CREATE TABLE IF NOT EXISTS supplier_payments (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  supplier_id     TEXT NOT NULL REFERENCES suppliers(id),
  po_id           TEXT REFERENCES purchase_orders(id),
  amount          REAL NOT NULL,
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  reference_no    TEXT,
  notes           TEXT,
  payment_date    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE suppliers ADD COLUMN total_payable REAL NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN total_paid    REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_supplier_payments ON supplier_payments(tenant_id, supplier_id) WHERE deleted_at IS NULL;
