use std::collections::HashMap;

use tauri::State;

use crate::{
    commands::purchases::get_purchase_detail_impl,
    commands::sales::fetch_invoice_detail,
    commands::sales::get_return_by_id,
    commands::settings::fetch_settings_map,
    db::DbPool,
    errors::AppError,
    models::item::Item,
    models::print::{
        BarcodePrintData, InvoicePrintData, InvoicePrintItem, PurchasePrintData, PurchasePrintItem,
        ReturnPrintData, ReturnPrintItem, ShopInfo,
    },
    services::invoice_pdf as invoice_pdf_service,
};

#[tauri::command]
pub async fn generate_invoice_pdf(
    pool: State<'_, DbPool>,
    invoice_id: i64,
) -> Result<String, AppError> {
    let invoice = fetch_invoice_detail(&pool, invoice_id).await?;
    let mut settings = fetch_settings_map(&pool).await?;
    inject_customer_balance(&pool, &invoice, &mut settings).await?;
    let path = invoice_pdf_service::generate_invoice_pdf(&invoice, &settings)?;

    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn open_whatsapp_with_invoice(
    pool: State<'_, DbPool>,
    invoice_id: i64,
    invoice_number: String,
) -> Result<bool, AppError> {
    let invoice = fetch_invoice_detail(&pool, invoice_id).await?;
    let mut settings = fetch_settings_map(&pool).await?;
    inject_customer_balance(&pool, &invoice, &mut settings).await?;
    let url = build_whatsapp_url(&settings, &invoice, &invoice_number);

    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| {
        AppError::new(
            "OPEN_URL_FAILED",
            "تعذر فتح واتساب",
            &format!("Failed to open WhatsApp URL: {error}"),
        )
    })?;

    Ok(true)
}

#[tauri::command]
pub async fn get_label_printer_list() -> Result<Vec<String>, AppError> {
    list_printers().await
}

#[tauri::command]
pub async fn list_printers() -> Result<Vec<String>, AppError> {
    match list_os_printers() {
        Ok(printers) => Ok(printers),
        Err(error) => {
            eprintln!("printer discovery failed: {}", error.message_en);
            Ok(Vec::new())
        }
    }
}

async fn shop_info_from_settings(pool: &DbPool) -> Result<ShopInfo, AppError> {
    let settings = fetch_settings_map(pool).await?;
    Ok(ShopInfo {
        shop_name: settings
            .get("shop_name")
            .cloned()
            .unwrap_or_else(|| "صفقة".to_owned()),
        shop_address: settings
            .get("shop_address")
            .cloned()
            .unwrap_or_else(|| "العنوان غير محدد".to_owned()),
        shop_phone: settings.get("shop_phone").cloned().unwrap_or_default(),
    })
}

async fn fetch_barcode_label_item(pool: &DbPool, item_id: i64) -> Result<Item, AppError> {
    sqlx::query_as::<_, Item>(
        r#"
        SELECT *
        FROM items
        WHERE id = ? AND is_active = 1
        "#,
    )
    .bind(item_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("الصنف"))
}

async fn fetch_customer_balance(pool: &DbPool, customer_id: i64) -> Result<Option<i64>, AppError> {
    let balance: Option<(i64,)> =
        sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
            .bind(customer_id)
            .fetch_optional(pool)
            .await?;
    Ok(balance.map(|(b,)| b))
}

#[tauri::command]
pub async fn get_invoice_print_data(
    pool: State<'_, DbPool>,
    invoice_id: i64,
) -> Result<InvoicePrintData, AppError> {
    let invoice = fetch_invoice_detail(&pool, invoice_id).await?;
    let shop = shop_info_from_settings(&pool).await?;

    let customer_balance_millieme = match invoice.customer_id {
        Some(customer_id) => fetch_customer_balance(&pool, customer_id).await?,
        None => None,
    };

    Ok(InvoicePrintData {
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        cashier_name: invoice.cashier_name,
        subtotal_millieme: invoice.subtotal_millieme,
        discount_millieme: invoice.discount_millieme,
        tax_millieme: invoice.tax_millieme,
        total_millieme: invoice.total_millieme,
        paid_millieme: invoice.paid_millieme,
        payment_method: invoice.payment_method,
        status: invoice.status,
        notes: invoice.notes,
        created_at: invoice.created_at,
        items: invoice
            .items
            .into_iter()
            .map(|item| InvoicePrintItem {
                item_name_ar: item.item_name_ar,
                qty: item.qty,
                unit_price_millieme: item.unit_price_millieme,
                discount_millieme: item.discount_millieme,
                total_millieme: item.total_millieme,
            })
            .collect(),
        shop,
        customer_balance_millieme,
    })
}

#[tauri::command]
pub async fn get_purchase_print_data(
    pool: State<'_, DbPool>,
    purchase_id: i64,
) -> Result<PurchasePrintData, AppError> {
    let purchase = get_purchase_detail_impl(&pool, purchase_id).await?;
    let shop = shop_info_from_settings(&pool).await?;

    Ok(PurchasePrintData {
        invoice_number: purchase.invoice_number,
        supplier_name: purchase.supplier_name,
        subtotal_millieme: purchase.subtotal_millieme,
        discount_millieme: purchase.discount_millieme,
        total_millieme: purchase.total_millieme,
        paid_millieme: purchase.paid_millieme,
        payment_method: purchase.payment_method,
        status: purchase.status,
        notes: purchase.notes,
        created_at: purchase.created_at,
        items: purchase
            .items
            .into_iter()
            .map(|item| PurchasePrintItem {
                item_name_ar: item.item_name_ar,
                qty: item.qty,
                unit_cost_millieme: item.unit_cost_millieme,
                total_millieme: item.total_millieme,
            })
            .collect(),
        shop,
    })
}

#[tauri::command]
pub async fn get_return_print_data(
    pool: State<'_, DbPool>,
    return_id: i64,
) -> Result<ReturnPrintData, AppError> {
    let return_data = get_return_by_id(&pool, return_id).await?;

    let original_invoice_number: String =
        sqlx::query_scalar("SELECT invoice_number FROM invoices WHERE id = ?")
            .bind(return_data.original_invoice_id)
            .fetch_optional(&*pool)
            .await?
            .ok_or_else(|| AppError::not_found("الفاتورة"))?;

    let item_names: HashMap<i64, String> = sqlx::query_as(
        "SELECT DISTINCT ri.item_id, i.name_ar FROM return_items ri JOIN items i ON i.id = ri.item_id WHERE ri.return_id = ?",
    )
    .bind(return_id)
    .fetch_all(&*pool)
    .await?
    .into_iter()
    .collect();

    let shop = shop_info_from_settings(&pool).await?;

    Ok(ReturnPrintData {
        return_number: return_data.return_number,
        original_invoice_id: return_data.original_invoice_id,
        original_invoice_number,
        total_millieme: return_data.total_millieme,
        refund_method: return_data.refund_method,
        status: return_data.status,
        notes: return_data.notes,
        created_at: return_data.created_at,
        items: return_data
            .items
            .into_iter()
            .map(|item| ReturnPrintItem {
                item_name_ar: item_names
                    .get(&item.item_id)
                    .cloned()
                    .unwrap_or_default(),
                qty: item.qty,
                unit_price_millieme: item.unit_price_millieme,
                total_millieme: item.total_millieme,
            })
            .collect(),
        shop,
    })
}

#[tauri::command]
pub async fn get_barcode_print_data(
    pool: State<'_, DbPool>,
    item_ids: Vec<i64>,
) -> Result<Vec<BarcodePrintData>, AppError> {
    let mut results = Vec::with_capacity(item_ids.len());

    for item_id in item_ids {
        let item = fetch_barcode_label_item(&pool, item_id).await?;

        let barcode = item
            .barcode
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                AppError::new(
                    "NO_BARCODE",
                    &format!("الصنف {} لا يحتوي على باركود", item.name_ar),
                    "Item has no barcode",
                )
            })?;

        results.push(BarcodePrintData {
            item_id,
            barcode: barcode.to_owned(),
            name_ar: item.name_ar,
            sell_price_millieme: item.sell_price_millieme,
        });
    }

    Ok(results)
}

async fn inject_customer_balance(
    pool: &DbPool,
    invoice: &crate::models::sale::InvoiceDetail,
    settings: &mut HashMap<String, String>,
) -> Result<(), AppError> {
    let Some(customer_id) = invoice.customer_id else {
        return Ok(());
    };

    let balance: Option<(i64,)> = sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
        .bind(customer_id)
        .fetch_optional(pool)
        .await?;

    if let Some((balance_millieme,)) = balance {
        settings.insert(
            format!("customer_balance_{customer_id}"),
            balance_millieme.to_string(),
        );
    }

    Ok(())
}

fn build_whatsapp_url(
    settings: &HashMap<String, String>,
    invoice: &crate::models::sale::InvoiceDetail,
    invoice_number: &str,
) -> String {
    let shop_name = setting_text(settings, "shop_name", "صفقة");
    let thank_you_message = setting_text(
        settings,
        "thank_you_message",
        "شكراً لزيارتكم — نتطلع لخدمتكم مجدداً",
    );

    let items_list = invoice
        .items
        .iter()
        .map(|item| {
            format!(
                "• {} × {} = {} جنيه",
                item.item_name_ar,
                item.qty,
                format_money_plain(item.total_millieme)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let payment_method = payment_method_arabic(&invoice.payment_method);
    let status = status_arabic(&invoice.status);
    let balance_line = customer_balance_line(settings, invoice);

    let mut message = format!(
        "🧾 فاتورة من {shop_name}\n\
         رقم الفاتورة: {invoice_number}\n\
         ──────────────\n\
         {items_list}\n\
         ──────────────\n\
         الإجمالي: {total} جنيه\n\
         المدفوع: {paid} جنيه\n\
         طريقة الدفع: {method}\n\
         الحالة: {status}",
        total = format_money_plain(invoice.total_millieme),
        paid = format_money_plain(invoice.paid_millieme),
        method = payment_method,
        status = status,
    );

    if !balance_line.is_empty() {
        message.push('\n');
        message.push_str(&balance_line);
    }

    message.push_str("\n──────────────\n");
    message.push_str(&thank_you_message);

    format!("https://wa.me/?text={}", urlencoding::encode(&message))
}

fn customer_balance_line(
    settings: &HashMap<String, String>,
    invoice: &crate::models::sale::InvoiceDetail,
) -> String {
    let Some(customer_id) = invoice.customer_id else {
        return String::new();
    };

    let Some(balance_value) = settings.get(&format!("customer_balance_{customer_id}")) else {
        return String::new();
    };

    let Ok(balance_millieme) = balance_value.trim().parse::<i64>() else {
        return String::new();
    };

    if balance_millieme > 0 {
        format!(
            "💳 رصيد مستحق: {} جنيه",
            format_money_plain(balance_millieme)
        )
    } else if balance_millieme < 0 {
        format!(
            "💚 رصيد لصالحك: {} جنيه",
            format_money_plain(balance_millieme.abs())
        )
    } else {
        String::new()
    }
}

fn setting_text(settings: &HashMap<String, String>, key: &str, default: &str) -> String {
    settings
        .get(key)
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or(default)
        .to_owned()
}

fn payment_method_arabic(method: &str) -> &'static str {
    match method {
        "cash" => "نقدي",
        "card" => "فيزا/كارت",
        "deferred" => "آجل",
        "split" => "دفع مختلط",
        _ => "غير محددة",
    }
}

fn status_arabic(status: &str) -> &'static str {
    match status {
        "paid" => "مدفوع ✓",
        "deferred" => "آجل",
        "partial" => "مدفوع جزئياً",
        _ => "غير محددة",
    }
}

fn format_money_plain(millieme: i64) -> String {
    format!("{:.2}", millieme as f64 / 1000.0)
}


fn list_os_printers() -> Result<Vec<String>, AppError> {
    #[cfg(target_os = "windows")]
    {
        let output = crate::services::windows_process::no_window_command("wmic")
            .args(["printer", "get", "name"])
            .output()
            .map_err(list_printers_error)?;

        if !output.status.success() {
            return Err(list_printers_error(std::io::Error::new(
                std::io::ErrorKind::Other,
                String::from_utf8_lossy(&output.stderr).to_string(),
            )));
        }

        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && *line != "Name")
            .map(ToOwned::to_owned)
            .collect())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = std::process::Command::new("lpstat")
            .arg("-a")
            .output()
            .map_err(list_printers_error)?;

        if !output.status.success() {
            return Err(list_printers_error(std::io::Error::new(
                std::io::ErrorKind::Other,
                String::from_utf8_lossy(&output.stderr).to_string(),
            )));
        }

        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| line.split_whitespace().next())
            .map(ToOwned::to_owned)
            .collect())
    }
}

fn list_printers_error(error: std::io::Error) -> AppError {
    AppError::new(
        "LIST_PRINTERS_FAILED",
        "تعذر قراءة قائمة الطابعات",
        &format!("Failed to list printers: {error}"),
    )
}
