-- [core] [all tenants] — multi-app support: one owner can register multiple app types

-- Add is_active flag so multiple app_config rows can coexist (one per registered app)
ALTER TABLE app_config ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Linked accounts registry: all apps this device's owner has registered
CREATE TABLE IF NOT EXISTS linked_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  shop_type TEXT NOT NULL UNIQUE, -- one entry per app type per device
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | rejected
  expires_at TEXT,
  registered_at TEXT,
  last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_linked_accounts ON linked_accounts(status);
