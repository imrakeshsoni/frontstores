-- [tailor] [all tenants]
CREATE TABLE IF NOT EXISTS tailor_customers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '',
  measurements TEXT DEFAULT '{}', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS tailor_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL, order_no TEXT DEFAULT '',
  item_type TEXT NOT NULL, description TEXT DEFAULT '',
  fabric_by TEXT DEFAULT 'customer', fabric_meters REAL DEFAULT 0,
  fabric_desc TEXT DEFAULT '', measurements TEXT DEFAULT '{}',
  advance_paid REAL DEFAULT 0, total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'received', delivery_date TEXT,
  delivered_at TEXT, notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS tailor_expenses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  description TEXT NOT NULL, amount REAL DEFAULT 0,
  category TEXT DEFAULT 'general', date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);
