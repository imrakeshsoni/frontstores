-- Failed login tracking on app_auth
ALTER TABLE app_auth ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_auth ADD COLUMN locked_until TEXT;

-- Export / backup audit log
CREATE TABLE IF NOT EXISTS export_logs (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  export_type TEXT NOT NULL,
  row_count   INTEGER DEFAULT 0,
  exported_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_export_logs_tenant ON export_logs(tenant_id, exported_at DESC);
