// [crm] [all tenants]
import { getDb, uuid, now } from './index';

export interface CRMTicket {
  id: string; tenant_id: string;
  contact_id: string; account_id: string;
  ticket_no: string; subject: string; description: string;
  priority: string; status: string; assigned_to: string;
  due_date: string | null; resolved_at: string | null; notes: string;
  origin: string; escalated_at: string | null; // [crm] [tenant: FrontStores.com] — Salesforce-style case fields
  updated_at: string; deleted_at: string | null;
}

// [crm] [tenant: FrontStores.com] — Salesforce-style case feed comments
export interface CRMCaseComment {
  id: string; tenant_id: string; ticket_id: string;
  body: string; author: string; created_at: string;
  updated_at: string; deleted_at: string | null;
}

export interface CRMContract {
  id: string; tenant_id: string;
  contact_id: string; account_id: string;
  title: string; start_date: string | null; end_date: string | null;
  value: number; status: string; notes: string;
  updated_at: string; deleted_at: string | null;
}

// ── Tickets ──────────────────────────────────────────────────────────────────

export async function listCRMTickets(tenantId: string, opts: { status?: string; contactId?: string } = {}): Promise<CRMTicket[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.status && opts.status !== 'all') { conds.push('status = ?'); params.push(opts.status); }
  if (opts.contactId) { conds.push('contact_id = ?'); params.push(opts.contactId); }
  return db.select<CRMTicket[]>(`SELECT * FROM crm_tickets WHERE ${conds.join(' AND ')} ORDER BY updated_at DESC`, params);
}

export async function createCRMTicket(tenantId: string, data: Partial<CRMTicket>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const ticketNo = data.ticket_no || `TKT-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO crm_tickets (id,tenant_id,contact_id,account_id,ticket_no,subject,description,priority,status,assigned_to,due_date,resolved_at,notes,origin,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.contact_id ?? '', data.account_id ?? '', ticketNo, data.subject ?? '', data.description ?? '',
     data.priority || 'medium', data.status || 'open', data.assigned_to ?? '', data.due_date ?? null, null, data.notes ?? '', data.origin || 'phone', now()]
  );
  return id;
}

export async function updateCRMTicket(tenantId: string, id: string, data: Partial<CRMTicket>): Promise<void> {
  const db = await getDb();
  const fields = ['contact_id','account_id','subject','description','priority','status','assigned_to','due_date','resolved_at','notes','origin','escalated_at'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  if (data.status === 'resolved' || data.status === 'closed') {
    if (!('resolved_at' in data)) { updates.push('resolved_at = ?'); vals.push(now()); }
  }
  await db.execute(`UPDATE crm_tickets SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMTicket(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_tickets SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Case comments (Salesforce-style case feed) ───────────────────────────────
// [crm] [tenant: FrontStores.com]

export async function listCRMCaseComments(tenantId: string, ticketId: string): Promise<CRMCaseComment[]> {
  const db = await getDb();
  return db.select<CRMCaseComment[]>(
    `SELECT * FROM crm_case_comments WHERE tenant_id = ? AND ticket_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId, ticketId]
  );
}

export async function createCRMCaseComment(tenantId: string, data: { ticket_id: string; body: string; author?: string }): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_case_comments (id,tenant_id,ticket_id,body,author,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, data.ticket_id, data.body, data.author ?? '', now(), now()]
  );
  return id;
}

export async function deleteCRMCaseComment(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_case_comments SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Service Contracts (AMC) ───────────────────────────────────────────────────

export async function listCRMContracts(tenantId: string, opts: { status?: string } = {}): Promise<CRMContract[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.status && opts.status !== 'all') { conds.push('status = ?'); params.push(opts.status); }
  return db.select<CRMContract[]>(`SELECT * FROM crm_contracts WHERE ${conds.join(' AND ')} ORDER BY end_date ASC`, params);
}

export async function createCRMContract(tenantId: string, data: Partial<CRMContract>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_contracts (id,tenant_id,contact_id,account_id,title,start_date,end_date,value,status,notes,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.contact_id ?? '', data.account_id ?? '', data.title ?? '', data.start_date ?? null, data.end_date ?? null,
     data.value ?? 0, data.status || 'active', data.notes ?? '', now()]
  );
  return id;
}

export async function updateCRMContract(tenantId: string, id: string, data: Partial<CRMContract>): Promise<void> {
  const db = await getDb();
  const fields = ['contact_id','account_id','title','start_date','end_date','value','status','notes'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE crm_contracts SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMContract(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_contracts SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface CRMServiceStats {
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  activeContracts: number;
  expiringContracts: number;
}

export async function getCRMServiceStats(tenantId: string): Promise<CRMServiceStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [{ total: openTickets }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_tickets WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'open'`, [tenantId]);
  const [{ total: inProgressTickets }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_tickets WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'in_progress'`, [tenantId]);
  const [{ total: resolvedToday }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_tickets WHERE tenant_id = ? AND deleted_at IS NULL AND resolved_at IS NOT NULL AND substr(resolved_at,1,10) = ?`, [tenantId, today]);
  const [{ total: activeContracts }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_contracts WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active'`, [tenantId]);
  const [{ total: expiringContracts }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_contracts WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active' AND end_date IS NOT NULL AND end_date <= ?`, [tenantId, in30]);
  return { openTickets, inProgressTickets, resolvedToday, activeContracts, expiringContracts };
}
