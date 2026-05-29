-- [repair] [all tenants]
CREATE TABLE IF NOT EXISTS repair_jobs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  job_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', device_type TEXT DEFAULT '',
  device_brand TEXT DEFAULT '', device_model TEXT DEFAULT '',
  imei TEXT DEFAULT '', issue TEXT NOT NULL,
  diagnosis TEXT DEFAULT '', status TEXT DEFAULT 'received',
  technician TEXT DEFAULT '', estimated_cost REAL DEFAULT 0,
  advance_paid REAL DEFAULT 0, final_amount REAL DEFAULT 0,
  received_at TEXT NOT NULL, promised_date TEXT,
  completed_at TEXT, delivered_at TEXT,
  warranty_days INTEGER DEFAULT 0, notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS repair_parts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '',
  stock INTEGER DEFAULT 0, purchase_price REAL DEFAULT 0,
  selling_price REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS repair_job_parts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL, part_id TEXT NOT NULL,
  part_name TEXT NOT NULL, quantity INTEGER DEFAULT 1,
  rate REAL DEFAULT 0, amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS repair_expenses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  description TEXT NOT NULL, amount REAL DEFAULT 0,
  date TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
