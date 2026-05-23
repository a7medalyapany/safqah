#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct StockMovement {
    pub id: i64,
    pub item_id: i64,
    pub delta: i64,
    pub movement_type: String,
    pub reference_id: Option<i64>,
    pub reference_type: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub reference_number: Option<String>,
}
