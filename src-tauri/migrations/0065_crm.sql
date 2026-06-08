-- [crm] [all tenants]
CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '',
  company TEXT DEFAULT '', source TEXT DEFAULT '',
  stage TEXT DEFAULT 'lead', tags TEXT DEFAULT '', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS crm_deals (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  contact_id TEXT NOT NULL, title TEXT NOT NULL,
  value REAL DEFAULT 0, stage TEXT DEFAULT 'new',
  expected_close_date TEXT, notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS crm_followups (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  contact_id TEXT NOT NULL, deal_id TEXT DEFAULT '',
  title TEXT NOT NULL, type TEXT DEFAULT 'call',
  due_at TEXT, status TEXT DEFAULT 'pending', notes TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS crm_communications (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  contact_id TEXT NOT NULL, type TEXT DEFAULT 'call',
  direction TEXT DEFAULT 'outgoing', summary TEXT DEFAULT '',
  occurred_at TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT
);
