use std::collections::HashMap;

use sqlx::Row;
use tauri::State;

use crate::{
    db::{database_file_path, DbPool},
    errors::AppError,
};

async fn settings_table_exists(pool: &DbPool) -> Result<bool, AppError> {
    let exists: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
    )
    .fetch_one(pool)
    .await?;

    Ok(exists.0 > 0)
}

pub async fn fetch_settings_map(pool: &DbPool) -> Result<HashMap<String, String>, AppError> {
    if !settings_table_exists(pool).await? {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query("SELECT key, value FROM settings")
        .fetch_all(pool)
        .await?;

    let mut settings = HashMap::with_capacity(rows.len());
    for row in rows {
        let key: String = row.try_get("key")?;
        let value: String = row.try_get("value")?;
        settings.insert(key, value);
    }

    Ok(settings)
}

pub async fn get_setting_value(pool: &DbPool, key: &str) -> Result<Option<String>, AppError> {
    if !settings_table_exists(pool).await? {
        return Ok(None);
    }

    let value = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;

    Ok(value)
}

#[tauri::command]
pub async fn get_settings(pool: State<'_, DbPool>) -> Result<HashMap<String, String>, AppError> {
    fetch_settings_map(&pool).await
}

#[tauri::command]
pub async fn update_settings(
    pool: State<'_, DbPool>,
    updates: HashMap<String, String>,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;

    for (key, value) in updates {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO settings (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            "#,
        )
        .bind(key)
        .bind(value)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(true)
}

#[tauri::command]
pub async fn get_setting(pool: State<'_, DbPool>, key: String) -> Result<Option<String>, AppError> {
    get_setting_value(&pool, &key).await
}

#[tauri::command]
pub async fn vacuum_database(pool: State<'_, DbPool>) -> Result<bool, AppError> {
    sqlx::query("VACUUM").execute(&*pool).await?;
    Ok(true)
}

#[tauri::command]
pub async fn get_db_file_size() -> Result<u64, AppError> {
    let path = database_file_path()?;
    let metadata = std::fs::metadata(path).map_err(|error| {
        AppError::new(
            "DB_FILE_SIZE_ERROR",
            "تعذر قراءة حجم قاعدة البيانات",
            &format!("Failed to read database file size: {error}"),
        )
    })?;
    Ok(metadata.len())
}

#[tauri::command]
pub async fn is_first_launch(pool: State<'_, DbPool>) -> Result<bool, AppError> {
    let result: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'setup_complete'")
            .fetch_optional(&*pool)
            .await?;

    Ok(result.map(|(v,)| v != "1").unwrap_or(true))
}

#[tauri::command]
pub async fn complete_setup(pool: State<'_, DbPool>) -> Result<bool, AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO settings (key, value, updated_at)
         VALUES ('setup_complete', '1', datetime('now'))",
    )
    .execute(&*pool)
    .await?;

    Ok(true)
}

#[tauri::command]
pub async fn seed_sample_data(pool: State<'_, DbPool>) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;

    // ── Categories (electricity equipment) ──
    let categories = vec![
        "كابلات وأسلاك",
        "مفاتيح وقواطع",
        "إضاءة",
        "مقابس وتوصيلات",
        "أدوات كهربائية",
        "حماية وتأريض",
        "متنوع",
    ];
    for cat in &categories {
        sqlx::query("INSERT OR IGNORE INTO categories (name_ar) VALUES (?)")
            .bind(cat)
            .execute(&mut *tx)
            .await?;
    }

    let (cables_id,): (i64,) =
        sqlx::query_as("SELECT id FROM categories WHERE name_ar = 'كابلات وأسلاك'")
            .fetch_one(&mut *tx)
            .await?;
    let (switches_id,): (i64,) =
        sqlx::query_as("SELECT id FROM categories WHERE name_ar = 'مفاتيح وقواطع'")
            .fetch_one(&mut *tx)
            .await?;
    let (lighting_id,): (i64,) =
        sqlx::query_as("SELECT id FROM categories WHERE name_ar = 'إضاءة'")
            .fetch_one(&mut *tx)
            .await?;
    let (sockets_id,): (i64,) =
        sqlx::query_as("SELECT id FROM categories WHERE name_ar = 'مقابس وتوصيلات'")
            .fetch_one(&mut *tx)
            .await?;
    let (tools_id,): (i64,) =
        sqlx::query_as("SELECT id FROM categories WHERE name_ar = 'أدوات كهربائية'")
            .fetch_one(&mut *tx)
            .await?;

    struct SeedItem {
        barcode: &'static str,
        name_ar: &'static str,
        category_id: i64,
        buy_price: i64,
        sell_price: i64,
        stock: i64,
        min_stock: i64,
        unit: &'static str,
    }

    let items = vec![
        SeedItem {
            barcode: "2000000001",
            name_ar: "كابل نحاس 1.5 مم — متر",
            category_id: cables_id,
            buy_price: 8000,
            sell_price: 12000,
            stock: 500,
            min_stock: 100,
            unit: "متر",
        },
        SeedItem {
            barcode: "2000000002",
            name_ar: "كابل نحاس 2.5 مم — متر",
            category_id: cables_id,
            buy_price: 13000,
            sell_price: 18000,
            stock: 300,
            min_stock: 100,
            unit: "متر",
        },
        SeedItem {
            barcode: "2000000003",
            name_ar: "كابل نحاس 4 مم — متر",
            category_id: cables_id,
            buy_price: 20000,
            sell_price: 28000,
            stock: 200,
            min_stock: 50,
            unit: "متر",
        },
        SeedItem {
            barcode: "2000000004",
            name_ar: "قاطع تلقائي 16 أمبير",
            category_id: switches_id,
            buy_price: 35000,
            sell_price: 55000,
            stock: 50,
            min_stock: 10,
            unit: "قطعة",
        },
        SeedItem {
            barcode: "2000000005",
            name_ar: "قاطع تلقائي 32 أمبير",
            category_id: switches_id,
            buy_price: 55000,
            sell_price: 80000,
            stock: 30,
            min_stock: 10,
            unit: "قطعة",
        },
        SeedItem {
            barcode: "2000000006",
            name_ar: "لمبة LED 9 واط",
            category_id: lighting_id,
            buy_price: 18000,
            sell_price: 30000,
            stock: 100,
            min_stock: 20,
            unit: "قطعة",
        },
        SeedItem {
            barcode: "2000000007",
            name_ar: "لمبة LED 18 واط",
            category_id: lighting_id,
            buy_price: 28000,
            sell_price: 45000,
            stock: 80,
            min_stock: 20,
            unit: "قطعة",
        },
        SeedItem {
            barcode: "2000000008",
            name_ar: "بريزة أرضي 3 دبوس",
            category_id: sockets_id,
            buy_price: 15000,
            sell_price: 25000,
            stock: 60,
            min_stock: 15,
            unit: "قطعة",
        },
        SeedItem {
            barcode: "2000000009",
            name_ar: "وصلة كهرباء 5 فيش",
            category_id: sockets_id,
            buy_price: 40000,
            sell_price: 65000,
            stock: 40,
            min_stock: 10,
            unit: "قطعة",
        },
        SeedItem {
            barcode: "2000000010",
            name_ar: "لاصق كهربائي أسود — لفة",
            category_id: tools_id,
            buy_price: 5000,
            sell_price: 8000,
            stock: 200,
            min_stock: 50,
            unit: "لفة",
        },
    ];

    for item in &items {
        let result = sqlx::query(
            r#"INSERT OR IGNORE INTO items
               (barcode, name_ar, category_id, buy_price_millieme,
                sell_price_millieme, current_stock, min_stock, unit)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(item.barcode)
        .bind(item.name_ar)
        .bind(item.category_id)
        .bind(item.buy_price)
        .bind(item.sell_price)
        .bind(item.stock)
        .bind(item.min_stock)
        .bind(item.unit)
        .execute(&mut *tx)
        .await?;

        let item_id = result.last_insert_rowid();
        if item_id > 0 && item.stock > 0 {
            sqlx::query(
                "INSERT INTO stock_movements
                   (item_id, delta, movement_type, notes)
                 VALUES (?, ?, 'adjustment', 'بيانات تجريبية أولية')",
            )
            .bind(item_id)
            .bind(item.stock)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Sample customer and supplier typical for electricity shops
    sqlx::query(
        "INSERT OR IGNORE INTO customers (name, phone)
         VALUES ('مقاول تجريبي', '01000000000')",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO suppliers (name, phone)
         VALUES ('موزع كهرباء تجريبي', '0200000000')",
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(true)
}
