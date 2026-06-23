#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopInfo {
    pub shop_name: String,
    pub shop_address: String,
    pub shop_phone: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoicePrintItem {
    pub item_name_ar: String,
    pub qty: i64,
    pub unit_price_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoicePrintData {
    pub invoice_number: String,
    pub customer_name: Option<String>,
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
    pub items: Vec<InvoicePrintItem>,
    pub shop: ShopInfo,
    pub customer_balance_millieme: Option<i64>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchasePrintItem {
    pub item_name_ar: String,
    pub qty: i64,
    pub unit_cost_millieme: i64,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchasePrintData {
    pub invoice_number: String,
    pub supplier_name: Option<String>,
    pub subtotal_millieme: i64,
    pub discount_millieme: i64,
    pub total_millieme: i64,
    pub paid_millieme: i64,
    pub payment_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub items: Vec<PurchasePrintItem>,
    pub shop: ShopInfo,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnPrintItem {
    pub item_name_ar: String,
    pub qty: i64,
    pub unit_price_millieme: i64,
    pub total_millieme: i64,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnPrintData {
    pub return_number: String,
    pub original_invoice_id: i64,
    pub original_invoice_number: String,
    pub total_millieme: i64,
    pub refund_method: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub items: Vec<ReturnPrintItem>,
    pub shop: ShopInfo,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BarcodePrintData {
    pub item_id: i64,
    pub barcode: String,
    pub name_ar: String,
    pub sell_price_millieme: i64,
}
