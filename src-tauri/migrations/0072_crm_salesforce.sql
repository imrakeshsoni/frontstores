-- [crm] [tenant: FrontStores.com] — Salesforce-style sales & service
-- (schema is shared; only the FrontStores.com tenant UI uses these fields)
ALTER TABLE crm_deals ADD COLUMN next_step TEXT DEFAULT '';
ALTER TABLE crm_sales ADD COLUMN deal_id TEXT DEFAULT '';
ALTER TABLE crm_tickets ADD COLUMN origin TEXT DEFAULT 'phone';
ALTER TABLE crm_tickets ADD COLUMN escalated_at TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS crm_case_comments (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  ticket_id   TEXT NOT NULL,
  body        TEXT DEFAULT '',
  author      TEXT DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT,
  deleted_at  TEXT
);
