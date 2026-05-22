use sqlx::{QueryBuilder, Sqlite, Transaction};
use tauri::State;

use crate::{
    db::DbPool,
    errors::AppError,
    models::{
        customer::Customer,
        item::Item,
        sale::{CreateSaleInvoicePayload, CreateSaleInvoiceResponse, Invoice},
    },
};

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

fn compute_line_total(qty: i64, unit_price_millieme: i64, discount_millieme: i64) -> i64 {
    (qty * unit_price_millieme - discount_millieme).max(0)
}

async fn get_active_customer_by_id(
    tx: &mut Transaction<'_, Sqlite>,
    id: i64,
) -> Result<Customer, AppError> {
    sqlx::query_as::<_, Customer>("SELECT * FROM customers WHERE id = ? AND is_active = 1")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::not_found("العميل"))
}

async fn get_active_item_by_id(
    tx: &mut Transaction<'_, Sqlite>,
    id: i64,
) -> Result<Item, AppError> {
    sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ? AND is_active = 1")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::not_found("الصنف"))
}

async fn get_invoice_by_id(
    tx: &mut Transaction<'_, Sqlite>,
    id: i64,
) -> Result<Invoice, AppError> {
    sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = ?")
        .bind(id)
        .fetch_one(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn ensure_open_session(tx: &mut Transaction<'_, Sqlite>, session_id: i64) -> Result<(), AppError> {
    let session: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM sessions WHERE id = ? AND status = 'open'")
            .bind(session_id)
            .fetch_optional(&mut **tx)
            .await?;

    if session.is_none() {
        return Err(AppError::validation("لا توجد وردية مفتوحة لإتمام البيع"));
    }

    Ok(())
}

async fn search_items_impl(
    pool: &DbPool,
    query: Option<String>,
    category_id: Option<i64>,
) -> Result<Vec<Item>, AppError> {
    let mut sql = QueryBuilder::<Sqlite>::new("SELECT * FROM items WHERE is_active = 1");

    if let Some(query) = normalize_optional_string(query) {
        sql.push(" AND (name_ar LIKE ");
        sql.push_bind(format!("%{query}%"));
        sql.push(" OR barcode = ");
        sql.push_bind(query);
        sql.push(")");
    }

    if let Some(category_id) = category_id {
        sql.push(" AND category_id = ");
        sql.push_bind(category_id);
    }

    sql.push(" ORDER BY name_ar ASC LIMIT 100");

    sql.build_query_as::<Item>()
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

async fn create_sale_invoice_impl(
    pool: &DbPool,
    payload: CreateSaleInvoicePayload,
) -> Result<CreateSaleInvoiceResponse, AppError> {
    if payload.items.is_empty() {
        return Err(AppError::validation("أضف صنفًا واحدًا على الأقل"));
    }

    if payload.global_discount_millieme < 0
        || payload.paid_cash_millieme < 0
        || payload.paid_card_millieme < 0
    {
        return Err(AppError::validation("قيم المبالغ غير صحيحة"));
    }

    let payment_method = payload.payment_method.trim().to_owned();
    if !matches!(payment_method.as_str(), "cash" | "card" | "deferred" | "split") {
        return Err(AppError::validation("طريقة الدفع غير مدعومة"));
    }

    let mut tx = pool.begin().await?;
    ensure_open_session(&mut tx, payload.session_id).await?;

    let customer = if let Some(customer_id) = payload.customer_id {
        Some(get_active_customer_by_id(&mut tx, customer_id).await?)
    } else {
        None
    };

    if payment_method == "deferred" && customer.is_none() {
        return Err(AppError::validation("اختيار العميل مطلوب للبيع الآجل"));
    }

    let mut subtotal_millieme = 0_i64;
    let mut line_discount_millieme = 0_i64;
    let mut enriched_items = Vec::with_capacity(payload.items.len());

    for line in payload.items {
        if line.qty <= 0 || line.unit_price_millieme < 0 || line.discount_millieme < 0 {
            return Err(AppError::validation("بيانات الأصناف غير صحيحة"));
        }

        let item = get_active_item_by_id(&mut tx, line.item_id).await?;
        let line_subtotal = line.qty * line.unit_price_millieme;
        if line.discount_millieme > line_subtotal {
            return Err(AppError::validation("خصم الصنف أكبر من قيمته"));
        }

        subtotal_millieme += line_subtotal;
        line_discount_millieme += line.discount_millieme;
        enriched_items.push((item, line));
    }

    if payload.global_discount_millieme > subtotal_millieme - line_discount_millieme {
        return Err(AppError::validation("الخصم الإجمالي أكبر من قيمة الفاتورة"));
    }

    let total_discount_millieme = line_discount_millieme + payload.global_discount_millieme;
    let total_millieme = subtotal_millieme - total_discount_millieme;
    let paid_total_millieme = payload.paid_cash_millieme + payload.paid_card_millieme;

    let change_millieme = match payment_method.as_str() {
        "cash" => {
            if payload.paid_card_millieme != 0 {
                return Err(AppError::validation("الدفع النقدي لا يقبل مبلغ فيزا"));
            }
            if payload.paid_cash_millieme < total_millieme {
                return Err(AppError::validation("المبلغ المدفوع أقل من إجمالي الفاتورة"));
            }
            payload.paid_cash_millieme - total_millieme
        }
        "card" => {
            if payload.paid_cash_millieme != 0 || payload.paid_card_millieme != total_millieme {
                return Err(AppError::validation("مبلغ الفيزا يجب أن يساوي إجمالي الفاتورة"));
            }
            0
        }
        "deferred" => {
            if paid_total_millieme > total_millieme {
                return Err(AppError::validation("المبلغ المدفوع أكبر من إجمالي الفاتورة"));
            }
            0
        }
        "split" => {
            if paid_total_millieme != total_millieme {
                return Err(AppError::validation("يجب أن يساوي الدفع المختلط إجمالي الفاتورة"));
            }
            0
        }
        _ => 0,
    };

    let notes = normalize_optional_string(payload.notes);
    let result = sqlx::query(
        r#"
        INSERT INTO invoices (
          session_id,
          customer_id,
          subtotal_millieme,
          line_discount_millieme,
          global_discount_millieme,
          total_discount_millieme,
          total_millieme,
          payment_method,
          paid_cash_millieme,
          paid_card_millieme,
          paid_total_millieme,
          change_millieme,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(payload.session_id)
    .bind(customer.as_ref().map(|value| value.id))
    .bind(subtotal_millieme)
    .bind(line_discount_millieme)
    .bind(payload.global_discount_millieme)
    .bind(total_discount_millieme)
    .bind(total_millieme)
    .bind(&payment_method)
    .bind(payload.paid_cash_millieme)
    .bind(payload.paid_card_millieme)
    .bind(paid_total_millieme)
    .bind(change_millieme)
    .bind(notes)
    .execute(&mut *tx)
    .await?;

    let invoice_id = result.last_insert_rowid();
    let invoice_number = format!("INV-{invoice_id:06}");

    sqlx::query("UPDATE invoices SET invoice_number = ? WHERE id = ?")
        .bind(&invoice_number)
        .bind(invoice_id)
        .execute(&mut *tx)
        .await?;

    for (item, line) in &enriched_items {
        sqlx::query(
            r#"
            INSERT INTO invoice_items (
              invoice_id,
              item_id,
              barcode,
              item_name_ar,
              qty,
              unit_price_millieme,
              discount_millieme,
              total_millieme
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(invoice_id)
        .bind(item.id)
        .bind(&item.barcode)
        .bind(&item.name_ar)
        .bind(line.qty)
        .bind(line.unit_price_millieme)
        .bind(line.discount_millieme)
        .bind(compute_line_total(
            line.qty,
            line.unit_price_millieme,
            line.discount_millieme,
        ))
        .execute(&mut *tx)
        .await?;

        sqlx::query("UPDATE items SET current_stock = current_stock - ? WHERE id = ?")
            .bind(line.qty)
            .bind(item.id)
            .execute(&mut *tx)
            .await?;
    }

    if payment_method == "deferred" {
        if let Some(customer) = customer {
            let remaining_millieme = total_millieme - paid_total_millieme;
            sqlx::query("UPDATE customers SET balance_millieme = balance_millieme + ? WHERE id = ?")
                .bind(remaining_millieme)
                .bind(customer.id)
                .execute(&mut *tx)
                .await?;
        }
    }

    let invoice = get_invoice_by_id(&mut tx, invoice_id).await?;
    tx.commit().await?;

    Ok(CreateSaleInvoiceResponse {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number.unwrap_or(invoice_number),
        total_millieme: invoice.total_millieme,
        paid_cash_millieme: invoice.paid_cash_millieme,
        paid_card_millieme: invoice.paid_card_millieme,
        paid_total_millieme: invoice.paid_total_millieme,
        change_millieme: invoice.change_millieme,
    })
}

#[tauri::command]
pub async fn search_items(
    pool: State<'_, DbPool>,
    query: Option<String>,
    category_id: Option<i64>,
) -> Result<Vec<Item>, AppError> {
    search_items_impl(&pool, query, category_id).await
}

#[tauri::command]
pub async fn create_sale_invoice(
    pool: State<'_, DbPool>,
    payload: CreateSaleInvoicePayload,
) -> Result<CreateSaleInvoiceResponse, AppError> {
    create_sale_invoice_impl(&pool, payload).await
}

#[cfg(test)]
mod tests {
    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        ConnectOptions,
    };

    use super::*;

    async fn test_pool() -> DbPool {
        let db_path = std::env::temp_dir().join(format!(
            "safqah-sales-test-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be valid")
                .as_nanos()
        ));

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .disable_statement_logging();

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("sqlite test pool should initialize");

        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("migrations should run");

        pool
    }

    #[tokio::test]
    async fn create_sale_invoice_updates_stock_and_customer_balance() {
        let pool = test_pool().await;

        let item_result = sqlx::query(
            r#"
            INSERT INTO items (
              barcode,
              name_ar,
              buy_price_millieme,
              sell_price_millieme,
              unit,
              current_stock,
              min_stock
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind("111")
        .bind("منتج اختبار")
        .bind(5000_i64)
        .bind(10000_i64)
        .bind("قطعة")
        .bind(8_i64)
        .bind(1_i64)
        .execute(&pool)
        .await
        .expect("item should be inserted");

        let customer_result = sqlx::query(
            r#"
            INSERT INTO customers (name, balance_millieme, credit_limit_millieme)
            VALUES (?, ?, ?)
            "#,
        )
        .bind("عميل اختبار")
        .bind(-5000_i64)
        .bind(50000_i64)
        .execute(&pool)
        .await
        .expect("customer should be inserted");

        let session_result = sqlx::query(
            "INSERT INTO sessions (cashier_id, opening_cash_millieme, status) VALUES (?, ?, 'open')",
        )
        .bind(1_i64)
        .bind(100000_i64)
        .execute(&pool)
        .await
        .expect("session should be inserted");

        let response = create_sale_invoice_impl(
            &pool,
            CreateSaleInvoicePayload {
                session_id: session_result.last_insert_rowid(),
                customer_id: Some(customer_result.last_insert_rowid()),
                payment_method: "deferred".to_owned(),
                global_discount_millieme: 1000,
                paid_cash_millieme: 4000,
                paid_card_millieme: 0,
                notes: Some("  ملاحظة  ".to_owned()),
                items: vec![crate::models::sale::CreateSaleInvoiceLinePayload {
                    item_id: item_result.last_insert_rowid(),
                    qty: 2,
                    unit_price_millieme: 10000,
                    discount_millieme: 2000,
                }],
            },
        )
        .await
        .expect("sale invoice should be created");

        assert_eq!(response.invoice_number, "INV-000001");
        assert_eq!(response.total_millieme, 17000);
        assert_eq!(response.paid_total_millieme, 4000);

        let stock: (i64,) = sqlx::query_as("SELECT current_stock FROM items WHERE id = ?")
            .bind(item_result.last_insert_rowid())
            .fetch_one(&pool)
            .await
            .expect("stock should be readable");
        assert_eq!(stock.0, 6);

        let balance: (i64,) =
            sqlx::query_as("SELECT balance_millieme FROM customers WHERE id = ?")
                .bind(customer_result.last_insert_rowid())
                .fetch_one(&pool)
                .await
                .expect("customer balance should be readable");
        assert_eq!(balance.0, 8000);
    }
}
