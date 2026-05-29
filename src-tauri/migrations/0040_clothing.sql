-- [clothing] [all tenants]
CREATE TABLE IF NOT EXISTS cl_products (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '',
  brand TEXT DEFAULT '', gender TEXT DEFAULT 'unisex',
  variants TEXT DEFAULT '[]',
  purchase_price REAL DEFAULT 0, selling_price REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS cl_stock (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL, size TEXT DEFAULT '',
  color TEXT DEFAULT '', quantity INTEGER DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS cl_sales (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  bill_no TEXT DEFAULT '', customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '', total REAL DEFAULT 0,
  discount REAL DEFAULT 0, paid REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash', sale_date TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS cl_sale_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  sale_id TEXT NOT NULL, product_id TEXT NOT NULL,
  product_name TEXT NOT NULL, size TEXT DEFAULT '',
  color TEXT DEFAULT '', quantity INTEGER DEFAULT 1,
  rate REAL DEFAULT 0, amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS cl_exchanges (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  original_sale_id TEXT DEFAULT '', customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '', reason TEXT DEFAULT '',
  returned_item TEXT DEFAULT '', exchange_item TEXT DEFAULT '',
  date TEXT NOT NULL, amount_diff REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
