-- ============================================================
-- 0001_core_schema.sql
-- Full schema from scratch. Single source of truth.
-- Never edit this file after it has been applied to any DB.
-- ============================================================

-- ────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'cashier',
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (role IN ('admin', 'cashier', 'accountant'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);

-- ────────────────────────────────────────
-- CATEGORIES
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────
-- SUPPLIERS
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  phone            TEXT,
  address          TEXT,
  balance_millieme INTEGER NOT NULL DEFAULT 0,
  tax_number       TEXT,
  notes            TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────
-- CUSTOMERS
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  phone                 TEXT,
  address               TEXT,
  balance_millieme      INTEGER NOT NULL DEFAULT 0,
  credit_limit_millieme INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────
-- ITEMS
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode              TEXT UNIQUE,
  name_ar              TEXT NOT NULL,
  name_en              TEXT,
  category_id          INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id          INTEGER REFERENCES suppliers(id)  ON DELETE SET NULL,
  buy_price_millieme   INTEGER NOT NULL DEFAULT 0 CHECK (buy_price_millieme  >= 0),
  sell_price_millieme  INTEGER NOT NULL DEFAULT 0 CHECK (sell_price_millieme >= 0),
  color                TEXT,
  size                 TEXT,
  unit                 TEXT    NOT NULL DEFAULT 'قطعة',
  min_stock            INTEGER NOT NULL DEFAULT 0,
  current_stock        INTEGER NOT NULL DEFAULT 0,
  image_path           TEXT,
  is_active            INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_barcode  ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_name_ar  ON items(name_ar);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_supplier ON items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_items_active   ON items(is_active);

-- ────────────────────────────────────────
-- SESSIONS (shifts)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id             INTEGER NOT NULL REFERENCES users(id),
  opened_at              TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at              TEXT,
  opening_cash_millieme  INTEGER NOT NULL DEFAULT 0,
  closing_cash_millieme  INTEGER NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'open',
  notes                  TEXT,
  CHECK (status IN ('open', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_status     ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_opened_at  ON sessions(opened_at DESC);

-- ────────────────────────────────────────
-- INVOICES (sales)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number          TEXT NOT NULL UNIQUE,
  session_id              INTEGER NOT NULL REFERENCES sessions(id),
  cashier_id              INTEGER NOT NULL DEFAULT 1,
  customer_id             INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  subtotal_millieme       INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_millieme       >= 0),
  discount_millieme       INTEGER NOT NULL DEFAULT 0 CHECK (discount_millieme       >= 0),
  tax_millieme            INTEGER NOT NULL DEFAULT 0 CHECK (tax_millieme            >= 0),
  total_millieme          INTEGER NOT NULL DEFAULT 0 CHECK (total_millieme          >= 0),
  paid_millieme           INTEGER NOT NULL DEFAULT 0 CHECK (paid_millieme           >= 0),
  payment_method          TEXT NOT NULL CHECK (payment_method IN ('cash','card','deferred','split')),
  status                  TEXT NOT NULL DEFAULT 'paid'
                            CHECK (status IN ('paid','deferred','partial','cancelled')),
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at   ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer      ON invoices(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_session       ON invoices(session_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_date_status   ON invoices(DATE(created_at), status);

-- ────────────────────────────────────────
-- INVOICE ITEMS
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id          INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id             INTEGER NOT NULL REFERENCES items(id),
  barcode             TEXT,
  item_name_ar        TEXT NOT NULL,
  qty                 INTEGER NOT NULL CHECK (qty > 0),
  unit_price_millieme INTEGER NOT NULL CHECK (unit_price_millieme >= 0),
  discount_millieme   INTEGER NOT NULL DEFAULT 0 CHECK (discount_millieme >= 0),
  total_millieme      INTEGER NOT NULL DEFAULT 0 CHECK (total_millieme    >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item    ON invoice_items(item_id);
-- alias used by report queries
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON invoice_items(item_id);

-- ────────────────────────────────────────
-- STOCK MOVEMENTS  (append-only event log)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  delta          INTEGER NOT NULL,           -- negative = out, positive = in
  movement_type  TEXT NOT NULL
                   CHECK (movement_type IN ('sale','purchase','return','adjustment')),
  reference_id   INTEGER,
  reference_type TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

-- ────────────────────────────────────────
-- RETURNS
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS returns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number       TEXT NOT NULL UNIQUE,
  original_invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  session_id          INTEGER NOT NULL REFERENCES sessions(id),
  total_millieme      INTEGER NOT NULL,
  refund_method       TEXT NOT NULL DEFAULT 'cash'
                        CHECK (refund_method IN ('cash','credit')),
  status              TEXT NOT NULL DEFAULT 'completed',
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS return_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id         INTEGER NOT NULL REFERENCES returns(id),
  invoice_item_id   INTEGER NOT NULL REFERENCES invoice_items(id),
  item_id           INTEGER NOT NULL REFERENCES items(id),
  qty               INTEGER NOT NULL CHECK (qty > 0),
  unit_price_millieme INTEGER NOT NULL,
  total_millieme    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_returns_invoice           ON returns(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_returns_session           ON returns(session_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return       ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_invoice_item ON return_items(invoice_item_id);

-- ────────────────────────────────────────
-- PURCHASE INVOICES
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number  TEXT NOT NULL UNIQUE,
  supplier_id     INTEGER REFERENCES suppliers(id),
  session_id      INTEGER REFERENCES sessions(id),
  subtotal_millieme INTEGER NOT NULL CHECK (subtotal_millieme >= 0),
  discount_millieme INTEGER NOT NULL DEFAULT 0,
  total_millieme    INTEGER NOT NULL CHECK (total_millieme    >= 0),
  paid_millieme     INTEGER NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL DEFAULT 'cash',
  status            TEXT NOT NULL DEFAULT 'paid'
                      CHECK (status IN ('paid','deferred','partial')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id                           INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id                  INTEGER NOT NULL REFERENCES purchase_invoices(id),
  item_id                      INTEGER NOT NULL REFERENCES items(id),
  qty                          INTEGER NOT NULL CHECK (qty > 0),
  unit_cost_millieme           INTEGER NOT NULL,
  suggested_sell_price_millieme INTEGER,
  total_millieme               INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_created_at  ON purchase_invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier    ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status      ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item     ON purchase_items(item_id);

-- ────────────────────────────────────────
-- FINANCE — expenses + payments
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_millieme  INTEGER NOT NULL CHECK (amount_millieme > 0),
  category_id      INTEGER REFERENCES expense_categories(id),
  description      TEXT,
  session_id       INTEGER REFERENCES sessions(id),
  created_by       INTEGER DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type           TEXT NOT NULL CHECK (entity_type IN ('customer','supplier')),
  entity_id             INTEGER NOT NULL,
  amount_millieme       INTEGER NOT NULL CHECK (amount_millieme > 0),
  direction             TEXT NOT NULL CHECK (direction IN ('in','out')),
  method                TEXT NOT NULL DEFAULT 'cash',
  reference_invoice_id  INTEGER,
  notes                 TEXT,
  session_id            INTEGER REFERENCES sessions(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_expenses_session    ON expenses(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_entity     ON payments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ────────────────────────────────────────
-- SETTINGS  (key-value store)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────
-- SEED DATA
-- ────────────────────────────────────────

-- Default expense categories
INSERT OR IGNORE INTO expense_categories (name_ar) VALUES
  ('إيجار'),
  ('كهرباء'),
  ('مياه'),
  ('رواتب'),
  ('مواصلات'),
  ('صيانة'),
  ('مصروفات متنوعة');

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shop_name',                    'اسم المحل'),
  ('shop_address',                 'العنوان'),
  ('shop_phone',                   ''),
  ('shop_logo_path',               ''),
  ('currency_symbol',              'ج.م'),
  ('tax_percent',                  '0'),
  ('receipt_size',                 'full'),
  ('invoice_prefix',               'INV'),
  ('purchase_prefix',              'PUR'),
  ('return_prefix',                'RET'),
  ('default_printer',              ''),
  ('label_printer',                ''),
  ('low_stock_alert',              '1'),
  ('backup_interval_hours',        '4'),
  ('show_shop_name_on_receipt',    '1'),
  ('show_shop_address_on_receipt', '1'),
  ('show_shop_phone_on_receipt',   '1'),
  ('show_thank_you_on_receipt',    '1'),
  ('receipt_thank_you_message',    'شكراً لزيارتكم'),
  ('setup_complete',               '0');