CREATE INDEX IF NOT EXISTS idx_invoices_date_status
  ON invoices(DATE(created_at), status);

CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id
  ON invoice_items(item_id);

CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON expenses(DATE(created_at));
