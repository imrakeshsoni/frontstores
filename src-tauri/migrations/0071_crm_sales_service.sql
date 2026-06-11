-- [crm] [all tenants]
-- Sales: quotes/orders/invoices with line items + payments
CREATE TABLE IF NOT EXISTS crm_sales (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  contact_id      TEXT DEFAULT '',
  account_id      TEXT DEFAULT '',
  doc_type        TEXT DEFAULT 'quote',
  doc_no          TEXT DEFAULT '',
  title           TEXT DEFAULT '',
  items           TEXT DEFAULT '[]',
  subtotal        REAL DEFAULT 0,
  discount        REAL DEFAULT 0,
  tax             REAL DEFAULT 0,
  total           REAL DEFAULT 0,
  status          TEXT DEFAULT 'draft',
  due_date        TEXT DEFAULT NULL,
  notes           TEXT DEFAULT '',
  owner           TEXT DEFAULT '',
  updated_at      TEXT,
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS crm_payments (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  sale_id         TEXT NOT NULL,
  amount          REAL DEFAULT 0,
  method          TEXT DEFAULT 'cash',
  paid_at         TEXT NOT NULL,
  notes           TEXT DEFAULT '',
  updated_at      TEXT,
  deleted_at      TEXT
);

-- Service: support tickets + AMC/service contracts
CREATE TABLE IF NOT EXISTS crm_tickets (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  contact_id      TEXT DEFAULT '',
  account_id      TEXT DEFAULT '',
  ticket_no       TEXT DEFAULT '',
  subject         TEXT NOT NULL,
  description     TEXT DEFAULT '',
  priority        TEXT DEFAULT 'medium',
  status          TEXT DEFAULT 'open',
  assigned_to     TEXT DEFAULT '',
  due_date        TEXT DEFAULT NULL,
  resolved_at     TEXT DEFAULT NULL,
  notes           TEXT DEFAULT '',
  updated_at      TEXT,
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS crm_contracts (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  contact_id      TEXT DEFAULT '',
  account_id      TEXT DEFAULT '',
  title           TEXT NOT NULL,
  start_date      TEXT DEFAULT NULL,
  end_date        TEXT DEFAULT NULL,
  value           REAL DEFAULT 0,
  status          TEXT DEFAULT 'active',
  notes           TEXT DEFAULT '',
  updated_at      TEXT,
  deleted_at      TEXT
);
