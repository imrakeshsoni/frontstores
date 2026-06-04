-- [carwash] [all tenants] — advance salary tracking per staff per month
CREATE TABLE IF NOT EXISTS carwash_salary_advance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  month TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cw_advance ON carwash_salary_advance(tenant_id, staff_id, month) WHERE deleted_at IS NULL;
