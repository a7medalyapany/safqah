CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  buy_price_millieme INTEGER NOT NULL DEFAULT 0 CHECK (buy_price_millieme >= 0),
  sell_price_millieme INTEGER NOT NULL DEFAULT 0 CHECK (sell_price_millieme >= 0),
  color TEXT,
  size TEXT,
  unit TEXT NOT NULL DEFAULT 'قطعة',
  min_stock INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  supplier_id INTEGER,
  image_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_name_ar ON items(name_ar);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);
