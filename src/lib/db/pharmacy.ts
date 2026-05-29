// [medical] [all tenants]
import { getDb, uuid, now } from './index';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RxBatch {
  id: string;
  tenant_id: string;
  product_id: string;
  batch_no: string;
  expiry_date: string;
  mfg_date: string | null;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  supplier_id: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface RxPrescription {
  id: string;
  tenant_id: string;
  customer_id: string;
  doctor_name: string;
  doctor_reg_no: string;
  prescription_no: string;
  prescription_date: string | null;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface RxScheduleEntry {
  id: string;
  tenant_id: string;
  medicine_name: string;
  schedule_type: string;
  quantity: number;
  patient_name: string;
  patient_address: string;
  doctor_name: string;
  prescription_no: string;
  sale_date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface RxPatientHistory {
  id: string;
  tenant_id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  prescription_id: string;
  sale_date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface RxSupplierReturn {
  id: string;
  tenant_id: string;
  supplier_id: string;
  batch_id: string;
  product_name: string;
  batch_no: string;
  quantity: number;
  reason: string;
  return_date: string;
  amount: number;
  updated_at: string | null;
  deleted_at: string | null;
}

// ── Batches ───────────────────────────────────────────────────────────────────

export async function getBatches(tenantId: string, productId?: string): Promise<RxBatch[]> {
  const db = await getDb();
  const conditions = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: any[] = [tenantId];
  if (productId) { conditions.push('product_id = ?'); params.push(productId); }
  return db.select<RxBatch[]>(
    `SELECT * FROM rx_batches WHERE ${conditions.join(' AND ')} ORDER BY expiry_date ASC`,
    params
  );
}

export async function saveBatch(tenantId: string, data: Omit<RxBatch, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<RxBatch> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO rx_batches (id, tenant_id, product_id, batch_no, expiry_date, mfg_date, quantity, purchase_price, selling_price, supplier_id, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.product_id, data.batch_no, data.expiry_date, data.mfg_date ?? null,
     data.quantity, data.purchase_price, data.selling_price, data.supplier_id, now()]
  );
  const rows = await db.select<RxBatch[]>('SELECT * FROM rx_batches WHERE id = ?', [id]);
  return rows[0];
}

export async function updateBatch(tenantId: string, id: string, data: Partial<RxBatch>): Promise<void> {
  const db = await getDb();
  const allowed = new Set(['product_id','batch_no','expiry_date','mfg_date','quantity','purchase_price','selling_price','supplier_id']);
  const safe: Record<string, unknown> = { updated_at: now() };
  for (const [k, v] of Object.entries(data)) { if (allowed.has(k)) safe[k] = v; }
  const fields = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  await db.execute(`UPDATE rx_batches SET ${fields} WHERE id = ? AND tenant_id = ?`, [...Object.values(safe), id, tenantId]);
}

export async function deleteBatch(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE rx_batches SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?', [now(), now(), id, tenantId]);
}

export async function getExpiringBatches(tenantId: string, daysAhead: number): Promise<RxBatch[]> {
  const db = await getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  return db.select<RxBatch[]>(
    `SELECT * FROM rx_batches
     WHERE tenant_id = ? AND deleted_at IS NULL AND quantity > 0 AND expiry_date <= ?
     ORDER BY expiry_date ASC`,
    [tenantId, cutoffStr]
  );
}

// ── Prescriptions ─────────────────────────────────────────────────────────────

export async function getPrescriptions(tenantId: string): Promise<RxPrescription[]> {
  const db = await getDb();
  return db.select<RxPrescription[]>(
    'SELECT * FROM rx_prescriptions WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY prescription_date DESC',
    [tenantId]
  );
}

export async function savePrescription(tenantId: string, data: Omit<RxPrescription, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<RxPrescription> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO rx_prescriptions (id, tenant_id, customer_id, doctor_name, doctor_reg_no, prescription_no, prescription_date, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.customer_id, data.doctor_name, data.doctor_reg_no,
     data.prescription_no, data.prescription_date ?? null, data.notes, now()]
  );
  const rows = await db.select<RxPrescription[]>('SELECT * FROM rx_prescriptions WHERE id = ?', [id]);
  return rows[0];
}

export async function updatePrescription(tenantId: string, id: string, data: Partial<RxPrescription>): Promise<void> {
  const db = await getDb();
  const allowed = new Set(['customer_id','doctor_name','doctor_reg_no','prescription_no','prescription_date','notes']);
  const safe: Record<string, unknown> = { updated_at: now() };
  for (const [k, v] of Object.entries(data)) { if (allowed.has(k)) safe[k] = v; }
  const fields = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  await db.execute(`UPDATE rx_prescriptions SET ${fields} WHERE id = ? AND tenant_id = ?`, [...Object.values(safe), id, tenantId]);
}

export async function deletePrescription(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE rx_prescriptions SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?', [now(), now(), id, tenantId]);
}

// ── Schedule Register ─────────────────────────────────────────────────────────

export async function getScheduleRegister(tenantId: string, dateFrom?: string, dateTo?: string): Promise<RxScheduleEntry[]> {
  const db = await getDb();
  const conditions = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: any[] = [tenantId];
  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(dateFrom); }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(dateTo); }
  return db.select<RxScheduleEntry[]>(
    `SELECT * FROM rx_schedule_register WHERE ${conditions.join(' AND ')} ORDER BY sale_date DESC`,
    params
  );
}

export async function saveScheduleEntry(tenantId: string, data: Omit<RxScheduleEntry, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<RxScheduleEntry> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO rx_schedule_register (id, tenant_id, medicine_name, schedule_type, quantity, patient_name, patient_address, doctor_name, prescription_no, sale_date, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.medicine_name, data.schedule_type, data.quantity,
     data.patient_name, data.patient_address, data.doctor_name, data.prescription_no, data.sale_date, now()]
  );
  const rows = await db.select<RxScheduleEntry[]>('SELECT * FROM rx_schedule_register WHERE id = ?', [id]);
  return rows[0];
}

export async function deleteScheduleEntry(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE rx_schedule_register SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?', [now(), now(), id, tenantId]);
}

// ── Patient History ───────────────────────────────────────────────────────────

export async function getPatientHistory(tenantId: string, customerId: string): Promise<RxPatientHistory[]> {
  const db = await getDb();
  return db.select<RxPatientHistory[]>(
    'SELECT * FROM rx_patient_history WHERE tenant_id = ? AND customer_id = ? AND deleted_at IS NULL ORDER BY sale_date DESC',
    [tenantId, customerId]
  );
}

export async function getAllPatientHistory(tenantId: string): Promise<RxPatientHistory[]> {
  const db = await getDb();
  return db.select<RxPatientHistory[]>(
    'SELECT * FROM rx_patient_history WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY sale_date DESC',
    [tenantId]
  );
}

export async function savePatientHistory(tenantId: string, data: Omit<RxPatientHistory, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<RxPatientHistory> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO rx_patient_history (id, tenant_id, customer_id, product_id, product_name, quantity, prescription_id, sale_date, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.customer_id, data.product_id, data.product_name, data.quantity,
     data.prescription_id, data.sale_date, now()]
  );
  const rows = await db.select<RxPatientHistory[]>('SELECT * FROM rx_patient_history WHERE id = ?', [id]);
  return rows[0];
}

// ── Supplier Returns ──────────────────────────────────────────────────────────

export async function getSupplierReturns(tenantId: string): Promise<RxSupplierReturn[]> {
  const db = await getDb();
  return db.select<RxSupplierReturn[]>(
    'SELECT * FROM rx_supplier_returns WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY return_date DESC',
    [tenantId]
  );
}

export async function saveSupplierReturn(tenantId: string, data: Omit<RxSupplierReturn, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<RxSupplierReturn> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO rx_supplier_returns (id, tenant_id, supplier_id, batch_id, product_name, batch_no, quantity, reason, return_date, amount, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.supplier_id, data.batch_id, data.product_name, data.batch_no,
     data.quantity, data.reason, data.return_date, data.amount, now()]
  );
  const rows = await db.select<RxSupplierReturn[]>('SELECT * FROM rx_supplier_returns WHERE id = ?', [id]);
  return rows[0];
}

export async function deleteSupplierReturn(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE rx_supplier_returns SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?', [now(), now(), id, tenantId]);
}
