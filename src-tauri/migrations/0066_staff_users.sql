-- [core] [all apps] [all tenants]
-- Staff logins under the same tenant — created by the owner from Settings,
-- activated only after admin approval. Password never leaves the device
-- (same SHA-256(salt+password) scheme as app_auth); only the username and
-- a request id are sent to the server for approval.
CREATE TABLE IF NOT EXISTS staff_users (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  username        TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  salt            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  request_id      TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  requested_at    TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at     TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
