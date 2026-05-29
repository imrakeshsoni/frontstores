-- [ca] [all tenants]
CREATE TABLE IF NOT EXISTS ca_clients (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '',
  pan TEXT DEFAULT '', gstin TEXT DEFAULT '',
  address TEXT DEFAULT '', client_type TEXT DEFAULT 'individual',
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ca_tasks (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL, task_type TEXT NOT NULL,
  financial_year TEXT DEFAULT '', due_date TEXT,
  status TEXT DEFAULT 'pending', priority TEXT DEFAULT 'normal',
  description TEXT DEFAULT '', fees REAL DEFAULT 0,
  fees_paid REAL DEFAULT 0, completed_at TEXT,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ca_documents (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL, doc_type TEXT NOT NULL,
  doc_name TEXT NOT NULL, financial_year TEXT DEFAULT '',
  notes TEXT DEFAULT '', received_at TEXT,
  updated_at TEXT, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS ca_invoices (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL, invoice_no TEXT DEFAULT '',
  services TEXT DEFAULT '[]', total REAL DEFAULT 0,
  paid REAL DEFAULT 0, invoice_date TEXT NOT NULL,
  status TEXT DEFAULT 'unpaid', updated_at TEXT, deleted_at TEXT
);
