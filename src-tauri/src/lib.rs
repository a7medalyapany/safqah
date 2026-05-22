mod commands;
mod db;
mod errors;
mod models;
mod services;

use serde::Serialize;
use tauri::{Manager, State};

use commands::{
    customers::{create_customer, delete_customer, get_customer, list_customers, update_customer},
    force_error, ping,
    items::{
        create_category, create_item, delete_category, delete_item, get_item_by_barcode,
        list_categories, list_items, update_item,
    },
    print::{list_printers, print_receipt},
    sales::{
        create_sale_invoice, get_invoice_detail, get_invoice_stats, list_invoices, search_items,
    },
    sessions::{
        close_session, get_active_session, get_session_sales_total_millieme, open_session,
    },
    suppliers::{create_supplier, delete_supplier, get_supplier, list_suppliers, update_supplier},
};
use db::DbPool;
use errors::AppError;
use services::print_queue::{new_print_queue, start_print_queue_worker};

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
            let print_queue = new_print_queue();
            app.manage(pool);
            app.manage(print_queue.clone());
            start_print_queue_worker(print_queue, app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_db_info,
            ping,
            force_error,
            list_items,
            search_items,
            get_item_by_barcode,
            create_item,
            update_item,
            delete_item,
            list_categories,
            create_category,
            delete_category,
            list_customers,
            get_customer,
            create_customer,
            update_customer,
            delete_customer,
            get_active_session,
            open_session,
            close_session,
            get_session_sales_total_millieme,
            create_sale_invoice,
            list_invoices,
            get_invoice_detail,
            get_invoice_stats,
            print_receipt,
            list_printers,
            list_suppliers,
            get_supplier,
            create_supplier,
            update_supplier,
            delete_supplier
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
