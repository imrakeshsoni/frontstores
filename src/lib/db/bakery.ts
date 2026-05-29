// [bakery] [all tenants]
import { getDb, uuid, now } from './index';

export interface BkProduct {
  id: string; tenant_id: string; name: string; category: string;
  unit: string; selling_price: number; production_cost: number;
  shelf_life_hours: number;
  updated_at: string | null; deleted_at: string | null;
}

export interface BkProduction {
  id: string; tenant_id: string; product_id: string; product_name: string;
  quantity: number; production_date: string; expiry_at: string | null;
  cost: number; notes: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface BkSale {
  id: string; tenant_id: string; bill_no: string; customer_name: string;
  total: number; payment_mode: string; sale_date: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface BkSaleItem {
  id: string; tenant_id: string; sale_id: string;
  product_id: string; product_name: string;
  quantity: number; unit: string; rate: number; amount: number;
  updated_at: string | null; deleted_at: string | null;
}

export interface BkBulkOrder {
  id: string; tenant_id: string; customer_name: string; customer_phone: string;
  event_type: string; items: string; delivery_date: string;
  advance_paid: number; total_amount: number; status: string; notes: string;
  updated_at: string | null; deleted_at: string | null;
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function listBkProducts(tenantId: string, search = ''): Promise<BkProduct[]> {
  const db = await getDb();
  const where = search
    ? `tenant_id = ? AND deleted_at IS NULL AND (name LIKE ? OR category LIKE ?)`
    : `tenant_id = ? AND deleted_at IS NULL`;
  const params = search ? [tenantId, `%${search}%`, `%${search}%`] : [tenantId];
  return db.select<BkProduct[]>(`SELECT * FROM bk_products WHERE ${where} ORDER BY category, name`, params);
}

export async function createBkProduct(tenantId: string, data: Omit<BkProduct, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO bk_products (id, tenant_id, name, category, unit, selling_price, production_cost, shelf_life_hours, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category, data.unit, data.selling_price, data.production_cost, data.shelf_life_hours, now()]
  );
  return id;
}

export async function updateBkProduct(tenantId: string, id: string, data: Partial<BkProduct>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'tenant_id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.execute(
    `UPDATE bk_products SET ${set}, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteBkProduct(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE bk_products SET deleted_at = datetime('now') WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
}

// ── Production ────────────────────────────────────────────────────────────────

export async function logBkProduction(tenantId: string, data: Omit<BkProduction, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO bk_production (id, tenant_id, product_id, product_name, quantity, production_date, expiry_at, cost, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.product_id, data.product_name, data.quantity, data.production_date, data.expiry_at ?? null, data.cost, data.notes, now()]
  );
  return id;
}

export async function listBkProduction(tenantId: string, date?: string): Promise<BkProduction[]> {
  const db = await getDb();
  const where = date
    ? `tenant_id = ? AND date(production_date) = date(?) AND deleted_at IS NULL`
    : `tenant_id = ? AND deleted_at IS NULL`;
  const params = date ? [tenantId, date] : [tenantId];
  return db.select<BkProduction[]>(`SELECT * FROM bk_production WHERE ${where} ORDER BY production_date DESC`, params);
}

export async function getExpiringBkItems(tenantId: string, withinHours = 4): Promise<BkProduction[]> {
  const db = await getDb();
  return db.select<BkProduction[]>(
    `SELECT * FROM bk_production WHERE tenant_id = ? AND deleted_at IS NULL
     AND expiry_at IS NOT NULL AND datetime(expiry_at) <= datetime('now', '+' || ? || ' hours')
     AND datetime(expiry_at) > datetime('now')
     ORDER BY expiry_at`,
    [tenantId, withinHours]
  );
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function createBkSale(tenantId: string, sale: Omit<BkSale, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, items: Omit<BkSaleItem, 'id' | 'tenant_id' | 'sale_id' | 'updated_at' | 'deleted_at'>[]): Promise<string> {
  const db = await getDb();
  const saleId = uuid();
  await db.execute(
    `INSERT INTO bk_sales (id, tenant_id, bill_no, customer_name, total, payment_mode, sale_date, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [saleId, tenantId, sale.bill_no, sale.customer_name, sale.total, sale.payment_mode, sale.sale_date, now()]
  );
  for (const item of items) {
    await db.execute(
      `INSERT INTO bk_sale_items (id, tenant_id, sale_id, product_id, product_name, quantity, unit, rate, amount, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, saleId, item.product_id, item.product_name, item.quantity, item.unit, item.rate, item.amount, now()]
    );
  }
  return saleId;
}

export async function listBkSales(tenantId: string, dateFrom?: string, dateTo?: string): Promise<BkSale[]> {
  const db = await getDb();
  let where = `tenant_id = ? AND deleted_at IS NULL`;
  const params: any[] = [tenantId];
  if (dateFrom) { where += ` AND date(sale_date) >= date(?)`; params.push(dateFrom); }
  if (dateTo) { where += ` AND date(sale_date) <= date(?)`; params.push(dateTo); }
  return db.select<BkSale[]>(`SELECT * FROM bk_sales WHERE ${where} ORDER BY sale_date DESC`, params);
}

export async function getBkSaleItems(tenantId: string, saleId: string): Promise<BkSaleItem[]> {
  const db = await getDb();
  return db.select<BkSaleItem[]>(`SELECT * FROM bk_sale_items WHERE tenant_id = ? AND sale_id = ? AND deleted_at IS NULL`, [tenantId, saleId]);
}

// ── Bulk Orders ───────────────────────────────────────────────────────────────

export async function listBkBulkOrders(tenantId: string, status?: string): Promise<BkBulkOrder[]> {
  const db = await getDb();
  const where = status
    ? `tenant_id = ? AND status = ? AND deleted_at IS NULL`
    : `tenant_id = ? AND deleted_at IS NULL`;
  const params = status ? [tenantId, status] : [tenantId];
  return db.select<BkBulkOrder[]>(`SELECT * FROM bk_bulk_orders WHERE ${where} ORDER BY delivery_date`, params);
}

export async function createBkBulkOrder(tenantId: string, data: Omit<BkBulkOrder, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO bk_bulk_orders (id, tenant_id, customer_name, customer_phone, event_type, items, delivery_date, advance_paid, total_amount, status, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.customer_name, data.customer_phone, data.event_type, data.items, data.delivery_date, data.advance_paid, data.total_amount, data.status, data.notes, now()]
  );
  return id;
}

export async function updateBkBulkOrder(tenantId: string, id: string, data: Partial<BkBulkOrder>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'tenant_id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.execute(
    `UPDATE bk_bulk_orders SET ${set}, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteBkBulkOrder(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE bk_bulk_orders SET deleted_at = datetime('now') WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getBakeryStats(tenantId: string) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [todaySales] = await db.select<{ total: number; count: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM bk_sales WHERE tenant_id = ? AND date(sale_date) = date(?) AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [todayProd] = await db.select<{ count: number; qty: number }[]>(
    `SELECT COUNT(*) as count, COALESCE(SUM(quantity),0) as qty FROM bk_production WHERE tenant_id = ? AND date(production_date) = date(?) AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [bulkDueToday] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM bk_bulk_orders WHERE tenant_id = ? AND date(delivery_date) = date(?) AND deleted_at IS NULL AND status != 'delivered'`,
    [tenantId, today]
  );
  const expiringItems = await getExpiringBkItems(tenantId, 4);
  return {
    todayRevenue: todaySales.total,
    todayBills: todaySales.count,
    todayProductionBatches: todayProd.count,
    todayProductionQty: todayProd.qty,
    bulkOrdersDueToday: bulkDueToday.count,
    expiringItemsCount: expiringItems.length,
  };
}

export async function getTopBakeryProducts(tenantId: string, limit = 5): Promise<{ product_name: string; qty: number; revenue: number }[]> {
  const db = await getDb();
  return db.select<{ product_name: string; qty: number; revenue: number }[]>(
    `SELECT product_name, SUM(quantity) as qty, SUM(amount) as revenue FROM bk_sale_items
     WHERE tenant_id = ? AND deleted_at IS NULL
     GROUP BY product_name ORDER BY revenue DESC LIMIT ?`,
    [tenantId, limit]
  );
}
