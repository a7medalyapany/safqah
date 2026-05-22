mod db;

use serde::Serialize;
use tauri::{Manager, State};

use db::DbPool;

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
async fn get_db_info(pool: State<'_, DbPool>) -> Result<DbInfo, String> {
    let row: (String,) = sqlx::query_as("PRAGMA journal_mode;")
        .fetch_one(&*pool)
        .await
        .map_err(|err| err.to_string())?;

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
        .invoke_handler(tauri::generate_handler![greet, get_db_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
