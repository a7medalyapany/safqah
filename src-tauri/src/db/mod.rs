use std::{fs, path::PathBuf};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

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

    let options = SqliteConnectOptions::new()
        .filename(&path)
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

    Ok(pool)
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
            "safqah-test-data-{}",
            std::process::id()
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
