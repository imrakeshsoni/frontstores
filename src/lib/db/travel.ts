// [travel] [all tenants]
import { getDb, uuid, now } from './index';

export interface TrBooking {
  id: string; tenant_id: string;
  booking_no: string; customer_name: string; customer_phone: string;
  pax: number; trip_type: string; destination: string;
  departure_date: string; return_date: string | null;
  total_amount: number; advance_paid: number;
  status: string; notes: string; updated_at: string; deleted_at: string | null;
}

export interface TrPayment {
  id: string; tenant_id: string; booking_id: string;
  amount: number; payment_mode: string; date: string;
  updated_at: string; deleted_at: string | null;
}

export interface TrVisa {
  id: string; tenant_id: string; booking_id: string;
  customer_name: string; passport_no: string; visa_type: string;
  applied_date: string | null; status: string;
  approved_date: string | null; expiry_date: string | null;
  updated_at: string; deleted_at: string | null;
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function listBookings(tenantId: string, status?: string): Promise<TrBooking[]> {
  const db = await getDb();
  if (status) {
    return db.select<TrBooking[]>(`SELECT * FROM tr_bookings WHERE tenant_id = ? AND status = ? AND deleted_at IS NULL ORDER BY departure_date ASC`, [tenantId, status]);
  }
  return db.select<TrBooking[]>(`SELECT * FROM tr_bookings WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY departure_date ASC`, [tenantId]);
}

export async function getBooking(tenantId: string, id: string): Promise<TrBooking | null> {
  const db = await getDb();
  const rows = await db.select<TrBooking[]>(`SELECT * FROM tr_bookings WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  return rows[0] ?? null;
}

export async function createBooking(tenantId: string, data: Omit<TrBooking, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const no = `BK-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO tr_bookings (id,tenant_id,booking_no,customer_name,customer_phone,pax,trip_type,destination,departure_date,return_date,total_amount,advance_paid,status,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.booking_no || no, data.customer_name, data.customer_phone, data.pax, data.trip_type, data.destination, data.departure_date, data.return_date, data.total_amount, data.advance_paid, data.status, data.notes, now()]
  );
  return id;
}

export async function updateBooking(tenantId: string, id: string, data: Partial<TrBooking>): Promise<void> {
  const db = await getDb();
  const fields = ['customer_name','customer_phone','pax','trip_type','destination','departure_date','return_date','total_amount','advance_paid','status','notes'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE tr_bookings SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteBooking(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE tr_bookings SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function listBookingPayments(tenantId: string, bookingId: string): Promise<TrPayment[]> {
  const db = await getDb();
  return db.select<TrPayment[]>(`SELECT * FROM tr_payments WHERE tenant_id = ? AND booking_id = ? AND deleted_at IS NULL ORDER BY date DESC`, [tenantId, bookingId]);
}

export async function addBookingPayment(tenantId: string, data: Omit<TrPayment, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO tr_payments (id,tenant_id,booking_id,amount,payment_mode,date,updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, data.booking_id, data.amount, data.payment_mode, data.date, now()]);
  // Update advance_paid on booking
  await db.execute(`UPDATE tr_bookings SET advance_paid = advance_paid + ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [data.amount, now(), data.booking_id, tenantId]);
  return id;
}

// ── Visa ──────────────────────────────────────────────────────────────────────

export async function listVisas(tenantId: string): Promise<TrVisa[]> {
  const db = await getDb();
  return db.select<TrVisa[]>(`SELECT * FROM tr_visa WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY applied_date ASC`, [tenantId]);
}

export async function createVisa(tenantId: string, data: Omit<TrVisa, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO tr_visa (id,tenant_id,booking_id,customer_name,passport_no,visa_type,applied_date,status,approved_date,expiry_date,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.booking_id, data.customer_name, data.passport_no, data.visa_type, data.applied_date, data.status, data.approved_date, data.expiry_date, now()]);
  return id;
}

export async function updateVisa(tenantId: string, id: string, data: Partial<TrVisa>): Promise<void> {
  const db = await getDb();
  const fields = ['status','approved_date','expiry_date','passport_no','visa_type'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE tr_visa SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteVisa(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE tr_visa SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface TravelStats {
  departingThisWeek: number;
  pendingPayments: number;
  monthlyRevenue: number;
  totalBookings: number;
}

export async function getTravelStats(tenantId: string): Promise<TravelStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  const [{ total: departingThisWeek }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM tr_bookings WHERE tenant_id = ? AND deleted_at IS NULL AND departure_date BETWEEN ? AND ?`, [tenantId, today, weekEnd]);
  const rows = await db.select<{ total_amount: number; advance_paid: number }[]>(`SELECT total_amount, advance_paid FROM tr_bookings WHERE tenant_id = ? AND deleted_at IS NULL AND status != 'cancelled'`, [tenantId]);
  const pendingPayments = rows.reduce((s, r) => s + (r.total_amount - r.advance_paid), 0);
  const monthRows = await db.select<{ total_amount: number }[]>(`SELECT total_amount FROM tr_bookings WHERE tenant_id = ? AND deleted_at IS NULL AND departure_date BETWEEN ? AND ?`, [tenantId, monthStart, monthEnd]);
  const monthlyRevenue = monthRows.reduce((s, r) => s + r.total_amount, 0);
  const [{ total: totalBookings }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM tr_bookings WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
  return { departingThisWeek, pendingPayments, monthlyRevenue, totalBookings };
}
