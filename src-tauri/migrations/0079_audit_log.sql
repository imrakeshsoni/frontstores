-- [core] [all apps] [all tenants]
-- Tamper-evident audit trail. Every write (INSERT/UPDATE/DELETE) made anywhere via
-- getDb() is logged here automatically by the execute() wrapper in lib/db/index.ts —
-- so ANY current or FUTURE feature is captured with zero extra code. Append-only:
-- rows are never updated or deleted by the app.
CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT NOT NULL,
  action       TEXT NOT NULL,                 -- CREATE | UPDATE | DELETE
  table_name   TEXT NOT NULL,                 -- which section/table changed
  record_id    TEXT,                          -- affected row id (best-effort)
  summary      TEXT,                          -- human-readable ("Created orders")
  details      TEXT,                          -- JSON { sql, params } — full detail
  actor        TEXT,                          -- logged-in username (owner / staff)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT,
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_date ON audit_log(tenant_id, created_at);
