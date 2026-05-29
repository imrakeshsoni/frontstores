-- [laundry] [all tenants]
CREATE TABLE IF NOT EXISTS laundry_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  order_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', items TEXT DEFAULT '[]',
  total_amount REAL DEFAULT 0, advance_paid REAL DEFAULT 0,
  status TEXT DEFAULT 'received',
  received_at TEXT NOT NULL, promised_date TEXT,
  delivered_at TEXT, notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS laundry_services (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  item_name TEXT NOT NULL, service_type TEXT DEFAULT 'wash',
  price REAL DEFAULT 0, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS laundry_expenses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  description TEXT NOT NULL, amount REAL DEFAULT 0,
  date TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
