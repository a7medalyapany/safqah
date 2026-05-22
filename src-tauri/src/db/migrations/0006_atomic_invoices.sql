ALTER TABLE invoices ADD COLUMN cashier_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN discount_millieme INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN tax_millieme INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN paid_millieme INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'paid';

UPDATE invoices
SET
  discount_millieme = global_discount_millieme,
  paid_millieme = paid_total_millieme,
  status = CASE
    WHEN payment_method = 'deferred' THEN 'deferred'
    WHEN paid_total_millieme >= total_millieme THEN 'paid'
    WHEN paid_total_millieme > 0 AND paid_total_millieme < total_millieme THEN 'partial'
    ELSE 'deferred'
  END
WHERE discount_millieme = 0
  AND paid_millieme = 0;

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  delta INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  reference_id INTEGER,
  reference_type TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (movement_type IN ('sale', 'purchase', 'return', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item ON invoice_items(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
