use std::{
    collections::HashMap,
    fs::File,
    io::{BufWriter, Cursor},
    path::PathBuf,
};

use arabic_reshaper::arabic_reshape;
use printpdf::{Line, Mm, PdfDocument, Point};
use unicode_bidi::BidiInfo;

use crate::{
    errors::AppError,
    models::sale::InvoiceDetail,
};

const PAGE_WIDTH_MM: f64 = 148.0;
const PAGE_HEIGHT_MM: f64 = 210.0;
const LEFT_MARGIN_MM: f64 = 10.0;
const RIGHT_MARGIN_MM: f64 = 10.0;

pub fn generate_invoice_pdf(
    invoice: &InvoiceDetail,
    settings: &HashMap<String, String>,
) -> Result<PathBuf, AppError> {
    let (doc, page, layer) = PdfDocument::new(
        &format!("invoice_{}", invoice.id),
        Mm(PAGE_WIDTH_MM as f32),
        Mm(PAGE_HEIGHT_MM as f32),
        "Layer 1",
    );
    let current_layer = doc.get_page(page).get_layer(layer);
    let font = doc
        .add_external_font(Cursor::new(include_bytes!("../../resources/fonts/Amiri-Regular.ttf")))
        .map_err(pdf_error)?;

    let shop_name = setting_text(settings, "shop_name", "صفقة");
    let shop_phone = setting_text(settings, "shop_phone", "");
    let shop_address = setting_text(settings, "shop_address", "العنوان غير محدد");
    let thank_you_message = setting_text(
        settings,
        "thank_you_message",
        "شكراً لزيارتكم — نتطلع لخدمتكم مجدداً",
    );

    let mut cursor_y = 200.0;
    draw_centered_text(&current_layer, &font, &shop_name, 16.0, cursor_y);
    cursor_y -= 8.0;
    if !shop_phone.is_empty() {
        draw_centered_text(&current_layer, &font, &shop_phone, 10.0, cursor_y);
        cursor_y -= 6.0;
    }
    draw_centered_text(&current_layer, &font, &shop_address, 10.0, cursor_y);
    cursor_y -= 8.0;
    draw_separator(&current_layer, cursor_y);
    cursor_y -= 10.0;

    let created_date = invoice
        .created_at
        .split_whitespace()
        .next()
        .unwrap_or(&invoice.created_at);
    let cashier_name = invoice
        .cashier_name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("غير محدد");

    draw_text_right(
        &current_layer,
        &font,
        &format!("رقم الفاتورة: {}", invoice.invoice_number),
        PAGE_WIDTH_MM - RIGHT_MARGIN_MM,
        cursor_y,
        11.0,
    );
    draw_text(
        &current_layer,
        &font,
        &format!("العميل: {}", invoice.customer_name.as_deref().unwrap_or("عميل عام")),
        LEFT_MARGIN_MM,
        cursor_y,
        11.0,
    );
    cursor_y -= 7.0;
    draw_text_right(
        &current_layer,
        &font,
        &format!("التاريخ: {created_date}"),
        PAGE_WIDTH_MM - RIGHT_MARGIN_MM,
        cursor_y,
        11.0,
    );
    draw_text(
        &current_layer,
        &font,
        &format!("الكاشير: {cashier_name}"),
        LEFT_MARGIN_MM,
        cursor_y,
        11.0,
    );
    cursor_y -= 7.0;
    draw_text_right(
        &current_layer,
        &font,
        &format!("طريقة الدفع: {}", payment_method_arabic(&invoice.payment_method)),
        PAGE_WIDTH_MM - RIGHT_MARGIN_MM,
        cursor_y,
        11.0,
    );
    draw_text(
        &current_layer,
        &font,
        &format!("الحالة: {}", status_arabic(&invoice.status)),
        LEFT_MARGIN_MM,
        cursor_y,
        11.0,
    );
    cursor_y -= 8.0;
    draw_separator(&current_layer, cursor_y);
    cursor_y -= 10.0;

    let headers = ["الصنف", "الكمية", "السعر", "الخصم", "الإجمالي"];
    let widths = [58.0, 16.0, 18.0, 18.0, 18.0];
    draw_table_row(&current_layer, &font, &headers, &widths, cursor_y, 10.5);
    cursor_y -= 8.0;

    for item in &invoice.items {
        let row = [
            item.item_name_ar.as_str(),
            &item.qty.to_string(),
            &format_money_plain(item.unit_price_millieme),
            &format_money_plain(item.discount_millieme),
            &format_money_plain(item.total_millieme),
        ];
        draw_table_row(&current_layer, &font, &row, &widths, cursor_y, 10.0);
        cursor_y -= 7.5;
    }

    cursor_y -= 2.0;
    draw_separator(&current_layer, cursor_y);
    cursor_y -= 10.0;

    let totals_right_edge = PAGE_WIDTH_MM - RIGHT_MARGIN_MM;
    draw_money_line(
        &current_layer,
        &font,
        "المجموع الفرعي",
        &format_money_plain(invoice.subtotal_millieme),
        totals_right_edge,
        cursor_y,
        78.0,
        false,
    );
    cursor_y -= 7.0;
    if invoice.discount_millieme > 0 {
        draw_money_line(
            &current_layer,
            &font,
            "الخصم",
            &format_money_plain(invoice.discount_millieme),
            totals_right_edge,
            cursor_y,
            78.0,
            false,
        );
        cursor_y -= 7.0;
    }
    draw_money_line(
        &current_layer,
        &font,
        "الإجمالي",
        &format_money_plain(invoice.total_millieme),
        totals_right_edge,
        cursor_y,
        78.0,
        true,
    );
    cursor_y -= 7.0;
    draw_money_line(
        &current_layer,
        &font,
        "المدفوع",
        &format_money_plain(invoice.paid_millieme),
        totals_right_edge,
        cursor_y,
        78.0,
        false,
    );
    cursor_y -= 7.0;
    let remaining = (invoice.total_millieme - invoice.paid_millieme).max(0);
    if remaining > 0 {
        draw_money_line(
            &current_layer,
            &font,
            "المتبقي",
            &format_money_plain(remaining),
            totals_right_edge,
            cursor_y,
            78.0,
            false,
        );
        cursor_y -= 7.0;
    }

    if let Some(balance_line) = customer_balance_line(settings, invoice) {
        cursor_y -= 2.0;
        draw_separator(&current_layer, cursor_y);
        cursor_y -= 10.0;
        draw_centered_text(&current_layer, &font, &balance_line, 11.0, cursor_y);
        cursor_y -= 8.0;
    }

    cursor_y -= 2.0;
    draw_separator(&current_layer, cursor_y);
    cursor_y -= 10.0;
    draw_centered_text(&current_layer, &font, &thank_you_message, 11.0, cursor_y);

    let temp_path = std::env::temp_dir().join(format!("invoice_{}.pdf", invoice.id));
    let file = File::create(&temp_path).map_err(pdf_error)?;
    doc.save(&mut BufWriter::new(file)).map_err(pdf_error)?;

    Ok(temp_path)
}

fn customer_balance_line(
    settings: &HashMap<String, String>,
    invoice: &InvoiceDetail,
) -> Option<String> {
    let customer_id = invoice.customer_id?;
    let balance_key = format!("customer_balance_{customer_id}");
    let balance_value = settings.get(&balance_key)?;
    let balance_millieme = balance_value.trim().parse::<i64>().ok()?;

    Some(if balance_millieme > 0 {
        format!(
            "رصيد العميل المستحق: {} جنيه",
            format_money_plain(balance_millieme)
        )
    } else if balance_millieme < 0 {
        format!(
            "رصيد لصالح العميل: {} جنيه",
            format_money_plain(balance_millieme.abs())
        )
    } else {
        "الحساب متوازن ✓".to_owned()
    })
}

fn draw_table_row(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    values: &[&str],
    widths: &[f64],
    y: f64,
    font_size: f64,
) {
    let mut cursor_x = LEFT_MARGIN_MM;
    for (value, width) in values.iter().zip(widths.iter()) {
        draw_text_right(layer, font, value, cursor_x + *width, y, font_size);
        cursor_x += *width;
    }
}

fn draw_money_line(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    label: &str,
    value: &str,
    right_edge: f64,
    y: f64,
    label_width: f64,
    strong: bool,
) {
    let font_size = if strong { 12.0 } else { 11.0 };
    draw_text_right(layer, font, value, right_edge, y, font_size);
    draw_text(layer, font, label, right_edge - label_width, y, font_size);
}

fn draw_centered_text(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    text: &str,
    font_size: f64,
    y: f64,
) {
    let shaped = shape_rtl(text);
    let width = estimate_text_width_mm(&shaped, font_size);
    let x = ((PAGE_WIDTH_MM - width) / 2.0).max(LEFT_MARGIN_MM);
    layer.use_text(
        shaped,
        font_size as f32,
        Mm(x as f32),
        Mm(y as f32),
        font,
    );
}

fn draw_text(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    text: &str,
    x: f64,
    y: f64,
    font_size: f64,
) {
    layer.use_text(
        shape_rtl(text),
        font_size as f32,
        Mm(x as f32),
        Mm(y as f32),
        font,
    );
}

fn draw_text_right(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    text: &str,
    right_edge: f64,
    y: f64,
    font_size: f64,
) {
    let shaped = shape_rtl(text);
    let width = estimate_text_width_mm(&shaped, font_size);
    let x = (right_edge - width).max(LEFT_MARGIN_MM);
    layer.use_text(
        shaped,
        font_size as f32,
        Mm(x as f32),
        Mm(y as f32),
        font,
    );
}

fn draw_separator(layer: &printpdf::PdfLayerReference, y: f64) {
    let line = Line {
        points: vec![
            (
                Point::new(Mm(LEFT_MARGIN_MM as f32), Mm(y as f32)),
                false,
            ),
            (
                Point::new(
                    Mm((PAGE_WIDTH_MM - RIGHT_MARGIN_MM) as f32),
                    Mm(y as f32),
                ),
                false,
            ),
        ],
        is_closed: false,
    };
    layer.add_line(line);
}

fn shape_rtl(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    let reshaped = arabic_reshape(text);
    let bidi = BidiInfo::new(&reshaped, None);
    let paragraph = &bidi.paragraphs[0];
    bidi.reorder_line(paragraph, 0..reshaped.len()).to_string()
}

fn estimate_text_width_mm(text: &str, font_size: f64) -> f64 {
    let char_count = text.chars().count() as f64;
    char_count * font_size * 0.32
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

fn setting_text(settings: &HashMap<String, String>, key: &str, default: &str) -> String {
    settings
        .get(key)
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or(default)
        .to_owned()
}

fn format_money_plain(millieme: i64) -> String {
    format!("{:.2}", millieme as f64 / 1000.0)
}

fn pdf_error(error: impl std::fmt::Display) -> AppError {
    AppError::new(
        "PDF_ERROR",
        "تعذر إنشاء ملف PDF",
        &format!("PDF generation failed: {error}"),
    )
}