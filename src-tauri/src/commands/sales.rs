use sqlx::{QueryBuilder, Sqlite, Transaction};
use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    models::{
        item::Item,
        sale::{
            CreateSaleInvoicePayload, Invoice, InvoiceDetail, InvoiceDetailRow, InvoiceFilters,
            InvoiceItem, InvoiceItemDetail, InvoiceItemPayload, InvoiceRow, InvoiceStats,
            InvoiceSummary,
        },
    },
};

#[derive(Debug, sqlx::FromRow)]
struct ActiveItem {
    id: i64,
    barcode: Option<String>,
    current_stock: i64,
    name_ar: String,
}

#[cfg_attr(not(test), allow(dead_code))]
#[derive(Clone, Copy)]
enum SaleFailPoint {
    AfterInvoiceItems,
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

fn compute_line_total(line: &InvoiceItemPayload) -> i64 {
    (line.unit_price_millieme * line.qty - line.discount_millieme).max(0)
}

fn session_not_open_error() -> AppError {
    AppError::new(
        "SESSION_NOT_OPEN",
        "الوردية غير مفتوحة",
        "Session is not open",
    )
}

fn item_not_found_error() -> AppError {
    AppError::new(
        "ITEM_NOT_FOUND",
        "الصنف غير موجود أو غير نشط",
        "Item not found or inactive",
    )
}

async fn ensure_open_session(
    tx: &mut Transaction<'_, Sqlite>,
    session_id: i64,
) -> Result<(), AppError> {
    let status: Option<(String,)> = sqlx::query_as("SELECT status FROM sessions WHERE id = ?")
        .bind(session_id)
        .fetch_optional(&mut **tx)
        .await?;

    match status {
        Some((status,)) if status == "open" => Ok(()),
        _ => Err(session_not_open_error()),
    }
}

async fn get_active_item(
    tx: &mut Transaction<'_, Sqlite>,
    item_id: i64,
) -> Result<ActiveItem, AppError> {
    sqlx::query_as::<_, ActiveItem>(
        "SELECT id, barcode, current_stock, name_ar FROM items WHERE id = ? AND is_active = 1",
    )
    .bind(item_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(item_not_found_error)
}

async fn get_invoice_by_id(pool: &DbPool, invoice_id: i64) -> Result<Invoice, AppError> {
    let invoice = sqlx::query_as::<_, InvoiceRow>("SELECT * FROM invoices WHERE id = ?")
        .bind(invoice_id)
        .fetch_one(pool)
        .await?;

    let items = sqlx::query_as::<_, InvoiceItem>(
        "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC",
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await?;

    Ok(invoice.with_items(items))
}

async fn search_items_impl(
    pool: &DbPool,
    query: Option<String>,
    category_id: Option<i64>,
) -> Result<Vec<Item>, AppError> {
    let mut sql = QueryBuilder::<Sqlite>::new("SELECT * FROM items WHERE is_active = 1");

    if let Some(query) = normalize_optional_string(query) {
        sql.push(" AND (name_ar LIKE ");
        sql.push_bind(format!("%{query}%"));
        sql.push(" OR barcode = ");
        sql.push_bind(query);
        sql.push(")");
    }

    if let Some(category_id) = category_id {
        sql.push(" AND category_id = ");
        sql.push_bind(category_id);
    }

    sql.push(" ORDER BY name_ar ASC LIMIT 100");

    sql.build_query_as::<Item>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn list_invoices_impl(
    pool: &DbPool,
    filters: InvoiceFilters,
) -> Result<Vec<InvoiceSummary>, AppError> {
    let mut query = QueryBuilder::<Sqlite>::new(
        r#"
        SELECT
          invoices.id,
          invoices.invoice_number,
          invoices.customer_id,
          customers.name AS customer_name,
          invoices.total_millieme,
          invoices.paid_millieme,
          invoices.payment_method,
          invoices.status,
          invoices.created_at
        FROM invoices
        LEFT JOIN customers ON customers.id = invoices.customer_id
        WHERE 1 = 1
        "#,
    );

    if let Some(date_from) = normalize_optional_string(filters.date_from) {
        query.push(" AND date(invoices.created_at) >= date(");
        query.push_bind(date_from);
        query.push(")");
    }

    if let Some(date_to) = normalize_optional_string(filters.date_to) {
        query.push(" AND date(invoices.created_at) <= date(");
        query.push_bind(date_to);
        query.push(")");
    }

    if let Some(customer_id) = filters.customer_id {
        query.push(" AND invoices.customer_id = ");
        query.push_bind(customer_id);
    }

    if let Some(customer_search) = normalize_optional_string(filters.customer_search) {
        query.push(" AND customers.name LIKE ");
        query.push_bind(format!("%{customer_search}%"));
    }

    if let Some(status) = normalize_optional_string(filters.status) {
        query.push(" AND invoices.status = ");
        query.push_bind(status);
    }

    if let Some(payment_method) = normalize_optional_string(filters.payment_method) {
        query.push(" AND invoices.payment_method = ");
        query.push_bind(payment_method);
    }

    let limit = filters.limit.unwrap_or(50).clamp(1, 1000);
    let offset = filters.offset.unwrap_or(0).max(0);

    query.push(" ORDER BY invoices.created_at DESC, invoices.id DESC LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    query
        .build_query_as::<InvoiceSummary>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn get_invoice_detail_impl(
    pool: &DbPool,
    invoice_id: i64,
) -> Result<InvoiceDetail, AppError> {
    let invoice = sqlx::query_as::<_, InvoiceDetailRow>(
        r#"
        SELECT
          invoices.id,
          invoices.invoice_number,
          invoices.customer_id,
          customers.name AS customer_name,
          invoices.session_id,
          invoices.cashier_id,
          invoices.subtotal_millieme,
          invoices.discount_millieme,
          invoices.tax_millieme,
          invoices.total_millieme,
          invoices.paid_millieme,
          invoices.payment_method,
          invoices.status,
          invoices.notes,
          invoices.created_at
        FROM invoices
        LEFT JOIN customers ON customers.id = invoices.customer_id
        WHERE invoices.id = ?
        "#,
    )
    .bind(invoice_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("الفاتورة"))?;

    let items = sqlx::query_as::<_, InvoiceItemDetail>(
        r#"
        SELECT
          id,
          invoice_id,
          item_id,
          item_name_ar,
          qty,
          unit_price_millieme,
          discount_millieme,
          total_millieme
        FROM invoice_items
        WHERE invoice_id = ?
        ORDER BY id ASC
        "#,
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await?;

    Ok(invoice.with_items(items))
}

async fn get_invoice_stats_impl(pool: &DbPool) -> Result<InvoiceStats, AppError> {
    sqlx::query_as::<_, InvoiceStats>(
        r#"
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
          COALESCE(SUM(CASE WHEN status IN ('deferred', 'partial') THEN 1 ELSE 0 END), 0) AS deferred_count,
          COALESCE(SUM(total_millieme), 0) AS total_sales_millieme
        FROM invoices
        "#,
    )
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

fn validate_payload(payload: &CreateSaleInvoicePayload) -> Result<(), AppError> {
    if payload.items.is_empty() {
        return Err(AppError::validation("أضف صنفًا واحدًا على الأقل"));
    }

    if payload.global_discount_millieme < 0 || payload.paid_millieme < 0 {
        return Err(AppError::validation("قيم المبالغ غير صحيحة"));
    }

    for item in &payload.items {
        if item.qty <= 0 || item.unit_price_millieme < 0 || item.discount_millieme < 0 {
            return Err(AppError::validation("بيانات الأصناف غير صحيحة"));
        }
    }

    Ok(())
}

fn sale_status_and_paid(
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

async fn create_sale_invoice_impl(
    pool: &DbPool,
    payload: CreateSaleInvoicePayload,
) -> Result<Invoice, AppError> {
    create_sale_invoice_impl_inner(pool, payload, None).await
}

async fn create_sale_invoice_impl_inner(
    pool: &DbPool,
    payload: CreateSaleInvoicePayload,
    #[cfg_attr(not(test), allow(unused_variables))] fail_point: Option<SaleFailPoint>,
) -> Result<Invoice, AppError> {
    create_sale_invoice_impl_tx(pool, payload, fail_point).await
}

async fn create_sale_invoice_impl_tx(
    pool: &DbPool,
    payload: CreateSaleInvoicePayload,
    #[cfg_attr(not(test), allow(unused_variables))] fail_point: Option<SaleFailPoint>,
) -> Result<Invoice, AppError> {
    validate_payload(&payload)?;

    let mut tx = pool.begin().await?;

    ensure_open_session(&mut tx, payload.session_id).await?;

    let mut validated_items = Vec::with_capacity(payload.items.len());
    for item in &payload.items {
        let active_item = get_active_item(&mut tx, item.item_id).await?;
        let _ = active_item.current_stock;
        validated_items.push(active_item);
    }

    let (invoice_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM invoices")
        .fetch_one(&mut *tx)
        .await?;
    let invoice_number = format!("INV-{:06}", invoice_count + 1);

    let subtotal_millieme: i64 = payload.items.iter().map(compute_line_total).sum();
    let total_millieme = (subtotal_millieme - payload.global_discount_millieme).max(0);
    let payment_method = payload.payment_method.trim().to_owned();
    let (status, paid_millieme) =
        sale_status_and_paid(&payment_method, payload.paid_millieme, total_millieme);
    let notes = normalize_optional_string(payload.notes);

    let result = sqlx::query(
        r#"
        INSERT INTO invoices (
          invoice_number,
          customer_id,
          session_id,
          subtotal_millieme,
          discount_millieme,
          tax_millieme,
          total_millieme,
          paid_millieme,
          payment_method,
          status,
          notes
        )
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&invoice_number)
    .bind(payload.customer_id)
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

    let invoice_id = result.last_insert_rowid();

    for (item, active_item) in payload.items.iter().zip(validated_items.iter()) {
        sqlx::query(
            r#"
            INSERT INTO invoice_items (
              invoice_id,
              item_id,
              barcode,
              item_name_ar,
              qty,
              unit_price_millieme,
              discount_millieme,
              total_millieme
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(invoice_id)
        .bind(item.item_id)
        .bind(&active_item.barcode)
        .bind(&active_item.name_ar)
        .bind(item.qty)
        .bind(item.unit_price_millieme)
        .bind(item.discount_millieme)
        .bind(compute_line_total(item))
        .execute(&mut *tx)
        .await?;
    }

    #[cfg(test)]
    if matches!(fail_point, Some(SaleFailPoint::AfterInvoiceItems)) {
        panic!("test failpoint after invoice_items");
    }

    for (payload_item, active_item) in payload.items.iter().zip(validated_items.iter()) {
        sqlx::query(
            "UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(payload_item.qty)
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
            VALUES (?, ?, 'sale', ?, 'invoice')
            "#,
        )
        .bind(active_item.id)
        .bind(-payload_item.qty)
        .bind(invoice_id)
        .execute(&mut *tx)
        .await?;
    }

    if payload.customer_id.is_some() && matches!(status, "deferred" | "partial") {
        let remaining_millieme = total_millieme - paid_millieme;
        sqlx::query("UPDATE customers SET balance_millieme = balance_millieme + ? WHERE id = ?")
            .bind(remaining_millieme)
            .bind(payload.customer_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    get_invoice_by_id(pool, invoice_id).await
}

#[tauri::command]
pub async fn search_items(
    pool: State<'_, DbPool>,
    query: Option<String>,
    category_id: Option<i64>,
) -> Result<Vec<Item>, AppError> {
    search_items_impl(&pool, query, category_id).await
}

#[tauri::command]
pub async fn list_invoices(
    pool: State<'_, DbPool>,
    filters: InvoiceFilters,
) -> Result<Vec<InvoiceSummary>, AppError> {
    list_invoices_impl(&pool, filters).await
}

#[tauri::command]
pub async fn get_invoice_detail(
    pool: State<'_, DbPool>,
    invoice_id: i64,
) -> Result<InvoiceDetail, AppError> {
    get_invoice_detail_impl(&pool, invoice_id).await
}

#[tauri::command]
pub async fn get_invoice_stats(pool: State<'_, DbPool>) -> Result<InvoiceStats, AppError> {
    get_invoice_stats_impl(&pool).await
}

#[tauri::command]
pub async fn create_sale_invoice(
    pool: State<'_, DbPool>,
    payload: CreateSaleInvoicePayload,
) -> Result<Invoice, AppError> {
    create_sale_invoice_impl(&pool, payload).await
}

#[cfg(test)]
mod tests {
    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        ConnectOptions,
    };

    use super::*;

    async fn test_pool() -> DbPool {
        let db_path = std::env::temp_dir().join(format!(
            "safqah-sales-test-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be valid")
                .as_nanos()
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
            .expect("sqlite test pool should initialize");

        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("migrations should run");

        pool
    }

    async fn insert_session(pool: &DbPool, status: &str) -> i64 {
        sqlx::query("INSERT INTO sessions (cashier_id, opening_cash_millieme, status) VALUES (1, 100000, ?)")
            .bind(status)
            .execute(pool)
            .await
            .expect("session should be inserted")
            .last_insert_rowid()
    }

    async fn insert_item(pool: &DbPool, barcode: &str, stock: i64, price: i64) -> i64 {
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
            VALUES (?, ?, 5000, ?, 'قطعة', ?, 1)
            "#,
        )
        .bind(barcode)
        .bind(format!("صنف {barcode}"))
        .bind(price)
        .bind(stock)
        .execute(pool)
        .await
        .expect("item should be inserted")
        .last_insert_rowid()
    }

    async fn insert_customer(pool: &DbPool, balance: i64) -> i64 {
        sqlx::query(
            "INSERT INTO customers (name, balance_millieme, credit_limit_millieme) VALUES ('عميل اختبار', ?, 50000)",
        )
        .bind(balance)
        .execute(pool)
        .await
        .expect("customer should be inserted")
        .last_insert_rowid()
    }

    fn payload(session_id: i64, items: Vec<InvoiceItemPayload>) -> CreateSaleInvoicePayload {
        CreateSaleInvoicePayload {
            session_id,
            customer_id: None,
            items,
            global_discount_millieme: 0,
            payment_method: "cash".to_owned(),
            paid_millieme: 0,
            notes: None,
        }
    }

    #[tokio::test]
    async fn create_sale_invoice_happy_path_writes_invoice_items_stock_and_movements() {
        let pool = test_pool().await;
        let session_id = insert_session(&pool, "open").await;
        let item_1 = insert_item(&pool, "111", 10, 10000).await;
        let item_2 = insert_item(&pool, "222", 20, 15000).await;

        let mut request = payload(
            session_id,
            vec![
                InvoiceItemPayload {
                    item_id: item_1,
                    qty: 2,
                    unit_price_millieme: 10000,
                    discount_millieme: 1000,
                },
                InvoiceItemPayload {
                    item_id: item_2,
                    qty: 3,
                    unit_price_millieme: 15000,
                    discount_millieme: 0,
                },
            ],
        );
        request.paid_millieme = 64000;

        let invoice = create_sale_invoice_impl(&pool, request)
            .await
            .expect("invoice should be created");

        assert_eq!(invoice.invoice_number, "INV-000001");
        assert_eq!(invoice.items.len(), 2);
        assert_eq!(invoice.subtotal_millieme, 64000);
        assert_eq!(invoice.total_millieme, 64000);
        assert_eq!(invoice.status, "paid");

        let (item_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM invoice_items WHERE invoice_id = ?")
                .bind(invoice.id)
                .fetch_one(&pool)
                .await
                .expect("invoice item count should be readable");
        assert_eq!(item_count, 2);

        let (stock_1,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_1)
            .fetch_one(&pool)
            .await
            .expect("stock should be readable");
        let (stock_2,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_2)
            .fetch_one(&pool)
            .await
            .expect("stock should be readable");
        assert_eq!(stock_1, 8);
        assert_eq!(stock_2, 17);

        let movements: Vec<(i64,)> = sqlx::query_as(
            "SELECT delta FROM stock_movements WHERE reference_id = ? ORDER BY item_id ASC",
        )
        .bind(invoice.id)
        .fetch_all(&pool)
        .await
        .expect("stock movements should be readable");
        assert_eq!(movements, vec![(-2,), (-3,)]);
    }

    #[tokio::test]
    async fn create_sale_invoice_rolls_back_invoice_items_and_stock_after_panic() {
        let pool = test_pool().await;
        let session_id = insert_session(&pool, "open").await;
        let item_id = insert_item(&pool, "333", 7, 12000).await;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 2,
                unit_price_millieme: 12000,
                discount_millieme: 0,
            }],
        );
        request.paid_millieme = 24000;

        let panic_pool = pool.clone();
        let result = tokio::spawn(async move {
            create_sale_invoice_impl_inner(
                &panic_pool,
                request,
                Some(SaleFailPoint::AfterInvoiceItems),
            )
            .await
        })
        .await;

        assert!(result.is_err(), "test failpoint should panic");

        let (invoice_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM invoices")
            .fetch_one(&pool)
            .await
            .expect("invoice count should be readable");
        assert_eq!(invoice_count, 0);

        let (item_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM invoice_items")
            .fetch_one(&pool)
            .await
            .expect("invoice item count should be readable");
        assert_eq!(item_count, 0);

        let (stock,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_one(&pool)
            .await
            .expect("stock should be readable");
        assert_eq!(stock, 7);
    }

    #[tokio::test]
    async fn create_sale_invoice_deferred_payment_updates_customer_balance() {
        let pool = test_pool().await;
        let session_id = insert_session(&pool, "open").await;
        let item_id = insert_item(&pool, "444", 5, 10000).await;
        let customer_id = insert_customer(&pool, 3000).await;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 2,
                unit_price_millieme: 10000,
                discount_millieme: 0,
            }],
        );
        request.customer_id = Some(customer_id);
        request.payment_method = "deferred".to_owned();
        request.paid_millieme = 20000;

        let invoice = create_sale_invoice_impl(&pool, request)
            .await
            .expect("deferred invoice should be created");

        assert_eq!(invoice.status, "deferred");
        assert_eq!(invoice.paid_millieme, 0);

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
                .bind(customer_id)
                .fetch_one(&pool)
                .await
                .expect("customer balance should be readable");
        assert_eq!(balance, 23000);
    }

    #[tokio::test]
    async fn create_sale_invoice_rejects_closed_or_missing_session_without_writes() {
        let pool = test_pool().await;
        let session_id = insert_session(&pool, "closed").await;
        let item_id = insert_item(&pool, "555", 5, 10000).await;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 1,
                unit_price_millieme: 10000,
                discount_millieme: 0,
            }],
        );
        request.paid_millieme = 10000;

        let error = create_sale_invoice_impl(&pool, request)
            .await
            .expect_err("closed session should fail");

        assert_eq!(error.code, "SESSION_NOT_OPEN");
        assert_eq!(error.message_ar, "الوردية غير مفتوحة");

        let (invoice_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM invoices")
            .fetch_one(&pool)
            .await
            .expect("invoice count should be readable");
        assert_eq!(invoice_count, 0);

        let missing_session_error = create_sale_invoice_impl(
            &pool,
            CreateSaleInvoicePayload {
                session_id: 999_999,
                customer_id: None,
                items: vec![InvoiceItemPayload {
                    item_id,
                    qty: 1,
                    unit_price_millieme: 10000,
                    discount_millieme: 0,
                }],
                global_discount_millieme: 0,
                payment_method: "cash".to_owned(),
                paid_millieme: 10000,
                notes: None,
            },
        )
        .await
        .expect_err("missing session should fail");

        assert_eq!(missing_session_error.code, "SESSION_NOT_OPEN");
    }
}
