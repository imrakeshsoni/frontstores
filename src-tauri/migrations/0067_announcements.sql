-- [core] [all apps] [all tenants]
CREATE TABLE IF NOT EXISTS announcements (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  remote_id     TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  notified_at   TEXT,
  read_at       TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT,
  UNIQUE(tenant_id, remote_id)
);
