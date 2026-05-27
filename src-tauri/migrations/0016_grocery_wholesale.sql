-- [grocery] [all tenants] — wholesale price on products + cash drawer tracking
ALTER TABLE products ADD COLUMN wholesale_price REAL;

CREATE TABLE IF NOT EXISTS cash_drawer (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  closing_balance REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_drawer_tenant_date ON cash_drawer(tenant_id, date) WHERE deleted_at IS NULL;
