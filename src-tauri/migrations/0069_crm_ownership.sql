-- [crm] [all tenants]
-- Add owner + referred_by to leads
ALTER TABLE crm_leads ADD COLUMN owner TEXT DEFAULT '';
ALTER TABLE crm_leads ADD COLUMN referred_by TEXT DEFAULT '';
ALTER TABLE crm_leads ADD COLUMN business_type TEXT DEFAULT '';
ALTER TABLE crm_leads ADD COLUMN software_interest TEXT DEFAULT '';

-- Add owner + referred_by to deals
ALTER TABLE crm_deals ADD COLUMN owner TEXT DEFAULT '';
ALTER TABLE crm_deals ADD COLUMN referred_by TEXT DEFAULT '';

-- Team members
CREATE TABLE IF NOT EXISTS crm_team_members (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  phone        TEXT DEFAULT '',
  email        TEXT DEFAULT '',
  role         TEXT DEFAULT 'agent',
  commission_pct REAL DEFAULT 50.0,
  notes        TEXT DEFAULT '',
  updated_at   TEXT,
  deleted_at   TEXT
);

-- Commission records (auto-created when deal is won)
CREATE TABLE IF NOT EXISTS crm_commissions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  deal_id         TEXT NOT NULL,
  deal_title      TEXT DEFAULT '',
  deal_value      REAL DEFAULT 0,
  person_name     TEXT NOT NULL,
  person_type     TEXT DEFAULT 'referrer',
  commission_pct  REAL DEFAULT 50.0,
  commission_amount REAL DEFAULT 0,
  status          TEXT DEFAULT 'pending',
  notes           TEXT DEFAULT '',
  updated_at      TEXT,
  deleted_at      TEXT
);

-- WhatsApp inbox — leads captured via WA bot (synced from server)
CREATE TABLE IF NOT EXISTS crm_wa_inbox (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  from_phone   TEXT NOT NULL,
  from_name    TEXT DEFAULT '',
  company      TEXT DEFAULT '',
  business_type TEXT DEFAULT '',
  software_interest TEXT DEFAULT '',
  message_preview TEXT DEFAULT '',
  received_at  TEXT NOT NULL,
  imported_at  TEXT DEFAULT NULL,
  lead_id      TEXT DEFAULT NULL,
  updated_at   TEXT,
  deleted_at   TEXT
);
