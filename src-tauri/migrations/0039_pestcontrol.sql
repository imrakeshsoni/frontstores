-- [pestcontrol] [all tenants]
CREATE TABLE IF NOT EXISTS pc_customers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '',
  address TEXT NOT NULL, property_type TEXT DEFAULT 'residential',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pc_jobs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  job_no TEXT DEFAULT '', customer_id TEXT NOT NULL,
  service_type TEXT DEFAULT '', pest_type TEXT DEFAULT '',
  chemical_used TEXT DEFAULT '', technician TEXT DEFAULT '',
  job_date TEXT NOT NULL, next_service_date TEXT,
  amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash', status TEXT DEFAULT 'scheduled',
  amc INTEGER DEFAULT 0, notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pc_chemicals (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, stock_ml REAL DEFAULT 0,
  cost_per_ml REAL DEFAULT 0, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pc_contracts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL, contract_type TEXT DEFAULT 'AMC',
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  services_total INTEGER DEFAULT 4, services_done INTEGER DEFAULT 0,
  amount REAL DEFAULT 0, status TEXT DEFAULT 'active',
  updated_at TEXT, deleted_at TEXT
);
