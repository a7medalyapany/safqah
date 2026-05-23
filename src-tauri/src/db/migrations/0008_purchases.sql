CREATE TABLE IF NOT EXISTS purchase_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  supplier_id INTEGER REFERENCES suppliers(id),
  session_id INTEGER REFERENCES sessions(id),
  subtotal_millieme INTEGER NOT NULL,
  discount_millieme INTEGER NOT NULL DEFAULT 0,
  total_millieme INTEGER NOT NULL,
  paid_millieme INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('paid', 'deferred', 'partial')),
  CHECK (subtotal_millieme >= 0),
  CHECK (total_millieme >= 0)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchase_invoices(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cost_millieme INTEGER NOT NULL,
  suggested_sell_price_millieme INTEGER,
  total_millieme INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchase_invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item ON purchase_items(item_id);
