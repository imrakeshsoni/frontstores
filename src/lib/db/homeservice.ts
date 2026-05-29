// [homeservice] [all tenants]
import { getDb, uuid, now } from './index';

export interface HsJob {
  id: string; tenant_id: string;
  job_no: string; customer_name: string; customer_phone: string; address: string;
  service_type: string; description: string; technician: string;
  job_date: string; status: string; labour_charge: number;
  total_amount: number; paid_amount: number; payment_mode: string;
  completed_at: string | null; notes: string;
  updated_at: string; deleted_at: string | null;
}

export interface HsMaterial {
  id: string; tenant_id: string;
  name: string; unit: string; stock: number;
  purchase_price: number; selling_price: number;
  updated_at: string; deleted_at: string | null;
}

export interface HsTechnician {
  id: string; tenant_id: string;
  name: string; phone: string; specialization: string; status: string;
  updated_at: string; deleted_at: string | null;
}

export interface HsAmc {
  id: string; tenant_id: string;
  customer_name: string; phone: string; address: string; service_type: string;
  start_date: string; end_date: string;
  visits_included: number; visits_done: number;
  amount: number; status: string;
  updated_at: string; deleted_at: string | null;
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function listJobs(tenantId: string, status?: string): Promise<HsJob[]> {
  const db = await getDb();
  if (status) {
    return db.select<HsJob[]>(`SELECT * FROM hs_jobs WHERE tenant_id = ? AND status = ? AND deleted_at IS NULL ORDER BY job_date DESC`, [tenantId, status]);
  }
  return db.select<HsJob[]>(`SELECT * FROM hs_jobs WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY job_date DESC`, [tenantId]);
}

export async function getJob(tenantId: string, id: string): Promise<HsJob | null> {
  const db = await getDb();
  const rows = await db.select<HsJob[]>(`SELECT * FROM hs_jobs WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  return rows[0] ?? null;
}

export async function createJob(tenantId: string, data: Omit<HsJob, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at' | 'completed_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const no = `JB-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO hs_jobs (id,tenant_id,job_no,customer_name,customer_phone,address,service_type,description,technician,job_date,status,labour_charge,total_amount,paid_amount,payment_mode,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.job_no || no, data.customer_name, data.customer_phone, data.address, data.service_type, data.description, data.technician, data.job_date, data.status, data.labour_charge, data.total_amount, data.paid_amount, data.payment_mode, data.notes, now()]
  );
  return id;
}

export async function updateJob(tenantId: string, id: string, data: Partial<HsJob>): Promise<void> {
  const db = await getDb();
  const fields = ['customer_name','customer_phone','address','service_type','description','technician','job_date','status','labour_charge','total_amount','paid_amount','payment_mode','notes','completed_at'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  if (data.status === 'completed' && !data.completed_at) { updates.push('completed_at = ?'); vals.push(now()); }
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE hs_jobs SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteJob(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE hs_jobs SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Materials ─────────────────────────────────────────────────────────────────

export async function listMaterials(tenantId: string): Promise<HsMaterial[]> {
  const db = await getDb();
  return db.select<HsMaterial[]>(`SELECT * FROM hs_materials WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
}

export async function createMaterial(tenantId: string, data: Omit<HsMaterial, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO hs_materials (id,tenant_id,name,unit,stock,purchase_price,selling_price,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.unit, data.stock, data.purchase_price, data.selling_price, now()]);
  return id;
}

export async function updateMaterial(tenantId: string, id: string, data: Partial<HsMaterial>): Promise<void> {
  const db = await getDb();
  const fields = ['name','unit','stock','purchase_price','selling_price'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE hs_materials SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteMaterial(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE hs_materials SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Technicians ───────────────────────────────────────────────────────────────

export async function listTechnicians(tenantId: string): Promise<HsTechnician[]> {
  const db = await getDb();
  return db.select<HsTechnician[]>(`SELECT * FROM hs_technicians WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
}

export async function createTechnician(tenantId: string, data: Omit<HsTechnician, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO hs_technicians (id,tenant_id,name,phone,specialization,status,updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone, data.specialization, data.status, now()]);
  return id;
}

export async function updateTechnician(tenantId: string, id: string, data: Partial<HsTechnician>): Promise<void> {
  const db = await getDb();
  const fields = ['name','phone','specialization','status'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE hs_technicians SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteTechnician(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE hs_technicians SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── AMC ───────────────────────────────────────────────────────────────────────

export async function listAmcs(tenantId: string): Promise<HsAmc[]> {
  const db = await getDb();
  return db.select<HsAmc[]>(`SELECT * FROM hs_amc WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY end_date ASC`, [tenantId]);
}

export async function createAmc(tenantId: string, data: Omit<HsAmc, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO hs_amc (id,tenant_id,customer_name,phone,address,service_type,start_date,end_date,visits_included,visits_done,amount,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.customer_name, data.phone, data.address, data.service_type, data.start_date, data.end_date, data.visits_included, data.visits_done, data.amount, data.status, now()]);
  return id;
}

export async function updateAmc(tenantId: string, id: string, data: Partial<HsAmc>): Promise<void> {
  const db = await getDb();
  const fields = ['customer_name','phone','address','service_type','start_date','end_date','visits_included','visits_done','amount','status'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE hs_amc SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteAmc(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE hs_amc SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface HomeServiceStats {
  jobsToday: number;
  pendingJobs: number;
  todayRevenue: number;
  amcRenewalsDue: number;
}

export async function getHomeServiceStats(tenantId: string): Promise<HomeServiceStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  const [{ total: jobsToday }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM hs_jobs WHERE tenant_id = ? AND deleted_at IS NULL AND job_date = ?`, [tenantId, today]);
  const [{ total: pendingJobs }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM hs_jobs WHERE tenant_id = ? AND deleted_at IS NULL AND status IN ('scheduled','in-progress')`, [tenantId]);
  const rows = await db.select<{ total_amount: number }[]>(`SELECT total_amount FROM hs_jobs WHERE tenant_id = ? AND deleted_at IS NULL AND job_date = ? AND status = 'completed'`, [tenantId, today]);
  const todayRevenue = rows.reduce((s, r) => s + r.total_amount, 0);
  const [{ total: amcRenewalsDue }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM hs_amc WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active' AND end_date BETWEEN ? AND ?`, [tenantId, today, monthEnd]);
  return { jobsToday, pendingJobs, todayRevenue, amcRenewalsDue };
}
