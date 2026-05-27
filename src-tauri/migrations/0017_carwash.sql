-- [carwash] [all tenants] — full car wash shop schema
CREATE TABLE IF NOT EXISTS carwash_services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_hatchback REAL NOT NULL DEFAULT 0,
  price_sedan REAL NOT NULL DEFAULT 0,
  price_suv REAL NOT NULL DEFAULT 0,
  price_luxury REAL NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  gst_rate REAL NOT NULL DEFAULT 18,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS carwash_vehicles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  reg_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'sedan',
  make TEXT,
  model TEXT,
  color TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_carwash_vehicles_reg ON carwash_vehicles(tenant_id, reg_number) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS carwash_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_number TEXT NOT NULL,
  vehicle_id TEXT,
  reg_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'sedan',
  make TEXT,
  model TEXT,
  color TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_id TEXT,
  staff_id TEXT,
  staff_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  membership_id TEXT,
  notes TEXT,
  started_at TEXT,
  completed_at TEXT,
  delivered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS carwash_job_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  service_id TEXT,
  service_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 18,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS carwash_staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'washer',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS carwash_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_id TEXT,
  vehicle_id TEXT,
  reg_number TEXT,
  package_name TEXT NOT NULL,
  total_washes INTEGER NOT NULL DEFAULT 10,
  used_washes INTEGER NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  valid_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
