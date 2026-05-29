-- [printing] [all tenants]
CREATE TABLE IF NOT EXISTS pr_jobs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  job_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', job_type TEXT DEFAULT '',
  description TEXT NOT NULL, quantity INTEGER DEFAULT 1,
  paper_type TEXT DEFAULT '', size TEXT DEFAULT '',
  color_type TEXT DEFAULT 'bw', total_amount REAL DEFAULT 0,
  advance_paid REAL DEFAULT 0, status TEXT DEFAULT 'received',
  promised_date TEXT, delivered_at TEXT,
  notes TEXT DEFAULT '', updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pr_stationery (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '',
  stock REAL DEFAULT 0, unit TEXT DEFAULT 'piece',
  purchase_price REAL DEFAULT 0, selling_price REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pr_stationery_sales (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  bill_no TEXT DEFAULT '', customer_name TEXT DEFAULT '',
  total REAL DEFAULT 0, payment_mode TEXT DEFAULT 'cash',
  sale_date TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS pr_stationery_sale_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  sale_id TEXT NOT NULL, product_id TEXT NOT NULL,
  product_name TEXT NOT NULL, quantity REAL DEFAULT 0,
  rate REAL DEFAULT 0, amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
