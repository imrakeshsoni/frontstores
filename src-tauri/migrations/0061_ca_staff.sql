-- [ca] [all tenants]
ALTER TABLE ca_clients ADD COLUMN tan TEXT DEFAULT '';
ALTER TABLE ca_clients ADD COLUMN cin TEXT DEFAULT '';
ALTER TABLE ca_clients ADD COLUMN aadhaar TEXT DEFAULT '';
ALTER TABLE ca_clients ADD COLUMN notes TEXT DEFAULT '';
ALTER TABLE ca_tasks ADD COLUMN staff_id TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS ca_staff (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, role TEXT DEFAULT 'article',
  phone TEXT DEFAULT '', email TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
