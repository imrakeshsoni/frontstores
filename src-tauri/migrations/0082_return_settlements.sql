-- [medical] [all tenants] — supplier-level refund settlement for returned expired stock
ALTER TABLE inventory_batches ADD COLUMN return_settled_at TEXT;

-- one settlement row per supplier covering the seen expired batches returned to them
CREATE TABLE IF NOT EXISTS return_settlements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_id TEXT,
  supplier_name TEXT,
  settlement_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  item_count INTEGER,
  batch_ids TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_return_settlements_tenant ON return_settlements (tenant_id, deleted_at);
