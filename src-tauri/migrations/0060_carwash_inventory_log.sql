-- [carwash] [all tenants] — track every stock adjustment with date, reason, supplier
CREATE TABLE IF NOT EXISTS carwash_inventory_log (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  item_name   TEXT NOT NULL,
  category    TEXT,
  direction   TEXT NOT NULL CHECK(direction IN ('add','remove')),
  quantity    REAL NOT NULL,
  reason      TEXT,
  supplier    TEXT,
  invoice_no  TEXT,
  date        TEXT NOT NULL,
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_cw_inv_log ON carwash_inventory_log(tenant_id, item_id, date) WHERE deleted_at IS NULL;
