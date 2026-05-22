#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Session {
    pub id: i64,
    pub cashier_id: i64,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub opening_cash_millieme: i64,
    pub closing_cash_millieme: i64,
    pub status: String,
    pub notes: Option<String>,
}
