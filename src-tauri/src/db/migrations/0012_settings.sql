CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shop_name', 'اسم المحل'),
  ('shop_address', 'العنوان'),
  ('shop_phone', ''),
  ('shop_logo_path', ''),
  ('currency_symbol', 'ج.م'),
  ('tax_percent', '0'),
  ('receipt_size', 'full'),
  ('invoice_prefix', 'INV'),
  ('purchase_prefix', 'PUR'),
  ('return_prefix', 'RET'),
  ('default_printer', ''),
  ('low_stock_alert', '1'),
  ('backup_interval_hours', '4'),
  ('show_shop_name_on_receipt', '1'),
  ('show_shop_address_on_receipt', '1'),
  ('show_shop_phone_on_receipt', '1'),
  ('show_thank_you_on_receipt', '1'),
  ('receipt_thank_you_message', 'شكراً لزيارتكم');