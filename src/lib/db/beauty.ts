// [beauty] [all tenants]
import { getDb, uuid, now } from './index';

export interface BeautyService {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  gst_rate: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BeautyStaff {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  role: string;
  specialization: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BeautyAppointmentItem {
  id: string;
  appointment_id: string;
  service_id: string | null;
  service_name: string;
  price: number;
  gst_rate: number;
}

export interface BeautyAppointment {
  id: string;
  tenant_id: string;
  appointment_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  staff_id: string | null;
  staff_name: string | null;
  appointment_date: string;
  time_slot: string | null;
  status: string;
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
  created_at: string;
  items?: BeautyAppointmentItem[];
}

export interface BeautyMembership {
  id: string;
  tenant_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_id: string | null;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  amount_paid: number;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Services ────────────────────────────────────────────────────────────────

export async function listAllServices(tenantId: string): Promise<BeautyService[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM beauty_services WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY sort_order, category, name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: r.is_active === 1 }));
}

export async function listActiveServices(tenantId: string): Promise<BeautyService[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM beauty_services WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY sort_order, category, name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: true }));
}

export async function createService(tenantId: string, data: Omit<BeautyService, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO beauty_services (id, tenant_id, name, category, description, price, duration_minutes, gst_rate, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, data.name, data.category, data.description, data.price, data.duration_minutes, data.gst_rate, data.is_active ? 1 : 0, data.sort_order, now(), now()]
  );
  return id;
}

export async function updateService(tenantId: string, id: string, data: Partial<BeautyService>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE beauty_services SET name=?, category=?, description=?, price=?, duration_minutes=?, gst_rate=?, is_active=?, sort_order=?, updated_at=?
     WHERE id=? AND tenant_id=?`,
    [data.name, data.category, data.description, data.price, data.duration_minutes, data.gst_rate, data.is_active ? 1 : 0, data.sort_order, now(), id, tenantId]
  );
}

export async function deleteService(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE beauty_services SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

export async function seedDefaultServices(tenantId: string): Promise<void> {
  const defaults = [
    { name: 'Hair Cut (Ladies)', category: 'hair',   price: 200, duration_minutes: 45, sort_order: 1  },
    { name: 'Hair Cut (Gents)',  category: 'hair',   price: 100, duration_minutes: 30, sort_order: 2  },
    { name: 'Hair Color',        category: 'hair',   price: 800, duration_minutes: 90, sort_order: 3  },
    { name: 'Hair Spa',          category: 'hair',   price: 600, duration_minutes: 60, sort_order: 4  },
    { name: 'Hair Straightening',category: 'hair',   price: 1500,duration_minutes: 120,sort_order: 5  },
    { name: 'Facial (Basic)',    category: 'skin',   price: 500, duration_minutes: 60, sort_order: 10 },
    { name: 'Facial (Gold)',     category: 'skin',   price: 1200,duration_minutes: 75, sort_order: 11 },
    { name: 'Cleanup',           category: 'skin',   price: 300, duration_minutes: 45, sort_order: 12 },
    { name: 'Bleach',            category: 'skin',   price: 200, duration_minutes: 30, sort_order: 13 },
    { name: 'Waxing (Full Legs)',category: 'wax',    price: 400, duration_minutes: 45, sort_order: 20 },
    { name: 'Waxing (Full Arms)',category: 'wax',    price: 300, duration_minutes: 30, sort_order: 21 },
    { name: 'Full Body Wax',     category: 'wax',    price: 1200,duration_minutes: 90, sort_order: 22 },
    { name: 'Eyebrow Threading', category: 'thread', price: 50,  duration_minutes: 10, sort_order: 30 },
    { name: 'Upper Lip Threading',category:'thread', price: 30,  duration_minutes: 5,  sort_order: 31 },
    { name: 'Full Face Threading',category:'thread', price: 150, duration_minutes: 20, sort_order: 32 },
    { name: 'Manicure',          category: 'nails',  price: 300, duration_minutes: 45, sort_order: 40 },
    { name: 'Pedicure',          category: 'nails',  price: 400, duration_minutes: 60, sort_order: 41 },
    { name: 'Nail Art',          category: 'nails',  price: 200, duration_minutes: 30, sort_order: 42 },
    { name: 'Bridal Makeup',     category: 'makeup', price: 5000,duration_minutes: 120,sort_order: 50 },
    { name: 'Party Makeup',      category: 'makeup', price: 1500,duration_minutes: 60, sort_order: 51 },
    { name: 'Mehendi (Hands)',   category: 'mehendi',price: 300, duration_minutes: 60, sort_order: 60 },
    { name: 'Head Massage',      category: 'massage',price: 250, duration_minutes: 30, sort_order: 70 },
    { name: 'Body Massage',      category: 'massage',price: 800, duration_minutes: 60, sort_order: 71 },
  ];
  for (const svc of defaults) {
    await createService(tenantId, { ...svc, description: null, gst_rate: 18, is_active: true });
  }
}

// ── Staff ────────────────────────────────────────────────────────────────────

export async function listAllStaff(tenantId: string): Promise<BeautyStaff[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM beauty_staff WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: r.is_active === 1 }));
}

export async function listActiveStaff(tenantId: string): Promise<BeautyStaff[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM beauty_staff WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: true }));
}

export async function createStaff(tenantId: string, data: Omit<BeautyStaff, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO beauty_staff (id, tenant_id, name, phone, role, specialization, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, data.name, data.phone, data.role, data.specialization, data.is_active ? 1 : 0, now(), now()]
  );
  return id;
}

export async function updateStaff(tenantId: string, id: string, data: Partial<BeautyStaff>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE beauty_staff SET name=?, phone=?, role=?, specialization=?, is_active=?, updated_at=?
     WHERE id=? AND tenant_id=?`,
    [data.name, data.phone, data.role, data.specialization, data.is_active ? 1 : 0, now(), id, tenantId]
  );
}

export async function deleteStaff(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE beauty_staff SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Appointments ─────────────────────────────────────────────────────────────

async function nextAppointmentNumber(tenantId: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) as c FROM beauty_appointments WHERE tenant_id = ? AND deleted_at IS NULL`,
    [tenantId]
  );
  const seq = (rows[0]?.c ?? 0) + 1;
  return `APT${String(seq).padStart(4, '0')}`;
}

export async function createAppointment(
  tenantId: string,
  data: Omit<BeautyAppointment, 'id' | 'tenant_id' | 'appointment_number' | 'created_at' | 'updated_at' | 'items'>,
  items: Omit<BeautyAppointmentItem, 'id' | 'appointment_id'>[]
): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const apptNum = await nextAppointmentNumber(tenantId);
  await db.execute(
    `INSERT INTO beauty_appointments
     (id, tenant_id, appointment_number, customer_name, customer_phone, customer_id, staff_id, staff_name,
      appointment_date, time_slot, status, payment_method, payment_status,
      subtotal, discount, gst_amount, total, membership_id, notes, started_at, completed_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, apptNum, data.customer_name, data.customer_phone, data.customer_id,
     data.staff_id, data.staff_name, data.appointment_date, data.time_slot,
     data.status, data.payment_method, data.payment_status,
     data.subtotal, data.discount, data.gst_amount, data.total,
     data.membership_id, data.notes, data.started_at, data.completed_at, now(), now()]
  );
  for (const item of items) {
    await db.execute(
      `INSERT INTO beauty_appointment_items (id, tenant_id, appointment_id, service_id, service_name, price, gst_rate, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, id, item.service_id, item.service_name, item.price, item.gst_rate, now()]
    );
  }
  return id;
}

export async function listAppointments(tenantId: string, opts: { date?: string; status?: string } = {}): Promise<BeautyAppointment[]> {
  const db = await getDb();
  let sql = `SELECT a.*, GROUP_CONCAT(i.service_name, '|') as svc_names FROM beauty_appointments a
    LEFT JOIN beauty_appointment_items i ON i.appointment_id = a.id
    WHERE a.tenant_id = ? AND a.deleted_at IS NULL`;
  const params: any[] = [tenantId];
  if (opts.date) { sql += ` AND a.appointment_date = ?`; params.push(opts.date); }
  if (opts.status) { sql += ` AND a.status = ?`; params.push(opts.status); }
  sql += ` GROUP BY a.id ORDER BY a.created_at DESC`;
  const rows = await db.select<any[]>(sql, params);
  return rows.map(r => ({
    ...r,
    items: r.svc_names ? r.svc_names.split('|').map((n: string) => ({ service_name: n })) : [],
  }));
}

export async function getAppointmentWithItems(tenantId: string, id: string): Promise<BeautyAppointment | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM beauty_appointments WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`, [id, tenantId]
  );
  if (!rows.length) return null;
  const appt = rows[0];
  const items = await db.select<BeautyAppointmentItem[]>(
    `SELECT * FROM beauty_appointment_items WHERE appointment_id = ?`, [id]
  );
  return { ...appt, items };
}

export async function updateAppointmentStatus(tenantId: string, id: string, status: string): Promise<void> {
  const db = await getDb();
  const extra = status === 'in_progress' ? `, started_at = datetime('now')` : status === 'completed' ? `, completed_at = datetime('now')` : '';
  await db.execute(
    `UPDATE beauty_appointments SET status = ?, updated_at = ?${extra} WHERE id = ? AND tenant_id = ?`,
    [status, now(), id, tenantId]
  );
}

export async function updateAppointmentPayment(tenantId: string, id: string, payment_method: string, payment_status: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE beauty_appointments SET payment_method=?, payment_status=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [payment_method, payment_status, now(), id, tenantId]
  );
}

export async function deleteAppointment(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE beauty_appointments SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getTodayStats(tenantId: string): Promise<{
  revenue: number; completed: number; inProgress: number; pending: number; totalAppts: number;
}> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<any[]>(
    `SELECT status, SUM(total) as rev, COUNT(*) as cnt
     FROM beauty_appointments WHERE tenant_id=? AND appointment_date=? AND deleted_at IS NULL
     GROUP BY status`,
    [tenantId, today]
  );
  let revenue = 0, completed = 0, inProgress = 0, pending = 0, total = 0;
  for (const r of rows) {
    total += r.cnt;
    if (r.status === 'completed') { revenue += r.rev ?? 0; completed += r.cnt; }
    else if (r.status === 'in_progress') inProgress += r.cnt;
    else pending += r.cnt;
  }
  return { revenue, completed, inProgress, pending, totalAppts: total };
}

export async function getStaffPerformance(tenantId: string, date: string): Promise<{ staff_name: string; appts: number; revenue: number }[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT staff_name, COUNT(*) as appts, SUM(total) as revenue
     FROM beauty_appointments
     WHERE tenant_id=? AND appointment_date=? AND deleted_at IS NULL AND staff_name IS NOT NULL AND status='completed'
     GROUP BY staff_name ORDER BY appts DESC`,
    [tenantId, date]
  );
  return rows.map(r => ({ staff_name: r.staff_name, appts: r.appts, revenue: r.revenue ?? 0 }));
}

export async function getTopServices(tenantId: string, fromDate: string, toDate: string): Promise<{ service_name: string; count: number; revenue: number }[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT i.service_name, COUNT(*) as count, SUM(i.price) as revenue
     FROM beauty_appointment_items i
     JOIN beauty_appointments a ON a.id = i.appointment_id
     WHERE a.tenant_id=? AND a.appointment_date BETWEEN ? AND ? AND a.deleted_at IS NULL AND a.status='completed'
     GROUP BY i.service_name ORDER BY count DESC LIMIT 10`,
    [tenantId, fromDate, toDate]
  );
  return rows;
}

export async function getDailyRevenue(tenantId: string, fromDate: string, toDate: string): Promise<{ date: string; revenue: number; appts: number }[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT appointment_date as date, SUM(total) as revenue, COUNT(*) as appts
     FROM beauty_appointments
     WHERE tenant_id=? AND appointment_date BETWEEN ? AND ? AND deleted_at IS NULL AND status='completed'
     GROUP BY appointment_date ORDER BY appointment_date`,
    [tenantId, fromDate, toDate]
  );
  return rows;
}

// ── Memberships ───────────────────────────────────────────────────────────────

export async function listMemberships(tenantId: string): Promise<BeautyMembership[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM beauty_memberships WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, is_active: r.is_active === 1 }));
}

export async function createMembership(tenantId: string, data: Omit<BeautyMembership, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO beauty_memberships (id, tenant_id, customer_name, customer_phone, customer_id, package_name, total_sessions, used_sessions, amount_paid, valid_until, is_active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.customer_name, data.customer_phone, data.customer_id, data.package_name,
     data.total_sessions, data.used_sessions, data.amount_paid, data.valid_until, data.is_active ? 1 : 0, now(), now()]
  );
  return id;
}

export async function updateMembership(tenantId: string, id: string, data: Partial<BeautyMembership>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE beauty_memberships SET customer_name=?, customer_phone=?, package_name=?, total_sessions=?, used_sessions=?, amount_paid=?, valid_until=?, is_active=?, updated_at=?
     WHERE id=? AND tenant_id=?`,
    [data.customer_name, data.customer_phone, data.package_name, data.total_sessions, data.used_sessions, data.amount_paid, data.valid_until, data.is_active ? 1 : 0, now(), id, tenantId]
  );
}

export async function deleteMembership(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE beauty_memberships SET deleted_at=? WHERE id=? AND tenant_id=?`, [now(), id, tenantId]);
}
