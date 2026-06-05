-- [carwash] [all tenants] Salary payment records
CREATE TABLE IF NOT EXISTS carwash_salary_payments (
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
CREATE INDEX IF NOT EXISTS idx_cwsp_tenant_month ON carwash_salary_payments(tenant_id, month);
CREATE INDEX IF NOT EXISTS idx_cwsp_tenant_staff ON carwash_salary_payments(tenant_id, staff_id);
