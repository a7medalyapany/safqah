use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    models::finance::{
        CashSummary, CustomerLedger, DeferredInvoice, DeferredInvoiceSummary, Expense,
        ExpenseCategory, ExpenseWithCategory, Payment, PaymentWithEntity,
    },
    models::sale::InvoiceRow,
};

// ── helpers ──────────────────────────────────────────────────────────────────

async fn get_customer_exists(
    executor: impl sqlx::Executor<'_, Database = sqlx::Sqlite>,
    id: i64,
) -> Result<bool, AppError> {
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM customers WHERE id = ? AND is_active = 1",
    )
    .bind(id)
    .fetch_one(executor)
    .await?;
    Ok(exists > 0)
}

async fn get_supplier_exists(
    executor: impl sqlx::Executor<'_, Database = sqlx::Sqlite>,
    id: i64,
) -> Result<bool, AppError> {
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM suppliers WHERE id = ? AND is_active = 1",
    )
    .bind(id)
    .fetch_one(executor)
    .await?;
    Ok(exists > 0)
}

// ── create_expense ──────────────────────────────────────────────────────────

async fn create_expense_impl(
    pool: &DbPool,
    amount_millieme: i64,
    category_id: Option<i64>,
    description: Option<String>,
    session_id: Option<i64>,
) -> Result<Expense, AppError> {
    if amount_millieme <= 0 {
        return Err(AppError::validation("المبلغ يجب أن يكون أكبر من صفر"));
    }

    let result = sqlx::query(
        r#"
        INSERT INTO expenses (amount_millieme, category_id, description, session_id)
        VALUES (?, ?, ?, ?)
        "#,
    )
    .bind(amount_millieme)
    .bind(category_id)
    .bind(description)
    .bind(session_id)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, Expense>("SELECT * FROM expenses WHERE id = ?")
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

// ── list_expenses ───────────────────────────────────────────────────────────

async fn list_expenses_impl(
    pool: &DbPool,
    date_from: Option<String>,
    date_to: Option<String>,
    category_id: Option<i64>,
) -> Result<Vec<ExpenseWithCategory>, AppError> {
    let mut query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
        r#"
        SELECT
          e.id,
          e.amount_millieme,
          e.category_id,
          c.name_ar AS category_name_ar,
          e.description,
          e.session_id,
          e.created_by,
          e.created_at
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE 1 = 1
        "#,
    );

    if let Some(date_from) = date_from {
        query.push(" AND e.created_at >= ");
        query.push_bind(date_from);
    }

    if let Some(date_to) = date_to {
        query.push(" AND e.created_at <= ");
        query.push_bind(date_to);
    }

    if let Some(category_id) = category_id {
        query.push(" AND e.category_id = ");
        query.push_bind(category_id);
    }

    query.push(" ORDER BY e.created_at DESC");

    query
        .build_query_as::<ExpenseWithCategory>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

// ── list_expense_categories ─────────────────────────────────────────────────

async fn list_expense_categories_impl(pool: &DbPool) -> Result<Vec<ExpenseCategory>, AppError> {
    sqlx::query_as::<_, ExpenseCategory>("SELECT * FROM expense_categories ORDER BY id ASC")
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

// ── get_cash_summary ────────────────────────────────────────────────────────

async fn get_cash_summary_impl(
    pool: &DbPool,
    session_id: Option<i64>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<CashSummary, AppError> {
    let mut sales_query = String::from(
        "SELECT COALESCE(SUM(paid_millieme), 0) FROM invoices WHERE 1 = 1",
    );
    let mut expenses_query = String::from(
        "SELECT COALESCE(SUM(amount_millieme), 0) FROM expenses WHERE 1 = 1",
    );
    let mut payments_out_query = String::from(
        "SELECT COALESCE(SUM(amount_millieme), 0) FROM payments WHERE direction = 'out'",
    );
    let mut payments_in_query = String::from(
        "SELECT COALESCE(SUM(amount_millieme), 0) FROM payments WHERE direction = 'in'",
    );

    if let Some(sid) = session_id {
        let clause = format!(" AND session_id = {sid}");
        sales_query.push_str(&clause);
        expenses_query.push_str(&clause);
        payments_out_query.push_str(&clause);
        payments_in_query.push_str(&clause);
    }

    if let Some(ref date_from) = date_from {
        let clause = format!(" AND created_at >= '{date_from}'");
        sales_query.push_str(&clause);
        expenses_query.push_str(&clause);
        payments_out_query.push_str(&clause);
        payments_in_query.push_str(&clause);
    }

    if let Some(ref date_to) = date_to {
        let clause = format!(" AND created_at <= '{date_to}'");
        sales_query.push_str(&clause);
        expenses_query.push_str(&clause);
        payments_out_query.push_str(&clause);
        payments_in_query.push_str(&clause);
    }

    let total_sales_cash_millieme =
        sqlx::query_scalar::<_, i64>(&sales_query).fetch_one(pool).await?;
    let total_expenses_millieme =
        sqlx::query_scalar::<_, i64>(&expenses_query).fetch_one(pool).await?;
    let total_payments_out_millieme =
        sqlx::query_scalar::<_, i64>(&payments_out_query).fetch_one(pool).await?;
    let total_payments_in_millieme =
        sqlx::query_scalar::<_, i64>(&payments_in_query).fetch_one(pool).await?;

    let net_cash_millieme = total_sales_cash_millieme
        - total_expenses_millieme
        - total_payments_out_millieme
        + total_payments_in_millieme;

    Ok(CashSummary {
        total_sales_cash_millieme,
        total_expenses_millieme,
        total_payments_out_millieme,
        total_payments_in_millieme,
        net_cash_millieme,
    })
}

// ── record_customer_payment ─────────────────────────────────────────────────

async fn record_customer_payment_impl(
    pool: &DbPool,
    customer_id: i64,
    amount_millieme: i64,
    method: String,
    notes: Option<String>,
    session_id: Option<i64>,
) -> Result<Payment, AppError> {
    if amount_millieme <= 0 {
        return Err(AppError::validation("المبلغ يجب أن يكون أكبر من صفر"));
    }

    let mut tx = pool.begin().await?;

    let customer_exists = get_customer_exists(&mut *tx, customer_id).await?;
    if !customer_exists {
        return Err(AppError::not_found("العميل"));
    }

    let result = sqlx::query(
        r#"
        INSERT INTO payments (entity_type, entity_id, amount_millieme, direction, method, notes, session_id)
        VALUES ('customer', ?, ?, 'in', ?, ?, ?)
        "#,
    )
    .bind(customer_id)
    .bind(amount_millieme)
    .bind(&method)
    .bind(notes)
    .bind(session_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE customers SET balance_millieme = balance_millieme - ? WHERE id = ?",
    )
    .bind(amount_millieme)
    .bind(customer_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    sqlx::query_as::<_, Payment>("SELECT * FROM payments WHERE id = ?")
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

// ── record_supplier_payment ─────────────────────────────────────────────────

async fn record_supplier_payment_impl(
    pool: &DbPool,
    supplier_id: i64,
    amount_millieme: i64,
    method: String,
    notes: Option<String>,
    session_id: Option<i64>,
) -> Result<Payment, AppError> {
    if amount_millieme <= 0 {
        return Err(AppError::validation("المبلغ يجب أن يكون أكبر من صفر"));
    }

    let mut tx = pool.begin().await?;

    let supplier_exists = get_supplier_exists(&mut *tx, supplier_id).await?;
    if !supplier_exists {
        return Err(AppError::not_found("المورد"));
    }

    let result = sqlx::query(
        r#"
        INSERT INTO payments (entity_type, entity_id, amount_millieme, direction, method, notes, session_id)
        VALUES ('supplier', ?, ?, 'out', ?, ?, ?)
        "#,
    )
    .bind(supplier_id)
    .bind(amount_millieme)
    .bind(&method)
    .bind(notes)
    .bind(session_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE suppliers SET balance_millieme = balance_millieme - ? WHERE id = ?",
    )
    .bind(amount_millieme)
    .bind(supplier_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    sqlx::query_as::<_, Payment>("SELECT * FROM payments WHERE id = ?")
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

// ── list_payments ───────────────────────────────────────────────────────────

async fn list_payments_impl(
    pool: &DbPool,
    direction: Option<String>,
    entity_type: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PaymentWithEntity>, AppError> {
    let mut query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
        r#"
        SELECT
          p.id,
          p.entity_type,
          p.entity_id,
          COALESCE(c.name, s.name) AS entity_name,
          p.amount_millieme,
          p.direction,
          p.method,
          p.reference_invoice_id,
          p.notes,
          p.session_id,
          p.created_at
        FROM payments p
        LEFT JOIN customers c ON p.entity_type = 'customer' AND p.entity_id = c.id
        LEFT JOIN suppliers s ON p.entity_type = 'supplier' AND p.entity_id = s.id
        WHERE 1 = 1
        "#,
    );

    if let Some(direction) = direction {
        query.push(" AND p.direction = ");
        query.push_bind(direction);
    }

    if let Some(entity_type) = entity_type {
        query.push(" AND p.entity_type = ");
        query.push_bind(entity_type);
    }

    if let Some(date_from) = date_from {
        query.push(" AND p.created_at >= ");
        query.push_bind(date_from);
    }

    if let Some(date_to) = date_to {
        query.push(" AND p.created_at <= ");
        query.push_bind(date_to);
    }

    query.push(" ORDER BY p.created_at DESC");

    query
        .build_query_as::<PaymentWithEntity>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

// ── get_customer_ledger ─────────────────────────────────────────────────────

async fn get_customer_ledger_impl(
    pool: &DbPool,
    customer_id: i64,
) -> Result<CustomerLedger, AppError> {
    let customer = sqlx::query_as::<_, crate::models::customer::Customer>(
        "SELECT * FROM customers WHERE id = ? AND is_active = 1",
    )
    .bind(customer_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("العميل"))?;

    let deferred_invoices = sqlx::query_as::<_, DeferredInvoice>(
        r#"
        SELECT
          id AS invoice_id,
          invoice_number,
          created_at,
          total_millieme,
          paid_millieme,
          (total_millieme - paid_millieme) AS remaining_millieme,
          status
        FROM invoices
        WHERE customer_id = ? AND status IN ('deferred', 'partial')
        ORDER BY created_at ASC
        "#,
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await?;

    let payments = sqlx::query_as::<_, Payment>(
        r#"
        SELECT id, entity_type, entity_id, amount_millieme, direction, method,
               reference_invoice_id, notes, session_id, created_at
        FROM payments
        WHERE entity_type = 'customer' AND entity_id = ?
        ORDER BY created_at DESC
        "#,
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await?;

    let total_owed_millieme = customer.balance_millieme;

    Ok(CustomerLedger {
        customer,
        deferred_invoices,
        payments,
        total_owed_millieme,
    })
}

// ── get_all_deferred_invoices ───────────────────────────────────────────────

async fn get_all_deferred_invoices_impl(
    pool: &DbPool,
) -> Result<Vec<DeferredInvoiceSummary>, AppError> {
    sqlx::query_as::<_, DeferredInvoiceSummary>(
        r#"
        SELECT
          i.id AS invoice_id,
          i.invoice_number,
          i.customer_id,
          c.name AS customer_name,
          i.total_millieme,
          i.paid_millieme,
          (i.total_millieme - i.paid_millieme) AS remaining_millieme,
          i.status,
          i.created_at,
          CAST(julianday('now') - julianday(i.created_at) AS INTEGER) AS days_outstanding
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.status IN ('deferred', 'partial')
        ORDER BY i.created_at ASC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

// ── record_invoice_payment ──────────────────────────────────────────────────

async fn record_invoice_payment_impl(
    pool: &DbPool,
    invoice_id: i64,
    amount_millieme: i64,
    method: String,
    session_id: Option<i64>,
) -> Result<InvoiceRow, AppError> {
    if amount_millieme <= 0 {
        return Err(AppError::validation("المبلغ يجب أن يكون أكبر من صفر"));
    }

    let mut tx = pool.begin().await?;

    let invoice = sqlx::query_as::<_, InvoiceRow>("SELECT * FROM invoices WHERE id = ?")
        .bind(invoice_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("الفاتورة"))?;

    if invoice.status == "paid" {
        return Err(AppError::new(
            "INVOICE_ALREADY_PAID",
            "الفاتورة مدفوعة بالكامل بالفعل",
            "Invoice is already fully paid",
        ));
    }

    let customer_id = invoice.customer_id.ok_or_else(|| {
        AppError::new(
            "INVOICE_NO_CUSTOMER",
            "الفاتورة ليس لها عميل",
            "Invoice has no customer",
        )
    })?;

    let remaining = invoice.total_millieme - invoice.paid_millieme;
    if amount_millieme > remaining {
        return Err(AppError::validation("المبلغ يتجاوز المتبقي على الفاتورة"));
    }

    let new_paid = invoice.paid_millieme + amount_millieme;
    let new_status = if new_paid >= invoice.total_millieme {
        "paid"
    } else {
        "partial"
    };

    sqlx::query("UPDATE invoices SET paid_millieme = ?, status = ? WHERE id = ?")
        .bind(new_paid)
        .bind(new_status)
        .bind(invoice_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        r#"
        INSERT INTO payments (entity_type, entity_id, amount_millieme, direction, method, reference_invoice_id, session_id)
        VALUES ('customer', ?, ?, 'in', ?, ?, ?)
        "#,
    )
    .bind(customer_id)
    .bind(amount_millieme)
    .bind(&method)
    .bind(invoice_id)
    .bind(session_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE customers SET balance_millieme = balance_millieme - ? WHERE id = ?")
        .bind(amount_millieme)
        .bind(customer_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    sqlx::query_as::<_, InvoiceRow>("SELECT * FROM invoices WHERE id = ?")
        .bind(invoice_id)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}

// ── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_expense(
    pool: State<'_, DbPool>,
    amount_millieme: i64,
    category_id: Option<i64>,
    description: Option<String>,
    session_id: Option<i64>,
) -> Result<Expense, AppError> {
    create_expense_impl(&pool, amount_millieme, category_id, description, session_id).await
}

#[tauri::command]
pub async fn list_expenses(
    pool: State<'_, DbPool>,
    date_from: Option<String>,
    date_to: Option<String>,
    category_id: Option<i64>,
) -> Result<Vec<ExpenseWithCategory>, AppError> {
    list_expenses_impl(&pool, date_from, date_to, category_id).await
}

#[tauri::command]
pub async fn list_expense_categories(
    pool: State<'_, DbPool>,
) -> Result<Vec<ExpenseCategory>, AppError> {
    list_expense_categories_impl(&pool).await
}

#[tauri::command]
pub async fn get_cash_summary(
    pool: State<'_, DbPool>,
    session_id: Option<i64>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<CashSummary, AppError> {
    get_cash_summary_impl(&pool, session_id, date_from, date_to).await
}

#[tauri::command]
pub async fn list_payments(
    pool: State<'_, DbPool>,
    direction: Option<String>,
    entity_type: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<Vec<PaymentWithEntity>, AppError> {
    list_payments_impl(&pool, direction, entity_type, date_from, date_to).await
}

#[tauri::command]
pub async fn record_customer_payment(
    pool: State<'_, DbPool>,
    customer_id: i64,
    amount_millieme: i64,
    method: String,
    notes: Option<String>,
    session_id: Option<i64>,
) -> Result<Payment, AppError> {
    record_customer_payment_impl(&pool, customer_id, amount_millieme, method, notes, session_id)
        .await
}

#[tauri::command]
pub async fn record_supplier_payment(
    pool: State<'_, DbPool>,
    supplier_id: i64,
    amount_millieme: i64,
    method: String,
    notes: Option<String>,
    session_id: Option<i64>,
) -> Result<Payment, AppError> {
    record_supplier_payment_impl(&pool, supplier_id, amount_millieme, method, notes, session_id)
        .await
}

#[tauri::command]
pub async fn get_customer_ledger(
    pool: State<'_, DbPool>,
    customer_id: i64,
) -> Result<CustomerLedger, AppError> {
    get_customer_ledger_impl(&pool, customer_id).await
}

#[tauri::command]
pub async fn get_all_deferred_invoices(
    pool: State<'_, DbPool>,
) -> Result<Vec<DeferredInvoiceSummary>, AppError> {
    get_all_deferred_invoices_impl(&pool).await
}

#[tauri::command]
pub async fn record_invoice_payment(
    pool: State<'_, DbPool>,
    invoice_id: i64,
    amount_millieme: i64,
    method: String,
    session_id: Option<i64>,
) -> Result<InvoiceRow, AppError> {
    record_invoice_payment_impl(&pool, invoice_id, amount_millieme, method, session_id).await
}

// ── tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        ConnectOptions,
    };
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::*;

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    async fn test_pool() -> Result<DbPool, AppError> {
        let counter = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let db_path = std::env::temp_dir().join(format!(
            "safqah-finance-test-{}-{}.db",
            std::process::id(),
            counter,
        ));

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
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

    async fn seed_customer(pool: &DbPool, name: &str, balance: i64) -> i64 {
        sqlx::query(
            "INSERT INTO customers (name, balance_millieme) VALUES (?, ?)",
        )
        .bind(name)
        .bind(balance)
        .execute(pool)
        .await
        .unwrap()
        .last_insert_rowid()
    }

    async fn seed_supplier(pool: &DbPool, name: &str, balance: i64) -> i64 {
        sqlx::query(
            "INSERT INTO suppliers (name, balance_millieme) VALUES (?, ?)",
        )
        .bind(name)
        .bind(balance)
        .execute(pool)
        .await
        .unwrap()
        .last_insert_rowid()
    }

    async fn seed_invoice(pool: &DbPool, session_id: i64, paid_millieme: i64) {
        sqlx::query(
            r#"
            INSERT INTO invoices (invoice_number, session_id, total_millieme, paid_millieme, payment_method, status)
            VALUES (?, ?, ?, ?, 'cash', 'paid')
            "#,
        )
        .bind(format!("INV-TEST-{}", rand_noise()))
        .bind(session_id)
        .bind(paid_millieme)
        .bind(paid_millieme)
        .execute(pool)
        .await
        .unwrap();
    }

    fn rand_noise() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0)
    }

    // ── create_expense tests ───────────────────────────────────────────────

    #[tokio::test]
    async fn test_create_expense_validates_amount_positive() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let result = create_expense_impl(&pool, 0, None, None, None).await;
        assert!(result.is_err());

        let result = create_expense_impl(&pool, -100, None, None, None).await;
        assert!(result.is_err());

        Ok(())
    }

    #[tokio::test]
    async fn test_create_expense_works() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let expense = create_expense_impl(&pool, 50000, None, None, None).await?;
        assert_eq!(expense.amount_millieme, 50000);
        assert!(expense.id > 0);

        let expense2 =
            create_expense_impl(&pool, 75000, Some(1), Some("إيجار".to_owned()), None).await?;
        assert_eq!(expense2.amount_millieme, 75000);
        assert_eq!(expense2.category_id, Some(1));
        assert_eq!(expense2.description.as_deref(), Some("إيجار"));

        Ok(())
    }

    // ── list_expenses tests ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_list_expenses_returns_all() -> Result<(), AppError> {
        let pool = test_pool().await?;

        create_expense_impl(&pool, 10000, None, None, None).await?;
        create_expense_impl(&pool, 20000, Some(1), None, None).await?;

        let all = list_expenses_impl(&pool, None, None, None).await?;
        assert_eq!(all.len(), 2);

        let filtered = list_expenses_impl(&pool, None, None, Some(1)).await?;
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].category_name_ar.as_deref(), Some("إيجار"));

        Ok(())
    }

    // ── list_expense_categories tests ──────────────────────────────────────

    #[tokio::test]
    async fn test_list_expense_categories_returns_seeded() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let categories = list_expense_categories_impl(&pool).await?;
        assert!(categories.len() >= 7);

        Ok(())
    }

    // ── get_cash_summary tests ─────────────────────────────────────────────

    #[tokio::test]
    async fn test_cash_summary_all_time() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let summary = get_cash_summary_impl(&pool, None, None, None).await?;
        assert_eq!(summary.net_cash_millieme, 0);

        // Seed a session
        sqlx::query("INSERT INTO sessions (cashier_id, status) VALUES (1, 'open')")
            .execute(&pool)
            .await?;
        let session_id = 1;

        // Seed an invoice with paid amount
        seed_invoice(&pool, session_id, 50000).await;

        // Create an expense
        create_expense_impl(&pool, 10000, None, None, None).await?;

        // Pay a supplier
        let supplier_id = seed_supplier(&pool, "مورد", 0).await;
        record_supplier_payment_impl(&pool, supplier_id, 5000, "cash".to_owned(), None, None).await?;

        let summary = get_cash_summary_impl(&pool, None, None, None).await?;
        assert_eq!(summary.total_sales_cash_millieme, 50000);
        assert_eq!(summary.total_expenses_millieme, 10000);
        assert_eq!(summary.total_payments_out_millieme, 5000);
        assert_eq!(summary.total_payments_in_millieme, 0);
        assert_eq!(summary.net_cash_millieme, 35000); // 50000 - 10000 - 5000 + 0

        Ok(())
    }

    #[tokio::test]
    async fn test_cash_summary_by_session() -> Result<(), AppError> {
        let pool = test_pool().await?;

        sqlx::query("INSERT INTO sessions (cashier_id, status) VALUES (1, 'open')")
            .execute(&pool)
            .await?;
        sqlx::query("INSERT INTO sessions (cashier_id, status) VALUES (1, 'open')")
            .execute(&pool)
            .await?;

        seed_invoice(&pool, 1, 10000).await;
        seed_invoice(&pool, 2, 30000).await;
        create_expense_impl(&pool, 5000, None, None, Some(1)).await?;
        create_expense_impl(&pool, 2000, None, None, Some(2)).await?;

        let s1 = get_cash_summary_impl(&pool, Some(1), None, None).await?;
        assert_eq!(s1.total_sales_cash_millieme, 10000);
        assert_eq!(s1.total_expenses_millieme, 5000);

        let s2 = get_cash_summary_impl(&pool, Some(2), None, None).await?;
        assert_eq!(s2.total_sales_cash_millieme, 30000);
        assert_eq!(s2.total_expenses_millieme, 2000);

        Ok(())
    }

    // ── record_customer_payment tests ──────────────────────────────────────

    #[tokio::test]
    async fn test_customer_payment_reduces_balance() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let customer_id = seed_customer(&pool, "عميل", 50000).await;

        let payment =
            record_customer_payment_impl(&pool, customer_id, 30000, "cash".to_owned(), None, None)
                .await?;
        assert_eq!(payment.entity_type, "customer");
        assert_eq!(payment.amount_millieme, 30000);
        assert_eq!(payment.direction, "in");

        let balance = sqlx::query_scalar::<_, i64>(
            "SELECT balance_millieme FROM customers WHERE id = ?",
        )
        .bind(customer_id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(balance, 20000); // 50000 - 30000

        Ok(())
    }

    #[tokio::test]
    async fn test_customer_payment_can_go_negative() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let customer_id = seed_customer(&pool, "عميل", 10000).await;

        let _payment =
            record_customer_payment_impl(&pool, customer_id, 15000, "cash".to_owned(), None, None)
                .await?;

        let balance = sqlx::query_scalar::<_, i64>(
            "SELECT balance_millieme FROM customers WHERE id = ?",
        )
        .bind(customer_id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(balance, -5000);

        Ok(())
    }

    #[tokio::test]
    async fn test_customer_payment_validates_customer() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let result = record_customer_payment_impl(&pool, 999, 1000, "cash".to_owned(), None, None)
            .await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .message_ar
            .contains("العميل"));

        Ok(())
    }

    #[tokio::test]
    async fn test_customer_payment_validates_amount() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let customer_id = seed_customer(&pool, "عميل", 0).await;

        let result =
            record_customer_payment_impl(&pool, customer_id, 0, "cash".to_owned(), None, None)
                .await;
        assert!(result.is_err());

        let result = record_customer_payment_impl(
            &pool,
            customer_id,
            -100,
            "cash".to_owned(),
            None,
            None,
        )
        .await;
        assert!(result.is_err());

        Ok(())
    }

    // ── record_supplier_payment tests ──────────────────────────────────────

    #[tokio::test]
    async fn test_supplier_payment_reduces_balance() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let supplier_id = seed_supplier(&pool, "مورد", 40000).await;

        let payment =
            record_supplier_payment_impl(&pool, supplier_id, 25000, "bank".to_owned(), None, None)
                .await?;
        assert_eq!(payment.entity_type, "supplier");
        assert_eq!(payment.amount_millieme, 25000);
        assert_eq!(payment.direction, "out");

        let balance = sqlx::query_scalar::<_, i64>(
            "SELECT balance_millieme FROM suppliers WHERE id = ?",
        )
        .bind(supplier_id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(balance, 15000); // 40000 - 25000

        Ok(())
    }

    #[tokio::test]
    async fn test_supplier_payment_can_go_negative() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let supplier_id = seed_supplier(&pool, "مورد", 5000).await;

        let _payment =
            record_supplier_payment_impl(&pool, supplier_id, 10000, "cash".to_owned(), None, None)
                .await?;

        let balance = sqlx::query_scalar::<_, i64>(
            "SELECT balance_millieme FROM suppliers WHERE id = ?",
        )
        .bind(supplier_id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(balance, -5000);

        Ok(())
    }

    #[tokio::test]
    async fn test_supplier_payment_validates_supplier() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let result = record_supplier_payment_impl(&pool, 999, 1000, "cash".to_owned(), None, None)
            .await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .message_ar
            .contains("المورد"));

        Ok(())
    }

    #[tokio::test]
    async fn test_supplier_payment_validates_amount() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let supplier_id = seed_supplier(&pool, "مورد", 0).await;

        let result =
            record_supplier_payment_impl(&pool, supplier_id, 0, "cash".to_owned(), None, None)
                .await;
        assert!(result.is_err());

        let result = record_supplier_payment_impl(
            &pool,
            supplier_id,
            -100,
            "cash".to_owned(),
            None,
            None,
        )
        .await;
        assert!(result.is_err());

        Ok(())
    }

    // ── integration: full cash flow ────────────────────────────────────────

    #[tokio::test]
    async fn test_full_cash_flow() -> Result<(), AppError> {
        let pool = test_pool().await?;

        sqlx::query("INSERT INTO sessions (cashier_id, status) VALUES (1, 'open')")
            .execute(&pool)
            .await?;
        let session_id = 1i64;

        // 1. Create an expense: 50 EGP
        let _expense = create_expense_impl(&pool, 50000, Some(1), Some("إيجار".to_owned()), Some(session_id)).await?;

        // 2. Record a customer payment: 100 EGP received (customer owed us)
        let customer_id = seed_customer(&pool, "عميل", 100000).await;
        let _customer_payment =
            record_customer_payment_impl(&pool, customer_id, 100000, "cash".to_owned(), None, Some(session_id)).await?;

        // 3. Record a supplier payment: 200 EGP paid (we owed supplier)
        let supplier_id = seed_supplier(&pool, "مورد", 200000).await;
        let _supplier_payment = record_supplier_payment_impl(
            &pool,
            supplier_id,
            200000,
            "bank".to_owned(),
            None,
            Some(session_id),
        )
        .await?;

        // 4. Seed some sales cash
        seed_invoice(&pool, session_id, 300000).await; // 300 EGP sales

        // 5. Check cash summary
        let summary =
            get_cash_summary_impl(&pool, Some(session_id), None, None).await?;
        assert_eq!(summary.total_sales_cash_millieme, 300000);
        assert_eq!(summary.total_expenses_millieme, 50000);
        assert_eq!(summary.total_payments_out_millieme, 200000);
        assert_eq!(summary.total_payments_in_millieme, 100000);
        // net = 300000 - 50000 - 200000 + 100000 = 150000
        assert_eq!(summary.net_cash_millieme, 150000);

        // 6. Verify balances
        let cust_balance = sqlx::query_scalar::<_, i64>(
            "SELECT balance_millieme FROM customers WHERE id = ?",
        )
        .bind(customer_id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(cust_balance, 0); // was 100000, paid 100000

        let supp_balance = sqlx::query_scalar::<_, i64>(
            "SELECT balance_millieme FROM suppliers WHERE id = ?",
        )
        .bind(supplier_id)
        .fetch_one(&pool)
        .await?;
        assert_eq!(supp_balance, 0); // was 200000, paid 200000

        Ok(())
    }
}
