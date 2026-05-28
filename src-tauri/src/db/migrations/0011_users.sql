PRAGMA foreign_keys = OFF;

ALTER TABLE users RENAME TO users_legacy;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (role IN ('admin', 'cashier', 'accountant'))
);

INSERT INTO users (
  id,
  name,
  username,
  password_hash,
  role,
  is_active,
  created_at
)
SELECT
  id,
  name,
  'legacy-user-' || id,
  '',
  'cashier',
  1,
  datetime('now')
FROM users_legacy;

DROP TABLE users_legacy;

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

PRAGMA foreign_keys = ON;