-- [tyrescrap] [all tenants]
CREATE TABLE IF NOT EXISTS tyre_vendors (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tyre_buyers (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  gst_number TEXT,
  notes      TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tyre_purchases (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  vendor_id       TEXT,
  vendor_name     TEXT NOT NULL,
  date            TEXT NOT NULL,
  tyre_type       TEXT NOT NULL,
  category        TEXT NOT NULL,
  quantity_pieces INTEGER DEFAULT 0,
  weight_kg       REAL    DEFAULT 0,
  rate_per_kg     REAL    DEFAULT 0,
  total_amount    REAL    NOT NULL,
  payment_mode    TEXT    DEFAULT 'cash',
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS tyre_sales (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  buyer_id        TEXT,
  buyer_name      TEXT NOT NULL,
  bill_number     TEXT,
  date            TEXT NOT NULL,
  tyre_type       TEXT NOT NULL,
  category        TEXT NOT NULL,
  quantity_pieces INTEGER DEFAULT 0,
  weight_kg       REAL    DEFAULT 0,
  rate_per_kg     REAL    DEFAULT 0,
  total_amount    REAL    NOT NULL,
  payment_mode    TEXT    DEFAULT 'cash',
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS tyre_expenses (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  date        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  amount      REAL NOT NULL,
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_tyre_vendors_tenant   ON tyre_vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tyre_buyers_tenant    ON tyre_buyers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tyre_purchases_tenant ON tyre_purchases(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_tyre_sales_tenant     ON tyre_sales(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_tyre_expenses_tenant  ON tyre_expenses(tenant_id, date);
