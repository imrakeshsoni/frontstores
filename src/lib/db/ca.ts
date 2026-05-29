// [ca] [all tenants]
import { getDb, uuid, now } from './index';

export interface CAClient {
  id: string; tenant_id: string;
  name: string; phone: string; email: string;
  pan: string; gstin: string; address: string;
  client_type: string; updated_at: string; deleted_at: string | null;
}

export interface CATask {
  id: string; tenant_id: string; client_id: string;
  task_type: string; financial_year: string; due_date: string | null;
  status: string; priority: string; description: string;
  fees: number; fees_paid: number; completed_at: string | null;
  updated_at: string; deleted_at: string | null;
}

export interface CADocument {
  id: string; tenant_id: string; client_id: string;
  doc_type: string; doc_name: string; financial_year: string;
  notes: string; received_at: string | null;
  updated_at: string; deleted_at: string | null;
}

export interface CAInvoice {
  id: string; tenant_id: string; client_id: string;
  invoice_no: string; services: string; total: number;
  paid: number; invoice_date: string; status: string;
  updated_at: string; deleted_at: string | null;
}

// ── Clients ──────────────────────────────────────────────────────────────────

export async function listCAClients(tenantId: string, search = ''): Promise<CAClient[]> {
  const db = await getDb();
  const q = `%${search}%`;
  return db.select<CAClient[]>(
    `SELECT * FROM ca_clients WHERE tenant_id = ? AND deleted_at IS NULL AND (name LIKE ? OR pan LIKE ? OR phone LIKE ?) ORDER BY name`,
    [tenantId, q, q, q]
  );
}

export async function createCAClient(tenantId: string, data: Omit<CAClient, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO ca_clients (id,tenant_id,name,phone,email,pan,gstin,address,client_type,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone, data.email, data.pan, data.gstin, data.address, data.client_type, now()]
  );
  return id;
}

export async function updateCAClient(tenantId: string, id: string, data: Partial<CAClient>): Promise<void> {
  const db = await getDb();
  const fields = ['name','phone','email','pan','gstin','address','client_type'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ca_clients SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCAClient(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ca_clients SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function listCATasks(tenantId: string, opts: { clientId?: string; status?: string; fy?: string } = {}): Promise<CATask[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.clientId) { conds.push('client_id = ?'); params.push(opts.clientId); }
  if (opts.status)   { conds.push('status = ?');    params.push(opts.status); }
  if (opts.fy)       { conds.push('financial_year = ?'); params.push(opts.fy); }
  return db.select<CATask[]>(`SELECT * FROM ca_tasks WHERE ${conds.join(' AND ')} ORDER BY due_date ASC`, params);
}

export async function createCATask(tenantId: string, data: Omit<CATask, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at' | 'completed_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO ca_tasks (id,tenant_id,client_id,task_type,financial_year,due_date,status,priority,description,fees,fees_paid,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.client_id, data.task_type, data.financial_year, data.due_date, data.status, data.priority, data.description, data.fees, data.fees_paid, now()]
  );
  return id;
}

export async function updateCATask(tenantId: string, id: string, data: Partial<CATask>): Promise<void> {
  const db = await getDb();
  const fields = ['client_id','task_type','financial_year','due_date','status','priority','description','fees','fees_paid','completed_at'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ca_tasks SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCATask(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ca_tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Documents ────────────────────────────────────────────────────────────────

export async function listCADocuments(tenantId: string, clientId?: string): Promise<CADocument[]> {
  const db = await getDb();
  if (clientId) {
    return db.select<CADocument[]>(`SELECT * FROM ca_documents WHERE tenant_id = ? AND client_id = ? AND deleted_at IS NULL ORDER BY doc_name`, [tenantId, clientId]);
  }
  return db.select<CADocument[]>(`SELECT * FROM ca_documents WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY doc_name`, [tenantId]);
}

export async function createCADocument(tenantId: string, data: Omit<CADocument, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO ca_documents (id,tenant_id,client_id,doc_type,doc_name,financial_year,notes,received_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.client_id, data.doc_type, data.doc_name, data.financial_year, data.notes, data.received_at, now()]
  );
  return id;
}

export async function deleteCADocument(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ca_documents SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export async function listCAInvoices(tenantId: string, clientId?: string): Promise<CAInvoice[]> {
  const db = await getDb();
  if (clientId) {
    return db.select<CAInvoice[]>(`SELECT * FROM ca_invoices WHERE tenant_id = ? AND client_id = ? AND deleted_at IS NULL ORDER BY invoice_date DESC`, [tenantId, clientId]);
  }
  return db.select<CAInvoice[]>(`SELECT * FROM ca_invoices WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY invoice_date DESC`, [tenantId]);
}

export async function createCAInvoice(tenantId: string, data: Omit<CAInvoice, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO ca_invoices (id,tenant_id,client_id,invoice_no,services,total,paid,invoice_date,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.client_id, data.invoice_no, data.services, data.total, data.paid, data.invoice_date, data.status, now()]
  );
  return id;
}

export async function updateCAInvoice(tenantId: string, id: string, data: Partial<CAInvoice>): Promise<void> {
  const db = await getDb();
  const fields = ['paid','status'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ca_invoices SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface CAStats {
  totalClients: number;
  tasksDueThisWeek: number;
  overdueTasks: number;
  pendingFees: number;
}

export async function getCAStats(tenantId: string): Promise<CAStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [{ total: totalClients }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ca_clients WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
  const [{ total: tasksDueThisWeek }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ca_tasks WHERE tenant_id = ? AND deleted_at IS NULL AND status != 'completed' AND due_date BETWEEN ? AND ?`, [tenantId, today, weekEnd]);
  const [{ total: overdueTasks }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ca_tasks WHERE tenant_id = ? AND deleted_at IS NULL AND status != 'completed' AND due_date < ?`, [tenantId, today]);
  const rows = await db.select<{ fees: number; fees_paid: number }[]>(`SELECT fees, fees_paid FROM ca_tasks WHERE tenant_id = ? AND deleted_at IS NULL AND status != 'completed'`, [tenantId]);
  const pendingFees = rows.reduce((s, r) => s + (r.fees - r.fees_paid), 0);
  return { totalClients, tasksDueThisWeek, overdueTasks, pendingFees };
}
