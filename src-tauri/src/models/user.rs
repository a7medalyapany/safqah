#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow, Clone)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub role: String,
    pub is_active: i64,
    pub created_at: String,
}

#[derive(Debug, sqlx::FromRow)]
pub struct UserWithPassword {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub is_active: i64,
    pub created_at: String,
}

impl From<UserWithPassword> for User {
    fn from(value: UserWithPassword) -> Self {
        Self {
            id: value.id,
            name: value.name,
            username: value.username,
            role: value.role,
            is_active: value.is_active,
            created_at: value.created_at,
        }
    }
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserPayload {
    pub name: String,
    pub username: String,
    pub password: String,
    pub role: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserPayload {
    pub name: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub role: Option<String>,
    pub is_active: Option<i64>,
}