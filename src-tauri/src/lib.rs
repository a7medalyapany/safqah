mod commands;
mod db;
mod errors;
mod models;

use serde::Serialize;
use tauri::{Manager, State};

use commands::{
    force_error, ping,
    items::{
        create_category, create_item, delete_item, get_item_by_barcode, list_categories,
        list_items, update_item,
    },
};
use db::DbPool;
use errors::AppError;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Debug, Serialize)]
struct DbInfo {
    journal_mode: String,
}

#[tauri::command]
async fn get_db_info(pool: State<'_, DbPool>) -> Result<DbInfo, AppError> {
    let row: (String,) = sqlx::query_as("PRAGMA journal_mode;")
        .fetch_one(&*pool)
        .await?;

    Ok(DbInfo {
        journal_mode: row.0,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::get_pool());
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_db_info,
            ping,
            force_error,
            list_items,
            get_item_by_barcode,
            create_item,
            update_item,
            delete_item,
            list_categories,
            create_category
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
