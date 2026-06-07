-- [hardware] [all tenants] — GST billing, stock audit trail, quotations, supplier link

ALTER TABLE hw_products ADD COLUMN barcode TEXT DEFAULT '';
ALTER TABLE hw_products ADD COLUMN hsn_code TEXT DEFAULT '';
ALTER TABLE hw_products ADD COLUMN gst_rate REAL NOT NULL DEFAULT 18;
ALTER TABLE hw_products ADD COLUMN variant TEXT DEFAULT '';
ALTER TABLE hw_products ADD COLUMN supplier_id TEXT DEFAULT '';

ALTER TABLE hw_sales ADD COLUMN subtotal REAL NOT NULL DEFAULT 0;
ALTER TABLE hw_sales ADD COLUMN discount REAL NOT NULL DEFAULT 0;
ALTER TABLE hw_sales ADD COLUMN tax_total REAL NOT NULL DEFAULT 0;
ALTER TABLE hw_sales ADD COLUMN staff_id TEXT DEFAULT '';

ALTER TABLE hw_sale_items ADD COLUMN gst_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE hw_sale_items ADD COLUMN discount REAL NOT NULL DEFAULT 0;

ALTER TABLE hw_credit_transactions ADD COLUMN reference_bill_no TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS hw_stock_movements (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL, product_name TEXT DEFAULT '',
  qty_delta REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'adjustment',
  reference_type TEXT DEFAULT '', reference_id TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hw_stock_moves ON hw_stock_movements(tenant_id, product_id, created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hw_quotations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  quote_no TEXT DEFAULT '', customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  valid_until TEXT, status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hw_quotations ON hw_quotations(tenant_id, status, created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hw_quotation_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  quotation_id TEXT NOT NULL, product_id TEXT,
  product_name TEXT NOT NULL, unit TEXT DEFAULT 'piece',
  quantity REAL DEFAULT 0, rate REAL DEFAULT 0,
  gst_rate REAL DEFAULT 0, discount REAL DEFAULT 0, amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
