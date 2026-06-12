-- [crm] [tenant: FrontStores.com] — Salesforce-style Person Accounts
-- is_person = 1 → account represents an individual (no business), named after the person
ALTER TABLE crm_accounts ADD COLUMN is_person INTEGER DEFAULT 0;
