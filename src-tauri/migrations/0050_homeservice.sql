-- [homeservice] [all tenants]
CREATE TABLE IF NOT EXISTS hs_jobs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  job_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', address TEXT NOT NULL,
  service_type TEXT NOT NULL, description TEXT DEFAULT '',
  technician TEXT DEFAULT '', job_date TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled', labour_charge REAL DEFAULT 0,
  total_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash', completed_at TEXT,
  notes TEXT DEFAULT '', updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS hs_materials (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, unit TEXT DEFAULT 'piece',
  stock REAL DEFAULT 0, purchase_price REAL DEFAULT 0,
  selling_price REAL DEFAULT 0, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS hs_technicians (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '',
  specialization TEXT DEFAULT '', status TEXT DEFAULT 'active',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS hs_amc (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_name TEXT NOT NULL, phone TEXT DEFAULT '',
  address TEXT DEFAULT '', service_type TEXT DEFAULT '',
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  visits_included INTEGER DEFAULT 4, visits_done INTEGER DEFAULT 0,
  amount REAL DEFAULT 0, status TEXT DEFAULT 'active',
  updated_at TEXT, deleted_at TEXT
);
