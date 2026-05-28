#[derive(Debug, Default, serde::Serialize)]
pub struct CsvImportReport {
    pub imported: i64,
    pub skipped: i64,
    pub errors: Vec<String>,
}