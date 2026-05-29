// [laundry] [all tenants]
import { getDb, uuid, now } from './index';

export interface LaundryService {
  id: string;
  tenant_id: string;
  item_name: string;
  service_type: string;
  price: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface LaundryOrderItem {
  service_id: string;
  item_name: string;
  service_type: string;
  qty: number;
  price: number;
}

export interface LaundryOrder {
  id: string;
  tenant_id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  items: LaundryOrderItem[];
  total_amount: number;
  advance_paid: number;
  status: string;
  received_at: string;
  promised_date: string | null;
  delivered_at: string | null;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface LaundryExpense {
  id: string;
  tenant_id: string;
  description: string;
  amount: number;
  date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

function mapOrder(r: any): LaundryOrder {
  return { ...r, items: JSON.parse(r.items || '[]') };
}

// ── Services ─────────────────────────────────────────────────────────────────

export async function listLaundryServices(tenantId: string): Promise<LaundryService[]> {
  const db = await getDb();
  return db.select<LaundryService[]>(
    `SELECT * FROM laundry_services WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY item_name`,
    [tenantId]
  );
}

export async function saveLaundryService(tenantId: string, data: Omit<LaundryService, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, id?: string): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE laundry_services SET item_name=?, service_type=?, price=?, updated_at=? WHERE id=? AND tenant_id=?`,
      [data.item_name, data.service_type, data.price, now(), id, tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO laundry_services (id, tenant_id, item_name, service_type, price, updated_at) VALUES (?,?,?,?,?,?)`,
      [uuid(), tenantId, data.item_name, data.service_type, data.price, now()]
    );
  }
}

export async function deleteLaundryService(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE laundry_services SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function listLaundryOrders(tenantId: string, status?: string): Promise<LaundryOrder[]> {
  const db = await getDb();
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (status && status !== 'all') { conditions.push(`status = ?`); params.push(status); }
  const rows = await db.select<any[]>(
    `SELECT * FROM laundry_orders WHERE ${conditions.join(' AND ')} ORDER BY received_at DESC`,
    params
  );
  return rows.map(mapOrder);
}

export async function getLaundryOrder(tenantId: string, id: string): Promise<LaundryOrder | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM laundry_orders WHERE id=? AND tenant_id=? AND deleted_at IS NULL`, [id, tenantId]);
  return rows.length ? mapOrder(rows[0]) : null;
}

export async function createLaundryOrder(tenantId: string, data: Omit<LaundryOrder, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  // generate order_no
  const [{ cnt }] = await db.select<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM laundry_orders WHERE tenant_id=?`, [tenantId]);
  const orderNo = `LO-${String((cnt as number) + 1).padStart(4, '0')}`;
  await db.execute(
    `INSERT INTO laundry_orders (id, tenant_id, order_no, customer_name, customer_phone, items, total_amount, advance_paid, status, received_at, promised_date, delivered_at, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, orderNo, data.customer_name, data.customer_phone, JSON.stringify(data.items),
     data.total_amount, data.advance_paid, data.status, data.received_at,
     data.promised_date ?? null, data.delivered_at ?? null, data.notes, now()]
  );
  return id;
}

export async function updateLaundryOrderStatus(tenantId: string, id: string, status: string): Promise<void> {
  const db = await getDb();
  const deliveredAt = status === 'delivered' ? now() : null;
  await db.execute(
    `UPDATE laundry_orders SET status=?, delivered_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [status, deliveredAt, now(), id, tenantId]
  );
}

export async function deleteLaundryOrder(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE laundry_orders SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface LaundryStats {
  todayRevenue: number;
  pendingCount: number;
  readyCount: number;
  totalOrders: number;
  receivedCount: number;
  washingCount: number;
  dryingCount: number;
  deliveredCount: number;
}

export async function getLaundryStats(tenantId: string): Promise<LaundryStats> {
  const db = await getDb();
  const today = now().substring(0, 10);
  const [rev] = await db.select<{ r: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) as r FROM laundry_orders WHERE tenant_id=? AND date(received_at)=? AND deleted_at IS NULL AND status='delivered'`,
    [tenantId, today]
  );
  const rows = await db.select<{ status: string; cnt: number }[]>(
    `SELECT status, COUNT(*) as cnt FROM laundry_orders WHERE tenant_id=? AND deleted_at IS NULL GROUP BY status`,
    [tenantId]
  );
  const byStat: Record<string, number> = {};
  rows.forEach(r => { byStat[r.status] = r.cnt; });
  return {
    todayRevenue: rev?.r ?? 0,
    pendingCount: (byStat['received'] ?? 0) + (byStat['washing'] ?? 0) + (byStat['drying'] ?? 0),
    readyCount: byStat['ready'] ?? 0,
    totalOrders: rows.reduce((s, r) => s + r.cnt, 0),
    receivedCount: byStat['received'] ?? 0,
    washingCount: byStat['washing'] ?? 0,
    dryingCount: byStat['drying'] ?? 0,
    deliveredCount: byStat['delivered'] ?? 0,
  };
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listLaundryExpenses(tenantId: string): Promise<LaundryExpense[]> {
  const db = await getDb();
  return db.select<LaundryExpense[]>(
    `SELECT * FROM laundry_expenses WHERE tenant_id=? AND deleted_at IS NULL ORDER BY date DESC`,
    [tenantId]
  );
}

export async function saveLaundryExpense(tenantId: string, data: Omit<LaundryExpense, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, id?: string): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE laundry_expenses SET description=?, amount=?, date=?, updated_at=? WHERE id=? AND tenant_id=?`,
      [data.description, data.amount, data.date, now(), id, tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO laundry_expenses (id, tenant_id, description, amount, date, updated_at) VALUES (?,?,?,?,?,?)`,
      [uuid(), tenantId, data.description, data.amount, data.date, now()]
    );
  }
}

export async function deleteLaundryExpense(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE laundry_expenses SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getLaundryReportData(tenantId: string, fromDate: string, toDate: string) {
  const db = await getDb();
  const orders = await db.select<any[]>(
    `SELECT * FROM laundry_orders WHERE tenant_id=? AND date(received_at) BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY received_at DESC`,
    [tenantId, fromDate, toDate]
  );
  const expenses = await db.select<LaundryExpense[]>(
    `SELECT * FROM laundry_expenses WHERE tenant_id=? AND date BETWEEN ? AND ? AND deleted_at IS NULL`,
    [tenantId, fromDate, toDate]
  );
  return { orders: orders.map(mapOrder), expenses };
}
