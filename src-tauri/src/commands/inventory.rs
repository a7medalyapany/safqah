use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    models::{inventory::StockMovement, item::Item},
};

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

async fn adjust_stock_impl(
    pool: &DbPool,
    item_id: i64,
    new_qty: i64,
    reason: Option<String>,
) -> Result<Item, AppError> {
    let mut tx = pool.begin().await?;

    let (current_stock,): (i64,) = sqlx::query_as(
        "SELECT current_stock FROM items WHERE id = ? AND is_active = 1",
    )
    .bind(item_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::not_found("الصنف"))?;

    let delta = new_qty - current_stock;
    if delta == 0 {
        let item = sqlx::query_as::<_, Item>(
            "SELECT * FROM items WHERE id = ? AND is_active = 1",
        )
        .bind(item_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        return Ok(item);
    }

    let result = sqlx::query(
        "UPDATE items SET current_stock = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(new_qty)
    .bind(item_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("الصنف"));
    }

    let notes = normalize_optional_string(reason)
        .unwrap_or_else(|| "تسوية جرد يدوية".to_owned());

    sqlx::query(
        r#"
        INSERT INTO stock_movements (
          item_id, delta, movement_type, reference_id, reference_type, notes
        )
        VALUES (?, ?, 'adjustment', NULL, NULL, ?)
        "#,
    )
    .bind(item_id)
    .bind(delta)
    .bind(notes)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ? AND is_active = 1")
        .bind(item_id)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

async fn get_item_movements_impl(
    pool: &DbPool,
    item_id: i64,
    limit: Option<i64>,
) -> Result<Vec<StockMovement>, AppError> {
    let limit = limit.unwrap_or(20).clamp(1, 200);

    sqlx::query_as::<_, StockMovement>(
        r#"
        SELECT
          sm.*,
          CASE sm.movement_type
            WHEN 'sale' THEN (SELECT invoice_number FROM invoices WHERE id = sm.reference_id)
            WHEN 'purchase' THEN (SELECT invoice_number FROM purchase_invoices WHERE id = sm.reference_id)
            WHEN 'return' THEN (SELECT return_number FROM returns WHERE id = sm.reference_id)
            ELSE NULL
          END AS reference_number
        FROM stock_movements sm
        WHERE sm.item_id = ?
        ORDER BY sm.created_at DESC
        LIMIT ?
        "#,
    )
    .bind(item_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn get_item_movements(
    pool: State<'_, DbPool>,
    item_id: i64,
    limit: Option<i64>,
) -> Result<Vec<StockMovement>, AppError> {
    get_item_movements_impl(&pool, item_id, limit).await
}

#[tauri::command]
pub async fn adjust_stock(
    pool: State<'_, DbPool>,
    item_id: i64,
    new_qty: i64,
    reason: Option<String>,
) -> Result<Item, AppError> {
    adjust_stock_impl(&pool, item_id, new_qty, reason).await
}
