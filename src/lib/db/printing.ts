// [printing] [all tenants]
import { getDb, uuid, now } from './index';

export interface PRJob {
  id: string;
  tenant_id: string;
  job_no: string;
  customer_name: string;
  customer_phone: string;
  job_type: string;
  description: string;
  quantity: number;
  paper_type: string;
  size: string;
  color_type: string;
  total_amount: number;
  advance_paid: number;
  status: string;
  promised_date: string | null;
  delivered_at: string | null;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PRStationery {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  purchase_price: number;
  selling_price: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PRStationerySale {
  id: string;
  tenant_id: string;
  bill_no: string;
  customer_name: string;
  total: number;
  payment_mode: string;
  sale_date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PRStationerySaleItem {
  id: string;
  tenant_id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  rate: number;
  amount: number;
  updated_at: string | null;
  deleted_at: string | null;
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export async function listPRJobs(tenantId: string, status?: string): Promise<PRJob[]> {
  const db = await getDb();
  if (status) {
    return db.select<PRJob[]>(
      `SELECT * FROM pr_jobs WHERE tenant_id=? AND status=? AND deleted_at IS NULL ORDER BY promised_date ASC`,
      [tenantId, status]
    );
  }
  return db.select<PRJob[]>(
    `SELECT * FROM pr_jobs WHERE tenant_id=? AND deleted_at IS NULL ORDER BY promised_date ASC`,
    [tenantId]
  );
}

export async function getPRJob(tenantId: string, id: string): Promise<PRJob | null> {
  const db = await getDb();
  const rows = await db.select<PRJob[]>(`SELECT * FROM pr_jobs WHERE id=? AND tenant_id=? AND deleted_at IS NULL`, [id, tenantId]);
  return rows[0] ?? null;
}

export async function createPRJob(tenantId: string, data: Omit<PRJob, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at' | 'delivered_at'>): Promise<PRJob> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO pr_jobs (id, tenant_id, job_no, customer_name, customer_phone, job_type, description, quantity, paper_type, size, color_type, total_amount, advance_paid, status, promised_date, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.job_no, data.customer_name, data.customer_phone, data.job_type,
     data.description, data.quantity, data.paper_type, data.size, data.color_type,
     data.total_amount, data.advance_paid, data.status, data.promised_date ?? null, data.notes]
  );
  const rows = await db.select<PRJob[]>(`SELECT * FROM pr_jobs WHERE id=?`, [id]);
  return rows[0];
}

export async function updatePRJob(tenantId: string, id: string, data: Partial<PRJob>): Promise<void> {
  const db = await getDb();
  const allowed = ['job_no','customer_name','customer_phone','job_type','description','quantity','paper_type','size','color_type','total_amount','advance_paid','status','promised_date','delivered_at','notes'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) return;
  const setClause = [...fields.map(f => `${f}=?`), 'updated_at=?'].join(', ');
  await db.execute(
    `UPDATE pr_jobs SET ${setClause} WHERE id=? AND tenant_id=?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deletePRJob(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE pr_jobs SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ── Stationery ────────────────────────────────────────────────────────────────

export async function listPRStationery(tenantId: string, search = ''): Promise<PRStationery[]> {
  const db = await getDb();
  if (search) {
    return db.select<PRStationery[]>(
      `SELECT * FROM pr_stationery WHERE tenant_id=? AND deleted_at IS NULL AND (name LIKE ? OR category LIKE ?) ORDER BY name`,
      [tenantId, `%${search}%`, `%${search}%`]
    );
  }
  return db.select<PRStationery[]>(
    `SELECT * FROM pr_stationery WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
}

export async function createPRStationery(tenantId: string, data: Omit<PRStationery, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<PRStationery> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO pr_stationery (id, tenant_id, name, category, stock, unit, purchase_price, selling_price)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category, data.stock, data.unit, data.purchase_price, data.selling_price]
  );
  const rows = await db.select<PRStationery[]>(`SELECT * FROM pr_stationery WHERE id=?`, [id]);
  return rows[0];
}

export async function updatePRStationery(tenantId: string, id: string, data: Partial<PRStationery>): Promise<void> {
  const db = await getDb();
  const allowed = ['name','category','stock','unit','purchase_price','selling_price'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) return;
  const setClause = [...fields.map(f => `${f}=?`), 'updated_at=?'].join(', ');
  await db.execute(
    `UPDATE pr_stationery SET ${setClause} WHERE id=? AND tenant_id=?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deletePRStationery(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE pr_stationery SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ── Stationery Sales ──────────────────────────────────────────────────────────

export async function listPRStationerySales(tenantId: string, limit = 50): Promise<PRStationerySale[]> {
  const db = await getDb();
  return db.select<PRStationerySale[]>(
    `SELECT * FROM pr_stationery_sales WHERE tenant_id=? AND deleted_at IS NULL ORDER BY sale_date DESC LIMIT ?`,
    [tenantId, limit]
  );
}

export async function createPRStationerySale(
  tenantId: string,
  sale: Omit<PRStationerySale, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>,
  items: Omit<PRStationerySaleItem, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>[]
): Promise<string> {
  const db = await getDb();
  const saleId = uuid();
  await db.execute(
    `INSERT INTO pr_stationery_sales (id, tenant_id, bill_no, customer_name, total, payment_mode, sale_date)
     VALUES (?,?,?,?,?,?,?)`,
    [saleId, tenantId, sale.bill_no, sale.customer_name, sale.total, sale.payment_mode, sale.sale_date]
  );
  for (const item of items) {
    await db.execute(
      `INSERT INTO pr_stationery_sale_items (id, tenant_id, sale_id, product_id, product_name, quantity, rate, amount)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, saleId, item.product_id, item.product_name, item.quantity, item.rate, item.amount]
    );
    // deduct stock
    await db.execute(
      `UPDATE pr_stationery SET stock = stock - ?, updated_at=? WHERE id=? AND tenant_id=?`,
      [item.quantity, now(), item.product_id, tenantId]
    );
  }
  return saleId;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface PRDashStats {
  jobsReceived: number;
  jobsPrinting: number;
  jobsReady: number;
  todayDeliveries: number;
  todayRevenue: number;
}

export async function getPRStats(tenantId: string): Promise<PRDashStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [received] = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM pr_jobs WHERE tenant_id=? AND status='received' AND deleted_at IS NULL`,
    [tenantId]
  );
  const [printing] = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM pr_jobs WHERE tenant_id=? AND status='printing' AND deleted_at IS NULL`,
    [tenantId]
  );
  const [ready] = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM pr_jobs WHERE tenant_id=? AND status='ready' AND deleted_at IS NULL`,
    [tenantId]
  );
  const [deliveries] = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM pr_jobs WHERE tenant_id=? AND DATE(delivered_at)=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [rev] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) AS total FROM pr_jobs WHERE tenant_id=? AND DATE(delivered_at)=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [statRev] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total),0) AS total FROM pr_stationery_sales WHERE tenant_id=? AND sale_date=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  return {
    jobsReceived: received?.c ?? 0,
    jobsPrinting: printing?.c ?? 0,
    jobsReady: ready?.c ?? 0,
    todayDeliveries: deliveries?.c ?? 0,
    todayRevenue: (rev?.total ?? 0) + (statRev?.total ?? 0),
  };
}
