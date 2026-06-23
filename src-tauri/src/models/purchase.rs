#[derive(Debug, serde::Serialize)]
pub struct PurchaseInvoice {
    pub id: i64,
    pub invoice_number: String,
    pub supplier_id: Option<i64>,
    pub session_id: Option<i64>,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub items: Vec<PurchaseItem>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PurchaseInvoiceRow {
    pub id: i64,
    pub invoice_number: String,
    pub supplier_id: Option<i64>,
    pub session_id: Option<i64>,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl PurchaseInvoiceRow {
    pub fn with_items(self, items: Vec<PurchaseItem>) -> PurchaseInvoice {
        PurchaseInvoice {
            id: self.id,
            invoice_number: self.invoice_number,
            supplier_id: self.supplier_id,
            session_id: self.session_id,
            subtotal_millieme: self.subtotal_millieme,
            discount_millieme: self.discount_millieme,
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
pub struct PurchaseItem {
    pub id: i64,
    pub purchase_id: i64,
    pub item_id: i64,
    pub qty: i64,
    pub unit_cost_millieme: i64,
    pub suggested_sell_price_millieme: Option<i64>,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseFilters {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub supplier_id: Option<i64>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PurchaseSummary {
    pub id: i64,
    pub invoice_number: String,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize)]
pub struct PurchaseDetail {
    pub id: i64,
    pub invoice_number: String,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub session_id: Option<i64>,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub items: Vec<PurchaseItemDetail>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PurchaseDetailRow {
    pub id: i64,
    pub invoice_number: String,
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>,
    pub session_id: Option<i64>,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl PurchaseDetailRow {
    pub fn with_items(self, items: Vec<PurchaseItemDetail>) -> PurchaseDetail {
        PurchaseDetail {
            id: self.id,
            invoice_number: self.invoice_number,
            supplier_id: self.supplier_id,
            supplier_name: self.supplier_name,
            session_id: self.session_id,
            subtotal_millieme: self.subtotal_millieme,
            discount_millieme: self.discount_millieme,
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
pub struct PurchaseItemDetail {
    pub id: i64,
    pub purchase_id: i64,
    pub item_id: i64,
    pub item_name_ar: String,
    pub qty: i64,
    pub unit_cost_millieme: i64,
    pub suggested_sell_price_millieme: Option<i64>,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePurchasePayload {
    pub supplier_id: Option<i64>,
    pub session_id: Option<i64>,
    pub items: Vec<PurchaseItemPayload>,
    pub global_discount_millieme: i64,
    pub payment_method: String,
    pub paid_millieme: i64,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePurchasePayload {
    pub purchase_id: i64,
    pub supplier_id: Option<i64>,
    pub items: Vec<PurchaseItemPayload>,
    pub global_discount_millieme: i64,
    pub payment_method: String,
    pub paid_millieme: i64,
    pub notes: Option<String>,
    /// Optional invoice date override (e.g. "2026-06-23"). When provided it
    /// replaces the stored `created_at` so the user can correct the date.
    pub invoice_date: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseItemPayload {
    pub item_id: i64,
    pub qty: i64,
    pub unit_cost_millieme: i64,
    pub suggested_sell_price_millieme: Option<i64>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ItemPurchaseHistory {
    pub item_id: i64,
    pub name_ar: String,
    pub current_buy_price_millieme: i64,
    pub current_sell_price_millieme: i64,
    pub last_purchase_date: Option<String>,
    pub last_purchase_cost_millieme: Option<i64>,
    pub last_purchase_qty: Option<i64>,
    pub last_supplier_name: Option<String>,
    pub purchase_count: i64,
    pub avg_cost_millieme: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ItemBasePriceRow {
    pub item_id: i64,
    pub name_ar: String,
    pub current_buy_price_millieme: i64,
    pub current_sell_price_millieme: i64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct LastItemPurchaseRow {
    pub last_purchase_cost_millieme: i64,
    pub last_purchase_qty: i64,
    pub last_supplier_name: Option<String>,
    pub last_purchase_date: String,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ItemPurchaseStatsRow {
    pub purchase_count: i64,
    pub avg_cost_millieme: Option<i64>,
}
