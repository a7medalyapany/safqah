use std::{
    fs, io,
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

use crate::commands::auth::hash_password;

pub type DbPool = sqlx::SqlitePool;

fn db_path() -> Result<PathBuf, sqlx::Error> {
    let data_dir = dirs::data_dir().ok_or(sqlx::Error::Configuration(
        "Unable to resolve app data directory".into(),
    ))?;
    let app_dir = data_dir.join("pos");
    fs::create_dir_all(&app_dir).map_err(sqlx::Error::Io)?;
    Ok(app_dir.join("pos.db"))
}

pub fn database_file_path() -> Result<PathBuf, sqlx::Error> {
    db_path()
}

pub async fn init_db() -> Result<DbPool, sqlx::Error> {
    let path = db_path()?;

    match initialize_pool(&path).await {
        Ok(pool) => Ok(pool),
        Err(error) => {
            if path.exists() {
                // The database file exists but could not be opened/migrated. NEVER
                // delete it — for an accounting app that would silently destroy the
                // user's financial history. Instead, move it (and its WAL/SHM/journal
                // sidecars) aside to a timestamped `.corrupt-<ts>` backup so the data
                // can be recovered manually, then start fresh. If we cannot move it
                // safely, surface the original error rather than risk the data.
                match backup_database_files(&path) {
                    Ok(backup) => {
                        eprintln!(
                            "Database at {:?} failed to initialize ({error}); preserved a backup at {:?} and starting fresh.",
                            path, backup
                        );
                        let pool = initialize_pool(&path).await?;
                        return Ok(pool);
                    }
                    Err(backup_error) => {
                        eprintln!(
                            "Database at {:?} failed to initialize ({error}) and could not be backed up ({backup_error}); leaving it untouched.",
                            path
                        );
                        return Err(error);
                    }
                }
            }

            Err(error)
        }
    }
}

/// Renames the database file and its sidecars to a timestamped backup so a failed
/// initialization never destroys existing data. Returns the backup path of the main
/// database file on success.
fn backup_database_files(path: &PathBuf) -> Result<PathBuf, io::Error> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let backup_path = sidecar_path(path, &format!("corrupt-{timestamp}"));
    fs::rename(path, &backup_path)?;

    // Best-effort for the sidecars: they are only valid alongside the main file, so
    // failing to move them is not fatal once the main file is safely renamed.
    for suffix in ["wal", "shm", "journal"] {
        let sidecar = sidecar_path(path, suffix);
        if sidecar.exists() {
            let _ = fs::rename(&sidecar, sidecar_path(&backup_path, suffix));
        }
    }

    Ok(backup_path)
}

/// Builds a sibling path by appending `-<suffix>` to the file name (e.g. `pos.db-wal`).
fn sidecar_path(path: &PathBuf, suffix: &str) -> PathBuf {
    let mut name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("pos.db")
        .to_owned();
    name.push('-');
    name.push_str(suffix);

    match path.parent() {
        Some(parent) => parent.join(name),
        None => PathBuf::from(name),
    }
}

async fn initialize_pool(path: &PathBuf) -> Result<DbPool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(5))
        .pragma("cache_size", "-64000")
        .pragma("temp_store", "MEMORY");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    sqlx::migrate!("./src/db/migrations").run(&pool).await?;
    ensure_default_admin(&pool).await?;

    Ok(pool)
}

async fn ensure_default_admin(pool: &DbPool) -> Result<(), sqlx::Error> {
    let (user_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    let (admin_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM users WHERE username = 'admin'",
    )
    .fetch_one(pool)
    .await?;

    if user_count == 0 || admin_count == 0 {
        let password_hash = hash_password("admin123")
            .map_err(|error| sqlx::Error::Io(io::Error::new(io::ErrorKind::Other, error.message_en)))?;

        sqlx::query(
            r#"
            INSERT INTO users (name, username, password_hash, role, is_active)
            VALUES (?, ?, ?, 'admin', 1)
            "#,
        )
        .bind("المدير")
        .bind("admin")
        .bind(password_hash)
        .execute(pool)
        .await?;

        println!("Default admin created: username=admin password=admin123");
    }

    Ok(())
}

pub async fn get_pool() -> DbPool {
    init_db()
        .await
        .expect("failed to initialize SQLite database")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn init_db_creates_wal_database() {
        let test_data_home = std::env::temp_dir().join(format!(
            "safqah-test-data-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be valid")
                .as_nanos()
        ));
        std::fs::create_dir_all(&test_data_home).expect("temp data dir should be writable");
        std::env::set_var("XDG_DATA_HOME", &test_data_home);

        let path = db_path().expect("db path should resolve");
        let pool = init_db().await.expect("db should initialize");

        let (journal_mode,): (String,) = sqlx::query_as("PRAGMA journal_mode;")
            .fetch_one(&pool)
            .await
            .expect("should read journal mode");

        assert_eq!(journal_mode, "wal");
        assert!(path.exists(), "database file should exist at {:?}", path);
    }

    #[test]
    fn backup_database_files_preserves_data_instead_of_deleting() {
        let dir = std::env::temp_dir().join(format!(
            "safqah-backup-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be valid")
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir should be writable");

        let db = dir.join("pos.db");
        let payload = b"precious financial history";
        std::fs::write(&db, payload).expect("should write fake db");
        std::fs::write(sidecar_path(&db, "wal"), b"wal").expect("should write wal");

        let backup = backup_database_files(&db).expect("backup should succeed");

        // The original must be gone *because it was moved*, never silently destroyed.
        assert!(!db.exists(), "original db should be renamed away");
        assert!(backup.exists(), "backup should exist at {:?}", backup);
        assert_eq!(
            std::fs::read(&backup).expect("backup should be readable"),
            payload,
            "backed-up data must be byte-for-byte preserved"
        );
        assert!(
            sidecar_path(&backup, "wal").exists(),
            "wal sidecar should be moved alongside the backup"
        );
    }
}
