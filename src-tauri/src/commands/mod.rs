pub mod auth;
pub mod backup;
pub mod customers;
pub mod finance;
pub mod inventory;
pub mod items;
pub mod purchases;
pub mod print;
pub mod reports;
pub mod settings;
pub mod sessions;
pub mod suppliers;
pub mod sales;

use serde_json::Value;

use crate::errors::AppError;

#[tauri::command]
pub async fn ping() -> Result<Value, AppError> {
    Ok(serde_json::json!({
        "ok": true,
        "message": "البرنامج يعمل بشكل صحيح",
    }))
}

#[tauri::command]
pub async fn force_error() -> Result<Value, AppError> {
    Err(AppError::not_found("صنف"))
}
