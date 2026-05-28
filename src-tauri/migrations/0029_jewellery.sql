-- [jewellery] [all tenants] — jewellery shop schema

CREATE TABLE IF NOT EXISTS jewellery_gold_rates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  rate_date TEXT NOT NULL,
  gold_22k REAL NOT NULL DEFAULT 0,
  gold_24k REAL NOT NULL DEFAULT 0,
  silver REAL NOT NULL DEFAULT 0,
  platinum REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jewellery_gold_date ON jewellery_gold_rates(tenant_id, rate_date);

CREATE TABLE IF NOT EXISTS jewellery_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ring',
  metal TEXT NOT NULL DEFAULT 'gold',
  purity TEXT NOT NULL DEFAULT '22k',
  gross_weight REAL NOT NULL DEFAULT 0,
  net_weight REAL NOT NULL DEFAULT 0,
  stone_weight REAL NOT NULL DEFAULT 0,
  making_charges REAL NOT NULL DEFAULT 0,
  making_type TEXT NOT NULL DEFAULT 'fixed',
  wastage_pct REAL NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 1,
  cost_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  hsn_code TEXT,
  barcode TEXT,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jewellery_items_tenant ON jewellery_items(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jewellery_items_category ON jewellery_items(tenant_id, category) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS jewellery_bills (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  gold_rate_22k REAL NOT NULL DEFAULT 0,
  gold_rate_24k REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  making_total REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 3,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  advance_received REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  notes TEXT,
  billed_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jewellery_bills_tenant ON jewellery_bills(tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS jewellery_bill_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  item_id TEXT,
  name TEXT NOT NULL,
  category TEXT,
  purity TEXT,
  gross_weight REAL NOT NULL DEFAULT 0,
  net_weight REAL NOT NULL DEFAULT 0,
  rate_per_gram REAL NOT NULL DEFAULT 0,
  making_charges REAL NOT NULL DEFAULT 0,
  stone_charges REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jewellery_bill_items_bill ON jewellery_bill_items(bill_id);

CREATE TABLE IF NOT EXISTS jewellery_custom_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  description TEXT NOT NULL,
  category TEXT,
  metal TEXT NOT NULL DEFAULT 'gold',
  purity TEXT NOT NULL DEFAULT '22k',
  approx_weight REAL,
  design_notes TEXT,
  estimated_price REAL NOT NULL DEFAULT 0,
  advance_paid REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  expected_date TEXT,
  delivered_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jewellery_orders_tenant ON jewellery_custom_orders(tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS jewellery_repairs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_number TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  item_description TEXT NOT NULL,
  issue TEXT,
  estimated_price REAL NOT NULL DEFAULT 0,
  advance_paid REAL NOT NULL DEFAULT 0,
  final_price REAL,
  status TEXT NOT NULL DEFAULT 'received',
  received_at TEXT DEFAULT (datetime('now')),
  expected_date TEXT,
  delivered_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jewellery_repairs_tenant ON jewellery_repairs(tenant_id) WHERE deleted_at IS NULL;
