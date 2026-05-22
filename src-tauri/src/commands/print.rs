use encoding_rs::WINDOWS_1256;
use sqlx::Row;
use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    services::print_queue::{enqueue_print_job, send_print_payload, PrintPayload, PrintQueue},
};

#[derive(Debug, sqlx::FromRow)]
struct ReceiptInvoice {
    invoice_number: String,
    customer_name: Option<String>,
    cashier_name: Option<String>,
    total_millieme: i64,
    paid_millieme: i64,
    created_at: String,
}

#[derive(Debug, sqlx::FromRow)]
struct ReceiptItem {
    item_name_ar: String,
    qty: i64,
    unit_price_millieme: i64,
}

#[derive(Debug)]
struct ReceiptSettings {
    shop_name: String,
    shop_address: String,
}

#[tauri::command]
pub async fn print_receipt(
    pool: State<'_, DbPool>,
    queue: State<'_, PrintQueue>,
    invoice_id: i64,
    printer_name: Option<String>,
) -> Result<(), AppError> {
    let invoice = fetch_receipt_invoice(&pool, invoice_id).await?;
    let items = fetch_receipt_items(&pool, invoice_id).await?;
    let settings = fetch_receipt_settings(&pool).await?;
    let bytes = build_receipt_bytes(&settings, &invoice, &items);
    let payload = PrintPayload {
        bytes,
        printer_name,
        invoice_id,
    };

    match send_print_payload(&payload) {
        Ok(()) => Ok(()),
        Err(error) => {
            eprintln!(
                "initial print failed for invoice {}: {}",
                invoice_id, error.message_en
            );
            enqueue_print_job(&queue, payload)?;
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn list_printers() -> Result<Vec<String>, AppError> {
    list_os_printers()
}

async fn fetch_receipt_invoice(
    pool: &DbPool,
    invoice_id: i64,
) -> Result<ReceiptInvoice, AppError> {
    sqlx::query_as::<_, ReceiptInvoice>(
        r#"
        SELECT
          invoices.invoice_number,
          customers.name AS customer_name,
          users.name AS cashier_name,
          invoices.total_millieme,
          invoices.paid_millieme,
          invoices.created_at
        FROM invoices
        LEFT JOIN customers ON customers.id = invoices.customer_id
        LEFT JOIN users ON users.id = invoices.cashier_id
        WHERE invoices.id = ?
        "#,
    )
    .bind(invoice_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("الفاتورة"))
}

async fn fetch_receipt_items(pool: &DbPool, invoice_id: i64) -> Result<Vec<ReceiptItem>, AppError> {
    sqlx::query_as::<_, ReceiptItem>(
        r#"
        SELECT item_name_ar, qty, unit_price_millieme
        FROM invoice_items
        WHERE invoice_id = ?
        ORDER BY id ASC
        "#,
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn fetch_receipt_settings(pool: &DbPool) -> Result<ReceiptSettings, AppError> {
    let has_settings_table: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
    )
    .fetch_one(pool)
    .await?;

    if has_settings_table.0 == 0 {
        return Ok(default_receipt_settings());
    }

    let rows =
        sqlx::query("SELECT key, value FROM settings WHERE key IN ('shop_name', 'shop_address')")
            .fetch_all(pool)
            .await?;

    let mut settings = default_receipt_settings();
    for row in rows {
        let key: String = row.try_get("key")?;
        let value: String = row.try_get("value")?;
        match key.as_str() {
            "shop_name" if !value.trim().is_empty() => settings.shop_name = value,
            "shop_address" if !value.trim().is_empty() => settings.shop_address = value,
            _ => {}
        }
    }

    Ok(settings)
}

fn default_receipt_settings() -> ReceiptSettings {
    ReceiptSettings {
        shop_name: "صفقة".to_owned(),
        shop_address: "العنوان غير محدد".to_owned(),
    }
}

fn build_receipt_bytes(
    settings: &ReceiptSettings,
    invoice: &ReceiptInvoice,
    items: &[ReceiptItem],
) -> Vec<u8> {
    let mut bytes = Vec::new();

    bytes.extend_from_slice(&[0x1b, b'@']);
    bytes.extend_from_slice(&[0x1b, b't', 22]);
    bytes.extend_from_slice(&[0x1b, b'a', 1]);
    bytes.extend_from_slice(&[0x1d, b'!', 0x11]);
    push_text_line(&mut bytes, &settings.shop_name);
    bytes.extend_from_slice(&[0x1d, b'!', 0x00]);
    push_text_line(&mut bytes, &settings.shop_address);
    push_separator(&mut bytes);

    bytes.extend_from_slice(&[0x1b, b'a', 2]);
    push_text_line(
        &mut bytes,
        &format!("رقم الفاتورة: {}", invoice.invoice_number),
    );
    push_text_line(
        &mut bytes,
        &format!("التاريخ: {}", format_receipt_date(&invoice.created_at)),
    );
    push_text_line(
        &mut bytes,
        &format!(
            "الكاشير: {}",
            invoice.cashier_name.as_deref().unwrap_or("admin")
        ),
    );
    if let Some(customer_name) = invoice.customer_name.as_deref() {
        push_text_line(&mut bytes, &format!("العميل: {customer_name}"));
    }
    push_separator(&mut bytes);

    push_text_line(&mut bytes, "الصنف          الكمية  السعر");
    for item in items {
        push_text_line(&mut bytes, &format_item_line(item));
    }
    push_separator(&mut bytes);

    let paid = invoice.paid_millieme;
    let remaining = (invoice.total_millieme - paid).max(0);
    push_text_line(
        &mut bytes,
        &format!(
            "الإجمالي:      {} ج.م",
            format_receipt_money(invoice.total_millieme)
        ),
    );
    push_text_line(
        &mut bytes,
        &format!("المدفوع:       {} ج.م", format_receipt_money(paid)),
    );
    push_text_line(
        &mut bytes,
        &format!("الباقي:        {} ج.م", format_receipt_money(remaining)),
    );
    push_separator(&mut bytes);

    bytes.extend_from_slice(&[0x1b, b'a', 1]);
    push_text_line(&mut bytes, "شكراً لزيارتكم");
    bytes.extend_from_slice(b"\n\n\n");
    bytes.extend_from_slice(&[0x1d, b'V', 0]);

    bytes
}

fn push_separator(bytes: &mut Vec<u8>) {
    push_text_line(bytes, "---------------------");
}

fn push_text_line(bytes: &mut Vec<u8>, text: &str) {
    let arabic_text = to_arabic_digits(text);
    let (encoded, _, _) = WINDOWS_1256.encode(&arabic_text);
    bytes.extend_from_slice(&encoded);
    bytes.push(b'\n');
}

fn format_item_line(item: &ReceiptItem) -> String {
    let name = truncate_chars(&item.item_name_ar, 14);
    format!(
        "{name:<14} {:>5} {:>8}",
        item.qty,
        format_receipt_money(item.unit_price_millieme)
    )
}

fn format_receipt_money(millieme: i64) -> String {
    let pounds = millieme / 1000;
    let fraction = (millieme.abs() % 1000) / 10;
    format!("{pounds}.{fraction:02}")
}

fn format_receipt_date(value: &str) -> String {
    let date = value.split_whitespace().next().unwrap_or(value);
    date.replace('-', "/")
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut output: String = value.chars().take(max_chars).collect();
    if value.chars().count() > max_chars {
        output.push_str("...");
    }
    output
}

fn to_arabic_digits(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            '0' => '٠',
            '1' => '١',
            '2' => '٢',
            '3' => '٣',
            '4' => '٤',
            '5' => '٥',
            '6' => '٦',
            '7' => '٧',
            '8' => '٨',
            '9' => '٩',
            '.' => '٫',
            _ => ch,
        })
        .collect()
}

fn list_os_printers() -> Result<Vec<String>, AppError> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("wmic")
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
