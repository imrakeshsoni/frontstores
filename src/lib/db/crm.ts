// [crm] [all tenants]
import { getDb, uuid, now } from './index';

export interface CRMContact {
  id: string; tenant_id: string;
  name: string; phone: string; email: string;
  company: string; source: string;
  stage: string; tags: string; notes: string;
  updated_at: string; deleted_at: string | null;
}

export interface CRMDeal {
  id: string; tenant_id: string; contact_id: string;
  title: string; value: number; stage: string;
  expected_close_date: string | null; notes: string;
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

export async function createCRMContact(tenantId: string, data: Omit<CRMContact, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_contacts (id,tenant_id,name,phone,email,company,source,stage,tags,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone, data.email, data.company ?? '', data.source ?? '', data.stage || 'lead', data.tags ?? '', data.notes ?? '', now()]
  );
  return id;
}

export async function updateCRMContact(tenantId: string, id: string, data: Partial<CRMContact>): Promise<void> {
  const db = await getDb();
  const fields = ['name','phone','email','company','source','stage','tags','notes'];
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

export async function listCRMDeals(tenantId: string, opts: { contactId?: string; stage?: string } = {}): Promise<CRMDeal[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.contactId) { conds.push('contact_id = ?'); params.push(opts.contactId); }
  if (opts.stage) { conds.push('stage = ?'); params.push(opts.stage); }
  return db.select<CRMDeal[]>(`SELECT * FROM crm_deals WHERE ${conds.join(' AND ')} ORDER BY updated_at DESC`, params);
}

export async function createCRMDeal(tenantId: string, data: Omit<CRMDeal, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_deals (id,tenant_id,contact_id,title,value,stage,expected_close_date,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.contact_id, data.title, data.value ?? 0, data.stage || 'new', data.expected_close_date ?? null, data.notes ?? '', now()]
  );
  return id;
}

export async function updateCRMDeal(tenantId: string, id: string, data: Partial<CRMDeal>): Promise<void> {
  const db = await getDb();
  const fields = ['contact_id','title','value','stage','expected_close_date','notes'];
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

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getCRMStats(tenantId: string): Promise<CRMStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [{ total: totalContacts }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_contacts WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
  const [{ total: openDeals }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_deals WHERE tenant_id = ? AND deleted_at IS NULL AND stage NOT IN ('won','lost')`, [tenantId]);
  const rows = await db.select<{ value: number }[]>(`SELECT value FROM crm_deals WHERE tenant_id = ? AND deleted_at IS NULL AND stage NOT IN ('won','lost')`, [tenantId]);
  const pipelineValue = rows.reduce((s, r) => s + (r.value || 0), 0);
  const [{ total: followUpsDueToday }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_followups WHERE tenant_id = ? AND deleted_at IS NULL AND status != 'done' AND due_at IS NOT NULL AND substr(due_at,1,10) <= ?`, [tenantId, today]);
  return { totalContacts, openDeals, pipelineValue, followUpsDueToday };
}
