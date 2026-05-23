CREATE TABLE IF NOT EXISTS purchase_orders (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  po_number       TEXT NOT NULL,
  supplier_id     TEXT REFERENCES suppliers(id),
  supplier_name   TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  subtotal        REAL NOT NULL DEFAULT 0,
  tax_total       REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  ordered_at      TEXT,
  received_at     TEXT,
  deleted_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  po_id           TEXT NOT NULL REFERENCES purchase_orders(id),
  product_id      TEXT REFERENCES products(id),
  product_name    TEXT NOT NULL,
  quantity        REAL NOT NULL,
  unit_price      REAL NOT NULL DEFAULT 0,
  gst_rate        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  received_qty    REAL NOT NULL DEFAULT 0,
  batch_no        TEXT,
  expiry_date     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_po_tenant   ON purchase_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_items    ON purchase_order_items(po_id);
