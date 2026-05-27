// [carwash] [all tenants]
import { getDb, uuid, now } from './index';

export type VehicleType = 'hatchback' | 'sedan' | 'suv' | 'luxury';
export type JobStatus = 'waiting' | 'in_progress' | 'ready' | 'delivered';

export interface CarwashService {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price_hatchback: number;
  price_sedan: number;
  price_suv: number;
  price_luxury: number;
  duration_minutes: number;
  gst_rate: number;
  is_active: boolean;
  sort_order: number;
}

export interface CarwashVehicle {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  reg_number: string;
  vehicle_type: VehicleType;
  make: string | null;
  model: string | null;
  color: string | null;
  notes: string | null;
  created_at: string;
}

export interface CarwashJobItem {
  id: string;
  job_id: string;
  service_id: string | null;
  service_name: string;
  price: number;
  gst_rate: number;
}

export interface CarwashJob {
  id: string;
  tenant_id: string;
  job_number: string;
  vehicle_id: string | null;
  reg_number: string;
  vehicle_type: VehicleType;
  make: string | null;
  model: string | null;
  color: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  staff_id: string | null;
  staff_name: string | null;
  status: JobStatus;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  gst_amount: number;
  total: number;
  membership_id: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  items?: CarwashJobItem[];
}

export interface CarwashStaff {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
}

export interface CarwashMembership {
  id: string;
  tenant_id: string;
  customer_name: string;
  customer_phone: string | null;
  vehicle_id: string | null;
  reg_number: string | null;
  package_name: string;
  total_washes: number;
  used_washes: number;
  amount_paid: number;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

function mapService(r: any): CarwashService {
  return { ...r, is_active: r.is_active === 1 };
}
function mapStaff(r: any): CarwashStaff {
  return { ...r, is_active: r.is_active === 1 };
}
function mapMembership(r: any): CarwashMembership {
  return { ...r, is_active: r.is_active === 1 };
}

// ── Services ────────────────────────────────────────────────────────────────

export async function listServices(tenantId: string): Promise<CarwashService[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_services WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY sort_order, name`,
    [tenantId]
  );
  return rows.map(mapService);
}

export async function listAllServices(tenantId: string): Promise<CarwashService[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_services WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY sort_order, name`,
    [tenantId]
  );
  return rows.map(mapService);
}

export async function createService(tenantId: string, data: Omit<CarwashService, 'id' | 'tenant_id'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_services (id, tenant_id, name, description, price_hatchback, price_sedan, price_suv, price_luxury, duration_minutes, gst_rate, is_active, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.name, data.description ?? null, data.price_hatchback, data.price_sedan,
     data.price_suv, data.price_luxury, data.duration_minutes, data.gst_rate, data.is_active ? 1 : 0, data.sort_order]
  );
}

export async function updateService(tenantId: string, id: string, data: Partial<CarwashService>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_services SET name=?, description=?, price_hatchback=?, price_sedan=?, price_suv=?, price_luxury=?, duration_minutes=?, gst_rate=?, is_active=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.description ?? null, data.price_hatchback, data.price_sedan, data.price_suv, data.price_luxury,
     data.duration_minutes, data.gst_rate, data.is_active ? 1 : 0, now(), id, tenantId]
  );
}

export async function deleteService(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE carwash_services SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

export async function seedDefaultServices(tenantId: string): Promise<void> {
  const existing = await listAllServices(tenantId);
  if (existing.length > 0) return;
  const defaults: Array<[string, number, number, number, number, number]> = [
    ['Basic Exterior Wash',   100, 150, 200, 300, 20],
    ['Foam Wash',             150, 200, 280, 400, 30],
    ['Interior Vacuum',       100, 150, 200, 300, 30],
    ['Full Interior + Exterior', 250, 350, 450, 650, 60],
    ['Engine Bay Wash',       200, 250, 300, 500, 45],
    ['Polish & Wax',          300, 400, 550, 800, 90],
    ['Ceramic Coating',      2000,2500,3500,5000,180],
    ['AC Vent Cleaning',      150, 200, 250, 350, 30],
  ];
  const db = await getDb();
  for (let i = 0; i < defaults.length; i++) {
    const [name, h, s, suv, lux, dur] = defaults[i];
    await db.execute(
      `INSERT INTO carwash_services (id, tenant_id, name, price_hatchback, price_sedan, price_suv, price_luxury, duration_minutes, gst_rate, is_active, sort_order) VALUES (?,?,?,?,?,?,?,?,18,1,?)`,
      [uuid(), tenantId, name, h, s, suv, lux, dur, i]
    );
  }
}

// ── Vehicles ────────────────────────────────────────────────────────────────

export async function findVehicleByReg(tenantId: string, regNumber: string): Promise<CarwashVehicle | null> {
  const db = await getDb();
  const clean = regNumber.toUpperCase().replace(/\s+/g, '');
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_vehicles WHERE tenant_id = ? AND UPPER(REPLACE(reg_number,' ','')) = ? AND deleted_at IS NULL LIMIT 1`,
    [tenantId, clean]
  );
  return rows.length ? rows[0] : null;
}

export async function upsertVehicle(tenantId: string, data: Omit<CarwashVehicle, 'id' | 'tenant_id' | 'created_at'>): Promise<CarwashVehicle> {
  const db = await getDb();
  const existing = await findVehicleByReg(tenantId, data.reg_number);
  if (existing) {
    await db.execute(
      `UPDATE carwash_vehicles SET customer_name=?, customer_phone=?, vehicle_type=?, make=?, model=?, color=?, updated_at=? WHERE id=?`,
      [data.customer_name ?? existing.customer_name, data.customer_phone ?? existing.customer_phone,
       data.vehicle_type, data.make ?? existing.make, data.model ?? existing.model, data.color ?? existing.color, now(), existing.id]
    );
    return { ...existing, ...data };
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO carwash_vehicles (id, tenant_id, customer_id, customer_name, customer_phone, reg_number, vehicle_type, make, model, color)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.customer_id ?? null, data.customer_name ?? null, data.customer_phone ?? null,
     data.reg_number, data.vehicle_type, data.make ?? null, data.model ?? null, data.color ?? null]
  );
  return { id, tenant_id: tenantId, created_at: now(), ...data, notes: data.notes ?? null };
}

export async function getVehicleHistory(tenantId: string, vehicleId: string, limit = 20): Promise<CarwashJob[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM carwash_jobs WHERE tenant_id = ? AND vehicle_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`,
    [tenantId, vehicleId, limit]
  );
}

export async function searchVehicles(tenantId: string, search: string): Promise<CarwashVehicle[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM carwash_vehicles WHERE tenant_id = ? AND deleted_at IS NULL
     AND (UPPER(reg_number) LIKE UPPER(?) OR customer_name LIKE ? OR customer_phone LIKE ?)
     ORDER BY updated_at DESC LIMIT 20`,
    [tenantId, `%${search}%`, `%${search}%`, `%${search}%`]
  );
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

async function nextJobNumber(tenantId: string): Promise<string> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM carwash_jobs WHERE tenant_id = ? AND created_at LIKE ?`,
    [tenantId, `${new Date().toISOString().slice(0, 10)}%`]
  );
  const seq = (rows[0]?.count ?? 0) + 1;
  return `WS${today.slice(4)}-${String(seq).padStart(3, '0')}`;
}

export async function createJob(tenantId: string, data: {
  reg_number: string;
  vehicle_type: VehicleType;
  make?: string;
  model?: string;
  color?: string;
  customer_name?: string;
  customer_phone?: string;
  staff_id?: string;
  staff_name?: string;
  items: Array<{ service_id?: string; service_name: string; price: number; gst_rate: number }>;
  discount?: number;
  notes?: string;
  membership_id?: string;
}): Promise<CarwashJob> {
  const db = await getDb();

  // Upsert vehicle
  const vehicle = await upsertVehicle(tenantId, {
    reg_number: data.reg_number,
    vehicle_type: data.vehicle_type,
    make: data.make ?? null,
    model: data.model ?? null,
    color: data.color ?? null,
    customer_name: data.customer_name ?? null,
    customer_phone: data.customer_phone ?? null,
    customer_id: null,
    notes: null,
  });

  const jobId = uuid();
  const jobNumber = await nextJobNumber(tenantId);
  const subtotal = data.items.reduce((s, i) => s + i.price, 0);
  const discount = data.discount ?? 0;
  const gstAmount = data.items.reduce((s, i) => s + (i.price - discount / data.items.length) * i.gst_rate / 100, 0);
  const total = subtotal - discount + gstAmount;

  await db.execute(
    `INSERT INTO carwash_jobs (id, tenant_id, job_number, vehicle_id, reg_number, vehicle_type, make, model, color,
      customer_name, customer_phone, staff_id, staff_name, status, subtotal, discount, gst_amount, total, membership_id, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [jobId, tenantId, jobNumber, vehicle.id, data.reg_number, data.vehicle_type,
     data.make ?? null, data.model ?? null, data.color ?? null,
     data.customer_name ?? null, data.customer_phone ?? null,
     data.staff_id ?? null, data.staff_name ?? null,
     'waiting', subtotal, discount, gstAmount, total,
     data.membership_id ?? null, data.notes ?? null]
  );

  for (const item of data.items) {
    await db.execute(
      `INSERT INTO carwash_job_items (id, tenant_id, job_id, service_id, service_name, price, gst_rate) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), tenantId, jobId, item.service_id ?? null, item.service_name, item.price, item.gst_rate]
    );
  }

  // Deduct membership wash if used
  if (data.membership_id) {
    await db.execute(
      `UPDATE carwash_memberships SET used_washes = used_washes + 1, updated_at = ? WHERE id = ?`,
      [now(), data.membership_id]
    );
  }

  const rows = await db.select<any[]>(`SELECT * FROM carwash_jobs WHERE id = ?`, [jobId]);
  return rows[0];
}

export async function updateJobStatus(tenantId: string, jobId: string, status: JobStatus): Promise<void> {
  const db = await getDb();
  const tsField = status === 'in_progress' ? ', started_at = ?' : status === 'ready' ? ', completed_at = ?' : status === 'delivered' ? ', delivered_at = ?' : '';
  const tsValue = (status === 'in_progress' || status === 'ready' || status === 'delivered') ? now() : null;
  const params: any[] = tsValue ? [status, now(), tsValue, jobId, tenantId] : [status, now(), jobId, tenantId];
  await db.execute(
    `UPDATE carwash_jobs SET status = ?, updated_at = ?${tsField} WHERE id = ? AND tenant_id = ?`,
    params
  );
}

export async function settleJob(tenantId: string, jobId: string, paymentMethod: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_jobs SET payment_status = 'paid', payment_method = ?, status = 'delivered', delivered_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [paymentMethod, now(), now(), jobId, tenantId]
  );
}

export async function listJobs(tenantId: string, opts: { date?: string; status?: JobStatus; limit?: number } = {}): Promise<CarwashJob[]> {
  const db = await getDb();
  const conditions = [`j.tenant_id = ?`, `j.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.date) { conditions.push(`j.created_at LIKE ?`); params.push(`${opts.date}%`); }
  if (opts.status) { conditions.push(`j.status = ?`); params.push(opts.status); }
  const jobs = await db.select<any[]>(
    `SELECT j.* FROM carwash_jobs j WHERE ${conditions.join(' AND ')} ORDER BY j.created_at DESC LIMIT ${opts.limit ?? 200}`,
    params
  );
  if (jobs.length === 0) return [];
  const jobIds = jobs.map(j => j.id);
  const placeholders = jobIds.map(() => '?').join(',');
  const items = await db.select<any[]>(
    `SELECT * FROM carwash_job_items WHERE job_id IN (${placeholders})`,
    jobIds
  );
  const itemMap: Record<string, CarwashJobItem[]> = {};
  for (const it of items) {
    if (!itemMap[it.job_id]) itemMap[it.job_id] = [];
    itemMap[it.job_id].push(it);
  }
  return jobs.map(j => ({ ...j, items: itemMap[j.id] ?? [] }));
}

export async function getTodayStats(tenantId: string): Promise<{
  totalJobs: number; revenue: number; pending: number; inProgress: number; ready: number; delivered: number;
}> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<any[]>(
    `SELECT status, payment_status, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
     FROM carwash_jobs WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL GROUP BY status`,
    [tenantId, `${today}%`]
  );
  let totalJobs = 0, revenue = 0, pending = 0, inProgress = 0, ready = 0, delivered = 0;
  for (const r of rows) {
    totalJobs += r.count;
    if (r.status === 'delivered') { revenue += r.revenue; delivered += r.count; }
    else if (r.status === 'waiting') pending += r.count;
    else if (r.status === 'in_progress') inProgress += r.count;
    else if (r.status === 'ready') ready += r.count;
  }
  return { totalJobs, revenue, pending, inProgress, ready, delivered };
}

export async function getStaffPerformance(tenantId: string, date: string): Promise<Array<{ staff_name: string; jobs: number; revenue: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT staff_name, COUNT(*) as jobs, COALESCE(SUM(total),0) as revenue
     FROM carwash_jobs WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL AND staff_name IS NOT NULL
     GROUP BY staff_name ORDER BY jobs DESC`,
    [tenantId, `${date}%`]
  );
}

export async function getMonthlyRevenue(tenantId: string, months = 6): Promise<Array<{ month: string; jobs: number; revenue: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as jobs, COALESCE(SUM(total),0) as revenue
     FROM carwash_jobs WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'delivered'
     GROUP BY month ORDER BY month DESC LIMIT ?`,
    [tenantId, months]
  );
}

export async function getPopularServices(tenantId: string, date: string): Promise<Array<{ service_name: string; count: number; revenue: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT ji.service_name, COUNT(*) as count, COALESCE(SUM(ji.price),0) as revenue
     FROM carwash_job_items ji
     JOIN carwash_jobs j ON j.id = ji.job_id
     WHERE j.tenant_id = ? AND j.created_at LIKE ? AND j.deleted_at IS NULL
     GROUP BY ji.service_name ORDER BY count DESC LIMIT 10`,
    [tenantId, `${date.slice(0,7)}%`]
  );
}

export async function getLapsedCustomers(tenantId: string, daysSince = 30): Promise<Array<{ customer_name: string; customer_phone: string; reg_number: string; last_visit: string }>> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - daysSince * 86400000).toISOString().slice(0, 10);
  return db.select<any[]>(
    `SELECT customer_name, customer_phone, reg_number, MAX(created_at) as last_visit
     FROM carwash_jobs WHERE tenant_id = ? AND customer_phone IS NOT NULL AND deleted_at IS NULL
     GROUP BY customer_phone HAVING MAX(created_at) < ?
     ORDER BY last_visit ASC LIMIT 50`,
    [tenantId, `${cutoff}T23:59:59`]
  );
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export async function listCarwashStaff(tenantId: string): Promise<CarwashStaff[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM carwash_staff WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY name`, [tenantId]);
  return rows.map(mapStaff);
}

export async function createCarwashStaff(tenantId: string, data: { name: string; phone?: string; role?: string }): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_staff (id, tenant_id, name, phone, role) VALUES (?,?,?,?,?)`,
    [uuid(), tenantId, data.name, data.phone ?? null, data.role ?? 'washer']
  );
}

export async function deleteCarwashStaff(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE carwash_staff SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

// ── Memberships ───────────────────────────────────────────────────────────────

export async function listMemberships(tenantId: string): Promise<CarwashMembership[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_memberships WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(mapMembership);
}

export async function findActiveMembership(tenantId: string, regNumber: string): Promise<CarwashMembership | null> {
  const db = await getDb();
  const clean = regNumber.toUpperCase().replace(/\s+/g, '');
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_memberships WHERE tenant_id = ? AND UPPER(REPLACE(reg_number,' ','')) = ? AND is_active = 1 AND deleted_at IS NULL
     AND used_washes < total_washes AND (valid_until IS NULL OR valid_until >= date('now')) LIMIT 1`,
    [tenantId, clean]
  );
  return rows.length ? mapMembership(rows[0]) : null;
}

export async function createMembership(tenantId: string, data: {
  customer_name: string; customer_phone?: string; reg_number?: string;
  package_name: string; total_washes: number; amount_paid: number; valid_until?: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_memberships (id, tenant_id, customer_name, customer_phone, reg_number, package_name, total_washes, amount_paid, valid_until)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.customer_name, data.customer_phone ?? null, data.reg_number ?? null,
     data.package_name, data.total_washes, data.amount_paid, data.valid_until ?? null]
  );
}
