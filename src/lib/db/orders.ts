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
  hsn_code: string | null;
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
  order_date: string;   // invoice date — editable by the shopkeeper
  sale_date: string;    // actual sale date/time — set once, never edited (audit record)
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
  const today = now().substring(0, 10);

  // Validate each item before touching the DB
  for (const item of data.items) {
    if (item.unit_price < 0) throw new Error(`Invalid price for "${item.product_name}"`);
    if (item.quantity <= 0)  throw new Error(`Invalid quantity for "${item.product_name}"`);
    if (item.expiry_date && item.expiry_date < today) {
      throw new Error(`"${item.product_name}" (batch ${item.batch_no ?? 'N/A'}) has expired and cannot be sold`);
    }
  }

  // Recalculate totals from items — never trust client-supplied totals
  let calcSubtotal = 0;
  let calcTaxTotal = 0;
  let calcDiscount = 0;
  const lineItems = data.items.map((item) => {
    const gross      = round2(item.unit_price * item.quantity);
    const disc       = round2(Math.max(0, Math.min(item.discount ?? 0, gross)));
    const net        = round2(gross - disc);
    const tax        = round2(net * ((item.gst_rate ?? 0) / 100));
    const lineTotal  = round2(net + tax);
    calcSubtotal += net;
    calcTaxTotal += tax;
    calcDiscount += disc;
    return { ...item, discount: disc, total: lineTotal };
  });
  const calcTotal = round2(calcSubtotal + calcTaxTotal);
  calcSubtotal    = round2(calcSubtotal);
  calcTaxTotal    = round2(calcTaxTotal);
  calcDiscount    = round2(calcDiscount);

  // Credit limit check — fetch customer's current balance + limit
  if (data.payment_method === 'credit' && data.customer_id) {
    const [cust] = await db.select<{ credit_limit: number }[]>(
      'SELECT credit_limit FROM customers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [data.customer_id, tenantId]
    );
    if (cust && cust.credit_limit > 0) {
      const [bal] = await db.select<{ balance: number }[]>(
        `SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END), 0) AS balance
         FROM khata_entries WHERE tenant_id = ? AND customer_id = ? AND deleted_at IS NULL`,
        [tenantId, data.customer_id]
      );
      const currentBalance = bal?.balance ?? 0;
      if (currentBalance + calcTotal > cust.credit_limit) {
        throw new Error(
          `Credit limit exceeded. Limit: ₹${cust.credit_limit}, Used: ₹${currentBalance.toFixed(2)}, New total: ₹${calcTotal}`
        );
      }
    }
  }

  // Insert order and items — tauri-plugin-sql uses a connection pool so
  // BEGIN/COMMIT span different connections and deadlock. Each execute auto-commits.
  const orderId    = uuid();
  const billNumber = await getNextBillNumber(tenantId);
  const saleDate   = now();                       // actual sell time — immutable audit record
  const orderDate  = data.order_date ?? saleDate; // invoice date — may be adjusted later

  await db.execute(
    `INSERT INTO orders (id, tenant_id, bill_number, customer_id, customer_name, customer_phone,
      patient_name, doctor_name, subtotal, discount, tax_total, total, payment_method,
      payment_status, amount_paid, notes, order_date, sale_date)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orderId, tenantId, billNumber, data.customer_id ?? null, data.customer_name ?? null,
     data.customer_phone ?? null, data.patient_name ?? null, data.doctor_name ?? null,
     calcSubtotal, calcDiscount, calcTaxTotal, calcTotal, data.payment_method,
     data.payment_status, data.amount_paid, data.notes ?? null, orderDate, saleDate]
  );

  for (const item of lineItems) {
    await db.execute(
      `INSERT INTO order_items (id, tenant_id, order_id, product_id, product_name, quantity,
        unit_price, mrp, discount, gst_rate, total, batch_no, expiry_date, hsn_code)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, orderId, item.product_id ?? null, item.product_name, item.quantity,
       item.unit_price, item.mrp ?? null, item.discount, item.gst_rate, item.total,
       item.batch_no ?? null, item.expiry_date ?? null, item.hsn_code ?? null]
    );
    if (item.product_id) {
      await updateStock(tenantId, item.product_id, -item.quantity);
      await db.execute(
        `INSERT INTO inventory_adjustments (id, tenant_id, product_id, quantity, type, reference_id)
         VALUES (?,?,?,?,?,?)`,
        [uuid(), tenantId, item.product_id, -item.quantity, 'sale', orderId]
      );
    }
  }

  // [medical] [all tenants] — a credit bill is money the customer now owes. Post it to
  // the Khata ledger as a debit so the outstanding shows up on the Khata page AND so the
  // credit-limit check above sees real exposure on the next sale. Cash/UPI/card bills are
  // settled immediately and are not ledgered.
  if (data.payment_method === 'credit' && data.customer_id && calcTotal > 0) {
    await db.execute(
      `INSERT INTO khata_entries (id, tenant_id, customer_id, order_id, type, amount, notes, entry_date, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.customer_id, orderId, 'debit', calcTotal,
       `Credit bill ${billNumber}`, orderDate, now(), now()]
    );
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
  order.items = await db.select<OrderItem[]>(`SELECT * FROM order_items WHERE order_id = ? AND tenant_id = ?`, [orderId, tenantId]);
  return order;
}

export async function voidOrder(tenantId: string, orderId: string): Promise<void> {
  const db = await getDb();
  const order = await getOrderWithItems(tenantId, orderId);
  if (!order) throw new Error('Order not found');

  await db.execute(
    `UPDATE orders SET payment_status = 'cancelled', deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), orderId, tenantId]
  );
  // [medical] [all tenants] — if this was a credit bill it posted a Khata debit; voiding
  // the bill must reverse that receivable so the customer's outstanding drops back.
  await db.execute(
    `UPDATE khata_entries SET deleted_at = ?, updated_at = ? WHERE order_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
    [now(), now(), orderId, tenantId]
  );
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

export async function updateOrderDate(tenantId: string, orderId: string, orderDate: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET order_date = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [orderDate, now(), orderId, tenantId]
  );
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
