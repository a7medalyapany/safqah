#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ExpenseCategory {
    pub id: i64,
    pub name_ar: String,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct Expense {
    pub id: i64,
    pub amount_millieme: i64,
    pub category_id: Option<i64>,
    pub description: Option<String>,
    pub session_id: Option<i64>,
    pub created_by: i64,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ExpenseWithCategory {
    pub id: i64,
    pub amount_millieme: i64,
    pub category_id: Option<i64>,
    pub category_name_ar: Option<String>,
    pub description: Option<String>,
    pub session_id: Option<i64>,
    pub created_by: i64,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct Payment {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub amount_millieme: i64,
    pub direction: String,
    pub method: String,
    pub reference_invoice_id: Option<i64>,
    pub notes: Option<String>,
    pub session_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PaymentWithEntity {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub entity_name: String,
    pub amount_millieme: i64,
    pub direction: String,
    pub method: String,
    pub reference_invoice_id: Option<i64>,
    pub notes: Option<String>,
    pub session_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize)]
pub struct CashSummary {
    pub total_sales_cash_millieme: i64,
    pub total_expenses_millieme: i64,
    pub total_payments_out_millieme: i64,
    pub total_payments_in_millieme: i64,
    pub net_cash_millieme: i64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct DeferredInvoice {
    pub invoice_id: i64,
    pub invoice_number: String,
    pub created_at: String,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub remaining_millieme: i64,
    pub status: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct DeferredInvoiceSummary {
    pub invoice_id: i64,
    pub invoice_number: String,
    pub customer_id: i64,
    pub customer_name: String,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub remaining_millieme: i64,
    pub status: String,
    pub created_at: String,
    pub days_outstanding: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct CustomerLedger {
    pub customer: crate::models::customer::Customer,
    pub deferred_invoices: Vec<DeferredInvoice>,
    pub payments: Vec<Payment>,
    pub total_owed_millieme: i64,
}
