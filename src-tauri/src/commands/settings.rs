use std::collections::HashMap;

use sqlx::Row;
use tauri::State;

use crate::{
    db::{database_file_path, DbPool},
    errors::AppError,
};

async fn settings_table_exists(pool: &DbPool) -> Result<bool, AppError> {
    let exists: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
    )
    .fetch_one(pool)
    .await?;

    Ok(exists.0 > 0)
}

pub async fn fetch_settings_map(pool: &DbPool) -> Result<HashMap<String, String>, AppError> {
    if !settings_table_exists(pool).await? {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query("SELECT key, value FROM settings")
        .fetch_all(pool)
        .await?;

    let mut settings = HashMap::with_capacity(rows.len());
    for row in rows {
        let key: String = row.try_get("key")?;
        let value: String = row.try_get("value")?;
        settings.insert(key, value);
    }

    Ok(settings)
}

pub async fn get_setting_value(pool: &DbPool, key: &str) -> Result<Option<String>, AppError> {
    if !settings_table_exists(pool).await? {
        return Ok(None);
    }

    let value = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;

    Ok(value)
}

#[tauri::command]
pub async fn get_settings(pool: State<'_, DbPool>) -> Result<HashMap<String, String>, AppError> {
    fetch_settings_map(&pool).await
}

#[tauri::command]
pub async fn update_settings(
    pool: State<'_, DbPool>,
    updates: HashMap<String, String>,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;

    for (key, value) in updates {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO settings (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            "#,
        )
        .bind(key)
        .bind(value)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(true)
}

#[tauri::command]
pub async fn get_setting(pool: State<'_, DbPool>, key: String) -> Result<Option<String>, AppError> {
    get_setting_value(&pool, &key).await
}

#[tauri::command]
pub async fn vacuum_database(pool: State<'_, DbPool>) -> Result<bool, AppError> {
    sqlx::query("VACUUM").execute(&*pool).await?;
    Ok(true)
}

#[tauri::command]
pub async fn get_db_file_size() -> Result<u64, AppError> {
    let path = database_file_path()?;
    let metadata = std::fs::metadata(path).map_err(|error| {
        AppError::new(
            "DB_FILE_SIZE_ERROR",
            "تعذر قراءة حجم قاعدة البيانات",
            &format!("Failed to read database file size: {error}"),
        )
    })?;
    Ok(metadata.len())
}
