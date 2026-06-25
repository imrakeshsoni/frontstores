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

// [medical] [all tenants] — Draw down per-batch stock when a sale is made. Previously sales
// only reduced products.stock_qty, leaving inventory_batches untouched, so the POS billing
// search (which sums batch quantities) over-reported availability by everything ever sold.
// Sells from the exact batch the bill recorded first, then spills over FEFO (earliest expiry).
export async function deductBatchStock(
  tenantId: string, productId: string, quantity: number,
  batchNo?: string | null, expiryDate?: string | null,
): Promise<void> {
  if (!quantity || quantity <= 0) return;
  const db = await getDb();
  const exact = batchNo
    ? await db.select<{ id: string; quantity: number }[]>(
        `SELECT id, quantity FROM inventory_batches
         WHERE tenant_id = ? AND product_id = ? AND batch_no = ?
           AND COALESCE(expiry_date,'') = COALESCE(?, '') AND deleted_at IS NULL AND quantity > 0`,
        [tenantId, productId, batchNo, expiryDate ?? null])
    : [];
  const fefo = await db.select<{ id: string; quantity: number }[]>(
    `SELECT id, quantity FROM inventory_batches
     WHERE tenant_id = ? AND product_id = ? AND deleted_at IS NULL AND quantity > 0
     ORDER BY expiry_date ASC`,
    [tenantId, productId]
  );
  const seen = new Set<string>();
  const ordered = [...exact, ...fefo].filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
  let remaining = quantity;
  for (const b of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.quantity);
    await db.execute(`UPDATE inventory_batches SET quantity = quantity - ?, updated_at = ? WHERE id = ?`, [take, now(), b.id]);
    remaining -= take;
  }
}

// [medical] [all tenants] — Put batch stock back when a bill is voided (mirror of deductBatchStock).
export async function restoreBatchStock(
  tenantId: string, productId: string, quantity: number,
  batchNo?: string | null, expiryDate?: string | null,
): Promise<void> {
  if (!quantity || quantity <= 0) return;
  const db = await getDb();
  let target = batchNo
    ? (await db.select<{ id: string }[]>(
        `SELECT id FROM inventory_batches WHERE tenant_id = ? AND product_id = ? AND batch_no = ?
           AND COALESCE(expiry_date,'') = COALESCE(?, '') AND deleted_at IS NULL LIMIT 1`,
        [tenantId, productId, batchNo, expiryDate ?? null]))[0]
    : undefined;
  if (!target) {
    target = (await db.select<{ id: string }[]>(
      `SELECT id FROM inventory_batches WHERE tenant_id = ? AND product_id = ? AND deleted_at IS NULL ORDER BY expiry_date ASC LIMIT 1`,
      [tenantId, productId]))[0];
  }
  if (target) await db.execute(`UPDATE inventory_batches SET quantity = quantity + ?, updated_at = ? WHERE id = ?`, [quantity, now(), target.id]);
}

// [medical] [all tenants] — One-time/self-healing reconcile of historic drift: where the sum of a
// product's batch quantities exceeds its (authoritative, net) stock_qty, draw the excess down FEFO
// so the POS search matches the Inventory page. Idempotent — once aligned it does nothing, and it
// never increases batches or touches stock_qty.
export async function reconcileBatchStock(tenantId: string): Promise<void> {
  const db = await getDb();
  const drifted = await db.select<{ product_id: string; stock_qty: number; batch_sum: number }[]>(
    `SELECT p.id AS product_id, p.stock_qty AS stock_qty, SUM(b.quantity) AS batch_sum
     FROM products p
     JOIN inventory_batches b ON b.product_id = p.id AND b.deleted_at IS NULL AND b.quantity > 0
     WHERE p.tenant_id = ? AND p.deleted_at IS NULL
     GROUP BY p.id HAVING batch_sum > p.stock_qty`,
    [tenantId]
  );
  for (const row of drifted) {
    let excess = row.batch_sum - Math.max(row.stock_qty, 0);
    const batches = await db.select<{ id: string; quantity: number }[]>(
      `SELECT id, quantity FROM inventory_batches WHERE tenant_id = ? AND product_id = ? AND deleted_at IS NULL AND quantity > 0 ORDER BY expiry_date ASC`,
      [tenantId, row.product_id]
    );
    for (const b of batches) {
      if (excess <= 0) break;
      const take = Math.min(excess, b.quantity);
      await db.execute(`UPDATE inventory_batches SET quantity = quantity - ?, updated_at = ? WHERE id = ?`, [take, now(), b.id]);
      excess -= take;
    }
  }
}

export async function getExpiryAlerts(tenantId: string, daysAhead = 90): Promise<any[]> {
  const db = await getDb();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + daysAhead);
  return db.select<any[]>(
    `SELECT ib.*, p.name as product_name, p.mrp, s.name as supplier_name
     FROM inventory_batches ib
     JOIN products p ON p.id = ib.product_id
     LEFT JOIN suppliers s ON s.id = ib.supplier_id
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
