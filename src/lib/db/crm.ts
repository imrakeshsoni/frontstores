// [crm] [all tenants]
import { getDb, uuid, now } from './index';

export interface CRMContact {
  id: string; tenant_id: string;
  name: string; phone: string; email: string;
  company: string; source: string;
  stage: string; tags: string; notes: string;
  account_id: string; // [crm] [tenant: FrontStores.com] — Salesforce-style Account lookup
  updated_at: string; deleted_at: string | null;
}

export interface CRMDeal {
  id: string; tenant_id: string; contact_id: string;
  title: string; value: number; stage: string;
  expected_close_date: string | null; notes: string;
  owner: string; referred_by: string;
  next_step: string; // [crm] [tenant: FrontStores.com] — Salesforce-style "Next Step" field
  account_id: string; // [crm] [tenant: FrontStores.com] — Salesforce-style Account lookup
  updated_at: string; deleted_at: string | null;
}

export interface CRMFollowUp {
  id: string; tenant_id: string; contact_id: string; deal_id: string;
  title: string; type: string; due_at: string | null;
  status: string; notes: string;
  updated_at: string; deleted_at: string | null;
}

export interface CRMCommunication {
  id: string; tenant_id: string; contact_id: string;
  type: string; direction: string; summary: string;
  occurred_at: string;
  updated_at: string; deleted_at: string | null;
}

export interface CRMStats {
  totalContacts: number;
  openDeals: number;
  pipelineValue: number;
  followUpsDueToday: number;
  totalLeads: number;
  newLeads: number;
  convertedLeads: number;
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export async function listCRMContacts(tenantId: string, search = ''): Promise<CRMContact[]> {
  const db = await getDb();
  const q = `%${search}%`;
  return db.select<CRMContact[]>(
    `SELECT * FROM crm_contacts WHERE tenant_id = ? AND deleted_at IS NULL AND (name LIKE ? OR phone LIKE ? OR company LIKE ?) ORDER BY name`,
    [tenantId, q, q, q]
  );
}

export async function createCRMContact(tenantId: string, data: Omit<CRMContact, 'id' | 'tenant_id' | 'account_id' | 'updated_at' | 'deleted_at'> & { account_id?: string }): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_contacts (id,tenant_id,name,phone,email,company,source,stage,tags,notes,account_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone, data.email, data.company ?? '', data.source ?? '', data.stage || 'lead', data.tags ?? '', data.notes ?? '', data.account_id ?? '', now()]
  );
  return id;
}

export async function updateCRMContact(tenantId: string, id: string, data: Partial<CRMContact>): Promise<void> {
  const db = await getDb();
  const fields = ['name','phone','email','company','source','stage','tags','notes','account_id'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE crm_contacts SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMContact(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_contacts SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Deals / Pipeline ─────────────────────────────────────────────────────────

export async function listCRMDeals(tenantId: string, opts: { contactId?: string; stage?: string; ownerFilter?: string | null } = {}): Promise<CRMDeal[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.contactId) { conds.push('contact_id = ?'); params.push(opts.contactId); }
  if (opts.stage) { conds.push('stage = ?'); params.push(opts.stage); }
  if (opts.ownerFilter) { conds.push('owner = ?'); params.push(opts.ownerFilter); }
  return db.select<CRMDeal[]>(`SELECT * FROM crm_deals WHERE ${conds.join(' AND ')} ORDER BY updated_at DESC`, params);
}

export async function createCRMDeal(tenantId: string, data: Omit<CRMDeal, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'> | (Partial<CRMDeal> & { contact_id: string; title: string })): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_deals (id,tenant_id,contact_id,title,value,stage,expected_close_date,notes,owner,referred_by,next_step,account_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.contact_id, data.title, data.value ?? 0, data.stage || 'new', data.expected_close_date ?? null, data.notes ?? '', data.owner ?? '', data.referred_by ?? '', data.next_step ?? '', data.account_id ?? '', now()]
  );
  return id;
}

export async function updateCRMDeal(tenantId: string, id: string, data: Partial<CRMDeal>): Promise<void> {
  const db = await getDb();
  const fields = ['contact_id','title','value','stage','expected_close_date','notes','owner','next_step','account_id'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE crm_deals SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMDeal(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_deals SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Follow-ups / Tasks ───────────────────────────────────────────────────────

export async function listCRMFollowUps(tenantId: string, opts: { contactId?: string; status?: string } = {}): Promise<CRMFollowUp[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.contactId) { conds.push('contact_id = ?'); params.push(opts.contactId); }
  if (opts.status) { conds.push('status = ?'); params.push(opts.status); }
  return db.select<CRMFollowUp[]>(`SELECT * FROM crm_followups WHERE ${conds.join(' AND ')} ORDER BY due_at ASC`, params);
}

export async function createCRMFollowUp(tenantId: string, data: Omit<CRMFollowUp, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_followups (id,tenant_id,contact_id,deal_id,title,type,due_at,status,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.contact_id, data.deal_id ?? '', data.title, data.type || 'call', data.due_at ?? null, data.status || 'pending', data.notes ?? '', now()]
  );
  return id;
}

export async function updateCRMFollowUp(tenantId: string, id: string, data: Partial<CRMFollowUp>): Promise<void> {
  const db = await getDb();
  const fields = ['contact_id','deal_id','title','type','due_at','status','notes'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE crm_followups SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMFollowUp(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_followups SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Communication log ────────────────────────────────────────────────────────

export async function listCRMCommunications(tenantId: string, contactId?: string): Promise<CRMCommunication[]> {
  const db = await getDb();
  if (contactId) {
    return db.select<CRMCommunication[]>(
      `SELECT * FROM crm_communications WHERE tenant_id = ? AND contact_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC`,
      [tenantId, contactId]
    );
  }
  return db.select<CRMCommunication[]>(
    `SELECT * FROM crm_communications WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 100`,
    [tenantId]
  );
}

export async function createCRMCommunication(tenantId: string, data: Omit<CRMCommunication, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_communications (id,tenant_id,contact_id,type,direction,summary,occurred_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.contact_id, data.type || 'call', data.direction || 'outgoing', data.summary ?? '', data.occurred_at, now()]
  );
  return id;
}

export async function deleteCRMCommunication(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_communications SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export interface CRMAccount {
  id: string; tenant_id: string;
  name: string; industry: string; phone: string; email: string;
  website: string; address: string; notes: string; owner_name: string;
  is_person: number; // [crm] [tenant: FrontStores.com] — 1 = Salesforce-style Person Account
  updated_at: string; deleted_at: string | null;
}

export async function listCRMAccounts(tenantId: string, search = ''): Promise<CRMAccount[]> {
  const db = await getDb();
  const q = `%${search}%`;
  return db.select<CRMAccount[]>(
    `SELECT * FROM crm_accounts WHERE tenant_id = ? AND deleted_at IS NULL AND (name LIKE ? OR phone LIKE ? OR email LIKE ?) ORDER BY name`,
    [tenantId, q, q, q]
  );
}

export async function createCRMAccount(tenantId: string, data: Partial<CRMAccount>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_accounts (id,tenant_id,name,industry,phone,email,website,address,notes,owner_name,is_person,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name ?? '', data.industry ?? '', data.phone ?? '', data.email ?? '', data.website ?? '', data.address ?? '', data.notes ?? '', data.owner_name ?? '', data.is_person ?? 0, now()]
  );
  return id;
}

export async function updateCRMAccount(tenantId: string, id: string, data: Partial<CRMAccount>): Promise<void> {
  const db = await getDb();
  const fields = ['name','industry','phone','email','website','address','notes','owner_name'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string,unknown>)[f]); } }
  await db.execute(`UPDATE crm_accounts SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMAccount(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_accounts SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export interface CRMLead {
  id: string; tenant_id: string;
  name: string; company: string; email: string; phone: string;
  source: string; status: string; lead_value: number; notes: string;
  owner: string; referred_by: string;
  business_type: string; software_interest: string;
  converted_at: string | null;
  converted_contact_id: string | null;
  converted_account_id: string | null;
  converted_deal_id: string | null;
  updated_at: string; deleted_at: string | null;
}

export interface CRMTeamMember {
  id: string; tenant_id: string;
  name: string; phone: string; email: string;
  role: string; commission_pct: number; notes: string;
  updated_at: string; deleted_at: string | null;
}

export interface CRMCommission {
  id: string; tenant_id: string;
  deal_id: string; deal_title: string; deal_value: number;
  person_name: string; person_type: string;
  commission_pct: number; commission_amount: number;
  status: string; notes: string;
  updated_at: string; deleted_at: string | null;
}

export interface CRMWaInbox {
  id: string; tenant_id: string;
  from_phone: string; from_name: string;
  company: string; business_type: string; software_interest: string;
  message_preview: string; received_at: string;
  imported_at: string | null; lead_id: string | null;
  updated_at: string; deleted_at: string | null;
}

export async function listCRMLeads(tenantId: string, opts: { status?: string; search?: string; ownerFilter?: string | null } = {}): Promise<CRMLead[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.status && opts.status !== 'all') { conds.push('status = ?'); params.push(opts.status); }
  if (opts.search) { conds.push('(name LIKE ? OR company LIKE ? OR email LIKE ?)'); const q = `%${opts.search}%`; params.push(q, q, q); }
  if (opts.ownerFilter) { conds.push('owner = ?'); params.push(opts.ownerFilter); }
  return db.select<CRMLead[]>(`SELECT * FROM crm_leads WHERE ${conds.join(' AND ')} ORDER BY updated_at DESC`, params);
}

export async function createCRMLead(tenantId: string, data: Partial<CRMLead>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_leads (id,tenant_id,name,company,email,phone,source,status,lead_value,notes,owner,referred_by,business_type,software_interest,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name ?? '', data.company ?? '', data.email ?? '', data.phone ?? '', data.source ?? '', data.status || 'new', data.lead_value ?? 0, data.notes ?? '', data.owner ?? '', data.referred_by ?? '', data.business_type ?? '', data.software_interest ?? '', now()]
  );
  return id;
}

export async function updateCRMLead(tenantId: string, id: string, data: Partial<CRMLead>): Promise<void> {
  const db = await getDb();
  const fields = ['name','company','email','phone','source','status','lead_value','notes','owner','referred_by','business_type','software_interest'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string,unknown>)[f]); } }
  await db.execute(`UPDATE crm_leads SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMLead(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_leads SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// Salesforce-style lead conversion: auto-creates Account + Contact + Opportunity
// accountMode ('business' | 'person') is the Salesforce flow used by tenant FrontStores.com:
// business → account named after the company; person → Person Account named after the lead.
// Without accountMode the original behavior applies (account only when the lead has a company).
export async function convertCRMLead(
  tenantId: string,
  leadId: string,
  opts: { createAccount: boolean; createContact: boolean; createDeal: boolean; dealValue?: number; accountMode?: 'business' | 'person'; dealStage?: string }
): Promise<{ accountId: string | null; contactId: string | null; dealId: string | null }> {
  const db = await getDb();
  const [lead] = await db.select<CRMLead[]>(`SELECT * FROM crm_leads WHERE id = ? AND tenant_id = ?`, [leadId, tenantId]);
  if (!lead) throw new Error('Lead not found');

  let accountId: string | null = null;
  let contactId: string | null = null;
  let dealId: string | null = null;

  if (opts.createAccount && opts.accountMode) {
    const isPerson = opts.accountMode === 'person' || !lead.company;
    accountId = await createCRMAccount(tenantId, {
      name: isPerson ? lead.name : lead.company,
      phone: lead.phone, email: lead.email, is_person: isPerson ? 1 : 0,
    });
  } else if (opts.createAccount && lead.company) {
    accountId = await createCRMAccount(tenantId, {
      name: lead.company, phone: lead.phone, email: lead.email,
    });
  }

  if (opts.createContact) {
    contactId = await createCRMContact(tenantId, {
      name: lead.name, phone: lead.phone, email: lead.email,
      company: lead.company, source: lead.source,
      stage: 'qualified', tags: '', notes: lead.notes,
      account_id: accountId ?? '', // [crm] [tenant: FrontStores.com] — hard link to the new Account
    });
  }

  if (opts.createDeal && contactId) {
    dealId = uuid();
    await db.execute(
      `INSERT INTO crm_deals (id,tenant_id,contact_id,title,value,stage,expected_close_date,notes,owner,referred_by,account_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [dealId, tenantId, contactId, `${lead.company || lead.name} — Opportunity`, opts.dealValue ?? lead.lead_value ?? 0, opts.dealStage ?? 'new', null, '', lead.owner ?? '', lead.referred_by ?? '', accountId ?? '', now()]
    );
  }

  await db.execute(
    `UPDATE crm_leads SET status = 'converted', converted_at = ?, converted_contact_id = ?, converted_account_id = ?, converted_deal_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), contactId, accountId, dealId, now(), leadId, tenantId]
  );

  return { accountId, contactId, dealId };
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getCRMStats(tenantId: string): Promise<CRMStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [{ total: totalContacts }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_contacts WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
  const [{ total: openDeals }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_deals WHERE tenant_id = ? AND deleted_at IS NULL AND stage NOT IN ('won','lost')`, [tenantId]);
  const rows = await db.select<{ value: number }[]>(`SELECT value FROM crm_deals WHERE tenant_id = ? AND deleted_at IS NULL AND stage NOT IN ('won','lost')`, [tenantId]);
  const pipelineValue = rows.reduce((s, r) => s + (r.value || 0), 0);
  const [{ total: followUpsDueToday }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_followups WHERE tenant_id = ? AND deleted_at IS NULL AND status != 'done' AND due_at IS NOT NULL AND substr(due_at,1,10) <= ?`, [tenantId, today]);
  const [{ total: totalLeads }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_leads WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
  const [{ total: newLeads }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_leads WHERE tenant_id = ? AND deleted_at IS NULL AND status IN ('new','working')`, [tenantId]);
  const [{ total: convertedLeads }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_leads WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'converted'`, [tenantId]);
  return { totalContacts, openDeals, pipelineValue, followUpsDueToday, totalLeads, newLeads, convertedLeads };
}

// ── Team Members ─────────────────────────────────────────────────────────────

export async function listCRMTeamMembers(tenantId: string): Promise<CRMTeamMember[]> {
  const db = await getDb();
  return db.select<CRMTeamMember[]>(`SELECT * FROM crm_team_members WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
}

export async function createCRMTeamMember(tenantId: string, data: Partial<CRMTeamMember>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_team_members (id,tenant_id,name,phone,email,role,commission_pct,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name ?? '', data.phone ?? '', data.email ?? '', data.role ?? 'agent', data.commission_pct ?? 50, data.notes ?? '', now()]
  );
  return id;
}

export async function updateCRMTeamMember(tenantId: string, id: string, data: Partial<CRMTeamMember>): Promise<void> {
  const db = await getDb();
  const fields = ['name','phone','email','role','commission_pct','notes'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string,unknown>)[f]); } }
  await db.execute(`UPDATE crm_team_members SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMTeamMember(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_team_members SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Commissions ──────────────────────────────────────────────────────────────

export async function listCRMCommissions(tenantId: string, dealId?: string): Promise<CRMCommission[]> {
  const db = await getDb();
  if (dealId) {
    return db.select<CRMCommission[]>(`SELECT * FROM crm_commissions WHERE tenant_id = ? AND deal_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`, [tenantId, dealId]);
  }
  return db.select<CRMCommission[]>(`SELECT * FROM crm_commissions WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`, [tenantId]);
}

export async function createDealCommissions(tenantId: string, deal: { id: string; title: string; value: number; owner: string; referred_by: string }, ownerName: string): Promise<void> {
  const db = await getDb();
  // Idempotent — skip if commissions already exist for this deal
  const existing = await db.select<{ c: number }[]>(`SELECT COUNT(*) as c FROM crm_commissions WHERE tenant_id = ? AND deal_id = ? AND deleted_at IS NULL`, [tenantId, deal.id]);
  if ((existing[0]?.c ?? 0) > 0) return;
  const half = (deal.value ?? 0) / 2;
  // Owner always gets 50%
  const ownerId = uuid();
  await db.execute(
    `INSERT INTO crm_commissions (id,tenant_id,deal_id,deal_title,deal_value,person_name,person_type,commission_pct,commission_amount,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [ownerId, tenantId, deal.id, deal.title, deal.value, deal.owner || ownerName, 'owner', 50, half, 'pending', now()]
  );
  // Referred-by person gets 50% (if different from owner)
  if (deal.referred_by && deal.referred_by !== (deal.owner || ownerName)) {
    const refId = uuid();
    await db.execute(
      `INSERT INTO crm_commissions (id,tenant_id,deal_id,deal_title,deal_value,person_name,person_type,commission_pct,commission_amount,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [refId, tenantId, deal.id, deal.title, deal.value, deal.referred_by, 'referrer', 50, half, 'pending', now()]
    );
  }
}

export async function updateCRMCommissionStatus(tenantId: string, id: string, status: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_commissions SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [status, now(), id, tenantId]);
}

// ── WhatsApp Inbox ────────────────────────────────────────────────────────────

export async function listCRMWaInbox(tenantId: string, importedFilter?: 'pending' | 'imported'): Promise<CRMWaInbox[]> {
  const db = await getDb();
  if (importedFilter === 'pending') {
    return db.select<CRMWaInbox[]>(`SELECT * FROM crm_wa_inbox WHERE tenant_id = ? AND deleted_at IS NULL AND imported_at IS NULL ORDER BY received_at DESC`, [tenantId]);
  }
  return db.select<CRMWaInbox[]>(`SELECT * FROM crm_wa_inbox WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY received_at DESC`, [tenantId]);
}

export async function upsertCRMWaLead(tenantId: string, data: Omit<CRMWaInbox, 'id' | 'tenant_id' | 'imported_at' | 'lead_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const [existing] = await db.select<CRMWaInbox[]>(`SELECT id FROM crm_wa_inbox WHERE tenant_id = ? AND from_phone = ? AND imported_at IS NULL`, [tenantId, data.from_phone]);
  if (existing) {
    await db.execute(
      `UPDATE crm_wa_inbox SET from_name=?,company=?,business_type=?,software_interest=?,message_preview=?,updated_at=? WHERE id=?`,
      [data.from_name, data.company, data.business_type, data.software_interest, data.message_preview, now(), existing.id]
    );
    return existing.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_wa_inbox (id,tenant_id,from_phone,from_name,company,business_type,software_interest,message_preview,received_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.from_phone, data.from_name, data.company, data.business_type, data.software_interest, data.message_preview, data.received_at, now()]
  );
  return id;
}

export async function importWaLeadToLead(tenantId: string, waInboxId: string, owner: string): Promise<string> {
  const db = await getDb();
  const [wa] = await db.select<CRMWaInbox[]>(`SELECT * FROM crm_wa_inbox WHERE id = ? AND tenant_id = ?`, [waInboxId, tenantId]);
  if (!wa) throw new Error('WA inbox entry not found');
  const leadId = await createCRMLead(tenantId, {
    name: wa.from_name || wa.from_phone,
    company: wa.company,
    phone: wa.from_phone,
    source: 'whatsapp',
    status: 'new',
    business_type: wa.business_type,
    software_interest: wa.software_interest,
    notes: wa.message_preview,
    owner,
    referred_by: '',
  });
  await db.execute(`UPDATE crm_wa_inbox SET imported_at = ?, lead_id = ?, updated_at = ? WHERE id = ?`, [now(), leadId, now(), waInboxId]);
  return leadId;
}

// ── WhatsApp auto-lead sync ───────────────────────────────────────────────────
// [crm] [all tenants] — pulls WhatsApp bot leads from the update server (each
// tenant runs the bot on their own WhatsApp Business number). A lead is
// auto-created the moment a customer sends their first message, kept updated
// as they answer each bot question, and assigned to the tenant's owner.
const WA_LEADS_SERVER = 'https://update.frontstores.com';

interface ServerWaLead {
  id: string; from_phone: string; from_name?: string; company?: string;
  business_type?: string; software_interest?: string; message_preview?: string;
  received_at?: string; imported?: boolean; assigned_to?: string;
}

export async function syncWaLeadsFromServer(tenantId: string, ownerName = ''): Promise<boolean> {
  if (!tenantId) return false;
  let serverLeads: ServerWaLead[] = [];
  try {
    const res = await fetch(`${WA_LEADS_SERVER}/api/wa-leads/${tenantId}`);
    serverLeads = (await res.json()).leads ?? [];
  } catch { return false; } // offline — try again on the next poll
  if (serverLeads.length === 0) return false;

  const db = await getDb();
  let changedAny = false;
  for (const sl of serverLeads) {
    if (!sl.from_phone) continue;
    const [inbox] = await db.select<CRMWaInbox[]>(
      `SELECT * FROM crm_wa_inbox WHERE tenant_id = ? AND from_phone = ? AND deleted_at IS NULL ORDER BY received_at DESC LIMIT 1`,
      [tenantId, sl.from_phone]
    );
    if (!inbox) {
      const inboxId = await upsertCRMWaLead(tenantId, {
        from_phone: sl.from_phone,
        from_name: sl.from_name || '',
        company: sl.company || '',
        business_type: sl.business_type || '',
        software_interest: sl.software_interest || '',
        message_preview: sl.message_preview || '',
        received_at: sl.received_at || now(),
      });
      await importWaLeadToLead(tenantId, inboxId, sl.assigned_to || ownerName);
      changedAny = true;
    } else {
      // Merge: server values win when present, but never blank out local data
      const merged = {
        from_name: sl.from_name || inbox.from_name || '',
        company: sl.company || inbox.company || '',
        business_type: sl.business_type || inbox.business_type || '',
        software_interest: sl.software_interest || inbox.software_interest || '',
        message_preview: sl.message_preview || inbox.message_preview || '',
      };
      const changed = (Object.keys(merged) as (keyof typeof merged)[]).some(k => merged[k] !== (inbox[k] || ''));
      if (changed) {
        await db.execute(
          `UPDATE crm_wa_inbox SET from_name=?,company=?,business_type=?,software_interest=?,message_preview=?,updated_at=? WHERE id=?`,
          [merged.from_name, merged.company, merged.business_type, merged.software_interest, merged.message_preview, now(), inbox.id]
        );
        if (inbox.lead_id) {
          await updateCRMLead(tenantId, inbox.lead_id, {
            name: merged.from_name || sl.from_phone,
            company: merged.company,
            business_type: merged.business_type,
            software_interest: merged.software_interest,
            notes: merged.message_preview,
          });
        }
        changedAny = true;
      }
      if (!inbox.lead_id) {
        await importWaLeadToLead(tenantId, inbox.id, sl.assigned_to || ownerName);
        changedAny = true;
      }
    }
    if (!sl.imported) {
      try { await fetch(`${WA_LEADS_SERVER}/api/wa-leads/${tenantId}/${sl.id}/mark-imported`, { method: 'POST' }); } catch { /* retried next poll */ }
    }
  }
  return changedAny;
}
