-- [crm] [all tenants]
CREATE TABLE IF NOT EXISTS crm_accounts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, industry TEXT DEFAULT '', phone TEXT DEFAULT '',
  email TEXT DEFAULT '', website TEXT DEFAULT '', address TEXT DEFAULT '',
  notes TEXT DEFAULT '', owner_name TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS crm_leads (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, company TEXT DEFAULT '', email TEXT DEFAULT '',
  phone TEXT DEFAULT '', source TEXT DEFAULT '', status TEXT DEFAULT 'new',
  lead_value REAL DEFAULT 0, notes TEXT DEFAULT '',
  converted_at TEXT DEFAULT NULL,
  converted_contact_id TEXT DEFAULT NULL,
  converted_account_id TEXT DEFAULT NULL,
  converted_deal_id TEXT DEFAULT NULL,
  updated_at TEXT, deleted_at TEXT
);
