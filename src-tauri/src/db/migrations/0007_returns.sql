CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT NOT NULL UNIQUE,
  original_invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  total_millieme INTEGER NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'cash' CHECK (refund_method IN ('cash', 'credit')),
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES returns(id),
  invoice_item_id INTEGER NOT NULL REFERENCES invoice_items(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_millieme INTEGER NOT NULL,
  total_millieme INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_returns_invoice ON returns(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_returns_session ON returns(session_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_invoice_item ON return_items(invoice_item_id);
