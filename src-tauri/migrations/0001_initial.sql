-- FrontStores SQLite Schema — Migration 0001
-- Rules: UUID TEXT ids, tenant_id on every table, updated_at everywhere,
--        deleted_at for soft deletes (never hard delete user data), indexed.

-- App configuration and tenant identity (one row per installation)
CREATE TABLE IF NOT EXISTS app_config (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id         TEXT NOT NULL UNIQUE,
  shop_type         TEXT NOT NULL DEFAULT 'medical',
  shop_name         TEXT NOT NULL DEFAULT '',
  owner_name        TEXT NOT NULL DEFAULT '',
  phone             TEXT,
  email             TEXT,
  address_line1     TEXT,
  address_line2     TEXT,
  city              TEXT,
  state             TEXT,
  pincode           TEXT,
  gstin             TEXT,
  drug_license_no   TEXT,
  settings          TEXT NOT NULL DEFAULT '{}',
  is_setup_complete INTEGER NOT NULL DEFAULT 0,
  app_version       TEXT NOT NULL DEFAULT '1.0.0',
  last_sync_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products / catalog
CREATE TABLE IF NOT EXISTS products (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id          TEXT NOT NULL,
  name               TEXT NOT NULL,
  sku                TEXT,
  barcode            TEXT,
  category           TEXT,
  brand              TEXT,
  description        TEXT,
  unit               TEXT NOT NULL DEFAULT 'piece',
  mrp                REAL NOT NULL DEFAULT 0,
  selling_price      REAL NOT NULL DEFAULT 0,
  cost_price         REAL,
  gst_rate           REAL NOT NULL DEFAULT 0,
  hsn_code           TEXT,
  -- Medical store fields
  dosage_form        TEXT,
  salt_composition   TEXT,
  manufacturer       TEXT,
  requires_prescription INTEGER NOT NULL DEFAULT 0,
  total_units        INTEGER,
  ml_volume          TEXT,
  -- Stock
  stock_qty          REAL NOT NULL DEFAULT 0,
  min_stock_qty      REAL NOT NULL DEFAULT 0,
  -- Status
  is_active          INTEGER NOT NULL DEFAULT 1,
  deleted_at         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  city             TEXT,
  tags             TEXT DEFAULT '[]',
  loyalty_points   REAL NOT NULL DEFAULT 0,
  credit_limit     REAL NOT NULL DEFAULT 0,
  credit_balance   REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders (bills)
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  bill_number      TEXT NOT NULL,
  customer_id      TEXT REFERENCES customers(id),
  customer_name    TEXT,
  customer_phone   TEXT,
  patient_name     TEXT,
  doctor_name      TEXT,
  subtotal         REAL NOT NULL DEFAULT 0,
  discount         REAL NOT NULL DEFAULT 0,
  tax_total        REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL DEFAULT 0,
  payment_method   TEXT NOT NULL DEFAULT 'cash',
  payment_status   TEXT NOT NULL DEFAULT 'paid',
  amount_paid      REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  order_date       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Order line items
CREATE TABLE IF NOT EXISTS order_items (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  order_id         TEXT NOT NULL REFERENCES orders(id),
  product_id       TEXT REFERENCES products(id),
  product_name     TEXT NOT NULL,
  quantity         REAL NOT NULL,
  unit_price       REAL NOT NULL,
  mrp              REAL,
  discount         REAL NOT NULL DEFAULT 0,
  gst_rate         REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL,
  batch_no         TEXT,
  expiry_date      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inventory batches (track per-batch stock for expiry management)
CREATE TABLE IF NOT EXISTS inventory_batches (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  product_id       TEXT NOT NULL REFERENCES products(id),
  batch_no         TEXT,
  expiry_date      TEXT,
  quantity         REAL NOT NULL DEFAULT 0,
  cost_price       REAL,
  purchase_date    TEXT,
  supplier_id      TEXT,
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inventory adjustments audit log (every stock change is recorded)
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  product_id       TEXT NOT NULL REFERENCES products(id),
  batch_id         TEXT REFERENCES inventory_batches(id),
  quantity         REAL NOT NULL,
  type             TEXT NOT NULL,
  reference_id     TEXT,
  invoice_number   TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  gstin            TEXT,
  drug_license_no  TEXT,
  notes            TEXT,
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bill number sequences (per tenant, per type)
CREATE TABLE IF NOT EXISTS bill_sequences (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  sequence_type    TEXT NOT NULL DEFAULT 'invoice',
  prefix           TEXT NOT NULL DEFAULT 'INV',
  current_number   INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, sequence_type)
);

-- Expenses tracking
CREATE TABLE IF NOT EXISTS expenses (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  category         TEXT NOT NULL,
  description      TEXT,
  amount           REAL NOT NULL,
  expense_date     TEXT NOT NULL DEFAULT (datetime('now')),
  payment_method   TEXT NOT NULL DEFAULT 'cash',
  notes            TEXT,
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Restaurant: tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  capacity         INTEGER NOT NULL DEFAULT 4,
  status           TEXT NOT NULL DEFAULT 'available',
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vehicle showroom: vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  customer_id      TEXT REFERENCES customers(id),
  registration_no  TEXT,
  make             TEXT,
  model            TEXT,
  year             TEXT,
  color            TEXT,
  fuel_type        TEXT,
  vin              TEXT,
  notes            TEXT,
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vehicle service jobs
CREATE TABLE IF NOT EXISTS service_jobs (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id        TEXT NOT NULL,
  vehicle_id       TEXT NOT NULL REFERENCES vehicles(id),
  job_number       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  description      TEXT,
  technician       TEXT,
  estimated_cost   REAL,
  final_cost       REAL,
  start_date       TEXT NOT NULL DEFAULT (datetime('now')),
  end_date         TEXT,
  order_id         TEXT REFERENCES orders(id),
  deleted_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_tenant      ON products(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode     ON products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_name        ON products(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_tenant     ON customers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone      ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_orders_tenant        ON orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_date          ON orders(tenant_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_bill          ON orders(tenant_id, bill_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product  ON order_items(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inv_batches_product  ON inventory_batches(tenant_id, product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_batches_expiry   ON inventory_batches(tenant_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_adjustments_product  ON inventory_adjustments(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_ref      ON inventory_adjustments(reference_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant     ON suppliers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_tenant      ON expenses(tenant_id, expense_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant      ON vehicles(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_jobs_vehicle ON service_jobs(tenant_id, vehicle_id) WHERE deleted_at IS NULL;
