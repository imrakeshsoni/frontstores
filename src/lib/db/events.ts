// [events] [all tenants]
import { getDb, uuid, now } from './index';

export interface EvEvent {
  id: string; tenant_id: string;
  event_no: string; client_name: string; client_phone: string;
  event_type: string; event_date: string; venue: string;
  guest_count: number; quoted_amount: number; advance_paid: number;
  status: string; notes: string; updated_at: string; deleted_at: string | null;
}

export interface EvTask {
  id: string; tenant_id: string; event_id: string;
  task_name: string; assigned_to: string; due_date: string | null;
  status: string; updated_at: string; deleted_at: string | null;
}

export interface EvVendor {
  id: string; tenant_id: string;
  name: string; category: string; phone: string; notes: string;
  updated_at: string; deleted_at: string | null;
}

export interface EvExpense {
  id: string; tenant_id: string; event_id: string;
  description: string; amount: number; date: string;
  updated_at: string; deleted_at: string | null;
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function listEvents(tenantId: string, status?: string): Promise<EvEvent[]> {
  const db = await getDb();
  if (status) {
    return db.select<EvEvent[]>(`SELECT * FROM ev_events WHERE tenant_id = ? AND status = ? AND deleted_at IS NULL ORDER BY event_date ASC`, [tenantId, status]);
  }
  return db.select<EvEvent[]>(`SELECT * FROM ev_events WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY event_date ASC`, [tenantId]);
}

export async function getEvent(tenantId: string, id: string): Promise<EvEvent | null> {
  const db = await getDb();
  const rows = await db.select<EvEvent[]>(`SELECT * FROM ev_events WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  return rows[0] ?? null;
}

export async function createEvent(tenantId: string, data: Omit<EvEvent, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const no = `EV-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO ev_events (id,tenant_id,event_no,client_name,client_phone,event_type,event_date,venue,guest_count,quoted_amount,advance_paid,status,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.event_no || no, data.client_name, data.client_phone, data.event_type, data.event_date, data.venue, data.guest_count, data.quoted_amount, data.advance_paid, data.status, data.notes, now()]
  );
  return id;
}

export async function updateEvent(tenantId: string, id: string, data: Partial<EvEvent>): Promise<void> {
  const db = await getDb();
  const fields = ['client_name','client_phone','event_type','event_date','venue','guest_count','quoted_amount','advance_paid','status','notes'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ev_events SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteEvent(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ev_events SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Event Tasks ───────────────────────────────────────────────────────────────

export async function listEventTasks(tenantId: string, eventId: string): Promise<EvTask[]> {
  const db = await getDb();
  return db.select<EvTask[]>(`SELECT * FROM ev_tasks WHERE tenant_id = ? AND event_id = ? AND deleted_at IS NULL ORDER BY due_date ASC`, [tenantId, eventId]);
}

export async function createEventTask(tenantId: string, data: Omit<EvTask, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO ev_tasks (id,tenant_id,event_id,task_name,assigned_to,due_date,status,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.event_id, data.task_name, data.assigned_to, data.due_date, data.status, now()]
  );
  return id;
}

export async function updateEventTask(tenantId: string, id: string, status: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ev_tasks SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [status, now(), id, tenantId]);
}

export async function deleteEventTask(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ev_tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export async function listVendors(tenantId: string, category?: string): Promise<EvVendor[]> {
  const db = await getDb();
  if (category) {
    return db.select<EvVendor[]>(`SELECT * FROM ev_vendors WHERE tenant_id = ? AND category = ? AND deleted_at IS NULL ORDER BY name`, [tenantId, category]);
  }
  return db.select<EvVendor[]>(`SELECT * FROM ev_vendors WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
}

export async function createVendor(tenantId: string, data: Omit<EvVendor, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO ev_vendors (id,tenant_id,name,category,phone,notes,updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category, data.phone, data.notes, now()]);
  return id;
}

export async function updateVendor(tenantId: string, id: string, data: Partial<EvVendor>): Promise<void> {
  const db = await getDb();
  const fields = ['name','category','phone','notes'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE ev_vendors SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteVendor(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ev_vendors SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listEventExpenses(tenantId: string, eventId: string): Promise<EvExpense[]> {
  const db = await getDb();
  return db.select<EvExpense[]>(`SELECT * FROM ev_expenses WHERE tenant_id = ? AND event_id = ? AND deleted_at IS NULL ORDER BY date DESC`, [tenantId, eventId]);
}

export async function createEventExpense(tenantId: string, data: Omit<EvExpense, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(`INSERT INTO ev_expenses (id,tenant_id,event_id,description,amount,date,updated_at) VALUES (?,?,?,?,?,?,?)`,
    [id, tenantId, data.event_id, data.description, data.amount, data.date, now()]);
  return id;
}

export async function deleteEventExpense(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE ev_expenses SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface EventStats {
  upcomingThisMonth: number;
  tasksDueToday: number;
  totalRevenue: number;
  pendingBalance: number;
}

export async function getEventStats(tenantId: string): Promise<EventStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  const [{ total: upcomingThisMonth }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ev_events WHERE tenant_id = ? AND deleted_at IS NULL AND status IN ('inquiry','confirmed') AND event_date BETWEEN ? AND ?`, [tenantId, today, monthEnd]);
  const [{ total: tasksDueToday }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM ev_tasks WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending' AND due_date = ?`, [tenantId, today]);
  const rows = await db.select<{ quoted_amount: number; advance_paid: number }[]>(`SELECT quoted_amount, advance_paid FROM ev_events WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'completed'`, [tenantId]);
  const totalRevenue = rows.reduce((s, r) => s + r.quoted_amount, 0);
  const pendingBalance = rows.reduce((s, r) => s + (r.quoted_amount - r.advance_paid), 0);
  return { upcomingThisMonth, tasksDueToday, totalRevenue, pendingBalance };
}
