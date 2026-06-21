use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: String,
    pub message_ar: String,
    pub message_en: String,
}

impl AppError {
    pub fn new(code: &str, message_ar: &str, message_en: &str) -> Self {
        Self {
            code: code.to_owned(),
            message_ar: message_ar.to_owned(),
            message_en: message_en.to_owned(),
        }
    }

    pub fn db_error(e: sqlx::Error) -> Self {
        Self::new(
            "DB_ERROR",
            "حدث خطأ في قاعدة البيانات",
            &format!("Database error: {e}"),
        )
    }

    pub fn not_found(entity_ar: &str) -> Self {
        Self::new(
            "NOT_FOUND",
            &format!("لم يتم العثور على {entity_ar}"),
            &format!("{entity_ar} not found"),
        )
    }

    pub fn validation(message_ar: &str) -> Self {
        Self::new("VALIDATION_ERROR", message_ar, "Validation error")
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::db_error(e)
    }
}
