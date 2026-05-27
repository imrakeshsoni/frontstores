import { getDb, uuid, now } from './index';
import { updateStock } from './products';

export interface InventoryBatch {
  id: string;
  tenant_id: string;
  product_id: string;
  batch_no: string | null;
  expiry_date: string | null;
  quantity: number;
  cost_price: number | null;
  purchase_date: string | null;
  supplier_id: string | null;
}

export interface InventoryAdjustment {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name?: string;
  batch_id: string | null;
  quantity: number;
  type: string;
  reference_id: string | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
}

export async function addStock(tenantId: string, data: {
  product_id: string;
  quantity: number;
  batch_no?: string;
  expiry_date?: string;
  cost_price?: number;
  supplier_id?: string;
  invoice_number?: string;
  challan_number?: string;
  notes?: string;
  type?: string;
}): Promise<void> {
  if (!data.quantity || data.quantity <= 0) throw new Error('Stock quantity must be greater than zero');
  const today = new Date().toISOString().substring(0, 10);
  if (data.expiry_date && data.expiry_date < today) {
    throw new Error(`Cannot add expired stock (expiry: ${data.expiry_date}). Expired medicines cannot be added to inventory.`);
  }
  const db = await getDb();
  const batchId = uuid();
  await db.execute(
    `INSERT INTO inventory_batches (id, tenant_id, product_id, batch_no, expiry_date, quantity, cost_price, purchase_date, supplier_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [batchId, tenantId, data.product_id, data.batch_no ?? null, data.expiry_date ?? null,
     data.quantity, data.cost_price ?? null, now(), data.supplier_id ?? null]
  );
  await updateStock(tenantId, data.product_id, data.quantity);
  await db.execute(
    `INSERT INTO inventory_adjustments (id, tenant_id, product_id, batch_id, quantity, type, invoice_number, challan_number, notes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.product_id, batchId, data.quantity, data.type ?? 'purchase',
     data.invoice_number ?? null, data.challan_number ?? null, data.notes ?? null]
  );
}

export async function adjustStock(tenantId: string, data: {
  product_id: string;
  quantity: number;
  direction: 'add' | 'remove';
  type: string;
  batch_no?: string;
  expiry_date?: string;
  invoice_number?: string;
  challan_number?: string;
  notes?: string;
}): Promise<void> {
  if (!data.quantity || data.quantity <= 0) throw new Error('Adjustment quantity must be greater than zero');
  const db = await getDb();
  const delta = data.direction === 'add' ? Math.abs(data.quantity) : -Math.abs(data.quantity);
  await updateStock(tenantId, data.product_id, delta);
  await db.execute(
    `INSERT INTO inventory_adjustments (id, tenant_id, product_id, quantity, type, invoice_number, challan_number, notes)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.product_id, delta, data.type, data.invoice_number ?? null, data.challan_number ?? null, data.notes ?? null]
  );
}

export async function getExpiryAlerts(tenantId: string, daysAhead = 90): Promise<any[]> {
  const db = await getDb();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + daysAhead);
  return db.select<any[]>(
    `SELECT ib.*, p.name as product_name, p.mrp
     FROM inventory_batches ib
     JOIN products p ON p.id = ib.product_id
     WHERE ib.tenant_id = ? AND ib.deleted_at IS NULL AND ib.quantity > 0
       AND ib.expiry_date IS NOT NULL AND ib.expiry_date <= ?
     ORDER BY ib.expiry_date ASC`,
    [tenantId, cutoff.toISOString().substring(0, 10)]
  );
}

export async function getBatchesWithChallan(tenantId: string, productId: string): Promise<any[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT ib.id, ib.batch_no, ib.expiry_date, ib.quantity, ib.cost_price, ib.purchase_date,
            ia.invoice_number, ia.created_at as received_at, ia.type,
            s.name as supplier_name
     FROM inventory_batches ib
     LEFT JOIN inventory_adjustments ia ON ia.batch_id = ib.id AND ia.type = 'purchase'
     LEFT JOIN suppliers s ON s.id = ia.supplier_id
     WHERE ib.tenant_id = ? AND ib.product_id = ? AND ib.deleted_at IS NULL AND ib.quantity > 0
     ORDER BY ib.expiry_date ASC NULLS LAST`,
    [tenantId, productId]
  );
}

export async function getLowStockAlerts(tenantId: string): Promise<any[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM products WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1
       AND stock_qty <= min_stock_qty ORDER BY stock_qty ASC`,
    [tenantId]
  );
}
