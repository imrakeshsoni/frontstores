-- [carwash] [all tenants] — staff attendance + salary management

ALTER TABLE carwash_staff ADD COLUMN monthly_salary REAL NOT NULL DEFAULT 0;
ALTER TABLE carwash_staff ADD COLUMN joining_date TEXT;
ALTER TABLE carwash_staff ADD COLUMN deduct_half_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE carwash_staff ADD COLUMN deduct_full_day_leave INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS carwash_attendance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  note TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT,
  UNIQUE(tenant_id, staff_id, date)
);

CREATE INDEX IF NOT EXISTS idx_cw_attendance ON carwash_attendance(tenant_id, staff_id, date) WHERE deleted_at IS NULL;
