use std::{fs, io, path::PathBuf};

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

pub async fn init_db() -> Result<DbPool, sqlx::Error> {
    let path = db_path()?;

    match initialize_pool(&path).await {
        Ok(pool) => Ok(pool),
        Err(error) => {
            if path.exists() {
                eprintln!("Resetting database at {:?} after initialization failure: {error}", path);
                remove_database_files(&path);
                let pool = initialize_pool(&path).await?;
                return Ok(pool);
            }

            Err(error)
        }
    }
}

fn remove_database_files(path: &PathBuf) {
    let _ = fs::remove_file(path);

    if let Some(file_name) = path.file_name().and_then(|value| value.to_str()) {
        if let Some(parent) = path.parent() {
            let wal_path = parent.join(format!("{file_name}-wal"));
            let shm_path = parent.join(format!("{file_name}-shm"));
            let journal_path = parent.join(format!("{file_name}-journal"));

            let _ = fs::remove_file(wal_path);
            let _ = fs::remove_file(shm_path);
            let _ = fs::remove_file(journal_path);
        }
    }
}

async fn initialize_pool(path: &PathBuf) -> Result<DbPool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true)
        .synchronous(SqliteSynchronous::Normal)
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
}
