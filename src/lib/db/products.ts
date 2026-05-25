import { getDb, uuid, now } from './index';

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  description: string | null;
  unit: string;
  mrp: number;
  selling_price: number;
  cost_price: number | null;
  gst_rate: number;
  hsn_code: string | null;
  dosage_form: string | null;
  salt_composition: string | null;
  manufacturer: string | null;
  requires_prescription: boolean;
  total_units: number | null;
  ml_volume: string | null;
  stock_qty: number;
  min_stock_qty: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapProduct(r: any): Product {
  return { ...r, requires_prescription: r.requires_prescription === 1, is_active: r.is_active === 1 };
}

export async function listProducts(tenantId: string, opts: {
  search?: string; page?: number; perPage?: number; lowStock?: boolean;
} = {}): Promise<{ items: Product[]; total: number }> {
  const db = await getDb();
  const { search = '', page = 1, perPage = 50, lowStock = false } = opts;
  const offset = (page - 1) * perPage;
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`, `is_active = 1`];
  const params: any[] = [tenantId];
  if (search) { conditions.push(`(name LIKE ? OR barcode = ? OR sku LIKE ? OR salt_composition LIKE ? OR manufacturer LIKE ?)`); params.push(`%${search}%`, search, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (lowStock) { conditions.push(`stock_qty <= min_stock_qty`); }
  const where = conditions.join(' AND ');
  const [{ total }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM products WHERE ${where}`, params);
  const items = await db.select<any[]>(`SELECT * FROM products WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`, [...params, perPage, offset]);
  return { items: items.map(mapProduct), total };
}

export async function searchProductsForPOS(tenantId: string, search: string): Promise<(Product & { batchDetails: any[] })[]> {
  const db = await getDb();
  const params: any[] = [tenantId];
  const searchCondition = search
    ? `AND (p.name LIKE ? OR p.barcode = ? OR p.sku LIKE ? OR p.salt_composition LIKE ? OR p.manufacturer LIKE ?)`
    : '';
  if (search) params.push(`%${search}%`, search, `%${search}%`, `%${search}%`, `%${search}%`);

  const products = await db.select<any[]>(
    `SELECT * FROM products p
     WHERE p.tenant_id = ? AND p.deleted_at IS NULL AND p.is_active = 1
     ${searchCondition}
     ORDER BY p.name LIMIT 50`,
    params
  );

  if (products.length === 0) return [];

  const productIds = products.map(p => p.id);
  const placeholders = productIds.map(() => '?').join(',');
  const batches = await db.select<any[]>(
    `SELECT id, product_id, batch_no as batchNo, expiry_date as expiry,
            quantity, cost_price, purchase_date as manufactureDate
     FROM inventory_batches
     WHERE tenant_id = ? AND product_id IN (${placeholders})
       AND deleted_at IS NULL AND quantity > 0
     ORDER BY expiry_date ASC NULLS LAST`,
    [tenantId, ...productIds]
  );

  const batchMap: Record<string, any[]> = {};
  for (const b of batches) {
    if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
    batchMap[b.product_id].push(b);
  }

  return products.map(p => ({ ...mapProduct(p), batchDetails: batchMap[p.id] ?? [] }));
}

export async function getProductByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM products WHERE tenant_id = ? AND barcode = ? AND deleted_at IS NULL LIMIT 1`, [tenantId, barcode]);
  return rows.length ? mapProduct(rows[0]) : null;
}

export async function createProduct(tenantId: string, data: Omit<Product, 'id' | 'tenant_id' | 'stock_qty' | 'created_at' | 'updated_at'>): Promise<Product> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO products (id, tenant_id, name, sku, barcode, category, brand, description,
      unit, mrp, selling_price, cost_price, gst_rate, hsn_code, dosage_form, salt_composition,
      manufacturer, requires_prescription, total_units, ml_volume, min_stock_qty, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.sku ?? null, data.barcode ?? null, data.category ?? null,
     data.brand ?? null, data.description ?? null, data.unit, data.mrp, data.selling_price,
     data.cost_price ?? null, data.gst_rate, data.hsn_code ?? null, data.dosage_form ?? null,
     data.salt_composition ?? null, data.manufacturer ?? null, data.requires_prescription ? 1 : 0,
     data.total_units ?? null, data.ml_volume ?? null, data.min_stock_qty, data.is_active ? 1 : 0]
  );
  const rows = await db.select<any[]>(`SELECT * FROM products WHERE id = ?`, [id]);
  return mapProduct(rows[0]);
}

const PRODUCT_UPDATE_FIELDS = new Set([
  'name','sku','barcode','category','brand','description','unit',
  'mrp','selling_price','cost_price','gst_rate','hsn_code',
  'dosage_form','salt_composition','manufacturer','requires_prescription',
  'total_units','ml_volume','min_stock_qty','is_active','updated_at',
]);

export async function updateProduct(tenantId: string, id: string, data: Partial<Product>): Promise<void> {
  const db = await getDb();
  const safe: Record<string, unknown> = { updated_at: now() };
  for (const [k, v] of Object.entries(data)) {
    if (PRODUCT_UPDATE_FIELDS.has(k)) safe[k] = v;
  }
  if ('requires_prescription' in safe) safe.requires_prescription = safe.requires_prescription ? 1 : 0;
  if ('is_active' in safe) safe.is_active = safe.is_active ? 1 : 0;
  const fields = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  await db.execute(`UPDATE products SET ${fields} WHERE id = ? AND tenant_id = ?`, [...Object.values(safe), id, tenantId]);
}

export async function deleteProduct(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

export async function updateStock(tenantId: string, productId: string, delta: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [delta, now(), productId, tenantId]
  );
}
