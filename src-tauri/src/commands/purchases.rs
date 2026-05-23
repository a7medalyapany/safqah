use sqlx::{QueryBuilder, Sqlite, Transaction};
use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    models::purchase::{
        CreatePurchasePayload, PurchaseDetail, PurchaseDetailRow, PurchaseFilters, PurchaseInvoice,
        PurchaseInvoiceRow, PurchaseItem, PurchaseItemDetail, PurchaseItemPayload, PurchaseSummary,
    },
};

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PurchaseStats {
    total_count: i64,
    paid_count: i64,
    deferred_count: i64,
    total_purchases_millieme: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct ActiveItem {
    id: i64,
    _name_ar: String,
}

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

fn item_not_found_error() -> AppError {
    AppError::new(
        "ITEM_NOT_FOUND",
        "الصنف غير موجود أو غير نشط",
        "Item not found or inactive",
    )
}

async fn get_active_item(
    tx: &mut Transaction<'_, Sqlite>,
    item_id: i64,
) -> Result<ActiveItem, AppError> {
    sqlx::query_as::<_, ActiveItem>(
        "SELECT id, name_ar FROM items WHERE id = ? AND is_active = 1",
    )
    .bind(item_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(item_not_found_error)
}

async fn get_purchase_by_id(pool: &DbPool, purchase_id: i64) -> Result<PurchaseInvoice, AppError> {
    let purchase =
        sqlx::query_as::<_, PurchaseInvoiceRow>("SELECT * FROM purchase_invoices WHERE id = ?")
            .bind(purchase_id)
            .fetch_one(pool)
            .await?;

    let items = sqlx::query_as::<_, PurchaseItem>(
        "SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id ASC",
    )
    .bind(purchase_id)
    .fetch_all(pool)
    .await?;

    Ok(purchase.with_items(items))
}

fn compute_line_total(line: &PurchaseItemPayload) -> i64 {
    (line.unit_cost_millieme * line.qty).max(0)
}

fn validate_payload(payload: &CreatePurchasePayload) -> Result<(), AppError> {
    if payload.items.is_empty() {
        return Err(AppError::validation("أضف صنفًا واحدًا على الأقل"));
    }

    if payload.global_discount_millieme < 0 || payload.paid_millieme < 0 {
        return Err(AppError::validation("قيم المبالغ غير صحيحة"));
    }

    for item in &payload.items {
        if item.qty <= 0 || item.unit_cost_millieme < 0 {
            return Err(AppError::validation("بيانات الأصناف غير صحيحة"));
        }
    }

    Ok(())
}

fn purchase_status_and_paid(
    payment_method: &str,
    requested_paid: i64,
    total: i64,
) -> (&'static str, i64) {
    if payment_method == "deferred" {
        return ("deferred", 0);
    }

    if requested_paid >= total {
        ("paid", requested_paid)
    } else if requested_paid > 0 {
        ("partial", requested_paid)
    } else {
        ("deferred", 0)
    }
}

async fn list_purchases_impl(
    pool: &DbPool,
    filters: PurchaseFilters,
) -> Result<Vec<PurchaseSummary>, AppError> {
    let mut query = QueryBuilder::<Sqlite>::new(
        r#"
        SELECT
          purchase_invoices.id,
          purchase_invoices.invoice_number,
          purchase_invoices.supplier_id,
          suppliers.name AS supplier_name,
          purchase_invoices.total_millieme,
          purchase_invoices.paid_millieme,
          purchase_invoices.payment_method,
          purchase_invoices.status,
          purchase_invoices.created_at
        FROM purchase_invoices
        LEFT JOIN suppliers ON suppliers.id = purchase_invoices.supplier_id
        WHERE 1 = 1
        "#,
    );

    if let Some(date_from) = normalize_optional_string(filters.date_from) {
        query.push(" AND date(purchase_invoices.created_at) >= date(");
        query.push_bind(date_from);
        query.push(")");
    }

    if let Some(date_to) = normalize_optional_string(filters.date_to) {
        query.push(" AND date(purchase_invoices.created_at) <= date(");
        query.push_bind(date_to);
        query.push(")");
    }

    if let Some(supplier_id) = filters.supplier_id {
        query.push(" AND purchase_invoices.supplier_id = ");
        query.push_bind(supplier_id);
    }

    if let Some(status) = normalize_optional_string(filters.status) {
        query.push(" AND purchase_invoices.status = ");
        query.push_bind(status);
    }

    let limit = filters.limit.unwrap_or(50).clamp(1, 1000);
    let offset = filters.offset.unwrap_or(0).max(0);

    query.push(" ORDER BY purchase_invoices.created_at DESC, purchase_invoices.id DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    query
        .build_query_as::<PurchaseSummary>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn get_purchase_detail_impl(
    pool: &DbPool,
    purchase_id: i64,
) -> Result<PurchaseDetail, AppError> {
    let purchase = sqlx::query_as::<_, PurchaseDetailRow>(
        r#"
        SELECT
          purchase_invoices.id,
          purchase_invoices.invoice_number,
          purchase_invoices.supplier_id,
          suppliers.name AS supplier_name,
          purchase_invoices.session_id,
          purchase_invoices.subtotal_millieme,
          purchase_invoices.discount_millieme,
          purchase_invoices.total_millieme,
          purchase_invoices.paid_millieme,
          purchase_invoices.payment_method,
          purchase_invoices.status,
          purchase_invoices.notes,
          purchase_invoices.created_at
        FROM purchase_invoices
        LEFT JOIN suppliers ON suppliers.id = purchase_invoices.supplier_id
        WHERE purchase_invoices.id = ?
        "#,
    )
    .bind(purchase_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("الفاتورة"))?;

    let items = sqlx::query_as::<_, PurchaseItemDetail>(
        r#"
        SELECT
          purchase_items.id,
          purchase_items.purchase_id,
          purchase_items.item_id,
          items.name_ar AS item_name_ar,
          purchase_items.qty,
          purchase_items.unit_cost_millieme,
          purchase_items.suggested_sell_price_millieme,
          purchase_items.total_millieme
        FROM purchase_items
        JOIN items ON items.id = purchase_items.item_id
        WHERE purchase_items.purchase_id = ?
        ORDER BY purchase_items.id ASC
        "#,
    )
    .bind(purchase_id)
    .fetch_all(pool)
    .await?;

    Ok(purchase.with_items(items))
}

async fn create_purchase_invoice_impl(
    pool: &DbPool,
    payload: CreatePurchasePayload,
) -> Result<PurchaseInvoice, AppError> {
    validate_payload(&payload)?;

    let mut tx = pool.begin().await?;

    let mut validated_items = Vec::with_capacity(payload.items.len());
    for item in &payload.items {
        let active_item = get_active_item(&mut tx, item.item_id).await?;
        validated_items.push(active_item);
    }

    let (purchase_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM purchase_invoices")
            .fetch_one(&mut *tx)
            .await?;
    let invoice_number = format!("PUR-{:06}", purchase_count + 1);

    let subtotal_millieme: i64 = payload.items.iter().map(compute_line_total).sum();
    let total_millieme = (subtotal_millieme - payload.global_discount_millieme).max(0);
    let payment_method = payload.payment_method.trim().to_owned();
    let (status, paid_millieme) =
        purchase_status_and_paid(&payment_method, payload.paid_millieme, total_millieme);
    let notes = normalize_optional_string(payload.notes);

    let result = sqlx::query(
        r#"
        INSERT INTO purchase_invoices (
          invoice_number,
          supplier_id,
          session_id,
          subtotal_millieme,
          discount_millieme,
          total_millieme,
          paid_millieme,
          payment_method,
          status,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&invoice_number)
    .bind(payload.supplier_id)
    .bind(payload.session_id)
    .bind(subtotal_millieme)
    .bind(payload.global_discount_millieme)
    .bind(total_millieme)
    .bind(paid_millieme)
    .bind(&payment_method)
    .bind(status)
    .bind(notes)
    .execute(&mut *tx)
    .await?;

    let purchase_id = result.last_insert_rowid();

    for (item, active_item) in payload.items.iter().zip(validated_items.iter()) {
        let line_total = compute_line_total(item);
        sqlx::query(
            r#"
            INSERT INTO purchase_items (
              purchase_id,
              item_id,
              qty,
              unit_cost_millieme,
              suggested_sell_price_millieme,
              total_millieme
            )
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(purchase_id)
        .bind(item.item_id)
        .bind(item.qty)
        .bind(item.unit_cost_millieme)
        .bind(item.suggested_sell_price_millieme)
        .bind(line_total)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE items SET
              current_stock = current_stock + ?,
              buy_price_millieme = ?,
              updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(item.qty)
        .bind(item.unit_cost_millieme)
        .bind(active_item.id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO stock_movements (
              item_id,
              delta,
              movement_type,
              reference_id,
              reference_type
            )
            VALUES (?, ?, 'purchase', ?, 'purchase')
            "#,
        )
        .bind(active_item.id)
        .bind(item.qty)
        .bind(purchase_id)
        .execute(&mut *tx)
        .await?;
    }

    if payload.supplier_id.is_some() && matches!(status, "deferred" | "partial") {
        let remaining_millieme = total_millieme - paid_millieme;
        sqlx::query("UPDATE suppliers SET balance_millieme = balance_millieme + ? WHERE id = ?")
            .bind(remaining_millieme)
            .bind(payload.supplier_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    get_purchase_by_id(pool, purchase_id).await
}

async fn get_purchase_stats_impl(pool: &DbPool) -> Result<PurchaseStats, AppError> {
    sqlx::query_as::<_, PurchaseStats>(
        r#"
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
          COALESCE(SUM(CASE WHEN status IN ('deferred', 'partial') THEN 1 ELSE 0 END), 0) AS deferred_count,
          COALESCE(SUM(total_millieme), 0) AS total_purchases_millieme
        FROM purchase_invoices
        "#,
    )
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn list_purchases(
    pool: State<'_, DbPool>,
    filters: PurchaseFilters,
) -> Result<Vec<PurchaseSummary>, AppError> {
    list_purchases_impl(&pool, filters).await
}

#[tauri::command]
pub async fn get_purchase_detail(
    pool: State<'_, DbPool>,
    purchase_id: i64,
) -> Result<PurchaseDetail, AppError> {
    get_purchase_detail_impl(&pool, purchase_id).await
}

#[tauri::command]
pub async fn create_purchase_invoice(
    pool: State<'_, DbPool>,
    payload: CreatePurchasePayload,
) -> Result<PurchaseInvoice, AppError> {
    create_purchase_invoice_impl(&pool, payload).await
}

#[tauri::command]
pub async fn get_purchase_stats(pool: State<'_, DbPool>) -> Result<PurchaseStats, AppError> {
    get_purchase_stats_impl(&pool).await
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        ConnectOptions,
    };

    use super::*;

    static TEST_DB_COUNTER: AtomicU64 = AtomicU64::new(0);

    async fn test_pool() -> Result<DbPool, AppError> {
        let db_path = std::env::temp_dir().join(format!(
            "safqah-purchases-test-{}-{}.db",
            std::process::id(),
            TEST_DB_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .foreign_keys(true)
            .disable_statement_logging();

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .map_err(AppError::from)?;

        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .map_err(|e| {
                AppError::new(
                    "TEST_MIGRATE_FAILED",
                    "فشل تشغيل migrations للاختبار",
                    &format!("Test migrations failed: {e}"),
                )
            })?;

        Ok(pool)
    }

    async fn insert_item(pool: &DbPool, name: &str, stock: i64) -> Result<i64, AppError> {
        sqlx::query(
            r#"
            INSERT INTO items (
              barcode,
              name_ar,
              buy_price_millieme,
              sell_price_millieme,
              unit,
              current_stock,
              min_stock
            )
            VALUES (?, ?, 5000, 15000, 'قطعة', ?, 1)
            "#,
        )
        .bind(format!("{name}-barcode"))
        .bind(name)
        .bind(stock)
        .execute(pool)
        .await
        .map(|result| result.last_insert_rowid())
        .map_err(Into::into)
    }

    async fn insert_supplier(pool: &DbPool, balance: i64) -> Result<i64, AppError> {
        sqlx::query(
            "INSERT INTO suppliers (name, balance_millieme, is_active) VALUES ('مورد اختبار', ?, 1)",
        )
        .bind(balance)
        .execute(pool)
        .await
        .map(|result| result.last_insert_rowid())
        .map_err(Into::into)
    }

    #[tokio::test]
    async fn create_purchase_invoice_updates_stock_movements_and_buy_price() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_id = insert_item(&pool, "iPhone", 5).await?;

        let payload = CreatePurchasePayload {
            supplier_id: None,
            session_id: None,
            items: vec![PurchaseItemPayload {
                item_id,
                qty: 10,
                unit_cost_millieme: 12000,
                suggested_sell_price_millieme: None,
            }],
            global_discount_millieme: 0,
            payment_method: "cash".to_owned(),
            paid_millieme: 120000,
            notes: None,
        };

        let purchase = create_purchase_invoice_impl(&pool, payload).await?;
        assert_eq!(purchase.invoice_number, "PUR-000001");

        let (stock,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_one(&pool)
            .await?;
        assert_eq!(stock, 15);

        let movement: (i64, String) = sqlx::query_as(
            "SELECT delta, movement_type FROM stock_movements WHERE reference_id = ?",
        )
        .bind(purchase.id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(movement, (10, "purchase".to_owned()));

        let (buy_price,): (i64,) =
            sqlx::query_as("SELECT buy_price_millieme FROM items WHERE id = ?")
                .bind(item_id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(buy_price, 12000);

        Ok(())
    }

    #[tokio::test]
    async fn create_purchase_invoice_deferred_updates_supplier_balance() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_id = insert_item(&pool, "iPhone", 5).await?;
        let supplier_id = insert_supplier(&pool, 3000).await?;

        let payload = CreatePurchasePayload {
            supplier_id: Some(supplier_id),
            session_id: None,
            items: vec![PurchaseItemPayload {
                item_id,
                qty: 2,
                unit_cost_millieme: 10000,
                suggested_sell_price_millieme: None,
            }],
            global_discount_millieme: 0,
            payment_method: "deferred".to_owned(),
            paid_millieme: 20000,
            notes: None,
        };

        let purchase = create_purchase_invoice_impl(&pool, payload).await?;
        assert_eq!(purchase.status, "deferred");
        assert_eq!(purchase.paid_millieme, 0);

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM suppliers WHERE id = ?")
                .bind(supplier_id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(balance, 23000);

        Ok(())
    }
}
