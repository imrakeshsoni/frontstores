// [clothing] [all tenants]
import { getDb, uuid, now } from './index';

export interface ClProduct {
  id: string; tenant_id: string; name: string; category: string;
  brand: string; gender: string; variants: string;
  purchase_price: number; selling_price: number;
  updated_at: string | null; deleted_at: string | null;
}

export interface ClStock {
  id: string; tenant_id: string; product_id: string;
  size: string; color: string; quantity: number;
  updated_at: string | null; deleted_at: string | null;
}

export interface ClSale {
  id: string; tenant_id: string; bill_no: string;
  customer_name: string; customer_phone: string;
  total: number; discount: number; paid: number;
  payment_mode: string; sale_date: string;
  updated_at: string | null; deleted_at: string | null;
}

export interface ClSaleItem {
  id: string; tenant_id: string; sale_id: string;
  product_id: string; product_name: string;
  size: string; color: string; quantity: number;
  rate: number; amount: number;
  updated_at: string | null; deleted_at: string | null;
}

export interface ClExchange {
  id: string; tenant_id: string;
  original_sale_id: string; customer_name: string;
  customer_phone: string; reason: string;
  returned_item: string; exchange_item: string;
  date: string; amount_diff: number;
  updated_at: string | null; deleted_at: string | null;
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function listClProducts(tenantId: string, search = ''): Promise<ClProduct[]> {
  const db = await getDb();
  const where = search
    ? `tenant_id = ? AND deleted_at IS NULL AND (name LIKE ? OR brand LIKE ? OR category LIKE ?)`
    : `tenant_id = ? AND deleted_at IS NULL`;
  const params = search ? [tenantId, `%${search}%`, `%${search}%`, `%${search}%`] : [tenantId];
  return db.select<ClProduct[]>(`SELECT * FROM cl_products WHERE ${where} ORDER BY name`, params);
}

export async function createClProduct(tenantId: string, data: Omit<ClProduct, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO cl_products (id, tenant_id, name, category, brand, gender, variants, purchase_price, selling_price, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category, data.brand, data.gender, data.variants, data.purchase_price, data.selling_price, now()]
  );
  return id;
}

export async function updateClProduct(tenantId: string, id: string, data: Partial<ClProduct>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'tenant_id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  await db.execute(
    `UPDATE cl_products SET ${set}, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [...fields.map(f => (data as any)[f]), now(), id, tenantId]
  );
}

export async function deleteClProduct(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE cl_products SET deleted_at = datetime('now') WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
}

// ── Stock ─────────────────────────────────────────────────────────────────────

export async function listClStock(tenantId: string, productId?: string): Promise<ClStock[]> {
  const db = await getDb();
  if (productId) {
    return db.select<ClStock[]>(
      `SELECT * FROM cl_stock WHERE tenant_id = ? AND product_id = ? AND deleted_at IS NULL ORDER BY size, color`,
      [tenantId, productId]
    );
  }
  return db.select<ClStock[]>(
    `SELECT * FROM cl_stock WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY size, color`,
    [tenantId]
  );
}

export async function upsertClStock(tenantId: string, productId: string, size: string, color: string, quantity: number): Promise<void> {
  const db = await getDb();
  const existing = await db.select<ClStock[]>(
    `SELECT id FROM cl_stock WHERE tenant_id = ? AND product_id = ? AND size = ? AND color = ? AND deleted_at IS NULL`,
    [tenantId, productId, size, color]
  );
  if (existing.length) {
    await db.execute(
      `UPDATE cl_stock SET quantity = ?, updated_at = ? WHERE id = ?`,
      [quantity, now(), existing[0].id]
    );
  } else {
    await db.execute(
      `INSERT INTO cl_stock (id, tenant_id, product_id, size, color, quantity, updated_at) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), tenantId, productId, size, color, quantity, now()]
    );
  }
}

export async function getLowClStock(tenantId: string, threshold = 3): Promise<(ClStock & { product_name: string })[]> {
  const db = await getDb();
  return db.select<(ClStock & { product_name: string })[]>(
    `SELECT s.*, p.name AS product_name FROM cl_stock s
     JOIN cl_products p ON p.id = s.product_id
     WHERE s.tenant_id = ? AND s.deleted_at IS NULL AND p.deleted_at IS NULL AND s.quantity <= ?
     ORDER BY s.quantity`,
    [tenantId, threshold]
  );
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function createClSale(tenantId: string, sale: Omit<ClSale, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>, items: Omit<ClSaleItem, 'id' | 'tenant_id' | 'sale_id' | 'updated_at' | 'deleted_at'>[]): Promise<string> {
  const db = await getDb();
  const saleId = uuid();
  await db.execute(
    `INSERT INTO cl_sales (id, tenant_id, bill_no, customer_name, customer_phone, total, discount, paid, payment_mode, sale_date, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [saleId, tenantId, sale.bill_no, sale.customer_name, sale.customer_phone, sale.total, sale.discount, sale.paid, sale.payment_mode, sale.sale_date, now()]
  );
  for (const item of items) {
    await db.execute(
      `INSERT INTO cl_sale_items (id, tenant_id, sale_id, product_id, product_name, size, color, quantity, rate, amount, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, saleId, item.product_id, item.product_name, item.size, item.color, item.quantity, item.rate, item.amount, now()]
    );
    // Deduct stock
    const st = await db.select<ClStock[]>(
      `SELECT id, quantity FROM cl_stock WHERE tenant_id = ? AND product_id = ? AND size = ? AND color = ? AND deleted_at IS NULL LIMIT 1`,
      [tenantId, item.product_id, item.size, item.color]
    );
    if (st.length) {
      await db.execute(`UPDATE cl_stock SET quantity = MAX(0, quantity - ?), updated_at = ? WHERE id = ?`, [item.quantity, now(), st[0].id]);
    }
  }
  return saleId;
}

export async function listClSales(tenantId: string, dateFrom?: string, dateTo?: string): Promise<ClSale[]> {
  const db = await getDb();
  let where = `tenant_id = ? AND deleted_at IS NULL`;
  const params: any[] = [tenantId];
  if (dateFrom) { where += ` AND date(sale_date) >= date(?)`; params.push(dateFrom); }
  if (dateTo) { where += ` AND date(sale_date) <= date(?)`; params.push(dateTo); }
  return db.select<ClSale[]>(`SELECT * FROM cl_sales WHERE ${where} ORDER BY sale_date DESC`, params);
}

export async function getClSaleItems(tenantId: string, saleId: string): Promise<ClSaleItem[]> {
  const db = await getDb();
  return db.select<ClSaleItem[]>(`SELECT * FROM cl_sale_items WHERE tenant_id = ? AND sale_id = ? AND deleted_at IS NULL`, [tenantId, saleId]);
}

// ── Exchanges ─────────────────────────────────────────────────────────────────

export async function createClExchange(tenantId: string, data: Omit<ClExchange, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO cl_exchanges (id, tenant_id, original_sale_id, customer_name, customer_phone, reason, returned_item, exchange_item, date, amount_diff, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.original_sale_id, data.customer_name, data.customer_phone, data.reason, data.returned_item, data.exchange_item, data.date, data.amount_diff, now()]
  );
  return id;
}

export async function listClExchanges(tenantId: string): Promise<ClExchange[]> {
  const db = await getDb();
  return db.select<ClExchange[]>(`SELECT * FROM cl_exchanges WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY date DESC`, [tenantId]);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getClothingStats(tenantId: string) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const [todaySales] = await db.select<{ total: number; count: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM cl_sales WHERE tenant_id = ? AND date(sale_date) = date(?) AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [monthSales] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total FROM cl_sales WHERE tenant_id = ? AND strftime('%Y-%m', sale_date) = strftime('%Y-%m','now') AND deleted_at IS NULL`,
    [tenantId]
  );
  const [products] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM cl_products WHERE tenant_id = ? AND deleted_at IS NULL`,
    [tenantId]
  );
  const [lowStock] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM cl_stock WHERE tenant_id = ? AND deleted_at IS NULL AND quantity <= 3`,
    [tenantId]
  );
  const [exchanges] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM cl_exchanges WHERE tenant_id = ? AND date(date) = date(?) AND deleted_at IS NULL`,
    [tenantId, today]
  );
  return {
    todayRevenue: todaySales.total,
    todayBills: todaySales.count,
    monthRevenue: monthSales.total,
    totalProducts: products.count,
    lowStockVariants: lowStock.count,
    todayExchanges: exchanges.count,
  };
}

export async function getTopClothingProducts(tenantId: string, limit = 5): Promise<{ product_name: string; qty: number; revenue: number }[]> {
  const db = await getDb();
  return db.select<{ product_name: string; qty: number; revenue: number }[]>(
    `SELECT product_name, SUM(quantity) as qty, SUM(amount) as revenue FROM cl_sale_items
     WHERE tenant_id = ? AND deleted_at IS NULL
     GROUP BY product_name ORDER BY revenue DESC LIMIT ?`,
    [tenantId, limit]
  );
}
