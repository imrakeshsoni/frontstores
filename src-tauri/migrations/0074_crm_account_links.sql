-- [crm] [tenant: FrontStores.com] — proper Salesforce-style record links:
-- Contacts and Opportunities carry a real account_id lookup (not just a company-name match)
ALTER TABLE crm_contacts ADD COLUMN account_id TEXT DEFAULT '';
ALTER TABLE crm_deals ADD COLUMN account_id TEXT DEFAULT '';

-- Backfill existing contacts: business accounts match on company name,
-- Person Accounts match on the contact's own name
UPDATE crm_contacts SET account_id = COALESCE((
  SELECT a.id FROM crm_accounts a
  WHERE a.tenant_id = crm_contacts.tenant_id AND a.deleted_at IS NULL
    AND ((a.is_person = 0 AND TRIM(crm_contacts.company) != '' AND LOWER(TRIM(a.name)) = LOWER(TRIM(crm_contacts.company)))
      OR (a.is_person = 1 AND LOWER(TRIM(a.name)) = LOWER(TRIM(crm_contacts.name))))
  LIMIT 1), '')
WHERE deleted_at IS NULL AND (account_id IS NULL OR account_id = '');

-- Backfill existing opportunities: inherit the account of their contact
UPDATE crm_deals SET account_id = COALESCE((
  SELECT c.account_id FROM crm_contacts c
  WHERE c.id = crm_deals.contact_id AND c.tenant_id = crm_deals.tenant_id
), '')
WHERE deleted_at IS NULL AND (account_id IS NULL OR account_id = '');
