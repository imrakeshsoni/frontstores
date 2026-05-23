-- Local app authentication (password never leaves the device)
CREATE TABLE IF NOT EXISTS app_auth (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  username     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reset tokens requested by the user (sent to server, code returned by admin)
CREATE TABLE IF NOT EXISTS reset_requests (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  reset_code   TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT
);
