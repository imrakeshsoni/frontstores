-- [crm] [all tenants] — full WhatsApp bot chat transcripts synced from the update server
CREATE TABLE IF NOT EXISTS crm_wa_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  from_phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'in',
  message TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_wa_messages_phone ON crm_wa_messages(tenant_id, from_phone, sent_at);
