use std::collections::HashMap;

use sqlx::{QueryBuilder, Sqlite, Transaction};
use tauri::State;

use crate::{
    commands::settings::get_setting_value,
    db::DbPool,
    errors::AppError,
    models::{
        item::Item,
        sale::{
            CreateReturnPayload, CreateSaleInvoicePayload, Invoice, InvoiceDetail,
            InvoiceDetailRow, InvoiceFilters, InvoiceItem, InvoiceItemDetail, InvoiceItemPayload,
            InvoiceRow, InvoiceStats, InvoiceSummary, Return, ReturnItem, ReturnRow,
        },
    },
};

#[derive(Debug, sqlx::FromRow)]
struct ActiveItem {
    id: i64,
    barcode: Option<String>,
    buy_price_millieme: i64,
    current_stock: i64,
    name_ar: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct ReturnableInvoiceItem {
    id: i64,
    item_id: i64,
    qty: i64,
    unit_price_millieme: i64,
    /// Line total after the per-line discount (unit_price * qty - discount).
    total_millieme: i64,
}

/// Refund owed for returning `returned_qty` units of an invoice line, based on
/// what the customer actually paid. The line total is already net of the
/// per-line discount; scaling by `invoice_total / invoice_subtotal` prorates
/// the invoice-level (global) discount and tax too. Prorated for partial
/// returns; a full return of the whole invoice sums back to the invoice total.
fn return_line_refund_millieme(
    line: &ReturnableInvoiceItem,
    returned_qty: i64,
    invoice_subtotal_millieme: i64,
    invoice_total_millieme: i64,
) -> i64 {
    if line.qty <= 0 {
        return 0;
    }
    let numerator = (line.total_millieme as i128)
        * (returned_qty as i128)
        * (invoice_total_millieme as i128);
    let denominator = (line.qty as i128) * (invoice_subtotal_millieme.max(1) as i128);
    ((numerator + denominator / 2) / denominator) as i64
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
        "SELECT id, barcode, buy_price_millieme, current_stock, name_ar FROM items WHERE id = ? AND is_active = 1",
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
                    users.name AS cashier_name,
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
        LEFT JOIN users ON users.id = invoices.cashier_id
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
          COALESCE((
            SELECT SUM(return_items.qty)
            FROM return_items
            WHERE return_items.invoice_item_id = invoice_items.id
          ), 0) AS returned_qty,
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

pub(crate) async fn fetch_invoice_detail(
    pool: &DbPool,
    invoice_id: i64,
) -> Result<InvoiceDetail, AppError> {
    get_invoice_detail_impl(pool, invoice_id).await
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

fn return_exceeds_original_error() -> AppError {
    AppError::new(
        "RETURN_EXCEEDS_ORIGINAL",
        "كمية المرتجع أكبر من الكمية المباعة",
        "Return quantity exceeds original sold quantity",
    )
}

fn validate_return_payload(payload: &CreateReturnPayload) -> Result<String, AppError> {
    if payload.items.is_empty() {
        return Err(AppError::validation("اختر صنفًا واحدًا على الأقل للمرتجع"));
    }

    for item in &payload.items {
        if item.qty <= 0 {
            return Err(AppError::validation("كمية المرتجع غير صحيحة"));
        }
    }

    let refund_method = payload.refund_method.trim().to_owned();
    if !matches!(refund_method.as_str(), "cash" | "credit") {
        return Err(AppError::validation("طريقة رد المبلغ غير صحيحة"));
    }

    Ok(refund_method)
}

/// Resolves the invoice status, the amount recorded as paid, and how the
/// customer's balance should change.
///
/// Returns `(status, paid_millieme, balance_delta)` where a positive
/// `balance_delta` means the customer now owes us more (مديونية) and a negative
/// one means we owe the customer / they gained store credit (دائن). When no
/// customer is attached, `balance_delta` is always 0 (cash overpayment is
/// change handed back, not credit).
fn sale_status_and_paid(
    payment_method: &str,
    requested_paid: i64,
    total: i64,
    customer_present: bool,
) -> (&'static str, i64, i64) {
    match payment_method {
        // Cash always covers the full total (enforced in the UI). Any overpayment
        // is credited to the customer's balance when one is selected, otherwise
        // it is change returned from the drawer.
        "cash" => {
            let excess = (requested_paid - total).max(0);
            let balance_delta = if customer_present { -excess } else { 0 };
            ("paid", total, balance_delta)
        }
        // Deferred honours the "paid now" amount: the rest is recorded against the
        // customer's balance, and overpayment becomes store credit (negative delta).
        "deferred" => {
            let paid_millieme = requested_paid.clamp(0, total);
            let balance_delta = if customer_present {
                total - requested_paid
            } else {
                0
            };
            let status = if requested_paid >= total {
                "paid"
            } else if requested_paid > 0 {
                "partial"
            } else {
                "deferred"
            };
            (status, paid_millieme, balance_delta)
        }
        // Card / split must equal the total (enforced in the UI).
        _ => ("paid", total, 0),
    }
}

async fn load_text_setting(pool: &DbPool, key: &str, default: &str) -> Result<String, AppError> {
    Ok(get_setting_value(pool, key)
        .await?
        .and_then(|value| {
            let trimmed = value.trim().to_owned();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .unwrap_or_else(|| default.to_owned()))
}

async fn load_i64_setting(pool: &DbPool, key: &str, default: i64) -> Result<i64, AppError> {
    Ok(get_setting_value(pool, key)
        .await?
        .and_then(|value| value.trim().parse::<i64>().ok())
        .unwrap_or(default)
        .max(0))
}

fn build_document_number(prefix: &str, number: i64) -> String {
    format!("{}-{:06}", prefix.trim(), number)
}

fn calculate_tax_millieme(base_millieme: i64, tax_percent: i64) -> i64 {
    if base_millieme <= 0 || tax_percent <= 0 {
        0
    } else {
        (base_millieme * tax_percent + 50) / 100
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
    let invoice_prefix = load_text_setting(pool, "invoice_prefix", "INV").await?;
    let tax_percent = load_i64_setting(pool, "tax_percent", 0).await?;
    let invoice_number = build_document_number(&invoice_prefix, invoice_count + 1);

    let subtotal_millieme: i64 = payload.items.iter().map(compute_line_total).sum();
    let taxable_millieme = (subtotal_millieme - payload.global_discount_millieme).max(0);
    let tax_millieme = calculate_tax_millieme(taxable_millieme, tax_percent);
    let total_millieme = taxable_millieme + tax_millieme;

    let minimum_subtotal_millieme: i64 = payload
        .items
        .iter()
        .zip(validated_items.iter())
        .map(|(item, active_item)| active_item.buy_price_millieme * item.qty)
        .sum();

    for (item, active_item) in payload.items.iter().zip(validated_items.iter()) {
        let line_total_millieme = compute_line_total(item);
        let minimum_line_total_millieme = active_item.buy_price_millieme * item.qty;

        if line_total_millieme < minimum_line_total_millieme {
            return Err(AppError::validation("لا يمكن البيع بأقل من سعر التكلفة"));
        }
    }

    if taxable_millieme < minimum_subtotal_millieme {
        return Err(AppError::validation("الخصم يجعل إجمالي الفاتورة أقل من سعر التكلفة"));
    }

    let payment_method = payload.payment_method.trim().to_owned();
    let (status, paid_millieme, balance_delta) = sale_status_and_paid(
        &payment_method,
        payload.paid_millieme,
        total_millieme,
        payload.customer_id.is_some(),
    );
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&invoice_number)
    .bind(payload.customer_id)
    .bind(payload.session_id)
    .bind(subtotal_millieme)
    .bind(payload.global_discount_millieme)
    .bind(tax_millieme)
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
        // A test-only failpoint used to verify transaction rollback behavior without panicking.
        return Err(AppError::new(
            "TEST_FAILPOINT",
            "نقطة فشل للاختبار",
            "Test failpoint",
        ));
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

    if payload.customer_id.is_some() && balance_delta != 0 {
        sqlx::query("UPDATE customers SET balance_millieme = balance_millieme + ? WHERE id = ?")
            .bind(balance_delta)
            .bind(payload.customer_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    get_invoice_by_id(pool, invoice_id).await
}

pub(crate) async fn get_return_by_id(pool: &DbPool, return_id: i64) -> Result<Return, AppError> {
    let return_row = sqlx::query_as::<_, ReturnRow>("SELECT * FROM returns WHERE id = ?")
        .bind(return_id)
        .fetch_one(pool)
        .await?;

    let items = sqlx::query_as::<_, ReturnItem>(
        "SELECT * FROM return_items WHERE return_id = ? ORDER BY id ASC",
    )
    .bind(return_id)
    .fetch_all(pool)
    .await?;

    Ok(return_row.with_items(items))
}

async fn create_return_impl(
    pool: &DbPool,
    payload: CreateReturnPayload,
) -> Result<Return, AppError> {
    let refund_method = validate_return_payload(&payload)?;
    let mut tx = pool.begin().await?;

    ensure_open_session(&mut tx, payload.session_id).await?;

    let invoice: Option<(Option<i64>, String, i64, i64)> = sqlx::query_as(
        "SELECT customer_id, status, subtotal_millieme, total_millieme FROM invoices WHERE id = ?",
    )
    .bind(payload.original_invoice_id)
    .fetch_optional(&mut *tx)
    .await?;

    let (customer_id, invoice_status, invoice_subtotal_millieme, invoice_total_millieme) =
        invoice.ok_or_else(|| AppError::not_found("الفاتورة"))?;
    if invoice_status == "cancelled" {
        return Err(AppError::validation("لا يمكن تسجيل مرتجع لفاتورة ملغية"));
    }

    let mut requested_by_invoice_item: HashMap<i64, i64> = HashMap::new();
    for item in &payload.items {
        *requested_by_invoice_item
            .entry(item.invoice_item_id)
            .or_insert(0) += item.qty;
    }

    for (invoice_item_id, requested_qty) in &requested_by_invoice_item {
        let original: ReturnableInvoiceItem = sqlx::query_as(
            r#"
            SELECT id, item_id, qty, unit_price_millieme, total_millieme
            FROM invoice_items
            WHERE id = ? AND invoice_id = ?
            "#,
        )
        .bind(invoice_item_id)
        .bind(payload.original_invoice_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("صنف الفاتورة"))?;

        let (already_returned,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(qty), 0) FROM return_items WHERE invoice_item_id = ?",
        )
        .bind(invoice_item_id)
        .fetch_one(&mut *tx)
        .await?;

        if already_returned + *requested_qty > original.qty {
            return Err(return_exceeds_original_error());
        }
    }

    let mut validated_items = Vec::with_capacity(payload.items.len());
    for item in &payload.items {
        let original: ReturnableInvoiceItem = sqlx::query_as(
            r#"
            SELECT id, item_id, qty, unit_price_millieme, total_millieme
            FROM invoice_items
            WHERE id = ? AND item_id = ? AND invoice_id = ?
            "#,
        )
        .bind(item.invoice_item_id)
        .bind(item.item_id)
        .bind(payload.original_invoice_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("صنف الفاتورة"))?;

        validated_items.push(original);
    }

    let (return_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM returns")
        .fetch_one(&mut *tx)
        .await?;
    let return_prefix = load_text_setting(pool, "return_prefix", "RET").await?;
    let return_number = build_document_number(&return_prefix, return_count + 1);

    let total_millieme: i64 = payload
        .items
        .iter()
        .zip(validated_items.iter())
        .map(|(item, original)| {
            return_line_refund_millieme(
                original,
                item.qty,
                invoice_subtotal_millieme,
                invoice_total_millieme,
            )
        })
        .sum();
    let notes = normalize_optional_string(payload.notes);

    let result = sqlx::query(
        r#"
        INSERT INTO returns (
          return_number,
          original_invoice_id,
          session_id,
          total_millieme,
          refund_method,
          status,
          notes
        )
        VALUES (?, ?, ?, ?, ?, 'completed', ?)
        "#,
    )
    .bind(&return_number)
    .bind(payload.original_invoice_id)
    .bind(payload.session_id)
    .bind(total_millieme)
    .bind(&refund_method)
    .bind(notes)
    .execute(&mut *tx)
    .await?;

    let return_id = result.last_insert_rowid();

    for (item, original) in payload.items.iter().zip(validated_items.iter()) {
        let line_total = return_line_refund_millieme(
            original,
            item.qty,
            invoice_subtotal_millieme,
            invoice_total_millieme,
        );
        // Effective per-unit refund price (line discount + prorated global
        // discount/tax), for display consistency: full-line refund / qty.
        let effective_unit_price = if original.qty > 0 {
            return_line_refund_millieme(
                original,
                original.qty,
                invoice_subtotal_millieme,
                invoice_total_millieme,
            ) / original.qty
        } else {
            original.unit_price_millieme
        };

        sqlx::query(
            r#"
            INSERT INTO return_items (
              return_id,
              invoice_item_id,
              item_id,
              qty,
              unit_price_millieme,
              total_millieme
            )
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(return_id)
        .bind(original.id)
        .bind(original.item_id)
        .bind(item.qty)
        .bind(effective_unit_price)
        .bind(line_total)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(item.qty)
        .bind(original.item_id)
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
            VALUES (?, ?, 'return', ?, 'return')
            "#,
        )
        .bind(original.item_id)
        .bind(item.qty)
        .bind(return_id)
        .execute(&mut *tx)
        .await?;
    }

    if refund_method == "credit" {
        if let Some(customer_id) = customer_id {
            sqlx::query(
                "UPDATE customers SET balance_millieme = balance_millieme - ? WHERE id = ?",
            )
            .bind(total_millieme)
            .bind(customer_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    get_return_by_id(pool, return_id).await
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
    fetch_invoice_detail(&pool, invoice_id).await
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

#[tauri::command]
pub async fn create_return(
    pool: State<'_, DbPool>,
    payload: CreateReturnPayload,
) -> Result<Return, AppError> {
    create_return_impl(&pool, payload).await
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        ConnectOptions,
    };

    use crate::models::sale::ReturnItemPayload;

    use super::*;

    static TEST_DB_COUNTER: AtomicU64 = AtomicU64::new(0);

    async fn test_pool() -> Result<DbPool, AppError> {
        let db_path = std::env::temp_dir().join(format!(
            "safqah-sales-test-{}-{}.db",
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

    async fn insert_session(pool: &DbPool, status: &str) -> Result<i64, AppError> {
        sqlx::query("INSERT INTO sessions (cashier_id, opening_cash_millieme, status) VALUES (1, 100000, ?)")
            .bind(status)
            .execute(pool)
            .await
            .map(|result| result.last_insert_rowid())
            .map_err(Into::into)
    }

    async fn insert_item(pool: &DbPool, barcode: &str, stock: i64, price: i64) -> Result<i64, AppError> {
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
        .map(|result| result.last_insert_rowid())
        .map_err(Into::into)
    }

    async fn insert_customer(pool: &DbPool, balance: i64) -> Result<i64, AppError> {
        sqlx::query(
            "INSERT INTO customers (name, balance_millieme, credit_limit_millieme) VALUES ('عميل اختبار', ?, 50000)",
        )
        .bind(balance)
        .execute(pool)
        .await
        .map(|result| result.last_insert_rowid())
        .map_err(Into::into)
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
    async fn create_sale_invoice_happy_path_writes_invoice_items_stock_and_movements(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_1 = insert_item(&pool, "111", 10, 10000).await?;
        let item_2 = insert_item(&pool, "222", 20, 15000).await?;

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

        let invoice = create_sale_invoice_impl(&pool, request).await?;

        assert_eq!(invoice.invoice_number, "INV-000001");
        assert_eq!(invoice.items.len(), 2);
        assert_eq!(invoice.subtotal_millieme, 64000);
        assert_eq!(invoice.total_millieme, 64000);
        assert_eq!(invoice.status, "paid");

        let (item_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM invoice_items WHERE invoice_id = ?")
                .bind(invoice.id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(item_count, 2);

        let (stock_1,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_1)
            .fetch_one(&pool)
            .await?;
        let (stock_2,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_2)
            .fetch_one(&pool)
            .await?;
        assert_eq!(stock_1, 8);
        assert_eq!(stock_2, 17);

        let movements: Vec<(i64,)> = sqlx::query_as(
            "SELECT delta FROM stock_movements WHERE reference_id = ? ORDER BY item_id ASC",
        )
        .bind(invoice.id)
        .fetch_all(&pool)
        .await?;
        assert_eq!(movements, vec![(-2,), (-3,)]);

        Ok(())
    }

    #[tokio::test]
    async fn create_sale_invoice_rejects_below_cost_sales() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "112", 10, 10000).await?;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 1,
                unit_price_millieme: 10000,
                discount_millieme: 0,
            }],
        );
        request.global_discount_millieme = 6000;

        let error = create_sale_invoice_impl(&pool, request)
            .await
            .expect_err("below-cost sale should fail");

        assert_eq!(error.code, "VALIDATION_ERROR");
        assert_eq!(error.message_ar, "الخصم يجعل إجمالي الفاتورة أقل من سعر التكلفة");

        Ok(())
    }

    #[tokio::test]
    async fn create_sale_invoice_rolls_back_invoice_items_and_stock_after_failpoint(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "333", 7, 12000).await?;

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

        let err = create_sale_invoice_impl_inner(
            &pool,
            request,
            Some(SaleFailPoint::AfterInvoiceItems),
        )
        .await
        .expect_err("test failpoint should error");
        assert_eq!(err.code, "TEST_FAILPOINT");

        let (invoice_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM invoices")
            .fetch_one(&pool)
            .await?;
        assert_eq!(invoice_count, 0);

        let (item_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM invoice_items")
            .fetch_one(&pool)
            .await?;
        assert_eq!(item_count, 0);

        let (stock,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_one(&pool)
            .await?;
        assert_eq!(stock, 7);

        Ok(())
    }

    #[tokio::test]
    async fn create_sale_invoice_deferred_payment_updates_customer_balance(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "444", 5, 10000).await?;
        let customer_id = insert_customer(&pool, 3000).await?;

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
        request.paid_millieme = 0;

        let invoice = create_sale_invoice_impl(&pool, request).await?;

        assert_eq!(invoice.status, "deferred");
        assert_eq!(invoice.paid_millieme, 0);

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
                .bind(customer_id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(balance, 23000);

        Ok(())
    }

    #[tokio::test]
    async fn create_sale_invoice_deferred_partial_payment_records_paid_and_remaining(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "445", 5, 10000).await?;
        let customer_id = insert_customer(&pool, 3000).await?;

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
        request.paid_millieme = 12000; // total is 20000

        let invoice = create_sale_invoice_impl(&pool, request).await?;

        assert_eq!(invoice.status, "partial");
        assert_eq!(invoice.paid_millieme, 12000);

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
                .bind(customer_id)
                .fetch_one(&pool)
                .await?;
        // 3000 opening + (20000 - 12000) remaining owed
        assert_eq!(balance, 11000);

        Ok(())
    }

    #[tokio::test]
    async fn create_sale_invoice_cash_overpayment_credits_customer_balance(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "446", 5, 10000).await?;
        let customer_id = insert_customer(&pool, 0).await?;

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
        request.payment_method = "cash".to_owned();
        request.paid_millieme = 25000; // total is 20000 -> 5000 excess

        let invoice = create_sale_invoice_impl(&pool, request).await?;

        assert_eq!(invoice.status, "paid");
        // The invoice records the total as paid, not the inflated tendered amount.
        assert_eq!(invoice.paid_millieme, 20000);

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
                .bind(customer_id)
                .fetch_one(&pool)
                .await?;
        // Excess becomes store credit (negative balance = we owe the customer).
        assert_eq!(balance, -5000);

        Ok(())
    }

    #[tokio::test]
    async fn create_sale_invoice_cash_overpayment_without_customer_is_change(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "447", 5, 10000).await?;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 2,
                unit_price_millieme: 10000,
                discount_millieme: 0,
            }],
        );
        request.payment_method = "cash".to_owned();
        request.paid_millieme = 25000; // total is 20000

        let invoice = create_sale_invoice_impl(&pool, request).await?;

        assert_eq!(invoice.status, "paid");
        assert_eq!(invoice.paid_millieme, 20000);

        Ok(())
    }

    #[tokio::test]
    async fn create_sale_invoice_rejects_closed_or_missing_session_without_writes(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "closed").await?;
        let item_id = insert_item(&pool, "555", 5, 10000).await?;

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
            .await?;
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

        Ok(())
    }

    #[tokio::test]
    async fn create_return_restores_stock_and_writes_positive_movement() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "666", 10, 10000).await?;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 5,
                unit_price_millieme: 10000,
                discount_millieme: 0,
            }],
        );
        request.paid_millieme = 50000;
        let invoice = create_sale_invoice_impl(&pool, request).await?;

        let return_result = create_return_impl(
            &pool,
            CreateReturnPayload {
                original_invoice_id: invoice.id,
                session_id,
                items: vec![ReturnItemPayload {
                    invoice_item_id: invoice.items[0].id,
                    item_id,
                    qty: 2,
                }],
                refund_method: "cash".to_owned(),
                notes: None,
            },
        )
        .await?;

        assert_eq!(return_result.return_number, "RET-000001");
        assert_eq!(return_result.total_millieme, 20000);
        assert_eq!(return_result.items.len(), 1);

        let (stock,): (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_one(&pool)
            .await?;
        assert_eq!(stock, 7);

        let movement: (i64, String, String) = sqlx::query_as(
            r#"
            SELECT delta, movement_type, reference_type
            FROM stock_movements
            WHERE reference_id = ? AND movement_type = 'return'
            "#,
        )
        .bind(return_result.id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(movement, (2, "return".to_owned(), "return".to_owned()));

        Ok(())
    }

    #[tokio::test]
    async fn create_return_refunds_discounted_price_prorated() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "668", 10, 10000).await?;

        // 4 units @ 10000 with a 4000 line discount -> line total 36000 (9000/unit).
        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 4,
                unit_price_millieme: 10000,
                discount_millieme: 4000,
            }],
        );
        request.paid_millieme = 36000;
        let invoice = create_sale_invoice_impl(&pool, request).await?;

        let return_result = create_return_impl(
            &pool,
            CreateReturnPayload {
                original_invoice_id: invoice.id,
                session_id,
                items: vec![ReturnItemPayload {
                    invoice_item_id: invoice.items[0].id,
                    item_id,
                    qty: 2,
                }],
                refund_method: "cash".to_owned(),
                notes: None,
            },
        )
        .await?;

        // Discounted, prorated: 36000 * 2 / 4 = 18000 (NOT the pre-discount 20000).
        assert_eq!(return_result.total_millieme, 18000);
        assert_eq!(return_result.items[0].total_millieme, 18000);
        assert_eq!(return_result.items[0].unit_price_millieme, 9000);

        Ok(())
    }

    #[tokio::test]
    async fn create_return_refunds_after_invoice_level_discount() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "669", 10, 10000).await?;

        // 1 unit @ 18000, no line discount, but a 3000 invoice-level discount:
        // subtotal 18000 - 3000 = total 15000.
        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 1,
                unit_price_millieme: 18000,
                discount_millieme: 0,
            }],
        );
        request.global_discount_millieme = 3000;
        request.paid_millieme = 15000;
        let invoice = create_sale_invoice_impl(&pool, request).await?;
        assert_eq!(invoice.total_millieme, 15000);

        let return_result = create_return_impl(
            &pool,
            CreateReturnPayload {
                original_invoice_id: invoice.id,
                session_id,
                items: vec![ReturnItemPayload {
                    invoice_item_id: invoice.items[0].id,
                    item_id,
                    qty: 1,
                }],
                refund_method: "cash".to_owned(),
                notes: None,
            },
        )
        .await?;

        // Refund must reflect what was paid after the global discount: 15000, not 18000.
        assert_eq!(return_result.total_millieme, 15000);
        assert_eq!(return_result.items[0].total_millieme, 15000);

        Ok(())
    }

    #[tokio::test]
    async fn create_return_rejects_more_than_original_or_remaining_quantity(
    ) -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "777", 10, 10000).await?;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 5,
                unit_price_millieme: 10000,
                discount_millieme: 0,
            }],
        );
        request.paid_millieme = 50000;
        let invoice = create_sale_invoice_impl(&pool, request).await?;

        let too_much = create_return_impl(
            &pool,
            CreateReturnPayload {
                original_invoice_id: invoice.id,
                session_id,
                items: vec![ReturnItemPayload {
                    invoice_item_id: invoice.items[0].id,
                    item_id,
                    qty: 6,
                }],
                refund_method: "cash".to_owned(),
                notes: None,
            },
        )
        .await
        .expect_err("returning more than sold should fail");
        assert_eq!(too_much.code, "RETURN_EXCEEDS_ORIGINAL");
        assert_eq!(too_much.message_ar, "كمية المرتجع أكبر من الكمية المباعة");

        create_return_impl(
            &pool,
            CreateReturnPayload {
                original_invoice_id: invoice.id,
                session_id,
                items: vec![ReturnItemPayload {
                    invoice_item_id: invoice.items[0].id,
                    item_id,
                    qty: 5,
                }],
                refund_method: "cash".to_owned(),
                notes: None,
            },
        )
        .await?;

        let duplicate = create_return_impl(
            &pool,
            CreateReturnPayload {
                original_invoice_id: invoice.id,
                session_id,
                items: vec![ReturnItemPayload {
                    invoice_item_id: invoice.items[0].id,
                    item_id,
                    qty: 1,
                }],
                refund_method: "cash".to_owned(),
                notes: None,
            },
        )
        .await
        .expect_err("returning already returned units should fail");
        assert_eq!(duplicate.code, "RETURN_EXCEEDS_ORIGINAL");
        assert_eq!(duplicate.message_ar, "كمية المرتجع أكبر من الكمية المباعة");

        Ok(())
    }

    #[tokio::test]
    async fn create_return_credit_reduces_customer_balance() -> Result<(), AppError> {
        let pool = test_pool().await?;
        let session_id = insert_session(&pool, "open").await?;
        let item_id = insert_item(&pool, "888", 10, 10000).await?;
        let customer_id = insert_customer(&pool, 40000).await?;

        let mut request = payload(
            session_id,
            vec![InvoiceItemPayload {
                item_id,
                qty: 3,
                unit_price_millieme: 10000,
                discount_millieme: 0,
            }],
        );
        request.customer_id = Some(customer_id);
        request.payment_method = "deferred".to_owned();
        let invoice = create_sale_invoice_impl(&pool, request).await?;

        create_return_impl(
            &pool,
            CreateReturnPayload {
                original_invoice_id: invoice.id,
                session_id,
                items: vec![ReturnItemPayload {
                    invoice_item_id: invoice.items[0].id,
                    item_id,
                    qty: 2,
                }],
                refund_method: "credit".to_owned(),
                notes: None,
            },
        )
        .await?;

        let (balance,): (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
                .bind(customer_id)
                .fetch_one(&pool)
                .await?;
        assert_eq!(balance, 50000);

        Ok(())
    }
}
