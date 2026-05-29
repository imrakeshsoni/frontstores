// [catering] [all tenants]
import { getDb, uuid, now } from './index';

export interface CateringMenuItem {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  price_per_plate: number;
  min_order: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface CateringEventMenuItem {
  menu_item_id: string;
  name: string;
  category: string;
  price_per_plate: number;
  qty: number;
}

export interface CateringEvent {
  id: string;
  tenant_id: string;
  event_no: string;
  customer_name: string;
  customer_phone: string;
  event_type: string;
  event_date: string;
  venue: string;
  guest_count: number;
  menu: CateringEventMenuItem[];
  total_amount: number;
  advance_paid: number;
  status: string;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface CateringStaffAssignment {
  id: string;
  tenant_id: string;
  event_id: string;
  staff_name: string;
  role: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface CateringExpense {
  id: string;
  tenant_id: string;
  event_id: string;
  description: string;
  amount: number;
  date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

function mapEvent(r: any): CateringEvent {
  return { ...r, menu: JSON.parse(r.menu || '[]') };
}

// ── Menu Items ────────────────────────────────────────────────────────────────

export async function listCateringMenuItems(tenantId: string): Promise<CateringMenuItem[]> {
  const db = await getDb();
  return db.select<CateringMenuItem[]>(
    `SELECT * FROM catering_menu_items WHERE tenant_id=? AND deleted_at IS NULL ORDER BY category, name`,
    [tenantId]
  );
}

export async function saveCateringMenuItem(tenantId: string, data: Omit<CateringMenuItem, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, id?: string): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE catering_menu_items SET name=?, category=?, price_per_plate=?, min_order=?, updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.category, data.price_per_plate, data.min_order, now(), id, tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO catering_menu_items (id, tenant_id, name, category, price_per_plate, min_order, updated_at) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.name, data.category, data.price_per_plate, data.min_order, now()]
    );
  }
}

export async function deleteCateringMenuItem(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE catering_menu_items SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function listCateringEvents(tenantId: string, status?: string): Promise<CateringEvent[]> {
  const db = await getDb();
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (status && status !== 'all') { conditions.push(`status = ?`); params.push(status); }
  const rows = await db.select<any[]>(
    `SELECT * FROM catering_events WHERE ${conditions.join(' AND ')} ORDER BY event_date DESC`,
    params
  );
  return rows.map(mapEvent);
}

export async function getCateringEvent(tenantId: string, id: string): Promise<CateringEvent | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM catering_events WHERE id=? AND tenant_id=? AND deleted_at IS NULL`, [id, tenantId]);
  return rows.length ? mapEvent(rows[0]) : null;
}

export async function createCateringEvent(tenantId: string, data: Omit<CateringEvent, 'id' | 'tenant_id' | 'event_no' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const [{ cnt }] = await db.select<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM catering_events WHERE tenant_id=?`, [tenantId]);
  const eventNo = `CE-${String((cnt as number) + 1).padStart(4, '0')}`;
  await db.execute(
    `INSERT INTO catering_events (id, tenant_id, event_no, customer_name, customer_phone, event_type, event_date, venue, guest_count, menu, total_amount, advance_paid, status, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, eventNo, data.customer_name, data.customer_phone, data.event_type,
     data.event_date, data.venue, data.guest_count, JSON.stringify(data.menu),
     data.total_amount, data.advance_paid, data.status, data.notes, now()]
  );
  return id;
}

export async function updateCateringEvent(tenantId: string, id: string, data: Partial<CateringEvent>): Promise<void> {
  const db = await getDb();
  const menu = data.menu !== undefined ? JSON.stringify(data.menu) : undefined;
  await db.execute(
    `UPDATE catering_events SET customer_name=?, customer_phone=?, event_type=?, event_date=?, venue=?, guest_count=?, menu=?, total_amount=?, advance_paid=?, status=?, notes=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.customer_name, data.customer_phone, data.event_type, data.event_date, data.venue,
     data.guest_count, menu, data.total_amount, data.advance_paid, data.status, data.notes, now(), id, tenantId]
  );
}

export async function deleteCateringEvent(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE catering_events SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Staff Assignments ─────────────────────────────────────────────────────────

export async function listStaffForEvent(tenantId: string, eventId: string): Promise<CateringStaffAssignment[]> {
  const db = await getDb();
  return db.select<CateringStaffAssignment[]>(
    `SELECT * FROM catering_staff_assignments WHERE tenant_id=? AND event_id=? AND deleted_at IS NULL`,
    [tenantId, eventId]
  );
}

export async function addStaffAssignment(tenantId: string, eventId: string, staffName: string, role: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO catering_staff_assignments (id, tenant_id, event_id, staff_name, role, updated_at) VALUES (?,?,?,?,?,?)`,
    [uuid(), tenantId, eventId, staffName, role, now()]
  );
}

export async function removeStaffAssignment(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE catering_staff_assignments SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface CateringStats {
  monthRevenue: number;
  upcomingThisWeek: number;
  pendingAdvances: number;
  confirmedCount: number;
  pendingCount: number;
  totalEvents: number;
}

export async function getCateringStats(tenantId: string): Promise<CateringStats> {
  const db = await getDb();
  const today = now().substring(0, 10);
  const monthStart = today.substring(0, 7) + '-01';
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);

  const [rev] = await db.select<{ r: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) as r FROM catering_events WHERE tenant_id=? AND date(event_date) >= ? AND status='completed' AND deleted_at IS NULL`,
    [tenantId, monthStart]
  );
  const [upcomingRow] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM catering_events WHERE tenant_id=? AND date(event_date) BETWEEN ? AND ? AND status IN ('confirmed','inquiry') AND deleted_at IS NULL`,
    [tenantId, today, weekEnd]
  );
  const [advRow] = await db.select<{ a: number }[]>(
    `SELECT COALESCE(SUM(total_amount - advance_paid),0) as a FROM catering_events WHERE tenant_id=? AND status='confirmed' AND deleted_at IS NULL`,
    [tenantId]
  );
  const statusRows = await db.select<{ status: string; cnt: number }[]>(
    `SELECT status, COUNT(*) as cnt FROM catering_events WHERE tenant_id=? AND deleted_at IS NULL GROUP BY status`,
    [tenantId]
  );
  const byStat: Record<string, number> = {};
  statusRows.forEach(r => { byStat[r.status] = r.cnt; });

  return {
    monthRevenue: rev?.r ?? 0,
    upcomingThisWeek: upcomingRow?.cnt ?? 0,
    pendingAdvances: advRow?.a ?? 0,
    confirmedCount: byStat['confirmed'] ?? 0,
    pendingCount: byStat['inquiry'] ?? 0,
    totalEvents: statusRows.reduce((s, r) => s + r.cnt, 0),
  };
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listCateringExpenses(tenantId: string): Promise<CateringExpense[]> {
  const db = await getDb();
  return db.select<CateringExpense[]>(
    `SELECT * FROM catering_expenses WHERE tenant_id=? AND deleted_at IS NULL ORDER BY date DESC`,
    [tenantId]
  );
}

export async function saveCateringExpense(tenantId: string, data: Omit<CateringExpense, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, id?: string): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE catering_expenses SET event_id=?, description=?, amount=?, date=?, updated_at=? WHERE id=? AND tenant_id=?`,
      [data.event_id, data.description, data.amount, data.date, now(), id, tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO catering_expenses (id, tenant_id, event_id, description, amount, date, updated_at) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.event_id, data.description, data.amount, data.date, now()]
    );
  }
}

export async function deleteCateringExpense(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE catering_expenses SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getCateringReportData(tenantId: string, fromDate: string, toDate: string) {
  const db = await getDb();
  const events = await db.select<any[]>(
    `SELECT * FROM catering_events WHERE tenant_id=? AND date(event_date) BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY event_date`,
    [tenantId, fromDate, toDate]
  );
  return { events: events.map(mapEvent) };
}
