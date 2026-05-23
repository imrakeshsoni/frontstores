CREATE TABLE IF NOT EXISTS khata_entries (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  customer_id     TEXT NOT NULL REFERENCES customers(id),
  order_id        TEXT REFERENCES orders(id),
  type            TEXT NOT NULL CHECK(type IN ('debit','credit')),
  amount          REAL NOT NULL,
  notes           TEXT,
  entry_date      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_khata_customer ON khata_entries (tenant_id, customer_id, deleted_at);
