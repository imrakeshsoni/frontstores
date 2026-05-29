// [tailor] [all tenants]
import { getDb, uuid, now } from './index';

export interface TailorCustomer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  measurements: Record<string, string>;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface TailorOrder {
  id: string;
  tenant_id: string;
  customer_id: string;
  customer_name?: string;
  order_no: string;
  item_type: string;
  description: string;
  fabric_by: 'customer' | 'shop';
  fabric_meters: number;
  fabric_desc: string;
  measurements: Record<string, string>;
  advance_paid: number;
  total_amount: number;
  status: 'received' | 'cutting' | 'stitching' | 'ready' | 'delivered';
  delivery_date: string | null;
  delivered_at: string | null;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface TailorExpense {
  id: string;
  tenant_id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface TailorStats {
  todayDeliveries: number;
  receivedCount: number;
  cuttingCount: number;
  stitchingCount: number;
  readyCount: number;
  deliveredCount: number;
  monthRevenue: number;
  pendingBalance: number;
}

// ─── Customers ───────────────────────────────────────────────────────────────

function mapTailorCustomer(r: any): TailorCustomer {
  return { ...r, measurements: JSON.parse(r.measurements || '{}') };
}

export async function listTailorCustomers(
  tenantId: string,
  opts: { search?: string } = {}
): Promise<TailorCustomer[]> {
  const db = await getDb();
  const { search = '' } = opts;
  if (search) {
    const rows = await db.select<any[]>(
      `SELECT * FROM tailor_customers WHERE tenant_id=? AND deleted_at IS NULL
       AND (name LIKE ? OR phone LIKE ?) ORDER BY name`,
      [tenantId, `%${search}%`, `%${search}%`]
    );
    return rows.map(mapTailorCustomer);
  }
  const rows = await db.select<any[]>(
    `SELECT * FROM tailor_customers WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
  return rows.map(mapTailorCustomer);
}

export async function getTailorCustomer(tenantId: string, id: string): Promise<TailorCustomer | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM tailor_customers WHERE id=? AND tenant_id=? AND deleted_at IS NULL LIMIT 1`,
    [id, tenantId]
  );
  return rows.length ? mapTailorCustomer(rows[0]) : null;
}

export async function saveTailorCustomer(
  tenantId: string,
  data: Partial<TailorCustomer> & { name: string }
): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE tailor_customers SET name=?,phone=?,measurements=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone ?? '', JSON.stringify(data.measurements ?? {}), data.notes ?? '', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO tailor_customers(id,tenant_id,name,phone,measurements,notes) VALUES(?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone ?? '', JSON.stringify(data.measurements ?? {}), data.notes ?? '']
  );
  return id;
}

export async function deleteTailorCustomer(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tailor_customers SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function mapTailorOrder(r: any): TailorOrder {
  return {
    ...r,
    measurements: JSON.parse(r.measurements || '{}'),
    fabric_meters: Number(r.fabric_meters),
    advance_paid: Number(r.advance_paid),
    total_amount: Number(r.total_amount),
  };
}

export async function listTailorOrders(
  tenantId: string,
  opts: { status?: string; search?: string } = {}
): Promise<TailorOrder[]> {
  const db = await getDb();
  const conditions = [`o.tenant_id=?`, `o.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.status) { conditions.push(`o.status=?`); params.push(opts.status); }
  if (opts.search) {
    conditions.push(`(o.order_no LIKE ? OR o.item_type LIKE ? OR c.name LIKE ?)`);
    params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`);
  }
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT o.*, c.name as customer_name FROM tailor_orders o
     LEFT JOIN tailor_customers c ON c.id=o.customer_id
     WHERE ${where} ORDER BY o.delivery_date ASC, o.updated_at DESC`,
    params
  );
  return rows.map(mapTailorOrder);
}

export async function getTailorOrder(tenantId: string, id: string): Promise<TailorOrder | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT o.*, c.name as customer_name FROM tailor_orders o
     LEFT JOIN tailor_customers c ON c.id=o.customer_id
     WHERE o.id=? AND o.tenant_id=? AND o.deleted_at IS NULL LIMIT 1`,
    [id, tenantId]
  );
  return rows.length ? mapTailorOrder(rows[0]) : null;
}

export async function saveTailorOrder(
  tenantId: string,
  data: Partial<TailorOrder> & { customer_id: string; item_type: string }
): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE tailor_orders SET customer_id=?,order_no=?,item_type=?,description=?,
       fabric_by=?,fabric_meters=?,fabric_desc=?,measurements=?,advance_paid=?,total_amount=?,
       status=?,delivery_date=?,delivered_at=?,notes=?,updated_at=?
       WHERE id=? AND tenant_id=?`,
      [
        data.customer_id, data.order_no ?? '', data.item_type, data.description ?? '',
        data.fabric_by ?? 'customer', data.fabric_meters ?? 0, data.fabric_desc ?? '',
        JSON.stringify(data.measurements ?? {}), data.advance_paid ?? 0, data.total_amount ?? 0,
        data.status ?? 'received', data.delivery_date ?? null, data.delivered_at ?? null,
        data.notes ?? '', now(), data.id, tenantId,
      ]
    );
    return data.id;
  }
  const id = uuid();
  // generate order_no if not provided
  const orderNo = data.order_no || `T${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO tailor_orders(id,tenant_id,customer_id,order_no,item_type,description,
     fabric_by,fabric_meters,fabric_desc,measurements,advance_paid,total_amount,
     status,delivery_date,delivered_at,notes)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, tenantId, data.customer_id, orderNo, data.item_type, data.description ?? '',
      data.fabric_by ?? 'customer', data.fabric_meters ?? 0, data.fabric_desc ?? '',
      JSON.stringify(data.measurements ?? {}), data.advance_paid ?? 0, data.total_amount ?? 0,
      data.status ?? 'received', data.delivery_date ?? null, data.delivered_at ?? null,
      data.notes ?? '',
    ]
  );
  return id;
}

export async function updateTailorOrderStatus(
  tenantId: string,
  id: string,
  status: TailorOrder['status']
): Promise<void> {
  const db = await getDb();
  const deliveredAt = status === 'delivered' ? now() : null;
  await db.execute(
    `UPDATE tailor_orders SET status=?,delivered_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [status, deliveredAt, now(), id, tenantId]
  );
}

export async function deleteTailorOrder(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tailor_orders SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function listTailorExpenses(
  tenantId: string,
  opts: { month?: string } = {}
): Promise<TailorExpense[]> {
  const db = await getDb();
  if (opts.month) {
    const rows = await db.select<TailorExpense[]>(
      `SELECT * FROM tailor_expenses WHERE tenant_id=? AND deleted_at IS NULL
       AND strftime('%Y-%m', date)=? ORDER BY date DESC`,
      [tenantId, opts.month]
    );
    return rows;
  }
  const rows = await db.select<TailorExpense[]>(
    `SELECT * FROM tailor_expenses WHERE tenant_id=? AND deleted_at IS NULL ORDER BY date DESC`,
    [tenantId]
  );
  return rows;
}

export async function saveTailorExpense(
  tenantId: string,
  data: Partial<TailorExpense> & { description: string; date: string }
): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE tailor_expenses SET description=?,amount=?,category=?,date=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.description, data.amount ?? 0, data.category ?? 'general', data.date, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO tailor_expenses(id,tenant_id,description,amount,category,date) VALUES(?,?,?,?,?,?)`,
    [id, tenantId, data.description, data.amount ?? 0, data.category ?? 'general', data.date]
  );
  return id;
}

export async function deleteTailorExpense(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tailor_expenses SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getTailorStats(tenantId: string): Promise<TailorStats> {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  const monthStr = today.slice(0, 7);

  const [todayDel] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM tailor_orders WHERE tenant_id=? AND deleted_at IS NULL
     AND delivery_date=? AND status != 'delivered'`,
    [tenantId, today]
  );
  const statusCounts = await db.select<{ status: string; cnt: number }[]>(
    `SELECT status, COUNT(*) as cnt FROM tailor_orders WHERE tenant_id=? AND deleted_at IS NULL GROUP BY status`,
    [tenantId]
  );
  const [revenue] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) as total FROM tailor_orders
     WHERE tenant_id=? AND deleted_at IS NULL AND strftime('%Y-%m', COALESCE(delivered_at, updated_at))=?`,
    [tenantId, monthStr]
  );
  const [pending] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total_amount - advance_paid),0) as total FROM tailor_orders
     WHERE tenant_id=? AND deleted_at IS NULL AND status != 'delivered'`,
    [tenantId]
  );

  const sc: Record<string, number> = {};
  statusCounts.forEach(r => { sc[r.status] = r.cnt; });

  return {
    todayDeliveries: todayDel.cnt,
    receivedCount: sc['received'] ?? 0,
    cuttingCount: sc['cutting'] ?? 0,
    stitchingCount: sc['stitching'] ?? 0,
    readyCount: sc['ready'] ?? 0,
    deliveredCount: sc['delivered'] ?? 0,
    monthRevenue: Number(revenue?.total ?? 0),
    pendingBalance: Number(pending?.total ?? 0),
  };
}
