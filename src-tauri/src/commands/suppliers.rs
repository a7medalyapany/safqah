use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

use crate::{
    commands::util::normalize_optional_string,
    db::DbPool,
    errors::AppError,
    models::import::CsvImportReport,
    models::supplier::{CreateSupplierPayload, Supplier, UpdateSupplierPayload},
};

#[derive(Debug, serde::Deserialize)]
struct SupplierCsvRow {
    name: String,
    phone: Option<String>,
    address: Option<String>,
    balance_millieme: Option<String>,
    tax_number: Option<String>,
    notes: Option<String>,
}

fn validate_name(value: &str) -> Result<String, AppError> {
    let name = value.trim().to_owned();
    if name.is_empty() {
        return Err(AppError::validation("الاسم مطلوب"));
    }

    Ok(name)
}

async fn get_supplier_by_id(pool: &DbPool, id: i64) -> Result<Supplier, AppError> {
    sqlx::query_as::<_, Supplier>("SELECT * FROM suppliers WHERE id = ? AND is_active = 1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("المورد"))
}

async fn list_suppliers_impl(
    pool: &DbPool,
    search: Option<String>,
) -> Result<Vec<Supplier>, AppError> {
    let mut query = QueryBuilder::<Sqlite>::new(
        "SELECT * FROM suppliers WHERE is_active = 1",
    );

    if let Some(search) = normalize_optional_string(search) {
        query.push(" AND (name LIKE ");
        query.push_bind(format!("%{search}%"));
        query.push(" OR phone LIKE ");
        query.push_bind(format!("%{search}%"));
        query.push(")");
    }

    query.push(" ORDER BY name ASC");

    query
        .build_query_as::<Supplier>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn create_supplier_impl(
    pool: &DbPool,
    payload: CreateSupplierPayload,
) -> Result<Supplier, AppError> {
    let name = validate_name(&payload.name)?;

    let result = sqlx::query(
        r#"
        INSERT INTO suppliers (
          name,
          phone,
          address,
          balance_millieme,
          tax_number,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(name)
    .bind(normalize_optional_string(payload.phone))
    .bind(normalize_optional_string(payload.address))
    .bind(payload.balance_millieme.unwrap_or(0))
    .bind(normalize_optional_string(payload.tax_number))
    .bind(normalize_optional_string(payload.notes))
    .execute(pool)
    .await?;

    get_supplier_by_id(pool, result.last_insert_rowid()).await
}

async fn update_supplier_impl(
    pool: &DbPool,
    id: i64,
    payload: UpdateSupplierPayload,
) -> Result<Supplier, AppError> {
    if let Some(name) = payload.name.as_ref() {
        validate_name(name)?;
    }

    let mut query = QueryBuilder::<Sqlite>::new("UPDATE suppliers SET ");
    let mut has_updates = false;

    let mut push_separator = |query: &mut QueryBuilder<Sqlite>| {
        if has_updates {
            query.push(", ");
        } else {
            has_updates = true;
        }
    };

    if let Some(name) = payload.name {
        push_separator(&mut query);
        query.push("name = ").push_bind(validate_name(&name)?);
    }

    if let Some(phone) = payload.phone {
        push_separator(&mut query);
        query
            .push("phone = ")
            .push_bind(normalize_optional_string(Some(phone)));
    }

    if let Some(address) = payload.address {
        push_separator(&mut query);
        query
            .push("address = ")
            .push_bind(normalize_optional_string(Some(address)));
    }

    if let Some(balance_millieme) = payload.balance_millieme {
        push_separator(&mut query);
        query
            .push("balance_millieme = ")
            .push_bind(balance_millieme);
    }

    if let Some(tax_number) = payload.tax_number {
        push_separator(&mut query);
        query
            .push("tax_number = ")
            .push_bind(normalize_optional_string(Some(tax_number)));
    }

    if let Some(notes) = payload.notes {
        push_separator(&mut query);
        query
            .push("notes = ")
            .push_bind(normalize_optional_string(Some(notes)));
    }

    if !has_updates {
        return get_supplier_by_id(pool, id).await;
    }

    query.push(" WHERE id = ");
    query.push_bind(id);
    query.push(" AND is_active = 1");

    let result = query.build().execute(pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::not_found("المورد"));
    }

    get_supplier_by_id(pool, id).await
}

async fn delete_supplier_impl(pool: &DbPool, id: i64) -> Result<bool, AppError> {
    let result = sqlx::query("UPDATE suppliers SET is_active = 0 WHERE id = ? AND is_active = 1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

async fn import_suppliers_csv_impl(
    pool: &DbPool,
    file_path: String,
) -> Result<CsvImportReport, AppError> {
    let mut reader = csv::ReaderBuilder::new()
        .trim(csv::Trim::All)
        .flexible(true)
        .from_path(&file_path)
        .map_err(|error| csv_error(&error.to_string()))?;

    let mut report = CsvImportReport::default();

    for (index, row) in reader.deserialize::<SupplierCsvRow>().enumerate() {
        match row {
            Ok(row) => {
                let balance_millieme = parse_optional_i64(row.balance_millieme.as_deref())?;

                let payload = CreateSupplierPayload {
                    name: row.name,
                    phone: row.phone,
                    address: row.address,
                    balance_millieme,
                    tax_number: row.tax_number,
                    notes: row.notes,
                };

                match create_supplier_impl(pool, payload).await {
                    Ok(_) => report.imported += 1,
                    Err(error) => {
                        report.skipped += 1;
                        report
                            .errors
                            .push(format!("السطر {}: {}", index + 2, error.message_ar));
                    }
                }
            }
            Err(error) => {
                report.skipped += 1;
                report
                    .errors
                    .push(format!("السطر {}: {error}", index + 2));
            }
        }
    }

    Ok(report)
}

fn parse_optional_i64(value: Option<&str>) -> Result<Option<i64>, AppError> {
    let Some(value) = value else {
        return Ok(None);
    };

    let trimmed = value.trim();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        trimmed.parse::<i64>().map(Some).map_err(|_| {
            AppError::validation("قيمة رقمية غير صحيحة في ملف CSV")
        })
    }
}

fn csv_error(message: &str) -> AppError {
    AppError::new("CSV_IMPORT_ERROR", "تعذر قراءة ملف CSV", message)
}

#[tauri::command]
pub async fn list_suppliers(
    pool: State<'_, DbPool>,
    search: Option<String>,
) -> Result<Vec<Supplier>, AppError> {
    list_suppliers_impl(&pool, search).await
}

#[tauri::command]
pub async fn get_supplier(pool: State<'_, DbPool>, id: i64) -> Result<Supplier, AppError> {
    get_supplier_by_id(&pool, id).await
}

#[tauri::command]
pub async fn create_supplier(
    pool: State<'_, DbPool>,
    payload: CreateSupplierPayload,
) -> Result<Supplier, AppError> {
    create_supplier_impl(&pool, payload).await
}

#[tauri::command]
pub async fn update_supplier(
    pool: State<'_, DbPool>,
    id: i64,
    payload: UpdateSupplierPayload,
) -> Result<Supplier, AppError> {
    update_supplier_impl(&pool, id, payload).await
}

#[tauri::command]
pub async fn delete_supplier(pool: State<'_, DbPool>, id: i64) -> Result<bool, AppError> {
    delete_supplier_impl(&pool, id).await
}

#[tauri::command]
pub async fn import_suppliers_csv(
    pool: State<'_, DbPool>,
    file_path: String,
) -> Result<CsvImportReport, AppError> {
    import_suppliers_csv_impl(&pool, file_path).await
}

#[cfg(test)]
mod tests {
    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        ConnectOptions,
    };

    use super::*;

    async fn test_pool() -> Result<DbPool, AppError> {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);

        let db_path = std::env::temp_dir().join(format!(
            "safqah-suppliers-test-{}-{}.db",
            std::process::id(),
            nanos
        ));

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .disable_statement_logging();

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .map_err(AppError::from)?;

        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .map_err(|e| {
                AppError::new(
                    "TEST_MIGRATE_FAILED",
                    "فشل تشغيل migrations للاختبار",
                    &format!("Test migrations failed: {e}"),
                )
            })?;

        Ok(pool)
    }

    #[tokio::test]
    async fn supplier_crud_flow_works() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let created = create_supplier_impl(
            &pool,
            CreateSupplierPayload {
                name: "مورد اختبار".to_owned(),
                phone: Some("0200".to_owned()),
                address: Some("الجيزة".to_owned()),
                balance_millieme: Some(31000),
                tax_number: Some("12345".to_owned()),
                notes: Some("ملاحظات".to_owned()),
            },
        )
        .await?;
        assert_eq!(created.name, "مورد اختبار");

        let listed = list_suppliers_impl(&pool, Some("اختبار".to_owned())).await?;
        assert_eq!(listed.len(), 1);

        let fetched = get_supplier_by_id(&pool, created.id).await?;
        assert_eq!(fetched.tax_number.as_deref(), Some("12345"));

        let updated = update_supplier_impl(
            &pool,
            created.id,
            UpdateSupplierPayload {
                name: Some("مورد محدث".to_owned()),
                phone: Some("0222".to_owned()),
                address: None,
                balance_millieme: Some(45000),
                tax_number: Some(String::new()),
                notes: Some(String::new()),
            },
        )
        .await?;
        assert_eq!(updated.name, "مورد محدث");
        assert_eq!(updated.balance_millieme, 45000);
        assert!(updated.tax_number.is_none());
        assert!(updated.notes.is_none());

        let deleted = delete_supplier_impl(&pool, created.id).await?;
        assert!(deleted);

        let listed_after_delete = list_suppliers_impl(&pool, Some("محدث".to_owned())).await?;
        assert!(listed_after_delete.is_empty());

        Ok(())
    }
}
