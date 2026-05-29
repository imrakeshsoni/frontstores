// [repair] [all tenants]
import { getDb, uuid, now } from './index';

export interface RepairJob {
  id: string; tenant_id: string;
  job_no: string; customer_name: string;
  customer_phone: string; device_type: string;
  device_brand: string; device_model: string;
  imei: string; issue: string;
  diagnosis: string; status: string;
  technician: string; estimated_cost: number;
  advance_paid: number; final_amount: number;
  received_at: string; promised_date: string | null;
  completed_at: string | null; delivered_at: string | null;
  warranty_days: number; notes: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface RepairPart {
  id: string; tenant_id: string;
  name: string; category: string;
  stock: number; purchase_price: number;
  selling_price: number;
  updated_at: string | null; deleted_at: string | null;
}

export interface RepairJobPart {
  id: string; tenant_id: string;
  job_id: string; part_id: string;
  part_name: string; quantity: number;
  rate: number; amount: number;
  updated_at: string | null; deleted_at: string | null;
}

export interface RepairExpense {
  id: string; tenant_id: string;
  description: string; amount: number;
  date: string; updated_at: string | null; deleted_at: string | null;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function listRepairJobs(
  tenantId: string,
  opts: { status?: string; search?: string } = {}
): Promise<RepairJob[]> {
  const db = await getDb();
  const conditions = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.status && opts.status !== 'all') { conditions.push('status = ?'); params.push(opts.status); }
  if (opts.search) { conditions.push('(customer_name LIKE ? OR job_no LIKE ? OR device_brand LIKE ? OR device_model LIKE ?)'); const q = `%${opts.search}%`; params.push(q, q, q, q); }
  const where = conditions.join(' AND ');
  return db.select<RepairJob[]>(`SELECT * FROM repair_jobs WHERE ${where} ORDER BY received_at DESC`, params);
}

export async function getRepairJob(tenantId: string, id: string): Promise<RepairJob | null> {
  const db = await getDb();
  const rows = await db.select<RepairJob[]>(`SELECT * FROM repair_jobs WHERE id=? AND tenant_id=? AND deleted_at IS NULL`, [id, tenantId]);
  return rows[0] ?? null;
}

export async function saveRepairJob(tenantId: string, data: Partial<RepairJob> & { customer_name: string; issue: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE repair_jobs SET customer_name=?,customer_phone=?,device_type=?,device_brand=?,device_model=?,imei=?,issue=?,diagnosis=?,status=?,technician=?,estimated_cost=?,advance_paid=?,final_amount=?,promised_date=?,completed_at=?,delivered_at=?,warranty_days=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.customer_name, data.customer_phone??'', data.device_type??'', data.device_brand??'', data.device_model??'', data.imei??'', data.issue, data.diagnosis??'', data.status??'received', data.technician??'', data.estimated_cost??0, data.advance_paid??0, data.final_amount??0, data.promised_date??null, data.completed_at??null, data.delivered_at??null, data.warranty_days??0, data.notes??'', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  // Generate job number: RJ-YYYYMMDD-XXXX
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const countRows = await db.select<{c:number}[]>(`SELECT COUNT(*) as c FROM repair_jobs WHERE tenant_id=?`, [tenantId]);
  const jobNo = `RJ-${dateStr}-${String((countRows[0]?.c ?? 0) + 1).padStart(4,'0')}`;
  await db.execute(
    `INSERT INTO repair_jobs(id,tenant_id,job_no,customer_name,customer_phone,device_type,device_brand,device_model,imei,issue,diagnosis,status,technician,estimated_cost,advance_paid,final_amount,received_at,promised_date,warranty_days,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, jobNo, data.customer_name, data.customer_phone??'', data.device_type??'', data.device_brand??'', data.device_model??'', data.imei??'', data.issue, data.diagnosis??'', data.status??'received', data.technician??'', data.estimated_cost??0, data.advance_paid??0, data.final_amount??0, now(), data.promised_date??null, data.warranty_days??0, data.notes??'']
  );
  return id;
}

export async function deleteRepairJob(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE repair_jobs SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ─── Parts ───────────────────────────────────────────────────────────────────

export async function listRepairParts(tenantId: string, search = ''): Promise<RepairPart[]> {
  const db = await getDb();
  if (search) {
    return db.select<RepairPart[]>(`SELECT * FROM repair_parts WHERE tenant_id=? AND deleted_at IS NULL AND (name LIKE ? OR category LIKE ?) ORDER BY name`, [tenantId, `%${search}%`, `%${search}%`]);
  }
  return db.select<RepairPart[]>(`SELECT * FROM repair_parts WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
}

export async function saveRepairPart(tenantId: string, data: Partial<RepairPart> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE repair_parts SET name=?,category=?,stock=?,purchase_price=?,selling_price=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.category??'', data.stock??0, data.purchase_price??0, data.selling_price??0, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO repair_parts(id,tenant_id,name,category,stock,purchase_price,selling_price) VALUES(?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category??'', data.stock??0, data.purchase_price??0, data.selling_price??0]
  );
  return id;
}

export async function deleteRepairPart(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE repair_parts SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ─── Job Parts ───────────────────────────────────────────────────────────────

export async function listJobParts(tenantId: string, jobId: string): Promise<RepairJobPart[]> {
  const db = await getDb();
  return db.select<RepairJobPart[]>(`SELECT * FROM repair_job_parts WHERE tenant_id=? AND job_id=? AND deleted_at IS NULL`, [tenantId, jobId]);
}

export async function addJobPart(tenantId: string, jobId: string, data: { part_id: string; part_name: string; quantity: number; rate: number }): Promise<void> {
  const db = await getDb();
  const id = uuid();
  const amount = data.quantity * data.rate;
  await db.execute(
    `INSERT INTO repair_job_parts(id,tenant_id,job_id,part_id,part_name,quantity,rate,amount) VALUES(?,?,?,?,?,?,?,?)`,
    [id, tenantId, jobId, data.part_id, data.part_name, data.quantity, data.rate, amount]
  );
  // Deduct stock
  await db.execute(`UPDATE repair_parts SET stock=MAX(0,stock-?),updated_at=? WHERE id=? AND tenant_id=?`, [data.quantity, now(), data.part_id, tenantId]);
}

export async function removeJobPart(tenantId: string, id: string, partId: string, quantity: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE repair_job_parts SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
  // Return stock
  await db.execute(`UPDATE repair_parts SET stock=stock+?,updated_at=? WHERE id=? AND tenant_id=?`, [quantity, now(), partId, tenantId]);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface RepairStats {
  totalJobs: number;
  received: number;
  diagnosing: number;
  repairing: number;
  ready: number;
  delivered: number;
  overdueJobs: number;
  todayCollections: number;
}

export async function getRepairStats(tenantId: string): Promise<RepairStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0,10);
  const [counts] = await db.select<{total:number,received:number,diagnosing:number,repairing:number,ready:number,delivered:number}[]>(
    `SELECT COUNT(*) as total,
      SUM(CASE WHEN status='received' THEN 1 ELSE 0 END) as received,
      SUM(CASE WHEN status='diagnosing' THEN 1 ELSE 0 END) as diagnosing,
      SUM(CASE WHEN status='repairing' THEN 1 ELSE 0 END) as repairing,
      SUM(CASE WHEN status='ready' THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered
     FROM repair_jobs WHERE tenant_id=? AND deleted_at IS NULL`, [tenantId]
  );
  const [overdue] = await db.select<{c:number}[]>(
    `SELECT COUNT(*) as c FROM repair_jobs WHERE tenant_id=? AND deleted_at IS NULL AND status NOT IN ('delivered') AND promised_date IS NOT NULL AND promised_date < ?`,
    [tenantId, today]
  );
  const [collections] = await db.select<{total:number}[]>(
    `SELECT COALESCE(SUM(final_amount),0) as total FROM repair_jobs WHERE tenant_id=? AND deleted_at IS NULL AND DATE(delivered_at)=?`,
    [tenantId, today]
  );
  return {
    totalJobs: counts?.total ?? 0,
    received: counts?.received ?? 0,
    diagnosing: counts?.diagnosing ?? 0,
    repairing: counts?.repairing ?? 0,
    ready: counts?.ready ?? 0,
    delivered: counts?.delivered ?? 0,
    overdueJobs: overdue?.c ?? 0,
    todayCollections: collections?.total ?? 0,
  };
}
