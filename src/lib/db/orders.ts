import { getDb, uuid, now } from './index';
import { getNextBillNumber } from './config';
import { updateStock } from './products';

export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  mrp: number | null;
  discount: number;
  gst_rate: number;
  total: number;
  batch_no: string | null;
  expiry_date: string | null;
}

export interface Order {
  id: string;
  tenant_id: string;
  bill_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  patient_name: string | null;
  doctor_name: string | null;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  payment_method: string;
  payment_status: string;
  amount_paid: number;
  notes: string | null;
  order_date: string;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export async function createOrder(tenantId: string, data: {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  patient_name?: string | null;
  doctor_name?: string | null;
  items: Omit<OrderItem, 'id' | 'tenant_id' | 'order_id'>[];
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  payment_method: string;
  payment_status: string;
  amount_paid: number;
  notes?: string | null;
  order_date?: string;
}): Promise<Order> {
  const db = await getDb();
  const orderId = uuid();
  const billNumber = await getNextBillNumber(tenantId);
  const orderDate = data.order_date ?? now();

  await db.execute(
    `INSERT INTO orders (id, tenant_id, bill_number, customer_id, customer_name, customer_phone,
      patient_name, doctor_name, subtotal, discount, tax_total, total, payment_method,
      payment_status, amount_paid, notes, order_date)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orderId, tenantId, billNumber, data.customer_id ?? null, data.customer_name ?? null,
     data.customer_phone ?? null, data.patient_name ?? null, data.doctor_name ?? null,
     data.subtotal, data.discount, data.tax_total, data.total, data.payment_method,
     data.payment_status, data.amount_paid, data.notes ?? null, orderDate]
  );

  for (const item of data.items) {
    await db.execute(
      `INSERT INTO order_items (id, tenant_id, order_id, product_id, product_name, quantity,
        unit_price, mrp, discount, gst_rate, total, batch_no, expiry_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, orderId, item.product_id ?? null, item.product_name, item.quantity,
       item.unit_price, item.mrp ?? null, item.discount, item.gst_rate, item.total,
       item.batch_no ?? null, item.expiry_date ?? null]
    );
    // Deduct stock for each sold product
    if (item.product_id) {
      await updateStock(tenantId, item.product_id, -item.quantity);
      await db.execute(
        `INSERT INTO inventory_adjustments (id, tenant_id, product_id, quantity, type, reference_id)
         VALUES (?,?,?,?,?,?)`,
        [uuid(), tenantId, item.product_id, -item.quantity, 'sale', orderId]
      );
    }
  }

  const rows = await db.select<any[]>(`SELECT * FROM orders WHERE id = ?`, [orderId]);
  return rows[0] as Order;
}

export async function listOrders(tenantId: string, opts: {
  search?: string; page?: number; perPage?: number;
  from?: string; to?: string; paymentMethod?: string;
} = {}): Promise<{ items: Order[]; total: number }> {
  const db = await getDb();
  const { search = '', page = 1, perPage = 30, from, to, paymentMethod } = opts;
  const offset = (page - 1) * perPage;
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (search) { conditions.push(`(bill_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (from) { conditions.push(`order_date >= ?`); params.push(from); }
  if (to) { conditions.push(`order_date <= ?`); params.push(to + ' 23:59:59'); }
  if (paymentMethod) { conditions.push(`payment_method = ?`); params.push(paymentMethod); }
  const where = conditions.join(' AND ');
  const [{ total }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM orders WHERE ${where}`, params);
  const items = await db.select<any[]>(`SELECT * FROM orders WHERE ${where} ORDER BY order_date DESC LIMIT ? OFFSET ?`, [...params, perPage, offset]);
  return { items: items as Order[], total };
}

export async function getOrderWithItems(tenantId: string, orderId: string): Promise<Order | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM orders WHERE id = ? AND tenant_id = ?`, [orderId, tenantId]);
  if (!rows.length) return null;
  const order = rows[0] as Order;
  order.items = await db.select<OrderItem[]>(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);
  return order;
}

export async function voidOrder(tenantId: string, orderId: string): Promise<void> {
  const db = await getDb();
  const order = await getOrderWithItems(tenantId, orderId);
  if (!order) throw new Error('Order not found');
  await db.execute(`UPDATE orders SET payment_status = 'cancelled', deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), orderId, tenantId]);
  // Restore stock for each item
  for (const item of order.items ?? []) {
    if (item.product_id) {
      await updateStock(tenantId, item.product_id, item.quantity);
      await db.execute(
        `INSERT INTO inventory_adjustments (id, tenant_id, product_id, quantity, type, reference_id, notes)
         VALUES (?,?,?,?,?,?,?)`,
        [uuid(), tenantId, item.product_id, item.quantity, 'return', orderId, 'Order voided']
      );
    }
  }
}

export async function getSalesSummary(tenantId: string, from: string, to: string): Promise<{
  total_revenue: number; total_orders: number; total_tax: number; total_discount: number;
  by_payment: { payment_method: string; count: number; total: number }[];
}> {
  const db = await getDb();
  const base = `FROM orders WHERE tenant_id = ? AND deleted_at IS NULL AND order_date >= ? AND order_date <= ? AND payment_status != 'cancelled'`;
  const params = [tenantId, from, to + ' 23:59:59'];
  const [summary] = await db.select<any[]>(
    `SELECT COALESCE(SUM(total),0) as total_revenue, COUNT(*) as total_orders,
            COALESCE(SUM(tax_total),0) as total_tax, COALESCE(SUM(discount),0) as total_discount
     ${base}`, params
  );
  const by_payment = await db.select<any[]>(
    `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total),0) as total ${base} GROUP BY payment_method`, params
  );
  return { ...summary, by_payment };
}
