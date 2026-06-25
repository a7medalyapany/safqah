//! Small helpers shared across command modules.
//!
//! These were previously copy-pasted into nearly every command file; keeping a
//! single definition avoids drift (e.g. one place fixing the trim behaviour while
//! others lag behind).

use crate::{commands::settings::get_setting_value, db::DbPool, errors::AppError};

/// Trims a free-text optional string, collapsing empty/whitespace-only input to `None`.
pub fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

/// Formats a document number as `PREFIX-000123` (zero-padded to 6 digits).
pub fn build_document_number(prefix: &str, number: i64) -> String {
    format!("{}-{:06}", prefix.trim(), number)
}

/// Reads a text setting, falling back to `default` when missing or blank.
pub async fn load_text_setting(
    pool: &DbPool,
    key: &str,
    default: &str,
) -> Result<String, AppError> {
    Ok(normalize_optional_string(get_setting_value(pool, key).await?)
        .unwrap_or_else(|| default.to_owned()))
}

/// Standard "item not found or inactive" error used by sale/purchase flows.
pub fn item_not_found_error() -> AppError {
    AppError::new(
        "ITEM_NOT_FOUND",
        "الصنف غير موجود أو غير نشط",
        "Item not found or inactive",
    )
}
