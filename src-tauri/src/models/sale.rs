#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct Invoice {
    pub id: i64,
    pub invoice_number: Option<String>,
    pub session_id: i64,
    pub customer_id: Option<i64>,
    pub subtotal_millieme: i64,
    pub line_discount_millieme: i64,
    pub global_discount_millieme: i64,
    pub total_discount_millieme: i64,
    pub total_millieme: i64,
    pub payment_method: String,
    pub paid_cash_millieme: i64,
    pub paid_card_millieme: i64,
    pub paid_total_millieme: i64,
    pub change_millieme: i64,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateSaleInvoicePayload {
    pub session_id: i64,
    pub customer_id: Option<i64>,
    pub payment_method: String,
    pub global_discount_millieme: i64,
    pub paid_cash_millieme: i64,
    pub paid_card_millieme: i64,
    pub notes: Option<String>,
    pub items: Vec<CreateSaleInvoiceLinePayload>,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateSaleInvoiceLinePayload {
    pub item_id: i64,
    pub qty: i64,
    pub unit_price_millieme: i64,
    pub discount_millieme: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct CreateSaleInvoiceResponse {
    pub invoice_id: i64,
    pub invoice_number: String,
    pub total_millieme: i64,
    pub paid_cash_millieme: i64,
    pub paid_card_millieme: i64,
    pub paid_total_millieme: i64,
    pub change_millieme: i64,
}
