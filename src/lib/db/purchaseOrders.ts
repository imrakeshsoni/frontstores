import { getDb, uuid, now } from './index';

export interface PurchaseOrder {
  id: string; tenant_id: string; po_number: string;
  supplier_id: string | null; supplier_name: string | null;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  subtotal: number; tax_total: number; total: number;
  notes: string | null; ordered_at: string | null; received_at: string | null;
  created_at: string; updated_at: string;
}
export interface POItem {
  id: string; tenant_id: string; po_id: string;
  product_id: string | null; product_name: string;
  quantity: number; unit_price: number; gst_rate: number; total: number;
  received_qty: number; batch_no: string | null; expiry_date: string | null;
}

async function nextPONumber(tenantId: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ n: number }[]>(
    `SELECT COUNT(*) as n FROM purchase_orders WHERE tenant_id = ?`, [tenantId]
  );
  return `PO-${String((rows[0]?.n ?? 0) + 1).padStart(4, '0')}`;
}

export async function createPO(tenantId: string, data: {
  supplier_id?: string; supplier_name?: string; notes?: string;
  items: { product_id?: string; product_name: string; quantity: number; unit_price: number; gst_rate: number; batch_no?: string; expiry_date?: string }[];
}): Promise<PurchaseOrder> {
  const db = await getDb();
  const id = uuid();
  const poNumber = await nextPONumber(tenantId);
  let subtotal = 0, taxTotal = 0;
  for (const item of data.items) {
    const itemTotal = item.quantity * item.unit_price;
    subtotal += itemTotal;
    taxTotal += itemTotal * (item.gst_rate / 100);
  }
  const total = subtotal + taxTotal;
  await db.execute(
    `INSERT INTO purchase_orders (id,tenant_id,po_number,supplier_id,supplier_name,status,subtotal,tax_total,total,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,'draft',?,?,?,?,?,?)`,
    [id, tenantId, poNumber, data.supplier_id ?? null, data.supplier_name ?? null, subtotal, taxTotal, total, data.notes ?? null, now(), now()]
  );
  for (const item of data.items) {
    const itemTotal = item.quantity * item.unit_price * (1 + item.gst_rate / 100);
    await db.execute(
      `INSERT INTO purchase_order_items (id,tenant_id,po_id,product_id,product_name,quantity,unit_price,gst_rate,total,batch_no,expiry_date,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, id, item.product_id ?? null, item.product_name, item.quantity, item.unit_price, item.gst_rate, itemTotal, item.batch_no ?? null, item.expiry_date ?? null, now(), now()]
    );
  }
  const rows = await db.select<PurchaseOrder[]>(`SELECT * FROM purchase_orders WHERE id = ?`, [id]);
  return rows[0];
}

export async function listPOs(tenantId: string, opts: { status?: string; perPage?: number; page?: number } = {}): Promise<{ items: PurchaseOrder[]; total: number }> {
  const db = await getDb();
  const { status, perPage = 50, page = 1 } = opts;
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: unknown[] = [tenantId];
  if (status) { conditions.push(`status = ?`); params.push(status); }
  const where = conditions.join(' AND ');
  const [{ total }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM purchase_orders WHERE ${where}`, params);
  const items = await db.select<PurchaseOrder[]>(
    `SELECT * FROM purchase_orders WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage]
  );
  return { items, total };
}

export async function getPOItems(poId: string): Promise<POItem[]> {
  const db = await getDb();
  return db.select<POItem[]>(`SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY created_at ASC`, [poId]);
}

export async function updatePOStatus(tenantId: string, id: string, status: PurchaseOrder['status']): Promise<void> {
  const db = await getDb();
  const extra = status === 'ordered' ? `, ordered_at = ?` : status === 'received' ? `, received_at = ?` : '';
  const params: unknown[] = status === 'ordered' || status === 'received' ? [status, now(), now(), id] : [status, now(), id];
  await db.execute(`UPDATE purchase_orders SET status = ?${extra}, updated_at = ? WHERE id = ?`, params);
}

export async function deletePO(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE purchase_orders SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}
