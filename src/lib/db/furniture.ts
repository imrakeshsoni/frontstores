// [furniture] [all tenants]
import { getDb, uuid, now } from './index';

export interface FurnProduct {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  material: string;
  dimensions: string;
  stock: number;
  purchase_price: number;
  selling_price: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface FurnOrder {
  id: string;
  tenant_id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: string;
  total_amount: number;
  advance_paid: number;
  delivery_date: string | null;
  delivered_at: string | null;
  status: string;
  notes: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface FurnCustomOrder {
  id: string;
  tenant_id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  description: string;
  wood_type: string;
  dimensions: string;
  estimated_cost: number;
  advance_paid: number;
  delivery_date: string | null;
  status: string;
  carpenter: string;
  updated_at: string | null;
  deleted_at: string | null;
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function listFurnProducts(tenantId: string, search = ''): Promise<FurnProduct[]> {
  const db = await getDb();
  if (search) {
    return db.select<FurnProduct[]>(
      `SELECT * FROM furn_products WHERE tenant_id=? AND deleted_at IS NULL AND (name LIKE ? OR category LIKE ? OR material LIKE ?) ORDER BY name`,
      [tenantId, `%${search}%`, `%${search}%`, `%${search}%`]
    );
  }
  return db.select<FurnProduct[]>(
    `SELECT * FROM furn_products WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`,
    [tenantId]
  );
}

export async function createFurnProduct(tenantId: string, data: Omit<FurnProduct, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<FurnProduct> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO furn_products (id, tenant_id, name, category, material, dimensions, stock, purchase_price, selling_price)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category, data.material, data.dimensions, data.stock, data.purchase_price, data.selling_price]
  );
  const rows = await db.select<FurnProduct[]>(`SELECT * FROM furn_products WHERE id=?`, [id]);
  return rows[0];
}

export async function updateFurnProduct(tenantId: string, id: string, data: Partial<FurnProduct>): Promise<void> {
  const db = await getDb();
  const allowed = ['name','category','material','dimensions','stock','purchase_price','selling_price'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) return;
  const setClause = [...fields.map(f => `${f}=?`), 'updated_at=?'].join(', ');
  await db.execute(
    `UPDATE furn_products SET ${setClause} WHERE id=? AND tenant_id=?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteFurnProduct(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE furn_products SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function listFurnOrders(tenantId: string, status?: string): Promise<FurnOrder[]> {
  const db = await getDb();
  if (status) {
    return db.select<FurnOrder[]>(
      `SELECT * FROM furn_orders WHERE tenant_id=? AND status=? AND deleted_at IS NULL ORDER BY delivery_date ASC`,
      [tenantId, status]
    );
  }
  return db.select<FurnOrder[]>(
    `SELECT * FROM furn_orders WHERE tenant_id=? AND deleted_at IS NULL ORDER BY delivery_date ASC`,
    [tenantId]
  );
}

export async function createFurnOrder(tenantId: string, data: Omit<FurnOrder, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at' | 'delivered_at'>): Promise<FurnOrder> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO furn_orders (id, tenant_id, order_no, customer_name, customer_phone, customer_address, items, total_amount, advance_paid, delivery_date, status, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.order_no, data.customer_name, data.customer_phone, data.customer_address,
     typeof data.items === 'string' ? data.items : JSON.stringify(data.items),
     data.total_amount, data.advance_paid, data.delivery_date ?? null, data.status, data.notes]
  );
  const rows = await db.select<FurnOrder[]>(`SELECT * FROM furn_orders WHERE id=?`, [id]);
  return rows[0];
}

export async function updateFurnOrder(tenantId: string, id: string, data: Partial<FurnOrder>): Promise<void> {
  const db = await getDb();
  const allowed = ['order_no','customer_name','customer_phone','customer_address','items','total_amount','advance_paid','delivery_date','delivered_at','status','notes'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) return;
  const vals = fields.map(f => {
    const v = (data as any)[f];
    return f === 'items' && typeof v !== 'string' ? JSON.stringify(v) : v;
  });
  const setClause = [...fields.map(f => `${f}=?`), 'updated_at=?'].join(', ');
  await db.execute(
    `UPDATE furn_orders SET ${setClause} WHERE id=? AND tenant_id=?`,
    [...vals, now(), id, tenantId]
  );
}

export async function deleteFurnOrder(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE furn_orders SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ── Custom Orders ─────────────────────────────────────────────────────────────

export async function listFurnCustomOrders(tenantId: string, status?: string): Promise<FurnCustomOrder[]> {
  const db = await getDb();
  if (status) {
    return db.select<FurnCustomOrder[]>(
      `SELECT * FROM furn_custom_orders WHERE tenant_id=? AND status=? AND deleted_at IS NULL ORDER BY delivery_date ASC`,
      [tenantId, status]
    );
  }
  return db.select<FurnCustomOrder[]>(
    `SELECT * FROM furn_custom_orders WHERE tenant_id=? AND deleted_at IS NULL ORDER BY delivery_date ASC`,
    [tenantId]
  );
}

export async function createFurnCustomOrder(tenantId: string, data: Omit<FurnCustomOrder, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<FurnCustomOrder> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO furn_custom_orders (id, tenant_id, order_no, customer_name, customer_phone, description, wood_type, dimensions, estimated_cost, advance_paid, delivery_date, status, carpenter)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.order_no, data.customer_name, data.customer_phone, data.description,
     data.wood_type, data.dimensions, data.estimated_cost, data.advance_paid,
     data.delivery_date ?? null, data.status, data.carpenter]
  );
  const rows = await db.select<FurnCustomOrder[]>(`SELECT * FROM furn_custom_orders WHERE id=?`, [id]);
  return rows[0];
}

export async function updateFurnCustomOrder(tenantId: string, id: string, data: Partial<FurnCustomOrder>): Promise<void> {
  const db = await getDb();
  const allowed = ['order_no','customer_name','customer_phone','description','wood_type','dimensions','estimated_cost','advance_paid','delivery_date','status','carpenter'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) return;
  const setClause = [...fields.map(f => `${f}=?`), 'updated_at=?'].join(', ');
  await db.execute(
    `UPDATE furn_custom_orders SET ${setClause} WHERE id=? AND tenant_id=?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteFurnCustomOrder(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE furn_custom_orders SET deleted_at=?, updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface FurnDashStats {
  pendingDeliveries: number;
  customOrdersInProgress: number;
  monthRevenue: number;
  totalProducts: number;
}

export async function getFurnStats(tenantId: string): Promise<FurnDashStats> {
  const db = await getDb();
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const [pending] = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM furn_orders WHERE tenant_id=? AND status != 'delivered' AND deleted_at IS NULL`,
    [tenantId]
  );
  const [inProg] = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM furn_custom_orders WHERE tenant_id=? AND status NOT IN ('delivered','cancelled') AND deleted_at IS NULL`,
    [tenantId]
  );
  const [rev] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) AS total FROM furn_orders WHERE tenant_id=? AND delivery_date >= ? AND deleted_at IS NULL`,
    [tenantId, monthStart]
  );
  const [prods] = await db.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM furn_products WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  return {
    pendingDeliveries: pending?.c ?? 0,
    customOrdersInProgress: inProg?.c ?? 0,
    monthRevenue: rev?.total ?? 0,
    totalProducts: prods?.c ?? 0,
  };
}
