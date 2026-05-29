// [pestcontrol] [all tenants]
import { getDb, uuid, now } from './index';

export interface PCCustomer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  address: string;
  property_type: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PCJob {
  id: string;
  tenant_id: string;
  job_no: string;
  customer_id: string;
  service_type: string;
  pest_type: string;
  chemical_used: string;
  technician: string;
  job_date: string;
  next_service_date: string | null;
  amount: number;
  paid_amount: number;
  payment_mode: string;
  status: string;
  amc: number;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PCJobWithCustomer extends PCJob {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
}

export interface PCChemical {
  id: string;
  tenant_id: string;
  name: string;
  stock_ml: number;
  cost_per_ml: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PCContract {
  id: string;
  tenant_id: string;
  customer_id: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  services_total: number;
  services_done: number;
  amount: number;
  status: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PCContractWithCustomer extends PCContract {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function listPCCustomers(tenantId: string, search = ''): Promise<PCCustomer[]> {
  const db = await getDb();
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (search) { conditions.push(`(name LIKE ? OR phone LIKE ? OR address LIKE ?)`); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  return db.select<PCCustomer[]>(
    `SELECT * FROM pc_customers WHERE ${conditions.join(' AND ')} ORDER BY name`,
    params
  );
}

export async function savePCCustomer(tenantId: string, data: Omit<PCCustomer, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, id?: string): Promise<string> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE pc_customers SET name=?, phone=?, address=?, property_type=?, updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone, data.address, data.property_type, now(), id, tenantId]
    );
    return id;
  } else {
    const newId = uuid();
    await db.execute(
      `INSERT INTO pc_customers (id, tenant_id, name, phone, address, property_type, updated_at) VALUES (?,?,?,?,?,?,?)`,
      [newId, tenantId, data.name, data.phone, data.address, data.property_type, now()]
    );
    return newId;
  }
}

export async function deletePCCustomer(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pc_customers SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function listPCJobs(tenantId: string, status?: string): Promise<PCJobWithCustomer[]> {
  const db = await getDb();
  const conditions = [`j.tenant_id = ?`, `j.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (status && status !== 'all') { conditions.push(`j.status = ?`); params.push(status); }
  return db.select<PCJobWithCustomer[]>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
     FROM pc_jobs j LEFT JOIN pc_customers c ON j.customer_id = c.id
     WHERE ${conditions.join(' AND ')} ORDER BY j.job_date DESC`,
    params
  );
}

export async function getPCJob(tenantId: string, id: string): Promise<PCJobWithCustomer | null> {
  const db = await getDb();
  const rows = await db.select<PCJobWithCustomer[]>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
     FROM pc_jobs j LEFT JOIN pc_customers c ON j.customer_id = c.id
     WHERE j.id=? AND j.tenant_id=? AND j.deleted_at IS NULL`,
    [id, tenantId]
  );
  return rows.length ? rows[0] : null;
}

export async function createPCJob(tenantId: string, data: Omit<PCJob, 'id' | 'tenant_id' | 'job_no' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const [{ cnt }] = await db.select<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM pc_jobs WHERE tenant_id=?`, [tenantId]);
  const jobNo = `PC-${String((cnt as number) + 1).padStart(4, '0')}`;
  await db.execute(
    `INSERT INTO pc_jobs (id, tenant_id, job_no, customer_id, service_type, pest_type, chemical_used, technician, job_date, next_service_date, amount, paid_amount, payment_mode, status, amc, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, jobNo, data.customer_id, data.service_type, data.pest_type,
     data.chemical_used, data.technician, data.job_date, data.next_service_date ?? null,
     data.amount, data.paid_amount, data.payment_mode, data.status, data.amc ? 1 : 0, data.notes, now()]
  );
  return id;
}

export async function updatePCJob(tenantId: string, id: string, data: Partial<PCJob>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pc_jobs SET service_type=?, pest_type=?, chemical_used=?, technician=?, job_date=?, next_service_date=?, amount=?, paid_amount=?, payment_mode=?, status=?, amc=?, notes=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.service_type, data.pest_type, data.chemical_used, data.technician, data.job_date,
     data.next_service_date ?? null, data.amount, data.paid_amount, data.payment_mode,
     data.status, data.amc ? 1 : 0, data.notes, now(), id, tenantId]
  );
}

export async function deletePCJob(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pc_jobs SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Chemicals ─────────────────────────────────────────────────────────────────

export async function listPCChemicals(tenantId: string): Promise<PCChemical[]> {
  const db = await getDb();
  return db.select<PCChemical[]>(
    `SELECT * FROM pc_chemicals WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
}

export async function savePCChemical(tenantId: string, data: Omit<PCChemical, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, id?: string): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE pc_chemicals SET name=?, stock_ml=?, cost_per_ml=?, updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.stock_ml, data.cost_per_ml, now(), id, tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO pc_chemicals (id, tenant_id, name, stock_ml, cost_per_ml, updated_at) VALUES (?,?,?,?,?,?)`,
      [uuid(), tenantId, data.name, data.stock_ml, data.cost_per_ml, now()]
    );
  }
}

export async function deletePCChemical(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pc_chemicals SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export async function listPCContracts(tenantId: string, status?: string): Promise<PCContractWithCustomer[]> {
  const db = await getDb();
  const conditions = [`con.tenant_id = ?`, `con.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (status && status !== 'all') { conditions.push(`con.status = ?`); params.push(status); }
  return db.select<PCContractWithCustomer[]>(
    `SELECT con.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
     FROM pc_contracts con LEFT JOIN pc_customers c ON con.customer_id = c.id
     WHERE ${conditions.join(' AND ')} ORDER BY con.end_date ASC`,
    params
  );
}

export async function savePCContract(tenantId: string, data: Omit<PCContract, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, id?: string): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE pc_contracts SET customer_id=?, contract_type=?, start_date=?, end_date=?, services_total=?, services_done=?, amount=?, status=?, updated_at=? WHERE id=? AND tenant_id=?`,
      [data.customer_id, data.contract_type, data.start_date, data.end_date, data.services_total, data.services_done, data.amount, data.status, now(), id, tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO pc_contracts (id, tenant_id, customer_id, contract_type, start_date, end_date, services_total, services_done, amount, status, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.customer_id, data.contract_type, data.start_date, data.end_date, data.services_total, data.services_done, data.amount, data.status, now()]
    );
  }
}

export async function deletePCContract(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pc_contracts SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface PCStats {
  jobsToday: number;
  dueThisWeek: number;
  monthRevenue: number;
  lowStockChemicals: number;
  scheduledCount: number;
  completedToday: number;
  activeContracts: number;
}

export async function getPCStats(tenantId: string): Promise<PCStats> {
  const db = await getDb();
  const today = now().substring(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
  const monthStart = today.substring(0, 7) + '-01';

  const [todayRow] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pc_jobs WHERE tenant_id=? AND date(job_date)=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [dueRow] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pc_jobs WHERE tenant_id=? AND date(next_service_date) BETWEEN ? AND ? AND deleted_at IS NULL`,
    [tenantId, today, weekEnd]
  );
  const [revRow] = await db.select<{ r: number }[]>(
    `SELECT COALESCE(SUM(amount),0) as r FROM pc_jobs WHERE tenant_id=? AND date(job_date) >= ? AND status='completed' AND deleted_at IS NULL`,
    [tenantId, monthStart]
  );
  const [chemRow] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pc_chemicals WHERE tenant_id=? AND stock_ml < 500 AND deleted_at IS NULL`,
    [tenantId]
  );
  const [scheduledRow] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pc_jobs WHERE tenant_id=? AND status='scheduled' AND deleted_at IS NULL`,
    [tenantId]
  );
  const [completedTodayRow] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pc_jobs WHERE tenant_id=? AND status='completed' AND date(job_date)=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [contractsRow] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pc_contracts WHERE tenant_id=? AND status='active' AND deleted_at IS NULL`,
    [tenantId]
  );

  return {
    jobsToday: todayRow?.cnt ?? 0,
    dueThisWeek: dueRow?.cnt ?? 0,
    monthRevenue: revRow?.r ?? 0,
    lowStockChemicals: chemRow?.cnt ?? 0,
    scheduledCount: scheduledRow?.cnt ?? 0,
    completedToday: completedTodayRow?.cnt ?? 0,
    activeContracts: contractsRow?.cnt ?? 0,
  };
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getPCReportData(tenantId: string, fromDate: string, toDate: string) {
  const db = await getDb();
  const jobs = await db.select<PCJobWithCustomer[]>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
     FROM pc_jobs j LEFT JOIN pc_customers c ON j.customer_id = c.id
     WHERE j.tenant_id=? AND date(j.job_date) BETWEEN ? AND ? AND j.deleted_at IS NULL ORDER BY j.job_date`,
    [tenantId, fromDate, toDate]
  );
  const dueJobs = await db.select<PCJobWithCustomer[]>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
     FROM pc_jobs j LEFT JOIN pc_customers c ON j.customer_id = c.id
     WHERE j.tenant_id=? AND j.next_service_date IS NOT NULL AND j.deleted_at IS NULL ORDER BY j.next_service_date`,
    [tenantId]
  );
  return { jobs, dueJobs };
}
