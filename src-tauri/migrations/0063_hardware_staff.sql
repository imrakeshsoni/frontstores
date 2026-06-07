-- [hardware] [all tenants] — staff, attendance, salary advances + payments

CREATE TABLE IF NOT EXISTS hardware_staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'salesman',
  is_active INTEGER NOT NULL DEFAULT 1,
  monthly_salary REAL NOT NULL DEFAULT 0,
  joining_date TEXT,
  deduct_half_day INTEGER NOT NULL DEFAULT 1,
  deduct_full_day_leave INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS hardware_attendance (
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

CREATE INDEX IF NOT EXISTS idx_hw_attendance ON hardware_attendance(tenant_id, staff_id, date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hardware_salary_advances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  month TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  given_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hw_advance ON hardware_salary_advances(tenant_id, staff_id, month) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hardware_salary_payments (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  staff_id        TEXT NOT NULL,
  month           TEXT NOT NULL,  -- YYYY-MM
  amount_paid     REAL NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'cash',  -- cash | upi | card
  note            TEXT,
  paid_at         TEXT,
  updated_at      TEXT,
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_hwsp_tenant_month ON hardware_salary_payments(tenant_id, month);
CREATE INDEX IF NOT EXISTS idx_hwsp_tenant_staff ON hardware_salary_payments(tenant_id, staff_id);
