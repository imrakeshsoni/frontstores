// [carwash] [all tenants]
import { getDb, uuid, now, localDateISO } from './index';
import { getCustomerByPhone, createCustomer } from './customers';

export type VehicleType = 'hatchback' | 'sedan' | 'suv' | 'luxury';

// [carwash] [all tenants] — Indian vehicle registration validation
// State format:  MH12AB1234  (2 letters + 1-2 digits + 1-3 letters + 1-4 digits)
// BH series:     22BH0001AA  (2 digits + BH + 4 digits + 1-2 letters)
const STATE_REG = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;
const BH_REG    = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

export function validateRegNumber(raw: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = raw.toUpperCase().replace(/[\s-]/g, '');
  if (!cleaned) return { valid: false, cleaned, error: 'Registration number is required' };
  if (STATE_REG.test(cleaned) || BH_REG.test(cleaned)) return { valid: true, cleaned };
  return {
    valid: false, cleaned,
    error: 'Invalid registration number. Use state format (MH12AB1234) or BH series (22BH0001AA)',
  };
}
export type JobStatus = 'waiting' | 'in_progress' | 'ready' | 'delivered';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'arrived' | 'done' | 'cancelled';

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
  monthly_salary: number;
  joining_date: string | null;
  deduct_half_day: boolean;
  deduct_full_day_leave: boolean;
}

export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave' | 'holiday';

export interface CarwashAttendance {
  id: string;
  tenant_id: string;
  staff_id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  updated_at: string;
}

export interface CarwashSalaryAdvance {
  id: string;
  tenant_id: string;
  staff_id: string;
  month: string;
  amount: number;
  note: string | null;
  given_at: string | null;
  created_at: string;
}

export interface CarwashSalaryPayment {
  id: string;
  tenant_id: string;
  staff_id: string;
  month: string;
  amount_paid: number;
  payment_method: string;
  note: string | null;
  paid_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface StaffSalarySummary {
  staff: CarwashStaff;
  present: number;
  half_day: number;
  absent: number;
  leave: number;
  holiday: number;
  working_days: number;
  per_day_rate: number;
  payable_days: number;
  net_salary: number;
  deductions: number;
  advance: number;
  payable_amount: number;
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

export interface CarwashAppointment {
  id: string;
  tenant_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  reg_number: string | null;
  vehicle_type: VehicleType;
  make: string | null;
  model: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  staff_id: string | null;
  staff_name: string | null;
  services_note: string | null;
  status: AppointmentStatus;
  notes: string | null;
  job_id: string | null;
  created_at: string;
}

export interface CarwashInventoryItem {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  cost_per_unit: number;
  selling_price: number;
  gst_rate: number;
  sku: string | null;
  brand: string | null;
  notes: string | null;
  updated_at: string;
}

export interface CarwashVehicleTypeRecord {
  id: string;
  tenant_id: string;
  name: string;
  icon: string;
  price_multiplier: number;
  is_active: boolean;
  sort_order: number;
}

export interface CarwashLoyalty {
  id: string;
  tenant_id: string;
  customer_phone: string;
  customer_name: string;
  reg_number: string | null;
  total_points: number;
  redeemed_points: number;
  available_points: number;
}

function mapService(r: any): CarwashService {
  return { ...r, is_active: r.is_active === 1 };
}
function mapStaff(r: any): CarwashStaff {
  return {
    ...r,
    is_active: r.is_active === 1,
    deduct_half_day: r.deduct_half_day === 1,
    deduct_full_day_leave: r.deduct_full_day_leave === 1,
    monthly_salary: r.monthly_salary ?? 0,
  };
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

export async function createService(tenantId: string, data: Omit<CarwashService, 'id' | 'tenant_id'>): Promise<{ id: string }> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO carwash_services (id, tenant_id, name, description, price_hatchback, price_sedan, price_suv, price_luxury, duration_minutes, gst_rate, is_active, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.description ?? null, data.price_hatchback, data.price_sedan,
     data.price_suv, data.price_luxury, data.duration_minutes, data.gst_rate, data.is_active ? 1 : 0, data.sort_order]
  );
  return { id };
}

export async function updateService(tenantId: string, id: string, data: Partial<CarwashService>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_services SET name=?, description=?, price_hatchback=?, price_sedan=?, price_suv=?, price_luxury=?, duration_minutes=?, gst_rate=?, is_active=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.description ?? null, data.price_hatchback, data.price_sedan, data.price_suv, data.price_luxury,
     data.duration_minutes, data.gst_rate, data.is_active ? 1 : 0, now(), id, tenantId]
  );
}

export async function isServiceInActiveJobs(tenantId: string, serviceId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM carwash_job_items ji
     JOIN carwash_jobs j ON j.id = ji.job_id
     WHERE j.tenant_id = ? AND ji.service_id = ? AND j.status != 'delivered' AND j.deleted_at IS NULL`,
    [tenantId, serviceId]
  );
  return (rows[0]?.count ?? 0) > 0;
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

export async function findVehiclesByPhone(tenantId: string, phone: string): Promise<CarwashVehicle[]> {
  const db = await getDb();
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return [];
  // Match last 10 digits — handles +91, 0 prefix, spaces, dashes
  const last10 = clean.slice(-10);
  return db.select<any[]>(
    `SELECT * FROM carwash_vehicles WHERE tenant_id = ? AND deleted_at IS NULL
     AND customer_phone IS NOT NULL AND customer_phone != ''
     AND REPLACE(REPLACE(REPLACE(customer_phone,'+',''),' ',''),'-','') LIKE ?
     ORDER BY updated_at DESC LIMIT 10`,
    [tenantId, `%${last10}`]
  );
}

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

export async function getVehicleServiceHistory(tenantId: string, regNumber: string): Promise<{
  lastVisit: string | null;
  visitCount: number;
  totalSpent: number;
  serviceHistory: Array<{ service_name: string; last_used: string; count: number }>;
}> {
  const db = await getDb();
  const clean = regNumber.toUpperCase().replace(/\s+/g, '');
  const jobs = await db.select<any[]>(
    `SELECT j.id, j.created_at, j.total FROM carwash_jobs j
     WHERE j.tenant_id = ? AND UPPER(REPLACE(j.reg_number,' ','')) = ? AND j.deleted_at IS NULL AND j.status = 'delivered'
     ORDER BY j.created_at DESC`,
    [tenantId, clean]
  );
  if (jobs.length === 0) return { lastVisit: null, visitCount: 0, totalSpent: 0, serviceHistory: [] };

  const jobIds = jobs.map(j => j.id);
  const placeholders = jobIds.map(() => '?').join(',');
  const items = await db.select<any[]>(
    `SELECT ji.service_name, ji.job_id FROM carwash_job_items ji WHERE ji.job_id IN (${placeholders})`,
    jobIds
  );

  const jobDateMap: Record<string, string> = {};
  for (const j of jobs) jobDateMap[j.id] = j.created_at;

  const svcMap: Record<string, { count: number; last_used: string }> = {};
  for (const item of items) {
    const date = jobDateMap[item.job_id] ?? '';
    if (!svcMap[item.service_name]) {
      svcMap[item.service_name] = { count: 0, last_used: date };
    }
    svcMap[item.service_name].count++;
    if (date > svcMap[item.service_name].last_used) svcMap[item.service_name].last_used = date;
  }

  const serviceHistory = Object.entries(svcMap)
    .map(([service_name, v]) => ({ service_name, ...v }))
    .sort((a, b) => b.count - a.count);

  return {
    lastVisit: jobs[0]?.created_at ?? null,
    visitCount: jobs.length,
    totalSpent: jobs.reduce((s, j) => s + (j.total ?? 0), 0),
    serviceHistory,
  };
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
  const today = localDateISO();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM carwash_jobs WHERE tenant_id = ? AND created_at LIKE ?`,
    [tenantId, `${today}%`]
  );
  const seq = (rows[0]?.count ?? 0) + 1;
  const mmdd = today.slice(5).replace('-', '');
  return `WS${mmdd}-${String(seq).padStart(3, '0')}`;
}

// [carwash] [all tenants] — Auto-create customer record from job card / appointment data
async function autoCreateCustomer(tenantId: string, name?: string, phone?: string): Promise<void> {
  const cleanPhone = phone?.replace(/\D/g, '') ?? '';
  const hasPhone = cleanPhone.length === 10;
  const hasName  = !!(name?.trim());
  if (!hasPhone && !hasName) return;

  // Look up by phone if available
  if (hasPhone) {
    const existing = await getCustomerByPhone(tenantId, cleanPhone);
    if (existing) {
      // Fill in missing name
      if (!existing.name && hasName) {
        const db = await getDb();
        await db.execute(`UPDATE customers SET name=?, updated_at=? WHERE id=?`, [name!.trim(), now(), existing.id]);
      }
      return;
    }
  } else {
    // No phone — check by name to avoid duplicates
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT id FROM customers WHERE tenant_id=? AND name=? AND deleted_at IS NULL LIMIT 1`,
      [tenantId, name!.trim()]
    );
    if (rows.length > 0) return;
  }

  await createCustomer(tenantId, {
    name: name?.trim() || 'Customer',
    phone: hasPhone ? cleanPhone : null,
    email: null, address: null, city: null, tags: [], credit_limit: 0, notes: null,
  });
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

  // Auto-create/find customer first so we can link customer_id to the job
  await autoCreateCustomer(tenantId, data.customer_name, data.customer_phone);
  let customerId: string | null = null;
  if (data.customer_phone) {
    const cleanPhone = data.customer_phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      const found = await getCustomerByPhone(tenantId, cleanPhone);
      customerId = found?.id ?? null;
    }
  }

  const vehicle = await upsertVehicle(tenantId, {
    reg_number: data.reg_number,
    vehicle_type: data.vehicle_type,
    make: data.make ?? null,
    model: data.model ?? null,
    color: data.color ?? null,
    customer_name: data.customer_name ?? null,
    customer_phone: data.customer_phone ?? null,
    customer_id: customerId,
    notes: null,
  });

  const jobId = uuid();
  const jobNumber = await nextJobNumber(tenantId);
  const subtotal = data.items.reduce((s, i) => s + i.price, 0);
  const discount = Math.max(0, data.discount ?? 0); // never negative
  const itemCount = Math.max(data.items.length, 1);
  const gstAmount = Math.round(data.items.reduce((s, i) => {
    const itemShare = subtotal > 0 ? i.price / subtotal : 1 / itemCount;
    const itemDiscount = discount * itemShare;
    return s + (i.price - itemDiscount) * i.gst_rate / 100;
  }, 0) * 100) / 100;
  const total = Math.max(0, subtotal - discount + gstAmount);

  await db.execute(
    `INSERT INTO carwash_jobs (id, tenant_id, job_number, vehicle_id, reg_number, vehicle_type, make, model, color,
      customer_name, customer_phone, customer_id, staff_id, staff_name, status, subtotal, discount, gst_amount, total, membership_id, notes, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [jobId, tenantId, jobNumber, vehicle.id, data.reg_number, data.vehicle_type,
     data.make ?? null, data.model ?? null, data.color ?? null,
     data.customer_name ?? null, data.customer_phone ?? null, customerId,
     data.staff_id ?? null, data.staff_name ?? null,
     'waiting', subtotal, discount, gstAmount, total,
     data.membership_id ?? null, data.notes ?? null, now()]
  );

  for (const item of data.items) {
    await db.execute(
      `INSERT INTO carwash_job_items (id, tenant_id, job_id, service_id, service_name, price, gst_rate) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), tenantId, jobId, item.service_id ?? null, item.service_name, item.price, item.gst_rate]
    );
  }

  if (data.membership_id) {
    // Only increment if washes remain (prevent over-use of exhausted membership)
    await db.execute(
      `UPDATE carwash_memberships SET used_washes = used_washes + 1, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND used_washes < total_washes`,
      [now(), data.membership_id, tenantId]
    );
  }

  // Award loyalty points outside transaction (non-critical, best-effort)
  if (data.customer_phone && data.customer_phone.replace(/\D/g, '').length >= 10) {
    try {
      await awardLoyaltyPoints(tenantId, {
        customer_phone: data.customer_phone,
        customer_name: data.customer_name ?? 'Customer',
        reg_number: data.reg_number,
        job_id: jobId,
        amount: total,
      });
    } catch { /* non-critical */ }
  }

  const rows = await db.select<any[]>(`SELECT * FROM carwash_jobs WHERE id = ?`, [jobId]);
  return rows[0];
}

export async function updateJob(tenantId: string, jobId: string, data: {
  customer_name?: string;
  customer_phone?: string;
  staff_id?: string;
  staff_name?: string;
  notes?: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_jobs SET customer_name=?, customer_phone=?, staff_id=?, staff_name=?, notes=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.customer_name ?? null, data.customer_phone ?? null, data.staff_id ?? null, data.staff_name ?? null, data.notes ?? null, now(), jobId, tenantId]
  );
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

export async function deleteJob(tenantId: string, jobId: string): Promise<void> {
  const db = await getDb();
  const jobs = await db.select<any[]>(`SELECT membership_id, customer_phone, total FROM carwash_jobs WHERE id = ? AND tenant_id = ?`, [jobId, tenantId]);
  if (jobs.length === 0) return;
  const job = jobs[0];

  // Restore membership wash — use CASE to prevent going below 0
  if (job.membership_id) {
    await db.execute(
      `UPDATE carwash_memberships
       SET used_washes = CASE WHEN used_washes > 0 THEN used_washes - 1 ELSE 0 END, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [now(), job.membership_id, tenantId]
    );
  }
  await db.execute(`UPDATE carwash_jobs SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), jobId, tenantId]);

  // Reverse loyalty points (best-effort, outside transaction)
  if (job.customer_phone) {
    const cleanPhone = String(job.customer_phone).replace(/\D/g, '');
    const points = Math.floor((job.total ?? 0) / 10);
    if (points > 0 && cleanPhone.length >= 10) {
      try {
        await db.execute(
          `UPDATE carwash_loyalty
           SET total_points = CASE WHEN total_points >= ? THEN total_points - ? ELSE 0 END, updated_at = ?
           WHERE tenant_id = ? AND REPLACE(REPLACE(customer_phone,'+',''),' ','') LIKE ?`,
          [points, points, now(), tenantId, `%${cleanPhone.slice(-10)}`]
        );
      } catch { /* non-critical */ }
    }
  }
}

export async function settleJob(tenantId: string, jobId: string, paymentMethod: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_jobs SET payment_status = 'paid', payment_method = ?, status = 'delivered', delivered_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [paymentMethod, now(), now(), jobId, tenantId]
  );
}

export async function listJobs(tenantId: string, opts: { date?: string; status?: JobStatus; limit?: number; offset?: number } = {}): Promise<CarwashJob[]> {
  const db = await getDb();
  const conditions = [`j.tenant_id = ?`, `j.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.date) { conditions.push(`j.created_at LIKE ?`); params.push(`${opts.date}%`); }
  if (opts.status) { conditions.push(`j.status = ?`); params.push(opts.status); }
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const jobs = await db.select<any[]>(
    `SELECT j.* FROM carwash_jobs j WHERE ${conditions.join(' AND ')} ORDER BY j.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  if (jobs.length === 0) return [];
  const jobIds = jobs.map(j => j.id);
  const placeholders = jobIds.map(() => '?').join(',');
  const items = await db.select<any[]>(
    `SELECT * FROM carwash_job_items WHERE tenant_id = ? AND job_id IN (${placeholders})`,
    [tenantId, ...jobIds]
  );
  const itemMap: Record<string, CarwashJobItem[]> = {};
  for (const it of items) {
    if (!itemMap[it.job_id]) itemMap[it.job_id] = [];
    itemMap[it.job_id].push(it);
  }
  return jobs.map(j => ({ ...j, items: itemMap[j.id] ?? [] }));
}

export async function getJobsByCustomerPhone(tenantId: string, phone: string): Promise<CarwashJob[]> {
  const db = await getDb();
  const clean = phone.replace(/\D/g, '');
  const jobs = await db.select<any[]>(
    `SELECT j.* FROM carwash_jobs j
     WHERE j.tenant_id = ? AND j.deleted_at IS NULL
       AND REPLACE(REPLACE(REPLACE(j.customer_phone,'+',''),' ',''),'-','') LIKE ?
     ORDER BY j.created_at DESC LIMIT 200`,
    [tenantId, `%${clean}`]
  );
  if (jobs.length === 0) return [];
  const jobIds = jobs.map(j => j.id);
  const placeholders = jobIds.map(() => '?').join(',');
  const items = await db.select<any[]>(`SELECT * FROM carwash_job_items WHERE tenant_id = ? AND job_id IN (${placeholders})`, [tenantId, ...jobIds]);
  const itemMap: Record<string, CarwashJobItem[]> = {};
  for (const it of items) { if (!itemMap[it.job_id]) itemMap[it.job_id] = []; itemMap[it.job_id].push(it); }
  return jobs.map(j => ({ ...j, items: itemMap[j.id] ?? [] }));
}

export async function countJobs(tenantId: string, opts: { date?: string; status?: JobStatus } = {}): Promise<number> {
  const db = await getDb();
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.date) { conditions.push(`created_at LIKE ?`); params.push(`${opts.date}%`); }
  if (opts.status) { conditions.push(`status = ?`); params.push(opts.status); }
  const rows = await db.select<{ count: number }[]>(`SELECT COUNT(*) as count FROM carwash_jobs WHERE ${conditions.join(' AND ')}`, params);
  return rows[0]?.count ?? 0;
}

export async function getTodayStats(tenantId: string): Promise<{
  totalJobs: number; revenue: number; pending: number; inProgress: number; ready: number; delivered: number;
}> {
  const db = await getDb();
  const today = localDateISO();
  const rows = await db.select<any[]>(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
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

export async function getStaffWeeklyPerformance(tenantId: string): Promise<Array<{ staff_name: string; date: string; jobs: number; revenue: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT staff_name, strftime('%Y-%m-%d', created_at) as date, COUNT(*) as jobs, COALESCE(SUM(total),0) as revenue
     FROM carwash_jobs
     WHERE tenant_id = ? AND deleted_at IS NULL AND staff_name IS NOT NULL
       AND created_at >= date('now', '-7 days')
     GROUP BY staff_name, date ORDER BY date ASC`,
    [tenantId]
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

export async function getDateStats(tenantId: string, date: string): Promise<{
  totalJobs: number; revenue: number; avgJobValue: number;
}> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT COUNT(*) as totalJobs, COALESCE(SUM(total),0) as revenue
     FROM carwash_jobs WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL AND status = 'delivered'`,
    [tenantId, `${date}%`]
  );
  const r = rows[0] ?? { totalJobs: 0, revenue: 0 };
  return { totalJobs: r.totalJobs, revenue: r.revenue, avgJobValue: r.totalJobs > 0 ? Math.round(r.revenue / r.totalJobs) : 0 };
}

export async function getHourlyStats(tenantId: string, date: string): Promise<Array<{ hour: number; jobs: number; revenue: number }>> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as jobs, COALESCE(SUM(total),0) as revenue
     FROM carwash_jobs WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL
     GROUP BY hour ORDER BY hour ASC`,
    [tenantId, `${date}%`]
  );
  return rows;
}

export async function getNewVsReturning(tenantId: string, date: string): Promise<{ newCustomers: number; returning: number }> {
  const db = await getDb();
  const jobs = await db.select<any[]>(
    `SELECT customer_phone, MIN(created_at) as first_visit
     FROM carwash_jobs WHERE tenant_id = ? AND deleted_at IS NULL AND customer_phone IS NOT NULL
     GROUP BY customer_phone`,
    [tenantId]
  );
  const todayJobs = await db.select<any[]>(
    `SELECT DISTINCT customer_phone FROM carwash_jobs
     WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL AND customer_phone IS NOT NULL`,
    [tenantId, `${date}%`]
  );
  let newC = 0, returning = 0;
  for (const tj of todayJobs) {
    const rec = jobs.find(j => j.customer_phone === tj.customer_phone);
    if (rec && rec.first_visit.startsWith(date)) newC++;
    else returning++;
  }
  return { newCustomers: newC, returning };
}

export async function getPaymentBreakdown(tenantId: string, date: string): Promise<Array<{ method: string; count: number; revenue: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT COALESCE(payment_method, 'cash') as method, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
     FROM carwash_jobs WHERE tenant_id = ? AND created_at LIKE ? AND deleted_at IS NULL AND status = 'delivered'
     GROUP BY method ORDER BY revenue DESC`,
    [tenantId, `${date}%`]
  );
}

export async function getDailyRevenueLast30(tenantId: string): Promise<Array<{ date: string; revenue: number; jobs: number }>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT strftime('%Y-%m-%d', created_at) as date, COALESCE(SUM(total),0) as revenue, COUNT(*) as jobs
     FROM carwash_jobs WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'delivered'
       AND created_at >= date('now', '-30 days')
     GROUP BY date ORDER BY date ASC`,
    [tenantId]
  );
}

export async function getLapsedCustomers(tenantId: string, daysSince = 30): Promise<Array<{ customer_name: string; customer_phone: string; reg_number: string; last_visit: string }>> {
  const db = await getDb();
  const _lc = new Date(Date.now() - daysSince * 86400000);
  const cutoff = `${_lc.getFullYear()}-${String(_lc.getMonth()+1).padStart(2,'0')}-${String(_lc.getDate()).padStart(2,'0')}`;
  return db.select<any[]>(
    `SELECT customer_name, customer_phone, reg_number, MAX(created_at) as last_visit
     FROM carwash_jobs WHERE tenant_id = ? AND customer_phone IS NOT NULL AND deleted_at IS NULL
     GROUP BY customer_phone HAVING MAX(created_at) < ?
     ORDER BY last_visit ASC`,
    [tenantId, `${cutoff}T23:59:59`]
  );
}

// ── Export / Reports ─────────────────────────────────────────────────────────

export async function getAllJobsForExport(tenantId: string, opts: {
  from?: string; to?: string; customerPhone?: string; status?: string;
} = {}): Promise<CarwashJob[]> {
  const db = await getDb();
  const conds = [`j.tenant_id = ?`, `j.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.from) { conds.push(`j.created_at >= ?`); params.push(`${opts.from}T00:00:00`); }
  if (opts.to)   { conds.push(`j.created_at <= ?`); params.push(`${opts.to}T23:59:59`); }
  if (opts.status) { conds.push(`j.status = ?`); params.push(opts.status); }
  if (opts.customerPhone) {
    const clean = opts.customerPhone.replace(/\D/g, '');
    conds.push(`REPLACE(REPLACE(REPLACE(j.customer_phone,'+',''),' ',''),'-','') LIKE ?`);
    params.push(`%${clean}`);
  }
  const jobs = await db.select<any[]>(
    `SELECT j.* FROM carwash_jobs j WHERE ${conds.join(' AND ')} ORDER BY j.created_at DESC LIMIT 2000`,
    params
  );
  if (jobs.length === 0) return [];
  const jobIds = jobs.map(j => j.id);
  const placeholders = jobIds.map(() => '?').join(',');
  const items = await db.select<any[]>(`SELECT * FROM carwash_job_items WHERE tenant_id = ? AND job_id IN (${placeholders})`, [tenantId, ...jobIds]);
  const itemMap: Record<string, CarwashJobItem[]> = {};
  for (const it of items) { if (!itemMap[it.job_id]) itemMap[it.job_id] = []; itemMap[it.job_id].push(it); }
  return jobs.map(j => ({ ...j, items: itemMap[j.id] ?? [] }));
}

export async function getCustomersWithJobStats(tenantId: string): Promise<Array<{
  customer_name: string; customer_phone: string; total_jobs: number; total_spent: number; last_visit: string;
}>> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT customer_name, customer_phone,
            COUNT(*) as total_jobs,
            SUM(total) as total_spent,
            MAX(created_at) as last_visit
     FROM carwash_jobs
     WHERE tenant_id = ? AND deleted_at IS NULL AND customer_phone IS NOT NULL
     GROUP BY customer_phone
     ORDER BY total_spent DESC`,
    [tenantId]
  );
}

export async function listInventoryForExport(tenantId: string): Promise<CarwashInventoryItem[]> {
  const db = await getDb();
  return db.select<CarwashInventoryItem[]>(
    `SELECT * FROM carwash_inventory WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY category, name`,
    [tenantId]
  );
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export async function listCarwashStaff(tenantId: string): Promise<CarwashStaff[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM carwash_staff WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY name`, [tenantId]);
  return rows.map(mapStaff);
}

export async function listAllCarwashStaff(tenantId: string): Promise<CarwashStaff[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM carwash_staff WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
  return rows.map(mapStaff);
}

export async function createCarwashStaff(tenantId: string, data: {
  name: string; phone?: string; role?: string;
  monthly_salary?: number; joining_date?: string;
  deduct_half_day?: boolean; deduct_full_day_leave?: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_staff (id, tenant_id, name, phone, role, monthly_salary, joining_date, deduct_half_day, deduct_full_day_leave) VALUES (?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.name, data.phone ?? null, data.role ?? 'washer',
     data.monthly_salary ?? 0, data.joining_date ?? null,
     data.deduct_half_day !== false ? 1 : 0, data.deduct_full_day_leave ? 1 : 0]
  );
}

export async function updateCarwashStaff(tenantId: string, id: string, data: {
  name?: string; phone?: string; role?: string;
  monthly_salary?: number; joining_date?: string;
  deduct_half_day?: boolean; deduct_full_day_leave?: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_staff SET name=?, phone=?, role=?, monthly_salary=?, joining_date=?, deduct_half_day=?, deduct_full_day_leave=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.phone ?? null, data.role, data.monthly_salary ?? 0, data.joining_date ?? null,
     data.deduct_half_day !== false ? 1 : 0, data.deduct_full_day_leave ? 1 : 0, now(), id, tenantId]
  );
}

export async function deleteCarwashStaff(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE carwash_staff SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function upsertAttendance(tenantId: string, staffId: string, date: string, status: AttendanceStatus, note?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_attendance (id, tenant_id, staff_id, date, status, note, updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(tenant_id, staff_id, date) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at, deleted_at=NULL`,
    [uuid(), tenantId, staffId, date, status, note ?? null, now()]
  );
}

export async function getAttendanceForMonth(tenantId: string, year: number, month: number): Promise<CarwashAttendance[]> {
  const db = await getDb();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return db.select<CarwashAttendance[]>(
    `SELECT * FROM carwash_attendance WHERE tenant_id = ? AND date LIKE ? AND deleted_at IS NULL`,
    [tenantId, `${prefix}-%`]
  );
}

export async function getAttendanceForStaffMonth(tenantId: string, staffId: string, year: number, month: number): Promise<CarwashAttendance[]> {
  const db = await getDb();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return db.select<CarwashAttendance[]>(
    `SELECT * FROM carwash_attendance WHERE tenant_id = ? AND staff_id = ? AND date LIKE ? AND deleted_at IS NULL`,
    [tenantId, staffId, `${prefix}-%`]
  );
}

export function computeSalary(staff: CarwashStaff, attendance: CarwashAttendance[], year: number, month: number): StaffSalarySummary {
  const daysInMonth = new Date(year, month, 0).getDate();

  // Determine first payable day
  let startDay = 1;
  if (staff.joining_date) {
    const jd = new Date(staff.joining_date);
    // Validate date parsed correctly (guard against "Feb 30" overflow, etc.)
    if (!isNaN(jd.getTime())) {
      if (jd.getFullYear() === year && jd.getMonth() + 1 === month) {
        startDay = Math.min(Math.max(jd.getDate(), 1), daysInMonth);
      } else if (jd > new Date(year, month - 1, daysInMonth)) {
        // Joined after this month — 0 salary
        return { staff, present: 0, half_day: 0, absent: 0, leave: 0, holiday: 0, working_days: 0, per_day_rate: 0, payable_days: 0, net_salary: 0, deductions: 0, advance: 0, payable_amount: 0 };
      }
      // If joined before this month, startDay stays 1
    }
  }

  const working_days = daysInMonth - startDay + 1;
  const per_day_rate = staff.monthly_salary > 0 ? staff.monthly_salary / daysInMonth : 0;

  // Only count attendance within the payable period
  const payableAttendance = attendance.filter(a => {
    const d = parseInt(a.date.slice(8, 10));
    return d >= startDay;
  });

  const present = payableAttendance.filter(a => a.status === 'present').length;
  const half_day = payableAttendance.filter(a => a.status === 'half_day').length;
  const absent = payableAttendance.filter(a => a.status === 'absent').length;
  const leave = payableAttendance.filter(a => a.status === 'leave').length;
  const holiday = payableAttendance.filter(a => a.status === 'holiday').length;

  // Days not yet marked = treated as present for display (partial month)
  const marked = present + half_day + absent + leave + holiday;
  const unmarked = Math.max(0, working_days - marked);

  const payable_present = present + unmarked + holiday; // holiday = always paid
  const payable_half = staff.deduct_half_day ? half_day * 0.5 : half_day;
  const payable_leave = staff.deduct_full_day_leave ? 0 : leave;
  const payable_days = payable_present + payable_half + payable_leave;

  const net_salary = Math.round(per_day_rate * payable_days);
  const deductions = Math.round(staff.monthly_salary - net_salary);

  return { staff, present, half_day, absent, leave, holiday, working_days, per_day_rate, payable_days, net_salary, deductions, advance: 0, payable_amount: net_salary };
}

export async function getAttendanceSummaryForMonth(tenantId: string, year: number, month: number): Promise<StaffSalarySummary[]> {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const [staffList, allAttendance, advances] = await Promise.all([
    listAllCarwashStaff(tenantId),
    getAttendanceForMonth(tenantId, year, month),
    getSalaryAdvancesForMonth(tenantId, monthStr),
  ]);
  return staffList.map(staff => {
    const att = allAttendance.filter(a => a.staff_id === staff.id);
    const summary = computeSalary(staff, att, year, month);
    const advance = Math.min(
      advances.filter(a => a.staff_id === staff.id).reduce((s, a) => s + a.amount, 0),
      summary.net_salary  // advance can never exceed net salary
    );
    return { ...summary, advance, payable_amount: Math.max(0, summary.net_salary - advance) };
  });
}

// ── Salary Advance ────────────────────────────────────────────────────────────

export async function getSalaryAdvancesForMonth(tenantId: string, month: string): Promise<CarwashSalaryAdvance[]> {
  const db = await getDb();
  return db.select<CarwashSalaryAdvance[]>(
    `SELECT * FROM carwash_salary_advance WHERE tenant_id = ? AND month = ? AND deleted_at IS NULL ORDER BY created_at`,
    [tenantId, month]
  );
}

export async function addSalaryAdvance(tenantId: string, staffId: string, month: string, amount: number, note?: string, givenAt?: string): Promise<void> {
  if (!amount || amount <= 0) throw new Error('Advance amount must be greater than zero');
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_salary_advance (id, tenant_id, staff_id, month, amount, note, given_at) VALUES (?,?,?,?,?,?,?)`,
    [uuid(), tenantId, staffId, month, amount, note ?? null, givenAt ?? now()]
  );
}

export async function deleteSalaryAdvance(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE carwash_salary_advance SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

// Returns all attendance rows for a YYYY-MM range (inclusive)
export async function getAttendanceForDateRange(tenantId: string, fromMonth: string, toMonth: string): Promise<CarwashAttendance[]> {
  const db = await getDb();
  return db.select<CarwashAttendance[]>(
    `SELECT * FROM carwash_attendance WHERE tenant_id = ? AND substr(date,1,7) >= ? AND substr(date,1,7) <= ? AND deleted_at IS NULL ORDER BY date`,
    [tenantId, fromMonth, toMonth]
  );
}

// Returns all advances for a YYYY-MM range (inclusive)
export async function getSalaryAdvancesForDateRange(tenantId: string, fromMonth: string, toMonth: string): Promise<CarwashSalaryAdvance[]> {
  const db = await getDb();
  return db.select<CarwashSalaryAdvance[]>(
    `SELECT * FROM carwash_salary_advance WHERE tenant_id = ? AND month >= ? AND month <= ? AND deleted_at IS NULL ORDER BY month, created_at`,
    [tenantId, fromMonth, toMonth]
  );
}

// ── Salary Payments ───────────────────────────────────────────────────────────

export async function recordSalaryPayment(
  tenantId: string, staffId: string, month: string,
  amountPaid: number, paymentMethod: string, note?: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_salary_payments (id, tenant_id, staff_id, month, amount_paid, payment_method, note, paid_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, staffId, month, amountPaid, paymentMethod, note ?? null, now(), now()]
  );
}

export async function getSalaryPaymentsForMonth(tenantId: string, month: string): Promise<CarwashSalaryPayment[]> {
  const db = await getDb();
  return db.select<CarwashSalaryPayment[]>(
    `SELECT * FROM carwash_salary_payments WHERE tenant_id = ? AND month = ? AND deleted_at IS NULL ORDER BY paid_at DESC`,
    [tenantId, month]
  );
}

export async function getSalaryPaymentsForStaff(tenantId: string, staffId: string): Promise<CarwashSalaryPayment[]> {
  const db = await getDb();
  return db.select<CarwashSalaryPayment[]>(
    `SELECT * FROM carwash_salary_payments WHERE tenant_id = ? AND staff_id = ? AND deleted_at IS NULL ORDER BY month DESC, paid_at DESC`,
    [tenantId, staffId]
  );
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
     AND used_washes < total_washes AND (valid_until IS NULL OR date(valid_until) >= date('now')) LIMIT 1`,
    [tenantId, clean]
  );
  return rows.length ? mapMembership(rows[0]) : null;
}

export async function getExpiringMemberships(tenantId: string, withinDays = 7): Promise<CarwashMembership[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() + withinDays * 86400000).toISOString().slice(0, 10);
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_memberships WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1
     AND valid_until IS NOT NULL AND date(valid_until) >= date('now')
     AND date(valid_until) <= ?
     AND used_washes < total_washes`,
    [tenantId, cutoff]
  );
  return rows.map(mapMembership);
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

// ── Appointments ──────────────────────────────────────────────────────────────

export async function listAppointments(tenantId: string, date: string): Promise<CarwashAppointment[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM carwash_appointments WHERE tenant_id = ? AND appointment_date = ? AND deleted_at IS NULL ORDER BY appointment_time ASC`,
    [tenantId, date]
  );
}

export async function createAppointment(tenantId: string, data: {
  appointment_date: string;
  appointment_time: string;
  duration_minutes?: number;
  reg_number?: string;
  vehicle_type?: VehicleType;
  make?: string;
  model?: string;
  customer_name?: string;
  customer_phone?: string;
  staff_id?: string;
  staff_name?: string;
  services_note?: string;
  notes?: string;
}): Promise<CarwashAppointment> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO carwash_appointments (id, tenant_id, appointment_date, appointment_time, duration_minutes, reg_number, vehicle_type, make, model, customer_name, customer_phone, staff_id, staff_name, services_note, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.appointment_date, data.appointment_time, data.duration_minutes ?? 60,
     data.reg_number ?? null, data.vehicle_type ?? 'sedan', data.make ?? null, data.model ?? null,
     data.customer_name ?? null, data.customer_phone ?? null, data.staff_id ?? null, data.staff_name ?? null,
     data.services_note ?? null, data.notes ?? null]
  );
  // Auto-create customer if not already in customers table
  await autoCreateCustomer(tenantId, data.customer_name, data.customer_phone);
  const rows = await db.select<any[]>(`SELECT * FROM carwash_appointments WHERE id = ?`, [id]);
  return rows[0];
}

export async function updateAppointmentStatus(tenantId: string, id: string, status: AppointmentStatus, jobId?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_appointments SET status = ?, job_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [status, jobId ?? null, now(), id, tenantId]
  );
}

export async function deleteAppointment(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE carwash_appointments SET deleted_at = ?, status = 'cancelled', updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function listInventory(tenantId: string): Promise<CarwashInventoryItem[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM carwash_inventory WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY category, name`,
    [tenantId]
  );
}

export async function createInventoryItem(tenantId: string, data: {
  name: string; category: string; unit: string; quantity: number; min_quantity: number;
  cost_per_unit: number; selling_price?: number; gst_rate?: number; sku?: string; brand?: string; notes?: string;
}): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO carwash_inventory (id, tenant_id, name, category, unit, quantity, min_quantity, cost_per_unit, selling_price, gst_rate, sku, brand, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category, data.unit, data.quantity, data.min_quantity,
     data.cost_per_unit, data.selling_price ?? 0, data.gst_rate ?? 18,
     data.sku ?? null, data.brand ?? null, data.notes ?? null]
  );
  return id;
}

export async function updateInventoryItem(tenantId: string, id: string, data: Partial<CarwashInventoryItem>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_inventory SET name=?, category=?, unit=?, quantity=?, min_quantity=?, cost_per_unit=?, selling_price=?, gst_rate=?, sku=?, brand=?, notes=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.category, data.unit, data.quantity, data.min_quantity,
     data.cost_per_unit, data.selling_price ?? 0, data.gst_rate ?? 18,
     data.sku ?? null, data.brand ?? null, data.notes ?? null, now(), id, tenantId]
  );
}

export interface CarwashInventoryLog {
  id: string;
  tenant_id: string;
  item_id: string;
  item_name: string;
  category: string | null;
  direction: 'add' | 'remove';
  quantity: number;
  reason: string | null;
  supplier: string | null;
  invoice_no: string | null;
  date: string;
  notes: string | null;
  created_at: string;
}

export async function adjustInventoryQuantity(
  tenantId: string, id: string, delta: number,
  meta?: { reason?: string; supplier?: string; invoice?: string; notes?: string; date?: string }
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_inventory SET quantity = MAX(0, quantity + ?), updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [delta, now(), id, tenantId]
  );
  // Write log entry
  const rows = await db.select<any[]>(`SELECT name, category FROM carwash_inventory WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  if (rows.length > 0) {
    await db.execute(
      `INSERT INTO carwash_inventory_log (id, tenant_id, item_id, item_name, category, direction, quantity, reason, supplier, invoice_no, date, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, id, rows[0].name, rows[0].category ?? null,
       delta >= 0 ? 'add' : 'remove', Math.abs(delta),
       meta?.reason ?? null, meta?.supplier ?? null, meta?.invoice ?? null,
       meta?.date ?? now().slice(0, 10), meta?.notes ?? null]
    );
  }
}

export async function listInventoryLogs(tenantId: string, itemId?: string, limit = 100): Promise<CarwashInventoryLog[]> {
  const db = await getDb();
  const conds = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (itemId) { conds.push(`item_id = ?`); params.push(itemId); }
  return db.select<CarwashInventoryLog[]>(
    `SELECT * FROM carwash_inventory_log WHERE ${conds.join(' AND ')} ORDER BY date DESC, created_at DESC LIMIT ${limit}`,
    params
  );
}

export async function deleteInventoryItem(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE carwash_inventory SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

export async function getLowStockInventory(tenantId: string): Promise<CarwashInventoryItem[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM carwash_inventory WHERE tenant_id = ? AND deleted_at IS NULL AND min_quantity > 0 AND quantity <= min_quantity`,
    [tenantId]
  );
}

// ── Vehicle Types ─────────────────────────────────────────────────────────────

const DEFAULT_VEHICLE_TYPES: Omit<CarwashVehicleTypeRecord, 'id' | 'tenant_id'>[] = [
  // ── Two-wheelers ──
  { name: 'Scooter',        icon: '🛵', price_multiplier: 0.3,  is_active: true, sort_order: 0 },
  { name: 'Motorcycle',     icon: '🏍️', price_multiplier: 0.35, is_active: true, sort_order: 1 },
  // ── Three-wheelers ──
  { name: 'Auto Rickshaw',  icon: '🛺', price_multiplier: 0.5,  is_active: true, sort_order: 2 },
  // ── Cars ──
  { name: 'Hatchback',      icon: '🚗', price_multiplier: 0.75, is_active: true, sort_order: 3 },
  { name: 'Compact Sedan',  icon: '🚗', price_multiplier: 0.85, is_active: true, sort_order: 4 },
  { name: 'Sedan',          icon: '🚙', price_multiplier: 1.0,  is_active: true, sort_order: 5 },
  { name: 'Compact SUV',    icon: '🚐', price_multiplier: 1.2,  is_active: true, sort_order: 6 },
  { name: 'Mid-size SUV',   icon: '🚐', price_multiplier: 1.4,  is_active: true, sort_order: 7 },
  { name: 'Full-size SUV',  icon: '🚐', price_multiplier: 1.6,  is_active: true, sort_order: 8 },
  { name: 'MUV / MPV',      icon: '🚐', price_multiplier: 1.5,  is_active: true, sort_order: 9 },
  { name: 'Luxury Car',     icon: '🏎️', price_multiplier: 2.2,  is_active: true, sort_order: 10 },
  // ── Commercial ──
  { name: 'Van / Tempo',    icon: '🚌', price_multiplier: 1.8,  is_active: true, sort_order: 11 },
  { name: 'Mini Truck',     icon: '🚚', price_multiplier: 2.0,  is_active: true, sort_order: 12 },
  { name: 'Heavy Truck',    icon: '🚛', price_multiplier: 3.0,  is_active: true, sort_order: 13 },
  { name: 'Bus',            icon: '🚌', price_multiplier: 2.8,  is_active: true, sort_order: 14 },
  { name: 'Tractor',        icon: '🚜', price_multiplier: 2.5,  is_active: true, sort_order: 15 },
];

export async function listVehicleTypes(tenantId: string): Promise<CarwashVehicleTypeRecord[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_vehicle_types WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY sort_order, name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: r.is_active === 1 }));
}

export async function listAllVehicleTypes(tenantId: string): Promise<CarwashVehicleTypeRecord[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM carwash_vehicle_types WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY sort_order, name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: r.is_active === 1 }));
}

export async function seedDefaultVehicleTypes(tenantId: string): Promise<void> {
  const existing = await listAllVehicleTypes(tenantId);
  if (existing.length > 0) return;
  const db = await getDb();
  for (const vt of DEFAULT_VEHICLE_TYPES) {
    await db.execute(
      `INSERT INTO carwash_vehicle_types (id, tenant_id, name, icon, price_multiplier, is_active, sort_order) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), tenantId, vt.name, vt.icon, vt.price_multiplier, 1, vt.sort_order]
    );
  }
}

export async function createVehicleType(tenantId: string, data: { name: string; icon: string; price_multiplier: number; sort_order?: number }): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ max_order: number }[]>(`SELECT COALESCE(MAX(sort_order),0) as max_order FROM carwash_vehicle_types WHERE tenant_id = ?`, [tenantId]);
  const sortOrder = data.sort_order ?? (rows[0]?.max_order ?? 0) + 1;
  await db.execute(
    `INSERT INTO carwash_vehicle_types (id, tenant_id, name, icon, price_multiplier, is_active, sort_order) VALUES (?,?,?,?,?,1,?)`,
    [uuid(), tenantId, data.name.trim(), data.icon, data.price_multiplier, sortOrder]
  );
}

export async function updateVehicleType(tenantId: string, id: string, data: Partial<Pick<CarwashVehicleTypeRecord, 'name' | 'icon' | 'price_multiplier' | 'is_active' | 'sort_order'>>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_vehicle_types SET name=?, icon=?, price_multiplier=?, is_active=?, sort_order=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.icon, data.price_multiplier, data.is_active ? 1 : 0, data.sort_order, now(), id, tenantId]
  );
}

export async function deleteVehicleType(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE carwash_vehicle_types SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ── Service Prices (per vehicle type) ────────────────────────────────────────
// [carwash] [all tenants] — dynamic manual pricing: service × vehicle type → price

export async function getAllServicePrices(tenantId: string): Promise<Record<string, Record<string, number>>> {
  const db = await getDb();
  const rows = await db.select<{ service_id: string; vehicle_type_id: string; price: number }[]>(
    'SELECT service_id, vehicle_type_id, price FROM carwash_service_prices WHERE tenant_id = ? AND deleted_at IS NULL',
    [tenantId]
  );
  const map: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!map[r.service_id]) map[r.service_id] = {};
    map[r.service_id][r.vehicle_type_id] = r.price;
  }
  return map;
}

export async function upsertServicePrice(tenantId: string, serviceId: string, vehicleTypeId: string, price: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO carwash_service_prices (id, tenant_id, service_id, vehicle_type_id, price, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, service_id, vehicle_type_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at, deleted_at = NULL`,
    [uuid(), tenantId, serviceId, vehicleTypeId, price, now()]
  );
}

export async function getServicePriceForVehicle(tenantId: string, serviceId: string, vehicleTypeId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ price: number }[]>(
    'SELECT price FROM carwash_service_prices WHERE tenant_id = ? AND service_id = ? AND vehicle_type_id = ? AND deleted_at IS NULL',
    [tenantId, serviceId, vehicleTypeId]
  );
  return rows[0]?.price ?? 0;
}

// ── Loyalty ───────────────────────────────────────────────────────────────────

async function awardLoyaltyPoints(tenantId: string, data: {
  customer_phone: string;
  customer_name: string;
  reg_number: string;
  job_id: string;
  amount: number;
}): Promise<void> {
  const db = await getDb();
  const points = Math.floor(data.amount / 10);
  if (points <= 0) return;

  const existing = await db.select<any[]>(
    `SELECT id FROM carwash_loyalty WHERE tenant_id = ? AND customer_phone = ? AND deleted_at IS NULL LIMIT 1`,
    [tenantId, data.customer_phone]
  );

  let loyaltyId: string;
  if (existing.length > 0) {
    loyaltyId = existing[0].id;
    await db.execute(
      `UPDATE carwash_loyalty SET total_points = total_points + ?, customer_name = ?, reg_number = ?, updated_at = ? WHERE id = ?`,
      [points, data.customer_name, data.reg_number, now(), loyaltyId]
    );
  } else {
    loyaltyId = uuid();
    await db.execute(
      `INSERT INTO carwash_loyalty (id, tenant_id, customer_phone, customer_name, reg_number, total_points) VALUES (?,?,?,?,?,?)`,
      [loyaltyId, tenantId, data.customer_phone, data.customer_name, data.reg_number, points]
    );
  }

  await db.execute(
    `INSERT INTO carwash_loyalty_transactions (id, tenant_id, loyalty_id, job_id, points, type, note) VALUES (?,?,?,?,?,?,?)`,
    [uuid(), tenantId, loyaltyId, data.job_id, points, 'earn', `₹${Math.round(data.amount)} job`]
  );
}

export async function getLoyaltyByPhone(tenantId: string, phone: string): Promise<CarwashLoyalty | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT *, (total_points - redeemed_points) as available_points FROM carwash_loyalty WHERE tenant_id = ? AND customer_phone = ? AND deleted_at IS NULL LIMIT 1`,
    [tenantId, phone.replace(/\D/g, '')]
  );
  return rows.length ? rows[0] : null;
}

export async function redeemLoyaltyPoints(tenantId: string, loyaltyId: string, points: number, jobId?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE carwash_loyalty SET redeemed_points = redeemed_points + ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [points, now(), loyaltyId, tenantId]
  );
  await db.execute(
    `INSERT INTO carwash_loyalty_transactions (id, tenant_id, loyalty_id, job_id, points, type, note) VALUES (?,?,?,?,?,?,?)`,
    [uuid(), tenantId, loyaltyId, jobId ?? null, points, 'redeem', `Redeemed ${points} pts = ₹${points}`]
  );
}

export async function listTopLoyaltyCustomers(tenantId: string): Promise<CarwashLoyalty[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT *, (total_points - redeemed_points) as available_points FROM carwash_loyalty WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY total_points DESC LIMIT 20`,
    [tenantId]
  );
}

// [carwash] [all tenants] — detect customers that look like duplicates
// Groups by (a) same vehicle reg_number used with different phones, (b) same phone in multiple customer records
export type DuplicateEntry = {
  customer_id: string | null;
  customer_name: string;
  phone: string;
  job_count: number;
  last_seen: string;
};
export type DuplicateGroup = {
  key: string;           // reg_number or phone
  reason: 'vehicle' | 'phone';
  display: string;       // human-readable label
  entries: DuplicateEntry[];
};

export async function findDuplicateCustomerGroups(tenantId: string): Promise<DuplicateGroup[]> {
  const db = await getDb();

  // Group 1: same vehicle reg used with different customer phones in carwash_jobs
  const vehicleRows = await db.select<any[]>(
    `WITH base AS (
       SELECT
         UPPER(REPLACE(REPLACE(reg_number,' ',''),'-','')) AS reg,
         REPLACE(REPLACE(REPLACE(customer_phone,'+',''),' ',''),'-','') AS phone,
         MAX(customer_name) AS cname,
         COUNT(*) AS job_count,
         MAX(created_at) AS last_seen
       FROM carwash_jobs
       WHERE tenant_id = ?
         AND deleted_at IS NULL
         AND reg_number IS NOT NULL AND TRIM(reg_number) != ''
         AND customer_phone IS NOT NULL AND TRIM(customer_phone) != ''
       GROUP BY reg, phone
     ),
     dup_regs AS (
       SELECT reg FROM base GROUP BY reg HAVING COUNT(*) > 1
     )
     SELECT b.reg, b.phone, b.cname, b.job_count, b.last_seen,
            c.id AS customer_id
     FROM base b
     JOIN dup_regs d ON b.reg = d.reg
     LEFT JOIN customers c ON c.tenant_id = ? AND REPLACE(REPLACE(REPLACE(c.phone,'+',''),' ',''),'-','') = b.phone AND c.deleted_at IS NULL
     ORDER BY b.reg, b.last_seen DESC`,
    [tenantId, tenantId]
  );

  // Group 2: same phone exists across multiple customer records (edge case)
  const phoneRows = await db.select<any[]>(
    `SELECT c.phone,
            c.id AS customer_id,
            c.name AS cname,
            0 AS job_count,
            c.created_at AS last_seen
     FROM customers c
     WHERE c.tenant_id = ? AND c.phone IS NOT NULL AND c.phone != '' AND c.deleted_at IS NULL
       AND (SELECT COUNT(*) FROM customers c2 WHERE c2.tenant_id = ? AND c2.deleted_at IS NULL
              AND REPLACE(REPLACE(REPLACE(c2.phone,'+',''),' ',''),'-','') = REPLACE(REPLACE(REPLACE(c.phone,'+',''),' ',''),'-','')) > 1
     ORDER BY c.phone, c.created_at DESC`,
    [tenantId, tenantId]
  );

  const groups: DuplicateGroup[] = [];

  // Build vehicle groups
  const vehicleMap = new Map<string, DuplicateEntry[]>();
  for (const row of vehicleRows) {
    const list = vehicleMap.get(row.reg) ?? [];
    list.push({ customer_id: row.customer_id ?? null, customer_name: row.cname ?? 'Unknown', phone: row.phone, job_count: row.job_count, last_seen: row.last_seen });
    vehicleMap.set(row.reg, list);
  }
  for (const [reg, entries] of vehicleMap) {
    groups.push({ key: reg, reason: 'vehicle', display: reg, entries });
  }

  // Build phone groups
  const phoneMap = new Map<string, DuplicateEntry[]>();
  for (const row of phoneRows) {
    const cleaned = row.phone?.replace(/\D/g, '') ?? '';
    const list = phoneMap.get(cleaned) ?? [];
    if (!list.find(e => e.customer_id === row.customer_id)) {
      list.push({ customer_id: row.customer_id, customer_name: row.cname, phone: cleaned, job_count: row.job_count, last_seen: row.last_seen });
    }
    phoneMap.set(cleaned, list);
  }
  for (const [phone, entries] of phoneMap) {
    // Don't duplicate a group already captured by vehicle matching
    groups.push({ key: phone, reason: 'phone', display: phone, entries });
  }

  return groups;
}

// [carwash] [all tenants] — merge duplicate customers into one primary
// Reassigns all jobs/vehicles/appointments to primary, soft-deletes duplicates
export async function mergeCustomers(
  tenantId: string,
  keepId: string,
  removeIds: string[]
): Promise<void> {
  const db = await getDb();
  const nowTs = now();

  // Fetch primary customer
  const primRows = await db.select<any[]>(
    `SELECT * FROM customers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
    [keepId, tenantId]
  );
  if (!primRows.length) throw new Error('Primary customer not found');
  const primary = primRows[0];

  for (const dupId of removeIds) {
    const dupRows = await db.select<any[]>(
      `SELECT * FROM customers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [dupId, tenantId]
    );
    if (!dupRows.length) continue;
    const dup = dupRows[0];
    const dupPhone = dup.phone?.replace(/\D/g, '') ?? '';

    // Reassign carwash_jobs
    await db.execute(
      `UPDATE carwash_jobs SET customer_id=?, customer_name=?, customer_phone=?, updated_at=?
       WHERE tenant_id=? AND deleted_at IS NULL AND (customer_id=? OR REPLACE(REPLACE(REPLACE(customer_phone,'+',''),' ',''),'-','')=?)`,
      [keepId, primary.name, primary.phone, nowTs, tenantId, dupId, dupPhone]
    );

    // Reassign carwash_vehicles
    await db.execute(
      `UPDATE carwash_vehicles SET customer_id=?, customer_name=?, customer_phone=?, updated_at=?
       WHERE tenant_id=? AND deleted_at IS NULL AND (customer_id=? OR REPLACE(REPLACE(REPLACE(customer_phone,'+',''),' ',''),'-','')=?)`,
      [keepId, primary.name, primary.phone, nowTs, tenantId, dupId, dupPhone]
    );

    // Reassign carwash_appointments
    await db.execute(
      `UPDATE carwash_appointments SET customer_phone=?, customer_name=?, updated_at=?
       WHERE tenant_id=? AND deleted_at IS NULL AND REPLACE(REPLACE(REPLACE(customer_phone,'+',''),' ',''),'-','')=?`,
      [primary.phone, primary.name, nowTs, tenantId, dupPhone]
    );

    // Transfer loyalty points — add dup's points to primary's loyalty record
    const loyaltyRows = await db.select<any[]>(
      `SELECT total_points, redeemed_points FROM carwash_loyalty WHERE tenant_id=? AND customer_phone=? AND deleted_at IS NULL LIMIT 1`,
      [tenantId, dupPhone]
    );
    if (loyaltyRows.length > 0) {
      const pts = loyaltyRows[0].total_points - loyaltyRows[0].redeemed_points;
      if (pts > 0 && primary.phone) {
        await db.execute(
          `UPDATE carwash_loyalty SET total_points = total_points + ?, updated_at=? WHERE tenant_id=? AND customer_phone=? AND deleted_at IS NULL`,
          [pts, nowTs, tenantId, primary.phone.replace(/\D/g, '')]
        );
      }
      // Soft-delete dup loyalty record
      await db.execute(`UPDATE carwash_loyalty SET deleted_at=? WHERE tenant_id=? AND customer_phone=?`, [nowTs, tenantId, dupPhone]);
    }

    // Soft-delete duplicate customer
    await db.execute(`UPDATE customers SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`, [nowTs, nowTs, dupId, tenantId]);
  }
}
