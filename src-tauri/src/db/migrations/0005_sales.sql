CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  subtotal_millieme INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_millieme >= 0),
  line_discount_millieme INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_millieme >= 0),
  global_discount_millieme INTEGER NOT NULL DEFAULT 0 CHECK (global_discount_millieme >= 0),
  total_discount_millieme INTEGER NOT NULL DEFAULT 0 CHECK (total_discount_millieme >= 0),
  total_millieme INTEGER NOT NULL DEFAULT 0 CHECK (total_millieme >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'deferred', 'split')),
  paid_cash_millieme INTEGER NOT NULL DEFAULT 0 CHECK (paid_cash_millieme >= 0),
  paid_card_millieme INTEGER NOT NULL DEFAULT 0 CHECK (paid_card_millieme >= 0),
  paid_total_millieme INTEGER NOT NULL DEFAULT 0 CHECK (paid_total_millieme >= 0),
  change_millieme INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  barcode TEXT,
  item_name_ar TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_millieme INTEGER NOT NULL CHECK (unit_price_millieme >= 0),
  discount_millieme INTEGER NOT NULL DEFAULT 0 CHECK (discount_millieme >= 0),
  total_millieme INTEGER NOT NULL DEFAULT 0 CHECK (total_millieme >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoices_session ON invoices(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
