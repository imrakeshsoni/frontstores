CREATE TABLE IF NOT EXISTS sync_queue (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  type        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  synced_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue (synced_at);
