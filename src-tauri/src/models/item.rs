#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Category {
    pub id: i64,
    pub name_ar: String,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Item {
    pub id: i64,
    pub barcode: Option<String>,
    pub name_ar: String,
    pub name_en: Option<String>,
    pub category_id: Option<i64>,
    pub buy_price_millieme: i64,
    pub sell_price_millieme: i64,
    pub color: Option<String>,
    pub size: Option<String>,
    pub unit: String,
    pub min_stock: i64,
    pub current_stock: i64,
    pub supplier_id: Option<i64>,
    pub image_path: Option<String>,
    pub is_active: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateItemPayload {
    pub barcode: Option<String>,
    pub name_ar: String,
    pub name_en: Option<String>,
    pub category_id: Option<i64>,
    pub buy_price_millieme: i64,
    pub sell_price_millieme: i64,
    pub color: Option<String>,
    pub size: Option<String>,
    pub unit: Option<String>,
    pub min_stock: Option<i64>,
    pub current_stock: Option<i64>,
    pub supplier_id: Option<i64>,
    pub image_path: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateItemPayload {
    pub barcode: Option<String>,
    pub name_ar: Option<String>,
    pub name_en: Option<String>,
    pub category_id: Option<i64>,
    pub buy_price_millieme: Option<i64>,
    pub sell_price_millieme: Option<i64>,
    pub color: Option<String>,
    pub size: Option<String>,
    pub unit: Option<String>,
    pub min_stock: Option<i64>,
    pub current_stock: Option<i64>,
    pub supplier_id: Option<i64>,
    pub image_path: Option<String>,
}
