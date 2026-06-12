-- [crm] [all tenants] — WhatsApp profile name kept separate from the typed name
ALTER TABLE crm_wa_inbox ADD COLUMN whatsapp_name TEXT DEFAULT '';
ALTER TABLE crm_leads ADD COLUMN whatsapp_name TEXT DEFAULT '';
