CREATE TABLE IF NOT EXISTS _migrations_test (
  id INTEGER PRIMARY KEY,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
