use sqlx::{QueryBuilder, Sqlite};
use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    models::import::CsvImportReport,
    models::item::{Category, CreateItemPayload, Item, UpdateItemPayload},
};

#[derive(Debug, serde::Deserialize)]
struct ItemCsvRow {
    barcode: Option<String>,
    name_ar: String,
    name_en: Option<String>,
    category_id: Option<String>,
    category_name: Option<String>,
    buy_price_millieme: Option<String>,
    sell_price_millieme: Option<String>,
    color: Option<String>,
    size: Option<String>,
    unit: Option<String>,
    min_stock: Option<String>,
    current_stock: Option<String>,
    supplier_id: Option<String>,
    supplier_name: Option<String>,
    image_path: Option<String>,
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

async fn find_or_create_category_id(pool: &DbPool, name: &str) -> Result<Option<i64>, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    if let Some((id,)) = sqlx::query_as::<_, (i64,)>("SELECT id FROM categories WHERE name_ar = ?")
        .bind(trimmed)
        .fetch_optional(pool)
        .await?
    {
        return Ok(Some(id));
    }

    let result = sqlx::query("INSERT INTO categories (name_ar) VALUES (?)")
        .bind(trimmed)
        .execute(pool)
        .await?;

    Ok(Some(result.last_insert_rowid()))
}

async fn find_or_create_supplier_id(pool: &DbPool, name: &str) -> Result<Option<i64>, AppError> {
    let trimmed = name.trim().to_owned();
    if trimmed.is_empty() {
        return Ok(None);
    }

    if let Some((id,)) = sqlx::query_as::<_, (i64,)>(
        "SELECT id FROM suppliers WHERE name = ? AND is_active = 1",
    )
    .bind(&trimmed)
    .fetch_optional(pool)
    .await?
    {
        return Ok(Some(id));
    }

    let result = sqlx::query("INSERT INTO suppliers (name, is_active) VALUES (?, 1)")
        .bind(trimmed)
        .execute(pool)
        .await?;

    Ok(Some(result.last_insert_rowid()))
}

fn parse_optional_i64_field(value: Option<&str>) -> Result<Option<i64>, AppError> {
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

async fn resolve_category_id(
    pool: &DbPool,
    numeric_value: Option<&str>,
    named_value: Option<&str>,
) -> Result<Option<i64>, AppError> {
    if let Some(id) = parse_optional_i64_field(numeric_value)? {
        return Ok(Some(id));
    }

    if let Some(name) = named_value {
        return find_or_create_category_id(pool, name).await;
    }

    Ok(None)
}

async fn resolve_supplier_id(
    pool: &DbPool,
    numeric_value: Option<&str>,
    named_value: Option<&str>,
) -> Result<Option<i64>, AppError> {
    if let Some(id) = parse_optional_i64_field(numeric_value)? {
        return Ok(Some(id));
    }

    if let Some(name) = named_value {
        return find_or_create_supplier_id(pool, name).await;
    }

    Ok(None)
}

async fn get_item_by_id(pool: &DbPool, id: i64) -> Result<Item, AppError> {
    sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("الصنف"))
}

async fn list_items_impl(
    pool: &DbPool,
    search: Option<String>,
    category_id: Option<i64>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Item>, AppError> {
    let mut query = QueryBuilder::<Sqlite>::new("SELECT * FROM items WHERE is_active = 1");

    if let Some(search) = search.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }) {
        query.push(" AND (barcode = ");
        query.push_bind(search.clone());
        query.push(" OR name_ar LIKE ");
        query.push_bind(format!("{search}%"));
        query.push(")");
    }

    if let Some(category_id) = category_id {
        query.push(" AND category_id = ");
        query.push_bind(category_id);
    }

    query.push(" ORDER BY name_ar ASC");

    let limit = limit.unwrap_or(50).min(200);
    let offset = offset.unwrap_or(0);
    query.push(" LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    query
        .build_query_as::<Item>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn get_item_by_barcode_impl(
    pool: &DbPool,
    barcode: String,
) -> Result<Item, AppError> {
    let barcode = barcode.trim().to_owned();

    sqlx::query_as::<_, Item>("SELECT * FROM items WHERE barcode = ? AND is_active = 1")
        .bind(barcode)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("الصنف"))
}

async fn create_item_impl(
    pool: &DbPool,
    payload: CreateItemPayload,
) -> Result<Item, AppError> {
    let name_ar = payload.name_ar.trim().to_owned();
    if name_ar.is_empty() {
        return Err(AppError::validation("اسم الصنف مطلوب"));
    }

    let barcode = normalize_optional_string(payload.barcode);

    if let Some(ref barcode) = barcode {
        let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM items WHERE barcode = ?")
            .bind(barcode)
            .fetch_optional(pool)
            .await?;

        if existing.is_some() {
            return Err(AppError::new(
                "DUPLICATE_BARCODE",
                "الباركود مستخدم من قبل",
                "Barcode already exists",
            ));
        }
    }

    let unit = payload
        .unit
        .and_then(|value| {
            let trimmed = value.trim().to_owned();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .unwrap_or_else(|| "قطعة".to_owned());

    let current_stock = payload.current_stock.unwrap_or(0);

    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r#"
        INSERT INTO items (
          barcode,
          name_ar,
          name_en,
          category_id,
          buy_price_millieme,
          sell_price_millieme,
          color,
          size,
          unit,
          min_stock,
          current_stock,
          supplier_id,
          image_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(barcode)
    .bind(name_ar)
    .bind(normalize_optional_string(payload.name_en))
    .bind(payload.category_id)
    .bind(payload.buy_price_millieme)
    .bind(payload.sell_price_millieme)
    .bind(normalize_optional_string(payload.color))
    .bind(normalize_optional_string(payload.size))
    .bind(unit)
    .bind(payload.min_stock.unwrap_or(0))
    .bind(current_stock)
    .bind(payload.supplier_id)
    .bind(normalize_optional_string(payload.image_path))
    .execute(&mut *tx)
    .await?;

    let new_item_id = result.last_insert_rowid();

    if current_stock > 0 {
        sqlx::query(
            r#"
            INSERT INTO stock_movements (
              item_id, delta, movement_type, reference_type
            )
            VALUES (?, ?, 'adjustment', 'manual')
            "#,
        )
        .bind(new_item_id)
        .bind(current_stock)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    get_item_by_id(pool, new_item_id).await
}

async fn update_item_impl(
    pool: &DbPool,
    id: i64,
    payload: UpdateItemPayload,
) -> Result<Item, AppError> {
    if let Some(name_ar) = payload.name_ar.as_ref() {
        if name_ar.trim().is_empty() {
            return Err(AppError::validation("اسم الصنف مطلوب"));
        }
    }

    let barcode = normalize_optional_string(payload.barcode);

    if let Some(ref barcode) = barcode {
        let existing: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM items WHERE barcode = ? AND id != ?")
                .bind(barcode)
                .bind(id)
                .fetch_optional(pool)
                .await?;

        if existing.is_some() {
            return Err(AppError::new(
                "DUPLICATE_BARCODE",
                "الباركود مستخدم من قبل",
                "Barcode already exists",
            ));
        }
    }

    let mut tx = pool.begin().await?;

    let (old_stock,): (i64,) =
        sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::not_found("الصنف"))?;

    let mut query = QueryBuilder::<Sqlite>::new("UPDATE items SET ");
    let mut has_updates = false;

    let mut push_separator = |query: &mut QueryBuilder<Sqlite>| {
        if has_updates {
            query.push(", ");
        } else {
            has_updates = true;
        }
    };

    if let Some(barcode) = barcode {
        push_separator(&mut query);
        query.push("barcode = ").push_bind(barcode);
    }

    if let Some(name_ar) = payload.name_ar {
        push_separator(&mut query);
        query
            .push("name_ar = ")
            .push_bind(name_ar.trim().to_owned());
    }

    if let Some(name_en) = payload.name_en {
        push_separator(&mut query);
        query
            .push("name_en = ")
            .push_bind(normalize_optional_string(Some(name_en)));
    }

    if let Some(category_id) = payload.category_id {
        push_separator(&mut query);
        query.push("category_id = ").push_bind(category_id);
    }

    if let Some(buy_price_millieme) = payload.buy_price_millieme {
        push_separator(&mut query);
        query
            .push("buy_price_millieme = ")
            .push_bind(buy_price_millieme);
    }

    if let Some(sell_price_millieme) = payload.sell_price_millieme {
        push_separator(&mut query);
        query
            .push("sell_price_millieme = ")
            .push_bind(sell_price_millieme);
    }

    if let Some(color) = payload.color {
        push_separator(&mut query);
        query
            .push("color = ")
            .push_bind(normalize_optional_string(Some(color)));
    }

    if let Some(size) = payload.size {
        push_separator(&mut query);
        query
            .push("size = ")
            .push_bind(normalize_optional_string(Some(size)));
    }

    if let Some(unit) = payload.unit {
        let unit = if unit.trim().is_empty() {
            "قطعة".to_owned()
        } else {
            unit.trim().to_owned()
        };
        push_separator(&mut query);
        query.push("unit = ").push_bind(unit);
    }

    if let Some(min_stock) = payload.min_stock {
        push_separator(&mut query);
        query.push("min_stock = ").push_bind(min_stock);
    }

    if let Some(new_stock) = payload.current_stock {
        push_separator(&mut query);
        query.push("current_stock = ").push_bind(new_stock);

        let delta = new_stock - old_stock;
        if delta != 0 {
            sqlx::query(
                r#"
                INSERT INTO stock_movements (
                  item_id, delta, movement_type, reference_type
                )
                VALUES (?, ?, 'adjustment', 'manual')
                "#,
            )
            .bind(id)
            .bind(delta)
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(supplier_id) = payload.supplier_id {
        push_separator(&mut query);
        query.push("supplier_id = ").push_bind(supplier_id);
    }

    if let Some(image_path) = payload.image_path {
        push_separator(&mut query);
        query
            .push("image_path = ")
            .push_bind(normalize_optional_string(Some(image_path)));
    }

    push_separator(&mut query);
    query.push("updated_at = datetime('now')");

    query.push(" WHERE id = ");
    query.push_bind(id);

    let result = query.build().execute(&mut *tx).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::not_found("الصنف"));
    }

    tx.commit().await?;

    get_item_by_id(pool, id).await
}

async fn delete_item_impl(pool: &DbPool, id: i64) -> Result<bool, AppError> {
    let result =
        sqlx::query("UPDATE items SET is_active = 0, updated_at = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

async fn list_categories_impl(pool: &DbPool) -> Result<Vec<Category>, AppError> {
    sqlx::query_as::<_, Category>("SELECT * FROM categories ORDER BY name_ar ASC")
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn create_category_impl(pool: &DbPool, name_ar: String) -> Result<Category, AppError> {
    let name_ar = name_ar.trim().to_owned();
    if name_ar.is_empty() {
        return Err(AppError::validation("اسم الفئة مطلوب"));
    }

    let result = sqlx::query("INSERT INTO categories (name_ar) VALUES (?)")
        .bind(name_ar)
        .execute(pool)
        .await?;

    let category = sqlx::query_as::<_, Category>("SELECT * FROM categories WHERE id = ?")
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await?;

    Ok(category)
}

async fn delete_category_impl(pool: &DbPool, id: i64) -> Result<bool, AppError> {
    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM items WHERE category_id = ? AND is_active = 1")
            .bind(id)
            .fetch_one(pool)
            .await?;

    if count > 0 {
        return Err(AppError::new(
            "CATEGORY_IN_USE",
            &format!("لا يمكن حذف التصنيف لأنه مستخدم في {count} أصناف"),
            &format!("Category is used in {count} items"),
        ));
    }

    let result = sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

async fn import_items_csv_impl(pool: &DbPool, file_path: String) -> Result<CsvImportReport, AppError> {
    let mut reader = csv::ReaderBuilder::new()
        .trim(csv::Trim::All)
        .flexible(true)
        .from_path(&file_path)
        .map_err(|error| csv_error(&error.to_string()))?;

    let mut report = CsvImportReport::default();

    for (index, row) in reader.deserialize::<ItemCsvRow>().enumerate() {
        match row {
            Ok(row) => {
                let buy_price_millieme = parse_required_i64(row.buy_price_millieme.as_deref())?;
                let sell_price_millieme = parse_required_i64(row.sell_price_millieme.as_deref())?;
                let min_stock = parse_optional_i64_field(row.min_stock.as_deref())?;
                let current_stock = parse_optional_i64_field(row.current_stock.as_deref())?;
                let category_id = resolve_category_id(
                    pool,
                    row.category_id.as_deref(),
                    row.category_name.as_deref(),
                )
                .await?;
                let supplier_id = resolve_supplier_id(
                    pool,
                    row.supplier_id.as_deref(),
                    row.supplier_name.as_deref(),
                )
                .await?;

                let payload = CreateItemPayload {
                    barcode: row.barcode,
                    name_ar: row.name_ar,
                    name_en: row.name_en,
                    category_id,
                    buy_price_millieme,
                    sell_price_millieme,
                    color: row.color,
                    size: row.size,
                    unit: row.unit,
                    min_stock,
                    current_stock,
                    supplier_id,
                    image_path: row.image_path,
                };

                match create_item_impl(pool, payload).await {
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

fn parse_required_i64(value: Option<&str>) -> Result<i64, AppError> {
    let Some(value) = value else {
        return Err(AppError::validation("قيمة رقمية مطلوبة في ملف CSV"));
    };

    value.trim().parse::<i64>().map_err(|_| {
        AppError::validation("قيمة رقمية غير صحيحة في ملف CSV")
    })
}

fn csv_error(message: &str) -> AppError {
    AppError::new("CSV_IMPORT_ERROR", "تعذر قراءة ملف CSV", message)
}

#[tauri::command]
pub async fn list_items(
    pool: State<'_, DbPool>,
    search: Option<String>,
    category_id: Option<i64>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Item>, AppError> {
    list_items_impl(&pool, search, category_id, limit, offset).await
}

#[tauri::command]
pub async fn get_item_by_barcode(
    pool: State<'_, DbPool>,
    barcode: String,
) -> Result<Item, AppError> {
    get_item_by_barcode_impl(&pool, barcode).await
}

#[tauri::command]
pub async fn create_item(
    pool: State<'_, DbPool>,
    payload: CreateItemPayload,
) -> Result<Item, AppError> {
    create_item_impl(&pool, payload).await
}

#[tauri::command]
pub async fn update_item(
    pool: State<'_, DbPool>,
    id: i64,
    payload: UpdateItemPayload,
) -> Result<Item, AppError> {
    update_item_impl(&pool, id, payload).await
}

#[tauri::command]
pub async fn delete_item(pool: State<'_, DbPool>, id: i64) -> Result<bool, AppError> {
    delete_item_impl(&pool, id).await
}

#[tauri::command]
pub async fn list_categories(pool: State<'_, DbPool>) -> Result<Vec<Category>, AppError> {
    list_categories_impl(&pool).await
}

#[tauri::command]
pub async fn create_category(
    pool: State<'_, DbPool>,
    name_ar: String,
) -> Result<Category, AppError> {
    create_category_impl(&pool, name_ar).await
}

#[tauri::command]
pub async fn delete_category(pool: State<'_, DbPool>, id: i64) -> Result<bool, AppError> {
    delete_category_impl(&pool, id).await
}

#[tauri::command]
pub async fn import_items_csv(
    pool: State<'_, DbPool>,
    file_path: String,
) -> Result<CsvImportReport, AppError> {
    import_items_csv_impl(&pool, file_path).await
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        ConnectOptions,
    };

    use super::*;

    static TEST_DB_COUNTER: AtomicU64 = AtomicU64::new(0);

    async fn test_pool() -> Result<DbPool, AppError> {
        let unique_suffix = TEST_DB_COUNTER.fetch_add(1, Ordering::Relaxed);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);

        let db_path = std::env::temp_dir().join(format!(
            "safqah-items-test-{}-{}-{}.db",
            std::process::id(),
            nanos,
            unique_suffix
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
    async fn item_crud_flow_works() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let category = create_category_impl(&pool, "فئة اختبار".to_owned())
            .await?;
        assert_eq!(category.name_ar, "فئة اختبار");

        let categories = list_categories_impl(&pool).await?;
        assert_eq!(categories.len(), 1);

        let created = create_item_impl(
            &pool,
            CreateItemPayload {
                barcode: Some("TEST-CRUD-1".to_owned()),
                name_ar: "صنف اختبار".to_owned(),
                name_en: None,
                category_id: Some(category.id),
                buy_price_millieme: 10000,
                sell_price_millieme: 12000,
                color: None,
                size: None,
                unit: Some("قطعة".to_owned()),
                min_stock: Some(1),
                current_stock: Some(5),
                supplier_id: None,
                image_path: None,
            },
        )
        .await?;
        assert_eq!(created.name_ar, "صنف اختبار");

        let listed =
            list_items_impl(&pool, Some("صنف".to_owned()), Some(category.id), None, None)
                .await?;
        assert_eq!(listed.len(), 1);

        let by_barcode = get_item_by_barcode_impl(&pool, "TEST-CRUD-1".to_owned()).await?;
        assert_eq!(by_barcode.id, created.id);

        let updated = update_item_impl(
            &pool,
            created.id,
            UpdateItemPayload {
                barcode: None,
                name_ar: Some("صنف محدث".to_owned()),
                name_en: None,
                category_id: None,
                buy_price_millieme: None,
                sell_price_millieme: Some(15000),
                color: None,
                size: None,
                unit: None,
                min_stock: None,
                current_stock: Some(7),
                supplier_id: None,
                image_path: None,
            },
        )
        .await?;
        assert_eq!(updated.name_ar, "صنف محدث");
        assert_eq!(updated.sell_price_millieme, 15000);
        assert_eq!(updated.current_stock, 7);

        let deleted = delete_item_impl(&pool, created.id).await?;
        assert!(deleted);

        let listed_after_delete =
            list_items_impl(&pool, Some("TEST-CRUD-1".to_owned()), None, None, None).await?;
        assert!(listed_after_delete.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn delete_category_fails_when_in_use_and_succeeds_when_unused() -> Result<(), AppError> {
        let pool = test_pool().await?;

        let used_category = create_category_impl(&pool, "فئة مستخدمة".to_owned())
            .await?;
        let unused_category = create_category_impl(&pool, "فئة غير مستخدمة".to_owned())
            .await?;

        create_item_impl(
            &pool,
            CreateItemPayload {
                barcode: Some("TEST-CATEGORY-USE".to_owned()),
                name_ar: "صنف مربوط".to_owned(),
                name_en: None,
                category_id: Some(used_category.id),
                buy_price_millieme: 10000,
                sell_price_millieme: 15000,
                color: None,
                size: None,
                unit: Some("قطعة".to_owned()),
                min_stock: Some(0),
                current_stock: Some(1),
                supplier_id: None,
                image_path: None,
            },
        )
        .await?;

        let error = delete_category_impl(&pool, used_category.id)
            .await
            .expect_err("used category should not be deleted");
        assert_eq!(error.code, "CATEGORY_IN_USE");
        assert_eq!(error.message_ar, "لا يمكن حذف التصنيف لأنه مستخدم في 1 أصناف");

        let deleted = delete_category_impl(&pool, unused_category.id)
            .await?;
        assert!(deleted);

        let categories = list_categories_impl(&pool).await?;
        assert_eq!(categories.len(), 1);
        assert_eq!(categories[0].id, used_category.id);

        Ok(())
    }
}
