-- [insurance] [all tenants]
CREATE TABLE IF NOT EXISTS ins_clients (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '',
  dob TEXT DEFAULT '', address TEXT DEFAULT '',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ins_policies (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL, policy_no TEXT NOT NULL,
  insurer TEXT DEFAULT '', policy_type TEXT DEFAULT '',
  plan_name TEXT DEFAULT '', premium REAL DEFAULT 0,
  premium_mode TEXT DEFAULT 'annual', start_date TEXT NOT NULL,
  maturity_date TEXT, next_due_date TEXT,
  status TEXT DEFAULT 'active', commission REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ins_renewals (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  policy_id TEXT NOT NULL, due_date TEXT NOT NULL,
  premium REAL DEFAULT 0, paid INTEGER DEFAULT 0,
  paid_date TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ins_claims (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  policy_id TEXT NOT NULL, claim_no TEXT DEFAULT '',
  amount REAL DEFAULT 0, filed_date TEXT NOT NULL,
  status TEXT DEFAULT 'filed', settled_amount REAL DEFAULT 0,
  updated_at TEXT, deleted_at TEXT
);
