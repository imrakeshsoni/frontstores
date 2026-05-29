-- [furniture] [all tenants]
CREATE TABLE IF NOT EXISTS furn_products (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '',
  material TEXT DEFAULT '', dimensions TEXT DEFAULT '',
  stock INTEGER DEFAULT 0, purchase_price REAL DEFAULT 0,
  selling_price REAL DEFAULT 0, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS furn_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  order_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', customer_address TEXT DEFAULT '',
  items TEXT DEFAULT '[]', total_amount REAL DEFAULT 0,
  advance_paid REAL DEFAULT 0, delivery_date TEXT,
  delivered_at TEXT, status TEXT DEFAULT 'confirmed',
  notes TEXT DEFAULT '', updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS furn_custom_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  order_no TEXT DEFAULT '', customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '', description TEXT NOT NULL,
  wood_type TEXT DEFAULT '', dimensions TEXT DEFAULT '',
  estimated_cost REAL DEFAULT 0, advance_paid REAL DEFAULT 0,
  delivery_date TEXT, status TEXT DEFAULT 'design',
  carpenter TEXT DEFAULT '', updated_at TEXT, deleted_at TEXT
);
