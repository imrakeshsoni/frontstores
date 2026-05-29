// [insurance] [all tenants]
import { getDb, uuid, now } from './index';

export interface InsClient {
  id: string; tenant_id: string;
  name: string; phone: string; dob: string; address: string;
  updated_at: string; deleted_at: string | null;
}

export interface InsPolicy {
  id: string; tenant_id: string; client_id: string;
  policy_no: string; insurer: string; policy_type: string;
  plan_name: string; premium: number; premium_mode: string;
  start_date: string; maturity_date: string | null; next_due_date: string | null;
  status: string; commission: number;
  updated_at: string; deleted_at: string | null;
}

export interface InsRenewal {
  id: string; tenant_id: string; policy_id: string;
  due_date: string; premium: number; paid: number;
  paid_date: string | null; updated_at: string; deleted_at: string | null;
}

export interface InsClaim {
  id: string; tenant_id: string; policy_id: string;
  claim_no: string; amount: number; filed_date: string;
  status: string; settled_amount: number;
  updated_at: string; deleted_at: string | null;
}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function listInsClients(tenantId: string, search = ''): Promise<InsClient[]> {
  const db = await getDb();
  const q = `%${search}%`;
  return db.select<InsClient[]>(`SELECT * FROM ins_clients WHERE tenant_id = ? AND deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?) ORDER BY name`, [tenantId, q, q]);
}

export async function createInsClient(tenantId: string, data: Omit<InsClient, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO ins_clients (id,tenant_id,name,phone,dob,address,updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone, data.dob, data.address, now()]);
  return id;
}

export async function updateInsClient(tenantId: string, id: string, data: Partial<InsClient>): Promise<void> {
  const db = await getDb();
  const fields = ['name','phone','dob','address'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ins_clients SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteInsClient(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ins_clients SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Policies ──────────────────────────────────────────────────────────────────

export async function listInsPolicies(tenantId: string, clientId?: string): Promise<InsPolicy[]> {
  const db = await getDb();
  if (clientId) {
    return db.select<InsPolicy[]>(`SELECT * FROM ins_policies WHERE tenant_id = ? AND client_id = ? AND deleted_at IS NULL ORDER BY start_date DESC`, [tenantId, clientId]);
  }
  return db.select<InsPolicy[]>(`SELECT * FROM ins_policies WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY next_due_date ASC`, [tenantId]);
}

export async function createInsPolicy(tenantId: string, data: Omit<InsPolicy, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO ins_policies (id,tenant_id,client_id,policy_no,insurer,policy_type,plan_name,premium,premium_mode,start_date,maturity_date,next_due_date,status,commission,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.client_id, data.policy_no, data.insurer, data.policy_type, data.plan_name, data.premium, data.premium_mode, data.start_date, data.maturity_date, data.next_due_date, data.status, data.commission, now()]
  );
  return id;
}

export async function updateInsPolicy(tenantId: string, id: string, data: Partial<InsPolicy>): Promise<void> {
  const db = await getDb();
  const fields = ['policy_no','insurer','policy_type','plan_name','premium','premium_mode','start_date','maturity_date','next_due_date','status','commission'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ins_policies SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteInsPolicy(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ins_policies SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Renewals ──────────────────────────────────────────────────────────────────

export async function listInsRenewals(tenantId: string, paid?: boolean): Promise<InsRenewal[]> {
  const db = await getDb();
  if (paid !== undefined) {
    return db.select<InsRenewal[]>(`SELECT * FROM ins_renewals WHERE tenant_id = ? AND paid = ? AND deleted_at IS NULL ORDER BY due_date ASC`, [tenantId, paid ? 1 : 0]);
  }
  return db.select<InsRenewal[]>(`SELECT * FROM ins_renewals WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY due_date ASC`, [tenantId]);
}

export async function createInsRenewal(tenantId: string, data: Omit<InsRenewal, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO ins_renewals (id,tenant_id,policy_id,due_date,premium,paid,paid_date,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.policy_id, data.due_date, data.premium, data.paid, data.paid_date, now()]);
  return id;
}

export async function markRenewalPaid(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(`UPDATE ins_renewals SET paid = 1, paid_date = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [today, now(), id, tenantId]);
}

export async function deleteInsRenewal(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ins_renewals SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Claims ────────────────────────────────────────────────────────────────────

export async function listInsClaims(tenantId: string): Promise<InsClaim[]> {
  const db = await getDb();
  return db.select<InsClaim[]>(`SELECT * FROM ins_claims WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY filed_date DESC`, [tenantId]);
}

export async function createInsClaim(tenantId: string, data: Omit<InsClaim, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO ins_claims (id,tenant_id,policy_id,claim_no,amount,filed_date,status,settled_amount,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.policy_id, data.claim_no, data.amount, data.filed_date, data.status, data.settled_amount, now()]);
  return id;
}

export async function updateInsClaim(tenantId: string, id: string, data: Partial<InsClaim>): Promise<void> {
  const db = await getDb();
  const fields = ['status','settled_amount','claim_no'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ins_claims SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteInsClaim(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ins_claims SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface InsuranceStats {
  renewalsDueThisMonth: number;
  activePolicies: number;
  commissionThisMonth: number;
  totalClients: number;
}

export async function getInsuranceStats(tenantId: string): Promise<InsuranceStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [{ total: renewalsDueThisMonth }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ins_renewals WHERE tenant_id = ? AND deleted_at IS NULL AND paid = 0 AND due_date BETWEEN ? AND ?`, [tenantId, today, monthEnd]);
  const [{ total: activePolicies }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ins_policies WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active'`, [tenantId]);
  const commRows = await db.select<{ commission: number }[]>(`SELECT commission FROM ins_policies WHERE tenant_id = ? AND deleted_at IS NULL AND start_date BETWEEN ? AND ?`, [tenantId, monthStart, monthEnd]);
  const commissionThisMonth = commRows.reduce((s, r) => s + r.commission, 0);
  const [{ total: totalClients }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ins_clients WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
  return { renewalsDueThisMonth, activePolicies, commissionThisMonth, totalClients };
}
