#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub balance_millieme: i64,
    pub tax_number: Option<String>,
    pub notes: Option<String>,
    pub is_active: i64,
    pub created_at: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateSupplierPayload {
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub balance_millieme: Option<i64>,
    pub tax_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateSupplierPayload {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub balance_millieme: Option<i64>,
    pub tax_number: Option<String>,
    pub notes: Option<String>,
}
