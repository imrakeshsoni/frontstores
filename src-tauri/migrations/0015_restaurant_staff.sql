-- [restaurant] [all tenants] — Staff/waiter management
CREATE TABLE IF NOT EXISTS restaurant_staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'waiter',
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

ALTER TABLE restaurant_tables ADD COLUMN assigned_staff_id TEXT;
ALTER TABLE restaurant_tables ADD COLUMN assigned_staff_name TEXT;
ALTER TABLE restaurant_orders ADD COLUMN staff_id TEXT;
ALTER TABLE restaurant_orders ADD COLUMN staff_name TEXT;
