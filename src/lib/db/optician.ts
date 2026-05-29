// [optician] [all tenants]
import { getDb, uuid, now } from './index';

export interface OptPatient {
  id: string; tenant_id: string; name: string; phone: string;
  dob: string; address: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface OptPrescription {
  id: string; tenant_id: string; patient_id: string; doctor_name: string;
  exam_date: string;
  r_sph: string; r_cyl: string; r_axis: string; r_add: string; r_va: string;
  l_sph: string; l_cyl: string; l_add: string; l_axis: string; l_va: string;
  pd: string; notes: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface OptOrder {
  id: string; tenant_id: string; order_no: string; patient_id: string;
  prescription_id: string; frame_desc: string;
  lens_type: string; lens_brand: string;
  coating: string; tint: string;
  advance_paid: number; total_amount: number;
  status: string; promised_date: string | null; delivered_at: string | null;
  updated_at: string | null; deleted_at: string | null;
}

export interface OptInventory {
  id: string; tenant_id: string; name: string; category: string;
  brand: string; stock: number; purchase_price: number; selling_price: number;
  updated_at: string | null; deleted_at: string | null;
}

// ── Patients ──────────────────────────────────────────────────────────────────

export async function listOptPatients(tenantId: string, search = ''): Promise<OptPatient[]> {
  const db = await getDb();
  const where = search
    ? `tenant_id = ? AND deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)`
    : `tenant_id = ? AND deleted_at IS NULL`;
  const params = search ? [tenantId, `%${search}%`, `%${search}%`] : [tenantId];
  return db.select<OptPatient[]>(`SELECT * FROM opt_patients WHERE ${where} ORDER BY name`, params);
}

export async function createOptPatient(tenantId: string, data: Omit<OptPatient, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO opt_patients (id, tenant_id, name, phone, dob, address, updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone, data.dob, data.address, now()]
  );
  return id;
}

export async function updateOptPatient(tenantId: string, id: string, data: Partial<OptPatient>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'tenant_id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.execute(
    `UPDATE opt_patients SET ${set}, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteOptPatient(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE opt_patients SET deleted_at = datetime('now') WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
}

// ── Prescriptions ─────────────────────────────────────────────────────────────

export async function listOptPrescriptions(tenantId: string, patientId?: string): Promise<OptPrescription[]> {
  const db = await getDb();
  const where = patientId
    ? `tenant_id = ? AND patient_id = ? AND deleted_at IS NULL`
    : `tenant_id = ? AND deleted_at IS NULL`;
  const params = patientId ? [tenantId, patientId] : [tenantId];
  return db.select<OptPrescription[]>(`SELECT * FROM opt_prescriptions WHERE ${where} ORDER BY exam_date DESC`, params);
}

export async function createOptPrescription(tenantId: string, data: Omit<OptPrescription, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO opt_prescriptions (id, tenant_id, patient_id, doctor_name, exam_date, r_sph, r_cyl, r_axis, r_add, r_va, l_sph, l_cyl, l_add, l_axis, l_va, pd, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.patient_id, data.doctor_name, data.exam_date,
     data.r_sph, data.r_cyl, data.r_axis, data.r_add, data.r_va,
     data.l_sph, data.l_cyl, data.l_add, data.l_axis, data.l_va,
     data.pd, data.notes, now()]
  );
  return id;
}

export async function updateOptPrescription(tenantId: string, id: string, data: Partial<OptPrescription>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'tenant_id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.execute(
    `UPDATE opt_prescriptions SET ${set}, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function listOptOrders(tenantId: string, status?: string): Promise<(OptOrder & { patient_name?: string })[]> {
  const db = await getDb();
  const where = status
    ? `o.tenant_id = ? AND o.status = ? AND o.deleted_at IS NULL`
    : `o.tenant_id = ? AND o.deleted_at IS NULL`;
  const params = status ? [tenantId, status] : [tenantId];
  return db.select<(OptOrder & { patient_name?: string })[]>(
    `SELECT o.*, p.name as patient_name FROM opt_orders o
     LEFT JOIN opt_patients p ON p.id = o.patient_id
     WHERE ${where} ORDER BY o.promised_date`,
    params
  );
}

export async function createOptOrder(tenantId: string, data: Omit<OptOrder, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO opt_orders (id, tenant_id, order_no, patient_id, prescription_id, frame_desc, lens_type, lens_brand, coating, tint, advance_paid, total_amount, status, promised_date, delivered_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.order_no, data.patient_id, data.prescription_id, data.frame_desc,
     data.lens_type, data.lens_brand, data.coating, data.tint,
     data.advance_paid, data.total_amount, data.status, data.promised_date ?? null, data.delivered_at ?? null, now()]
  );
  return id;
}

export async function updateOptOrder(tenantId: string, id: string, data: Partial<OptOrder>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'tenant_id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.execute(
    `UPDATE opt_orders SET ${set}, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteOptOrder(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE opt_orders SET deleted_at = datetime('now') WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function listOptInventory(tenantId: string, category?: string): Promise<OptInventory[]> {
  const db = await getDb();
  const where = category
    ? `tenant_id = ? AND category = ? AND deleted_at IS NULL`
    : `tenant_id = ? AND deleted_at IS NULL`;
  const params = category ? [tenantId, category] : [tenantId];
  return db.select<OptInventory[]>(`SELECT * FROM opt_inventory WHERE ${where} ORDER BY category, name`, params);
}

export async function createOptInventory(tenantId: string, data: Omit<OptInventory, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO opt_inventory (id, tenant_id, name, category, brand, stock, purchase_price, selling_price, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category, data.brand, data.stock, data.purchase_price, data.selling_price, now()]
  );
  return id;
}

export async function updateOptInventory(tenantId: string, id: string, data: Partial<OptInventory>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'tenant_id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.execute(
    `UPDATE opt_inventory SET ${set}, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteOptInventory(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE opt_inventory SET deleted_at = datetime('now') WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getOpticianStats(tenantId: string) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [monthRevenue] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) as total FROM opt_orders WHERE tenant_id = ? AND strftime('%Y-%m', updated_at) = strftime('%Y-%m','now') AND deleted_at IS NULL`,
    [tenantId]
  );
  const [readyOrders] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM opt_orders WHERE tenant_id = ? AND status = 'ready' AND deleted_at IS NULL`,
    [tenantId]
  );
  const [pendingOrders] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM opt_orders WHERE tenant_id = ? AND status NOT IN ('delivered') AND deleted_at IS NULL`,
    [tenantId]
  );
  const [todayExams] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM opt_prescriptions WHERE tenant_id = ? AND date(exam_date) = date(?) AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [lowStock] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM opt_inventory WHERE tenant_id = ? AND deleted_at IS NULL AND stock <= 5`,
    [tenantId]
  );
  return {
    monthRevenue: monthRevenue.total,
    readyForPickup: readyOrders.count,
    pendingOrders: pendingOrders.count,
    todayExams: todayExams.count,
    lowStockItems: lowStock.count,
  };
}
