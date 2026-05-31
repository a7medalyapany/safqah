use std::time::Instant;

use tauri::State;

use crate::{db::DbPool, errors::AppError};

#[derive(Debug, serde::Serialize)]
pub struct DailySalesReport {
    pub date: String,
    pub invoice_count: i64,
    pub total_millieme: i64,
    pub cash_millieme: i64,
    pub card_millieme: i64,
    pub deferred_millieme: i64,
    pub discount_millieme: i64,
    pub items_sold: i64,
    pub avg_invoice_millieme: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct DailySalesTotals {
    invoice_count: i64,
    total_millieme: i64,
    cash_millieme: i64,
    card_millieme: i64,
    deferred_millieme: i64,
    discount_millieme: i64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PeriodSalesRow {
    pub period_label: String,
    pub invoice_count: i64,
    pub total_millieme: i64,
    pub discount_millieme: i64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct TopItemRow {
    pub item_id: i64,
    pub name_ar: String,
    pub total_qty_sold: i64,
    pub total_revenue_millieme: i64,
    pub total_cost_millieme: i64,
    pub gross_profit_millieme: i64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct LowStockItem {
    pub item_id: i64,
    pub name_ar: String,
    pub current_stock: i64,
    pub min_stock: i64,
    pub shortage: i64,
    pub last_sale_date: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct ProfitReport {
    pub gross_revenue_millieme: i64,
    pub total_discount_millieme: i64,
    pub net_revenue_millieme: i64,
    pub cost_of_goods_millieme: i64,
    pub gross_profit_millieme: i64,
    pub total_expenses_millieme: i64,
    pub net_profit_millieme: i64,
    pub profit_margin_percent: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct RevenueTotals {
    gross_revenue_millieme: i64,
    total_discount_millieme: i64,
    net_revenue_millieme: i64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PaymentMethodRow {
    pub method: String,
    pub invoice_count: i64,
    pub total_millieme: i64,
    pub percentage: f64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct CustomerBalanceRow {
    pub customer_id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub balance_millieme: i64,
    pub deferred_invoice_count: i64,
    pub oldest_invoice_date: Option<String>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct SupplierBalanceRow {
    pub supplier_id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub balance_millieme: i64,
    pub deferred_invoice_count: i64,
    pub oldest_invoice_date: Option<String>,
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

fn log_slow_query(name: &str, start: Instant) {
    let elapsed = start.elapsed();
    if elapsed.as_millis() > 200 {
        eprintln!("SLOW QUERY: {name} took {}ms", elapsed.as_millis());
    }
}

async fn default_local_date(pool: &DbPool) -> Result<String, AppError> {
    sqlx::query_scalar::<_, String>("SELECT DATE(datetime('now', 'localtime'))")
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

async fn report_daily_sales_impl(
    pool: &DbPool,
    date: Option<String>,
) -> Result<DailySalesReport, AppError> {
    let report_date = match normalize_optional_string(date) {
        Some(date) => date,
        None => default_local_date(pool).await?,
    };

    let totals = sqlx::query_as::<_, DailySalesTotals>(
        r#"
        SELECT
          COUNT(*) AS invoice_count,
          COALESCE(SUM(total_millieme), 0) AS total_millieme,
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN paid_millieme ELSE 0 END), 0) AS cash_millieme,
          COALESCE(SUM(CASE WHEN payment_method = 'card' THEN paid_millieme ELSE 0 END), 0) AS card_millieme,
          COALESCE(SUM(total_millieme - paid_millieme), 0) AS deferred_millieme,
          COALESCE(SUM(discount_millieme), 0) AS discount_millieme
        FROM invoices
        WHERE DATE(created_at) = ?
          AND status != 'cancelled'
        "#,
    )
    .bind(&report_date)
    .fetch_one(pool)
    .await?;

    let items_sold = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(SUM(ii.qty), 0)
        FROM invoice_items ii
        JOIN invoices inv ON inv.id = ii.invoice_id
        WHERE DATE(inv.created_at) = ? AND inv.status != 'cancelled'
        "#,
    )
    .bind(&report_date)
    .fetch_one(pool)
    .await?;

    let avg_invoice_millieme = if totals.invoice_count > 0 {
        totals.total_millieme / totals.invoice_count
    } else {
        0
    };

    Ok(DailySalesReport {
        date: report_date,
        invoice_count: totals.invoice_count,
        total_millieme: totals.total_millieme,
        cash_millieme: totals.cash_millieme,
        card_millieme: totals.card_millieme,
        deferred_millieme: totals.deferred_millieme,
        discount_millieme: totals.discount_millieme,
        items_sold,
        avg_invoice_millieme,
    })
}

async fn report_sales_by_period_impl(
    pool: &DbPool,
    date_from: String,
    date_to: String,
    group_by: String,
) -> Result<Vec<PeriodSalesRow>, AppError> {
    let period_expression = match group_by.trim() {
        "day" => "DATE(created_at)",
        "week" => "STRFTIME('%Y-W%W', created_at)",
        "month" => "STRFTIME('%Y-%m', created_at)",
        _ => return Err(AppError::validation("تجميع التقرير غير صحيح")),
    };

    let sql = format!(
        r#"
        SELECT
          {period_expression} AS period_label,
          COUNT(*) AS invoice_count,
          COALESCE(SUM(total_millieme), 0) AS total_millieme,
          COALESCE(SUM(discount_millieme), 0) AS discount_millieme
        FROM invoices
        WHERE DATE(created_at) BETWEEN ? AND ?
          AND status != 'cancelled'
        GROUP BY {period_expression}
        ORDER BY period_label ASC
        "#
    );

    sqlx::query_as::<_, PeriodSalesRow>(&sql)
        .bind(date_from)
        .bind(date_to)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn report_top_items_impl(
    pool: &DbPool,
    date_from: Option<String>,
    date_to: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<TopItemRow>, AppError> {
    let date_from = normalize_optional_string(date_from);
    let date_to = normalize_optional_string(date_to);
    let limit = limit.unwrap_or(10).max(1);

    sqlx::query_as::<_, TopItemRow>(
        r#"
        SELECT
          ii.item_id,
          i.name_ar,
          COALESCE(SUM(ii.qty), 0) AS total_qty_sold,
          COALESCE(SUM(ii.total_millieme), 0) AS total_revenue_millieme,
          COALESCE(SUM(ii.qty * i.buy_price_millieme), 0) AS total_cost_millieme,
          COALESCE(SUM(ii.total_millieme), 0) - COALESCE(SUM(ii.qty * i.buy_price_millieme), 0) AS gross_profit_millieme
        FROM invoice_items ii
        JOIN items i ON i.id = ii.item_id
        JOIN invoices inv ON inv.id = ii.invoice_id
        WHERE inv.status != 'cancelled'
          AND (? IS NULL OR DATE(inv.created_at) >= ?)
          AND (? IS NULL OR DATE(inv.created_at) <= ?)
        GROUP BY ii.item_id, i.name_ar
        ORDER BY total_qty_sold DESC
        LIMIT ?
        "#,
    )
    .bind(&date_from)
    .bind(&date_from)
    .bind(&date_to)
    .bind(&date_to)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn report_low_stock_impl(
    pool: &DbPool,
    threshold: Option<i64>,
) -> Result<Vec<LowStockItem>, AppError> {
    sqlx::query_as::<_, LowStockItem>(
        r#"
        SELECT
          i.id AS item_id,
          i.name_ar,
          i.current_stock,
          i.min_stock,
          (i.min_stock - i.current_stock) AS shortage,
          DATE(MAX(inv.created_at)) AS last_sale_date
        FROM items i
        LEFT JOIN invoice_items ii ON ii.item_id = i.id
        LEFT JOIN invoices inv ON inv.id = ii.invoice_id AND inv.status != 'cancelled'
        WHERE i.is_active = 1
          AND i.current_stock <= COALESCE(?, i.min_stock)
        GROUP BY i.id, i.name_ar, i.current_stock, i.min_stock
        ORDER BY shortage DESC
        "#,
    )
    .bind(threshold)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn report_profit_analysis_impl(
    pool: &DbPool,
    date_from: String,
    date_to: String,
) -> Result<ProfitReport, AppError> {
    let revenue = sqlx::query_as::<_, RevenueTotals>(
        r#"
        SELECT
          COALESCE(SUM(total_millieme + discount_millieme), 0) AS gross_revenue_millieme,
          COALESCE(SUM(discount_millieme), 0) AS total_discount_millieme,
          COALESCE(SUM(total_millieme), 0) AS net_revenue_millieme
        FROM invoices
        WHERE DATE(created_at) BETWEEN ? AND ?
          AND status != 'cancelled'
        "#,
    )
    .bind(&date_from)
    .bind(&date_to)
    .fetch_one(pool)
    .await?;

    let cost_of_goods_millieme = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(SUM(ii.qty * i.buy_price_millieme), 0)
        FROM invoice_items ii
        JOIN items i ON i.id = ii.item_id
        JOIN invoices inv ON inv.id = ii.invoice_id
        WHERE DATE(inv.created_at) BETWEEN ? AND ?
          AND inv.status != 'cancelled'
        "#,
    )
    .bind(&date_from)
    .bind(&date_to)
    .fetch_one(pool)
    .await?;

    let total_expenses_millieme = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COALESCE(SUM(amount_millieme), 0)
        FROM expenses
        WHERE DATE(created_at) BETWEEN ? AND ?
        "#,
    )
    .bind(&date_from)
    .bind(&date_to)
    .fetch_one(pool)
    .await?;

    let gross_profit_millieme = revenue.net_revenue_millieme - cost_of_goods_millieme;
    let net_profit_millieme = gross_profit_millieme - total_expenses_millieme;
    let profit_margin_percent = if revenue.net_revenue_millieme > 0 {
        (net_profit_millieme as f64 / revenue.net_revenue_millieme as f64) * 100.0
    } else {
        0.0
    };

    Ok(ProfitReport {
        gross_revenue_millieme: revenue.gross_revenue_millieme,
        total_discount_millieme: revenue.total_discount_millieme,
        net_revenue_millieme: revenue.net_revenue_millieme,
        cost_of_goods_millieme,
        gross_profit_millieme,
        total_expenses_millieme,
        net_profit_millieme,
        profit_margin_percent,
    })
}

async fn report_payment_methods_impl(
    pool: &DbPool,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PaymentMethodRow>, AppError> {
    let date_from = normalize_optional_string(date_from);
    let date_to = normalize_optional_string(date_to);

    sqlx::query_as::<_, PaymentMethodRow>(
        r#"
        WITH method_totals AS (
          SELECT
            payment_method AS method,
            COUNT(*) AS invoice_count,
            COALESCE(SUM(total_millieme), 0) AS total_millieme
          FROM invoices
          WHERE status != 'cancelled'
            AND (? IS NULL OR DATE(created_at) >= ?)
            AND (? IS NULL OR DATE(created_at) <= ?)
          GROUP BY payment_method
        ),
        grand_total AS (
          SELECT COALESCE(SUM(total_millieme), 0) AS amount FROM method_totals
        )
        SELECT
          method,
          invoice_count,
          total_millieme,
          CASE
            WHEN grand_total.amount > 0 THEN (total_millieme * 100.0 / grand_total.amount)
            ELSE 0.0
          END AS percentage
        FROM method_totals, grand_total
        ORDER BY total_millieme DESC
        "#,
    )
    .bind(&date_from)
    .bind(&date_from)
    .bind(&date_to)
    .bind(&date_to)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn report_customer_balances_impl(
    pool: &DbPool,
) -> Result<Vec<CustomerBalanceRow>, AppError> {
    sqlx::query_as::<_, CustomerBalanceRow>(
        r#"
        SELECT
          c.id AS customer_id,
          c.name,
          c.phone,
          c.balance_millieme,
          COALESCE(COUNT(inv.id), 0) AS deferred_invoice_count,
          DATE(MIN(inv.created_at)) AS oldest_invoice_date
        FROM customers c
        LEFT JOIN invoices inv
          ON inv.customer_id = c.id
         AND inv.status != 'cancelled'
         AND inv.total_millieme > inv.paid_millieme
        WHERE c.balance_millieme > 0
        GROUP BY c.id, c.name, c.phone, c.balance_millieme
        ORDER BY c.balance_millieme DESC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn report_supplier_balances_impl(
    pool: &DbPool,
) -> Result<Vec<SupplierBalanceRow>, AppError> {
    sqlx::query_as::<_, SupplierBalanceRow>(
        r#"
        SELECT
          s.id AS supplier_id,
          s.name,
          s.phone,
          s.balance_millieme,
          COALESCE(COUNT(pi.id), 0) AS deferred_invoice_count,
          DATE(MIN(pi.created_at)) AS oldest_invoice_date
        FROM suppliers s
        LEFT JOIN purchase_invoices pi
          ON pi.supplier_id = s.id
         AND pi.total_millieme > pi.paid_millieme
        WHERE s.balance_millieme > 0
        GROUP BY s.id, s.name, s.phone, s.balance_millieme
        ORDER BY s.balance_millieme DESC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn report_daily_sales(
    pool: State<'_, DbPool>,
    date: Option<String>,
) -> Result<DailySalesReport, AppError> {
    let start = Instant::now();
    let result = report_daily_sales_impl(&pool, date).await;
    log_slow_query("report_daily_sales", start);
    result
}

#[tauri::command]
pub async fn report_sales_by_period(
    pool: State<'_, DbPool>,
    date_from: String,
    date_to: String,
    group_by: String,
) -> Result<Vec<PeriodSalesRow>, AppError> {
    let start = Instant::now();
    let result = report_sales_by_period_impl(&pool, date_from, date_to, group_by).await;
    log_slow_query("report_sales_by_period", start);
    result
}

#[tauri::command]
pub async fn report_top_items(
    pool: State<'_, DbPool>,
    date_from: Option<String>,
    date_to: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<TopItemRow>, AppError> {
    let start = Instant::now();
    let result = report_top_items_impl(&pool, date_from, date_to, limit).await;
    log_slow_query("report_top_items", start);
    result
}

#[tauri::command]
pub async fn report_low_stock(
    pool: State<'_, DbPool>,
    threshold: Option<i64>,
) -> Result<Vec<LowStockItem>, AppError> {
    let start = Instant::now();
    let result = report_low_stock_impl(&pool, threshold).await;
    log_slow_query("report_low_stock", start);
    result
}

#[tauri::command]
pub async fn report_profit_analysis(
    pool: State<'_, DbPool>,
    date_from: String,
    date_to: String,
) -> Result<ProfitReport, AppError> {
    let start = Instant::now();
    let result = report_profit_analysis_impl(&pool, date_from, date_to).await;
    log_slow_query("report_profit_analysis", start);
    result
}

#[tauri::command]
pub async fn report_payment_methods(
    pool: State<'_, DbPool>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PaymentMethodRow>, AppError> {
    let start = Instant::now();
    let result = report_payment_methods_impl(&pool, date_from, date_to).await;
    log_slow_query("report_payment_methods", start);
    result
}

#[tauri::command]
pub async fn report_customer_balances(
    pool: State<'_, DbPool>,
) -> Result<Vec<CustomerBalanceRow>, AppError> {
    let start = Instant::now();
    let result = report_customer_balances_impl(&pool).await;
    log_slow_query("report_customer_balances", start);
    result
}

#[tauri::command]
pub async fn report_supplier_balances(
    pool: State<'_, DbPool>,
) -> Result<Vec<SupplierBalanceRow>, AppError> {
    let start = Instant::now();
    let result = report_supplier_balances_impl(&pool).await;
    log_slow_query("report_supplier_balances", start);
    result
}
