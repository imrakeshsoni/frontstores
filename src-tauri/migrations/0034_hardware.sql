-- [hardware] [all tenants]
CREATE TABLE IF NOT EXISTS hw_products (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '',
  unit TEXT DEFAULT 'piece', brand TEXT DEFAULT '',
  stock REAL DEFAULT 0, min_stock REAL DEFAULT 0,
  purchase_price REAL DEFAULT 0, selling_price REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS hw_sales (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  bill_no TEXT DEFAULT '', customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '', total REAL DEFAULT 0,
  paid REAL DEFAULT 0, payment_mode TEXT DEFAULT 'cash',
  sale_date TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS hw_sale_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  sale_id TEXT NOT NULL, product_id TEXT NOT NULL,
  product_name TEXT NOT NULL, unit TEXT DEFAULT 'piece',
  quantity REAL DEFAULT 0, rate REAL DEFAULT 0, amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS hw_credit_accounts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  customer_name TEXT NOT NULL, phone TEXT DEFAULT '',
  address TEXT DEFAULT '', balance REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS hw_credit_transactions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  account_id TEXT NOT NULL, type TEXT DEFAULT 'debit',
  amount REAL DEFAULT 0, description TEXT DEFAULT '',
  date TEXT NOT NULL, updated_at TEXT, deleted_at TEXT
);
