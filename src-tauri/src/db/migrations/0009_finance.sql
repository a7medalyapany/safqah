CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_millieme INTEGER NOT NULL CHECK (amount_millieme > 0),
  category_id INTEGER REFERENCES expense_categories(id),
  description TEXT,
  session_id INTEGER REFERENCES sessions(id),
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  amount_millieme INTEGER NOT NULL CHECK (amount_millieme > 0),
  direction TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference_invoice_id INTEGER,
  notes TEXT,
  session_id INTEGER REFERENCES sessions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (entity_type IN ('customer', 'supplier')),
  CHECK (direction IN ('in', 'out'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_session ON expenses(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_entity ON payments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

INSERT INTO expense_categories (name_ar)
VALUES
  ('إيجار'),
  ('كهرباء'),
  ('مياه'),
  ('رواتب'),
  ('مواصلات'),
  ('صيانة'),
  ('مصروفات متنوعة');
