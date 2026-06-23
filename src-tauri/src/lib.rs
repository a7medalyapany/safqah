mod commands;
mod db;
mod errors;
mod models;
mod services;

use serde::Serialize;
use tauri::{Manager, State};

use commands::{
    auth::{
        create_user, deactivate_user, get_current_user, list_users, login, logout, update_user,
    },
    customers::{create_customer, delete_customer, get_customer, list_customers, update_customer},
    finance::{
        create_expense, get_all_deferred_invoices, get_cash_summary, get_customer_ledger,
        list_expense_categories, list_expenses, list_payments, record_customer_payment,
        record_invoice_payment, record_supplier_payment,
    },
    force_error, ping,
    inventory::get_item_movements,
    inventory::adjust_stock,
    items::{
        create_category, create_item, delete_category, delete_item, get_item_by_barcode,
        list_categories, list_items, update_item,
    },
    print::{
        generate_invoice_pdf, get_barcode_print_data, get_invoice_print_data,
        get_label_printer_list, get_purchase_print_data, get_return_print_data, list_printers,
        open_whatsapp_with_invoice,
    },
    reports::{
        report_customer_balances, report_daily_sales, report_low_stock, report_payment_methods,
        report_profit_analysis, report_sales_by_period, report_supplier_balances,
        report_top_items,
    },
    sales::{
        create_return, create_sale_invoice, get_invoice_detail, get_invoice_stats, list_invoices,
        search_items,
    },
    purchases::{
        create_purchase_invoice, get_item_purchase_history, get_purchase_detail, get_purchase_stats,
        list_purchases, update_purchase_invoice,
    },
    backup::{list_backups, restore_backup, trigger_backup},
    sessions::{
        close_session, get_active_session, get_session_sales_total_millieme, open_session,
    },
    suppliers::{create_supplier, delete_supplier, get_supplier, list_suppliers, update_supplier},
    settings::{
        get_db_file_size,
        get_setting,
        get_settings,
        update_settings,
        vacuum_database,
        is_first_launch,
        complete_setup,
        seed_sample_data,
    },
    customers::import_customers_csv,
    items::import_items_csv,
    suppliers::import_suppliers_csv,
};
use db::DbPool;
use errors::AppError;
use services::backup::BackupService;

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::get_pool());
            let backup_service = BackupService::new();
            app.manage(pool);
            app.manage(backup_service.clone());
            let backup_worker = backup_service.clone();

            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(4 * 60 * 60)).await;

                    if let Err(error) = backup_worker.create_backup() {
                        eprintln!("Automatic periodic backup failed: {error:?}");
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_db_info,
            login,
            logout,
            get_current_user,
            list_users,
            create_user,
            update_user,
            deactivate_user,
            ping,
            force_error,
            list_items,
            search_items,
            get_item_by_barcode,
            create_item,
            update_item,
            delete_item,
            get_item_movements,
            adjust_stock,
            list_categories,
            create_category,
            delete_category,
            list_customers,
            get_customer,
            create_customer,
            update_customer,
            delete_customer,
            import_customers_csv,
            get_active_session,
            open_session,
            close_session,
            get_session_sales_total_millieme,
            trigger_backup,
            list_backups,
            restore_backup,
            create_sale_invoice,
            create_return,
            list_invoices,
            get_invoice_detail,
            get_invoice_stats,
            list_purchases,
            get_purchase_detail,
            create_purchase_invoice,
            update_purchase_invoice,
            get_purchase_stats,
            get_item_purchase_history,
            generate_invoice_pdf,
            get_invoice_print_data,
            get_purchase_print_data,
            get_return_print_data,
            get_barcode_print_data,
            open_whatsapp_with_invoice,
            list_printers,
            get_label_printer_list,
            create_expense,
            list_expenses,
            list_expense_categories,
            get_cash_summary,
            list_payments,
            record_customer_payment,
            record_supplier_payment,
            get_customer_ledger,
            get_all_deferred_invoices,
            record_invoice_payment,
            list_suppliers,
            get_supplier,
            create_supplier,
            update_supplier,
            delete_supplier,
            import_items_csv,
            import_suppliers_csv,
            get_settings,
            update_settings,
            get_setting,
            vacuum_database,
            get_db_file_size,
            is_first_launch,
            complete_setup,
            seed_sample_data,
            report_daily_sales,
            report_sales_by_period,
            report_top_items,
            report_low_stock,
            report_profit_analysis,
            report_payment_methods,
            report_customer_balances,
            report_supplier_balances
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
