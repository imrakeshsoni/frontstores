-- [bakery] [all tenants]
CREATE TABLE IF NOT EXISTS bk_products (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '',
  unit TEXT DEFAULT 'piece', selling_price REAL DEFAULT 0,
  production_cost REAL DEFAULT 0, shelf_life_hours INTEGER DEFAULT 24,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS bk_production (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL, product_name TEXT NOT NULL,
  quantity REAL DEFAULT 0, production_date TEXT NOT NULL,
  expiry_at TEXT, cost REAL DEFAULT 0, notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS bk_sales (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  bill_no TEXT DEFAULT '', customer_name TEXT DEFAULT '',
  total REAL DEFAULT 0, payment_mode TEXT DEFAULT 'cash',
  sale_date TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS bk_sale_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  sale_id TEXT NOT NULL, product_id TEXT NOT NULL,
  product_name TEXT NOT NULL, quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'piece', rate REAL DEFAULT 0, amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS bk_bulk_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_name TEXT NOT NULL, customer_phone TEXT DEFAULT '',
  event_type TEXT DEFAULT '', items TEXT DEFAULT '[]',
  delivery_date TEXT NOT NULL, advance_paid REAL DEFAULT 0,
  total_amount REAL DEFAULT 0, status TEXT DEFAULT 'confirmed',
  notes TEXT DEFAULT '', updated_at TEXT, deleted_at TEXT
);
