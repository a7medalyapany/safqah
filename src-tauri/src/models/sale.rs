#[derive(Debug, serde::Serialize)]
pub struct Invoice {
    pub id: i64,
    pub invoice_number: String,
    pub customer_id: Option<i64>,
    pub session_id: i64,
    pub cashier_id: i64,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub tax_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub items: Vec<InvoiceItem>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct InvoiceRow {
    pub id: i64,
    pub invoice_number: String,
    pub customer_id: Option<i64>,
    pub session_id: i64,
    pub cashier_id: i64,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub tax_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl InvoiceRow {
    pub fn with_items(self, items: Vec<InvoiceItem>) -> Invoice {
        Invoice {
            id: self.id,
            invoice_number: self.invoice_number,
            customer_id: self.customer_id,
            session_id: self.session_id,
            cashier_id: self.cashier_id,
            subtotal_millieme: self.subtotal_millieme,
            discount_millieme: self.discount_millieme,
            tax_millieme: self.tax_millieme,
            total_millieme: self.total_millieme,
            paid_millieme: self.paid_millieme,
            payment_method: self.payment_method,
            status: self.status,
            notes: self.notes,
            created_at: self.created_at,
            items,
        }
    }
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct InvoiceItem {
    pub id: i64,
    pub invoice_id: i64,
    pub item_id: i64,
    pub qty: i64,
    pub unit_price_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceFilters {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub customer_id: Option<i64>,
    pub customer_search: Option<String>,
    pub status: Option<String>,
    pub payment_method: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct InvoiceSummary {
    pub id: i64,
    pub invoice_number: String,
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct InvoiceStats {
    pub total_count: i64,
    pub paid_count: i64,
    pub deferred_count: i64,
    pub total_sales_millieme: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct InvoiceDetail {
    pub id: i64,
    pub invoice_number: String,
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub session_id: i64,
    pub cashier_id: i64,
    pub cashier_name: Option<String>,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub tax_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub items: Vec<InvoiceItemDetail>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct InvoiceDetailRow {
    pub id: i64,
    pub invoice_number: String,
    pub customer_id: Option<i64>,
    pub customer_name: Option<String>,
    pub session_id: i64,
    pub cashier_id: i64,
    pub cashier_name: Option<String>,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub tax_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl InvoiceDetailRow {
    pub fn with_items(self, items: Vec<InvoiceItemDetail>) -> InvoiceDetail {
        InvoiceDetail {
            id: self.id,
            invoice_number: self.invoice_number,
            customer_id: self.customer_id,
            customer_name: self.customer_name,
            session_id: self.session_id,
            cashier_id: self.cashier_id,
            cashier_name: self.cashier_name,
            subtotal_millieme: self.subtotal_millieme,
            discount_millieme: self.discount_millieme,
            tax_millieme: self.tax_millieme,
            total_millieme: self.total_millieme,
            paid_millieme: self.paid_millieme,
            payment_method: self.payment_method,
            status: self.status,
            notes: self.notes,
            created_at: self.created_at,
            items,
        }
    }
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct InvoiceItemDetail {
    pub id: i64,
    pub invoice_id: i64,
    pub item_id: i64,
    pub item_name_ar: String,
    pub qty: i64,
    pub returned_qty: i64,
    pub unit_price_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct Return {
    pub id: i64,
    pub return_number: String,
    pub original_invoice_id: i64,
    pub session_id: i64,
    pub total_millieme: i64,
    pub refund_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub items: Vec<ReturnItem>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ReturnRow {
    pub id: i64,
    pub return_number: String,
    pub original_invoice_id: i64,
    pub session_id: i64,
    pub total_millieme: i64,
    pub refund_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl ReturnRow {
    pub fn with_items(self, items: Vec<ReturnItem>) -> Return {
        Return {
            id: self.id,
            return_number: self.return_number,
            original_invoice_id: self.original_invoice_id,
            session_id: self.session_id,
            total_millieme: self.total_millieme,
            refund_method: self.refund_method,
            status: self.status,
            notes: self.notes,
            created_at: self.created_at,
            items,
        }
    }
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ReturnItem {
    pub id: i64,
    pub return_id: i64,
    pub invoice_item_id: i64,
    pub item_id: i64,
    pub qty: i64,
    pub unit_price_millieme: i64,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSaleInvoicePayload {
    pub session_id: i64,
    pub customer_id: Option<i64>,
    pub items: Vec<InvoiceItemPayload>,
    pub global_discount_millieme: i64,
    pub payment_method: String,
    pub paid_millieme: i64,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItemPayload {
    pub item_id: i64,
    pub qty: i64,
    pub unit_price_millieme: i64,
    pub discount_millieme: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReturnPayload {
    pub original_invoice_id: i64,
    pub session_id: i64,
    pub items: Vec<ReturnItemPayload>,
    pub refund_method: String,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnItemPayload {
    pub invoice_item_id: i64,
    pub item_id: i64,
    pub qty: i64,
}
