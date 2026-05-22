use tauri::State;

use crate::{db::DbPool, errors::AppError, models::session::Session};

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

async fn get_session_by_id(pool: &DbPool, id: i64) -> Result<Session, AppError> {
    sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::new("SESSION_NOT_FOUND", "الوردية غير موجودة", "Session not found"))
}

async fn get_active_session_impl(pool: &DbPool) -> Result<Option<Session>, AppError> {
    sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

async fn open_session_impl(
    pool: &DbPool,
    opening_cash_millieme: i64,
) -> Result<Session, AppError> {
    if get_active_session_impl(pool).await?.is_some() {
        return Err(AppError::new(
            "SESSION_ALREADY_OPEN",
            "هناك وردية مفتوحة بالفعل",
            "There is already an open session",
        ));
    }

    let result = sqlx::query(
        r#"
        INSERT INTO sessions (
          cashier_id,
          opening_cash_millieme,
          status
        )
        VALUES (1, ?, 'open')
        "#,
    )
    .bind(opening_cash_millieme)
    .execute(pool)
    .await?;

    get_session_by_id(pool, result.last_insert_rowid()).await
}

async fn close_session_impl(
    pool: &DbPool,
    session_id: i64,
    closing_cash_millieme: i64,
    notes: Option<String>,
) -> Result<Session, AppError> {
    let result = sqlx::query(
        r#"
        UPDATE sessions
        SET
          status = 'closed',
          closed_at = datetime('now'),
          closing_cash_millieme = ?,
          notes = ?
        WHERE id = ? AND status = 'open'
        "#,
    )
    .bind(closing_cash_millieme)
    .bind(normalize_optional_string(notes))
    .bind(session_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::new(
            "SESSION_NOT_FOUND",
            "الوردية غير موجودة",
            "Session not found",
        ));
    }

    get_session_by_id(pool, session_id).await
}

async fn get_session_sales_total_millieme_impl(
    pool: &DbPool,
    session_id: i64,
) -> Result<i64, AppError> {
    let invoices_table_exists = sqlx::query_scalar::<_, String>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'invoices'",
    )
    .fetch_optional(pool)
    .await?
    .is_some();

    if !invoices_table_exists {
        return Ok(0);
    }

    let columns = sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('invoices')")
        .fetch_all(pool)
        .await?;

    let has_session_id = columns.iter().any(|column| column == "session_id");
    let has_total_millieme = columns.iter().any(|column| column == "total_millieme");

    if !has_session_id || !has_total_millieme {
        return Ok(0);
    }

    Ok(
        sqlx::query_scalar::<_, i64>(
            "SELECT COALESCE(SUM(total_millieme), 0) FROM invoices WHERE session_id = ?",
        )
        .bind(session_id)
        .fetch_one(pool)
        .await?,
    )
}

#[tauri::command]
pub async fn get_active_session(pool: State<'_, DbPool>) -> Result<Option<Session>, AppError> {
    get_active_session_impl(&pool).await
}

#[tauri::command]
pub async fn open_session(
    pool: State<'_, DbPool>,
    opening_cash_millieme: i64,
) -> Result<Session, AppError> {
    open_session_impl(&pool, opening_cash_millieme).await
}

#[tauri::command]
pub async fn close_session(
    pool: State<'_, DbPool>,
    session_id: i64,
    closing_cash_millieme: i64,
    notes: Option<String>,
) -> Result<Session, AppError> {
    close_session_impl(&pool, session_id, closing_cash_millieme, notes).await
}

#[tauri::command]
pub async fn get_session_sales_total_millieme(
    pool: State<'_, DbPool>,
    session_id: i64,
) -> Result<i64, AppError> {
    get_session_sales_total_millieme_impl(&pool, session_id).await
}
