use sqlx::{QueryBuilder, Sqlite, Transaction};
use tauri::State;

use crate::{
    commands::util::{
        build_document_number, item_not_found_error, load_text_setting, normalize_optional_string,
    },
    db::DbPool,
    errors::AppError,
    models::purchase::{
        CreatePurchasePayload, PurchaseDetail, PurchaseDetailRow, PurchaseFilters, PurchaseInvoice,
        PurchaseInvoiceRow, PurchaseItem, PurchaseItemDetail, PurchaseItemPayload, PurchaseSummary,
        ItemPurchaseHistory, ItemBasePriceRow, LastItemPurchaseRow, ItemPurchaseStatsRow,
        UpdatePurchasePayload,
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
}

async fn get_active_item(
    tx: &mut Transaction<'_, Sqlite>,
    item_id: i64,
) -> Result<ActiveItem, AppError> {
    sqlx::query_as::<_, ActiveItem>(
        "SELECT id FROM items WHERE id = ? AND is_active = 1",
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

fn validate_purchase_input(
    items: &[PurchaseItemPayload],
    global_discount_millieme: i64,
    paid_millieme: i64,
) -> Result<(), AppError> {
    if items.is_empty() {
        return Err(AppError::validation("أضف صنفًا واحدًا على الأقل"));
    }

    if global_discount_millieme < 0 || paid_millieme < 0 {
        return Err(AppError::validation("قيم المبالغ غير صحيحة"));
    }

    for item in items {
        if item.qty <= 0 || item.unit_cost_millieme < 0 {
            return Err(AppError::validation("بيانات الأصناف غير صحيحة"));
        }
    }

    Ok(())
}

fn validate_payload(payload: &CreatePurchasePayload) -> Result<(), AppError> {
    validate_purchase_input(
        &payload.items,
        payload.global_discount_millieme,
        payload.paid_millieme,
    )
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

pub(crate) async fn get_purchase_detail_impl(
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
    let purchase_prefix = load_text_setting(pool, "purchase_prefix", "PUR").await?;
    let invoice_number = build_document_number(&purchase_prefix, purchase_count + 1);

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

async fn update_purchase_invoice_impl(
    pool: &DbPool,
    payload: UpdatePurchasePayload,
) -> Result<PurchaseInvoice, AppError> {
    validate_purchase_input(
        &payload.items,
        payload.global_discount_millieme,
        payload.paid_millieme,
    )?;

    let invoice_date = normalize_optional_string(payload.invoice_date);

    let mut tx = pool.begin().await?;

    // Load the existing invoice so we can reverse its previous effects.
    let existing = sqlx::query_as::<_, PurchaseInvoiceRow>(
        "SELECT * FROM purchase_invoices WHERE id = ?",
    )
    .bind(payload.purchase_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::not_found("الفاتورة"))?;

    let existing_items = sqlx::query_as::<_, PurchaseItem>(
        "SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id ASC",
    )
    .bind(payload.purchase_id)
    .fetch_all(&mut *tx)
    .await?;

    // Validate that every new line references an existing, active item before
    // mutating anything.
    let mut validated_items = Vec::with_capacity(payload.items.len());
    for item in &payload.items {
        let active_item = get_active_item(&mut tx, item.item_id).await?;
        validated_items.push(active_item);
    }

    // ── Reverse the old invoice's stock effects ──────────────────────────
    for old_item in &existing_items {
        sqlx::query(
            r#"
            UPDATE items SET
              current_stock = current_stock - ?,
              updated_at = datetime('now')
            WHERE id = ?
            "#,
        )
        .bind(old_item.qty)
        .bind(old_item.item_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO stock_movements (
              item_id,
              delta,
              movement_type,
              reference_id,
              reference_type,
              notes
            )
            VALUES (?, ?, 'adjustment', ?, 'purchase_edit', 'عكس فاتورة شراء عند التعديل')
            "#,
        )
        .bind(old_item.item_id)
        .bind(-old_item.qty)
        .bind(payload.purchase_id)
        .execute(&mut *tx)
        .await?;
    }

    // Reverse the old supplier balance impact (only deferred/partial added to it).
    if let Some(old_supplier_id) = existing.supplier_id {
        if matches!(existing.status.as_str(), "deferred" | "partial") {
            let old_remaining = existing.total_millieme - existing.paid_millieme;
            sqlx::query(
                "UPDATE suppliers SET balance_millieme = balance_millieme - ? WHERE id = ?",
            )
            .bind(old_remaining)
            .bind(old_supplier_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Remove the old line items; they are fully replaced below.
    sqlx::query("DELETE FROM purchase_items WHERE purchase_id = ?")
        .bind(payload.purchase_id)
        .execute(&mut *tx)
        .await?;

    // ── Apply the edited invoice ─────────────────────────────────────────
    let subtotal_millieme: i64 = payload.items.iter().map(compute_line_total).sum();
    let total_millieme = (subtotal_millieme - payload.global_discount_millieme).max(0);
    let payment_method = payload.payment_method.trim().to_owned();
    let (status, paid_millieme) =
        purchase_status_and_paid(&payment_method, payload.paid_millieme, total_millieme);
    let notes = normalize_optional_string(payload.notes);

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
        .bind(payload.purchase_id)
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
        .bind(payload.purchase_id)
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

    // Persist the invoice header. The invoice_number is immutable; created_at is
    // only changed when an explicit date override is supplied (otherwise it is left
    // out of the SET clause so the original timestamp is preserved).
    let mut update = QueryBuilder::<Sqlite>::new("UPDATE purchase_invoices SET supplier_id = ");
    update.push_bind(payload.supplier_id);
    update.push(", subtotal_millieme = ").push_bind(subtotal_millieme);
    update.push(", discount_millieme = ").push_bind(payload.global_discount_millieme);
    update.push(", total_millieme = ").push_bind(total_millieme);
    update.push(", paid_millieme = ").push_bind(paid_millieme);
    update.push(", payment_method = ").push_bind(payment_method.as_str());
    update.push(", status = ").push_bind(status);
    update.push(", notes = ").push_bind(notes);
    if let Some(date) = invoice_date {
        update.push(", created_at = ").push_bind(date);
    }
    update.push(" WHERE id = ").push_bind(payload.purchase_id);
    update.build().execute(&mut *tx).await?;

    tx.commit().await?;

    get_purchase_by_id(pool, payload.purchase_id).await
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

async fn get_item_purchase_history_impl(
        pool: &DbPool,
        item_id: i64,
) -> Result<ItemPurchaseHistory, AppError> {
        let item = sqlx::query_as::<_, ItemBasePriceRow>(
                r#"
                SELECT
                    id AS item_id,
                    name_ar,
                    buy_price_millieme AS current_buy_price_millieme,
                    sell_price_millieme AS current_sell_price_millieme
                FROM items
                WHERE id = ?
                "#,
        )
        .bind(item_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(item_not_found_error)?;

        let last_purchase = sqlx::query_as::<_, LastItemPurchaseRow>(
                r#"
                SELECT
                    pi2.unit_cost_millieme AS last_purchase_cost_millieme,
                    pi2.qty AS last_purchase_qty,
                    pu.name AS last_supplier_name,
                    p.created_at AS last_purchase_date
                FROM purchase_items pi2
                JOIN purchase_invoices p ON p.id = pi2.purchase_id
                LEFT JOIN suppliers pu ON pu.id = p.supplier_id
                WHERE pi2.item_id = ?
                ORDER BY p.created_at DESC, pi2.id DESC
                LIMIT 1
                "#,
        )
        .bind(item_id)
        .fetch_optional(pool)
        .await?;

        let stats = sqlx::query_as::<_, ItemPurchaseStatsRow>(
                r#"
                SELECT
                    COUNT(*) AS purchase_count,
                    CASE
                        WHEN COUNT(*) = 0 THEN NULL
                        ELSE CAST(ROUND(AVG(unit_cost_millieme)) AS INTEGER)
                    END AS avg_cost_millieme
                FROM purchase_items
                WHERE item_id = ?
                "#,
        )
        .bind(item_id)
        .fetch_one(pool)
        .await?;

        Ok(ItemPurchaseHistory {
                item_id: item.item_id,
                name_ar: item.name_ar,
                current_buy_price_millieme: item.current_buy_price_millieme,
                current_sell_price_millieme: item.current_sell_price_millieme,
                last_purchase_date: last_purchase.as_ref().map(|row| row.last_purchase_date.clone()),
                last_purchase_cost_millieme: last_purchase
                        .as_ref()
                        .map(|row| row.last_purchase_cost_millieme),
                last_purchase_qty: last_purchase.as_ref().map(|row| row.last_purchase_qty),
                last_supplier_name: last_purchase.and_then(|row| row.last_supplier_name),
                purchase_count: stats.purchase_count,
                avg_cost_millieme: stats.avg_cost_millieme,
        })
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
pub async fn update_purchase_invoice(
    pool: State<'_, DbPool>,
    payload: UpdatePurchasePayload,
) -> Result<PurchaseInvoice, AppError> {
    update_purchase_invoice_impl(&pool, payload).await
}

#[tauri::command]
pub async fn get_purchase_stats(pool: State<'_, DbPool>) -> Result<PurchaseStats, AppError> {
    get_purchase_stats_impl(&pool).await
}

#[tauri::command]
pub async fn get_item_purchase_history(
    pool: State<'_, DbPool>,
    item_id: i64,
) -> Result<ItemPurchaseHistory, AppError> {
    get_item_purchase_history_impl(&pool, item_id).await
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
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .foreign_keys(true)
            .disable_statement_logging();

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
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

        sqlx::query(
            "INSERT INTO users (id, name, username, password_hash, role) VALUES (1, 'Test Cashier', 'test_cashier', 'test_hash', 'cashier')",
        )
        .execute(&pool)
        .await?;

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

    async fn get_item_stock(pool: &DbPool, item_id: i64) -> Result<i64, AppError> {
        let (stock,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_one(pool)
            .await?;
        Ok(stock)
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

    #[tokio::test]
    async fn create_purchase_invoice_multiple_items_updates_stock() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_a = insert_item(&pool, "Item A", 5).await?;
        let item_b = insert_item(&pool, "Item B", 1).await?;
        let item_c = insert_item(&pool, "Item C", 0).await?;

        let payload = CreatePurchasePayload {
            supplier_id: None,
            session_id: None,
            items: vec![
                PurchaseItemPayload {
                    item_id: item_a,
                    qty: 3,
                    unit_cost_millieme: 8000,
                    suggested_sell_price_millieme: None,
                },
                PurchaseItemPayload {
                    item_id: item_b,
                    qty: 2,
                    unit_cost_millieme: 12000,
                    suggested_sell_price_millieme: None,
                },
                PurchaseItemPayload {
                    item_id: item_c,
                    qty: 7,
                    unit_cost_millieme: 5000,
                    suggested_sell_price_millieme: Some(9000),
                },
            ],
            global_discount_millieme: 0,
            payment_method: "cash".to_owned(),
            paid_millieme: 3 * 8000 + 2 * 12000 + 7 * 5000,
            notes: None,
        };

        let purchase = create_purchase_invoice_impl(&pool, payload).await?;
        assert_eq!(purchase.items.len(), 3);

        assert_eq!(get_item_stock(&pool, item_a).await?, 8);
        assert_eq!(get_item_stock(&pool, item_b).await?, 3);
        assert_eq!(get_item_stock(&pool, item_c).await?, 7);

        Ok(())
    }

    #[tokio::test]
    async fn create_purchase_invoice_partial_updates_supplier_balance() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_id = insert_item(&pool, "Item A", 0).await?;
        let supplier_id = insert_supplier(&pool, 1000).await?;

        let payload = CreatePurchasePayload {
            supplier_id: Some(supplier_id),
            session_id: None,
            items: vec![PurchaseItemPayload {
                item_id,
                qty: 4,
                unit_cost_millieme: 3000,
                suggested_sell_price_millieme: None,
            }],
            global_discount_millieme: 0,
            payment_method: "partial".to_owned(),
            paid_millieme: 6000,
            notes: None,
        };

        let purchase = create_purchase_invoice_impl(&pool, payload).await?;
        assert_eq!(purchase.status, "partial");
        assert_eq!(purchase.paid_millieme, 6000);

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM suppliers WHERE id = ?")
                .bind(supplier_id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(balance, 1000 + 6000);

        Ok(())
    }

    #[tokio::test]
    async fn update_purchase_invoice_recalculates_stock_and_totals() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_a = insert_item(&pool, "Item A", 5).await?;
        let item_b = insert_item(&pool, "Item B", 2).await?;

        // Original invoice: 4 of item_a only.
        let create_payload = CreatePurchasePayload {
            supplier_id: None,
            session_id: None,
            items: vec![PurchaseItemPayload {
                item_id: item_a,
                qty: 4,
                unit_cost_millieme: 10000,
                suggested_sell_price_millieme: None,
            }],
            global_discount_millieme: 0,
            payment_method: "cash".to_owned(),
            paid_millieme: 40000,
            notes: None,
        };
        let original = create_purchase_invoice_impl(&pool, create_payload).await?;
        assert_eq!(get_item_stock(&pool, item_a).await?, 9);

        // Edit: drop item_a to 1, add 3 of item_b, apply discount.
        let update_payload = UpdatePurchasePayload {
            purchase_id: original.id,
            supplier_id: None,
            items: vec![
                PurchaseItemPayload {
                    item_id: item_a,
                    qty: 1,
                    unit_cost_millieme: 11000,
                    suggested_sell_price_millieme: None,
                },
                PurchaseItemPayload {
                    item_id: item_b,
                    qty: 3,
                    unit_cost_millieme: 5000,
                    suggested_sell_price_millieme: Some(9000),
                },
            ],
            global_discount_millieme: 2000,
            payment_method: "cash".to_owned(),
            paid_millieme: 24000,
            notes: Some("معدلة".to_owned()),
            invoice_date: None,
        };
        let updated = update_purchase_invoice_impl(&pool, update_payload).await?;

        // Invoice number is preserved across edits.
        assert_eq!(updated.invoice_number, original.invoice_number);
        assert_eq!(updated.items.len(), 2);
        // subtotal = 1*11000 + 3*5000 = 26000; total = 26000 - 2000 = 24000.
        assert_eq!(updated.subtotal_millieme, 26000);
        assert_eq!(updated.total_millieme, 24000);
        assert_eq!(updated.status, "paid");
        assert_eq!(updated.notes.as_deref(), Some("معدلة"));

        // Stock: item_a reversed (-4) then +1 => 5 + 1 = 6. item_b +3 => 5.
        assert_eq!(get_item_stock(&pool, item_a).await?, 6);
        assert_eq!(get_item_stock(&pool, item_b).await?, 5);

        // Buy price reflects the latest edited cost.
        let (buy_price,): (i64,) =
            sqlx::query_as("SELECT buy_price_millieme FROM items WHERE id = ?")
                .bind(item_a)
                .fetch_one(&pool)
                .await?;
        assert_eq!(buy_price, 11000);

        Ok(())
    }

    #[tokio::test]
    async fn update_purchase_invoice_adjusts_supplier_balance() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_id = insert_item(&pool, "Item A", 0).await?;
        let supplier_id = insert_supplier(&pool, 1000).await?;

        // Deferred purchase adds remaining (20000) to supplier balance => 21000.
        let create_payload = CreatePurchasePayload {
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
            paid_millieme: 0,
            notes: None,
        };
        let original = create_purchase_invoice_impl(&pool, create_payload).await?;
        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM suppliers WHERE id = ?")
                .bind(supplier_id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(balance, 21000);

        // Edit to paid cash: old remaining reversed, nothing new added => back to 1000.
        let update_payload = UpdatePurchasePayload {
            purchase_id: original.id,
            supplier_id: Some(supplier_id),
            items: vec![PurchaseItemPayload {
                item_id,
                qty: 2,
                unit_cost_millieme: 10000,
                suggested_sell_price_millieme: None,
            }],
            global_discount_millieme: 0,
            payment_method: "cash".to_owned(),
            paid_millieme: 20000,
            notes: None,
            invoice_date: None,
        };
        let updated = update_purchase_invoice_impl(&pool, update_payload).await?;
        assert_eq!(updated.status, "paid");

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM suppliers WHERE id = ?")
                .bind(supplier_id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(balance, 1000);

        Ok(())
    }

    #[tokio::test]
    async fn purchase_stats_reflects_saved_invoices() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_a = insert_item(&pool, "Item A", 0).await?;
        let item_b = insert_item(&pool, "Item B", 0).await?;

        let payload_paid = CreatePurchasePayload {
            supplier_id: None,
            session_id: None,
            items: vec![PurchaseItemPayload {
                item_id: item_a,
                qty: 1,
                unit_cost_millieme: 10000,
                suggested_sell_price_millieme: None,
            }],
            global_discount_millieme: 0,
            payment_method: "cash".to_owned(),
            paid_millieme: 10000,
            notes: None,
        };
        create_purchase_invoice_impl(&pool, payload_paid).await?;

        let payload_deferred = CreatePurchasePayload {
            supplier_id: None,
            session_id: None,
            items: vec![PurchaseItemPayload {
                item_id: item_b,
                qty: 2,
                unit_cost_millieme: 5000,
                suggested_sell_price_millieme: None,
            }],
            global_discount_millieme: 0,
            payment_method: "deferred".to_owned(),
            paid_millieme: 0,
            notes: None,
        };
        create_purchase_invoice_impl(&pool, payload_deferred).await?;

        let stats = get_purchase_stats_impl(&pool).await?;
        assert_eq!(stats.total_count, 2);
        assert_eq!(stats.paid_count, 1);
        assert_eq!(stats.deferred_count, 1);
        assert_eq!(stats.total_purchases_millieme, 20000);

        Ok(())
    }

    #[tokio::test]
    async fn item_purchase_history_returns_empty_state_before_any_purchase() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_id = insert_item(&pool, "Test Item", 2).await?;

        let history = get_item_purchase_history_impl(&pool, item_id).await?;
        assert_eq!(history.item_id, item_id);
        assert_eq!(history.name_ar, "Test Item");
        assert_eq!(history.current_buy_price_millieme, 5000);
        assert_eq!(history.current_sell_price_millieme, 15000);
        assert_eq!(history.last_purchase_date, None);
        assert_eq!(history.last_purchase_cost_millieme, None);
        assert_eq!(history.last_purchase_qty, None);
        assert_eq!(history.last_supplier_name, None);
        assert_eq!(history.purchase_count, 0);
        assert_eq!(history.avg_cost_millieme, None);

        Ok(())
    }

    #[tokio::test]
    async fn item_purchase_history_returns_last_purchase_and_stats() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let item_id = insert_item(&pool, "Test Item", 0).await?;
        let supplier_id = insert_supplier(&pool, 0).await?;

        let first_purchase_id = sqlx::query(
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
              notes,
              created_at
            )
            VALUES ('PUR-000001', ?, NULL, 48000, 0, 48000, 48000, 'cash', 'paid', NULL, '2026-05-10 10:00:00')
            "#,
        )
        .bind(supplier_id)
        .execute(&pool)
        .await?
        .last_insert_rowid();

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
            VALUES (?, ?, 4, 12000, 20000, 48000)
            "#,
        )
        .bind(first_purchase_id)
        .bind(item_id)
        .execute(&pool)
        .await?;

        let second_purchase_id = sqlx::query(
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
              notes,
              created_at
            )
            VALUES ('PUR-000002', ?, NULL, 20000, 0, 20000, 20000, 'cash', 'paid', NULL, '2026-05-12 10:00:00')
            "#,
        )
        .bind(supplier_id)
        .execute(&pool)
        .await?
        .last_insert_rowid();

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
            VALUES (?, ?, 2, 10000, 19000, 20000)
            "#,
        )
        .bind(second_purchase_id)
        .bind(item_id)
        .execute(&pool)
        .await?;

        sqlx::query("UPDATE items SET buy_price_millieme = 10000 WHERE id = ?")
            .bind(item_id)
            .execute(&pool)
            .await?;

        let history = get_item_purchase_history_impl(&pool, item_id).await?;
        assert_eq!(history.purchase_count, 2);
        assert_eq!(history.avg_cost_millieme, Some(11000));
        assert_eq!(history.last_purchase_cost_millieme, Some(10000));
        assert_eq!(history.last_purchase_qty, Some(2));
        assert_eq!(history.last_supplier_name.as_deref(), Some("مورد اختبار"));
        assert!(history.last_purchase_date.is_some());
        assert_eq!(history.current_buy_price_millieme, 10000);

        Ok(())
    }
}
