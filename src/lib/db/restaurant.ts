// [restaurant] [all tenants]
import { getDb, uuid, now } from './index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MenuCategory {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string | null;
  category_name: string | null;
  name: string;
  description: string | null;
  price: number;
  half_price: number | null;
  gst_rate: number;
  is_veg: number;
  is_available: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RestaurantTable {
  id: string;
  tenant_id: string;
  name: string;
  capacity: number;
  status: 'empty' | 'occupied' | 'reserved';
  open_order_id: string | null;
  open_items_count: number;
  open_total: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RestaurantOrder {
  id: string;
  tenant_id: string;
  table_id: string | null;
  table_name: string | null;
  order_number: string;
  status: 'open' | 'settled' | 'cancelled';
  order_type: 'dine-in' | 'takeaway' | 'delivery';
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  tax_total: number;
  discount: number;
  total: number;
  payment_method: string | null;
  payment_status: 'pending' | 'paid';
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RestaurantOrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  total: number;
  notes: string | null;
  kot_status: 'pending' | 'preparing' | 'served';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface KitchenItem extends RestaurantOrderItem {
  table_name: string | null;
  order_number: string;
}

// ─── Menu Categories ──────────────────────────────────────────────────────────

export async function listMenuCategories(tenantId: string): Promise<MenuCategory[]> {
  const db = await getDb();
  return db.select<MenuCategory[]>(
    `SELECT * FROM menu_categories
     WHERE tenant_id = ? AND deleted_at IS NULL
     ORDER BY sort_order ASC, name ASC`,
    [tenantId]
  );
}

export async function createMenuCategory(
  tenantId: string,
  data: { name: string; sort_order?: number }
): Promise<MenuCategory> {
  const db = await getDb();
  const id = uuid();
  const ts = now();
  await db.execute(
    `INSERT INTO menu_categories (id, tenant_id, name, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [id, tenantId, data.name.trim(), data.sort_order ?? 0, ts, ts]
  );
  const rows = await db.select<MenuCategory[]>(
    `SELECT * FROM menu_categories WHERE id = ?`, [id]
  );
  return rows[0];
}

export async function updateMenuCategory(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; sort_order: number; is_active: number }>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name.trim()); }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(data.sort_order); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); vals.push(data.is_active); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?'); vals.push(now());
  vals.push(id, tenantId);
  await db.execute(
    `UPDATE menu_categories SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
    vals
  );
}

export async function deleteMenuCategory(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE menu_categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), id, tenantId]
  );
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

export async function listMenuItems(
  tenantId: string,
  categoryId?: string | null
): Promise<MenuItem[]> {
  const db = await getDb();
  if (categoryId) {
    return db.select<MenuItem[]>(
      `SELECT mi.*, mc.name AS category_name
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mi.tenant_id = ? AND mi.category_id = ? AND mi.deleted_at IS NULL
       ORDER BY mi.sort_order ASC, mi.name ASC`,
      [tenantId, categoryId]
    );
  }
  return db.select<MenuItem[]>(
    `SELECT mi.*, mc.name AS category_name
     FROM menu_items mi
     LEFT JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.tenant_id = ? AND mi.deleted_at IS NULL
     ORDER BY mi.sort_order ASC, mi.name ASC`,
    [tenantId]
  );
}

export async function createMenuItem(
  tenantId: string,
  data: {
    name: string;
    category_id?: string | null;
    description?: string | null;
    price: number;
    half_price?: number | null;
    gst_rate?: number;
    is_veg?: boolean;
    is_available?: boolean;
    sort_order?: number;
  }
): Promise<MenuItem> {
  const db = await getDb();
  const id = uuid();
  const ts = now();
  await db.execute(
    `INSERT INTO menu_items
       (id, tenant_id, category_id, name, description, price, half_price,
        gst_rate, is_veg, is_available, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tenantId,
      data.category_id ?? null,
      data.name.trim(),
      data.description ?? null,
      data.price,
      data.half_price ?? null,
      data.gst_rate ?? 5,
      data.is_veg !== false ? 1 : 0,
      data.is_available !== false ? 1 : 0,
      data.sort_order ?? 0,
      ts, ts,
    ]
  );
  const rows = await db.select<MenuItem[]>(
    `SELECT mi.*, mc.name AS category_name
     FROM menu_items mi
     LEFT JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE mi.id = ?`,
    [id]
  );
  return rows[0];
}

export async function updateMenuItem(
  tenantId: string,
  id: string,
  data: Partial<{
    name: string;
    category_id: string | null;
    description: string | null;
    price: number;
    half_price: number | null;
    gst_rate: number;
    is_veg: number;
    is_available: number;
    sort_order: number;
  }>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name.trim()); }
  if ('category_id' in data) { sets.push('category_id = ?'); vals.push(data.category_id ?? null); }
  if ('description' in data) { sets.push('description = ?'); vals.push(data.description ?? null); }
  if (data.price !== undefined) { sets.push('price = ?'); vals.push(data.price); }
  if ('half_price' in data) { sets.push('half_price = ?'); vals.push(data.half_price ?? null); }
  if (data.gst_rate !== undefined) { sets.push('gst_rate = ?'); vals.push(data.gst_rate); }
  if (data.is_veg !== undefined) { sets.push('is_veg = ?'); vals.push(data.is_veg); }
  if (data.is_available !== undefined) { sets.push('is_available = ?'); vals.push(data.is_available); }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(data.sort_order); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?'); vals.push(now());
  vals.push(id, tenantId);
  await db.execute(
    `UPDATE menu_items SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
    vals
  );
}

export async function deleteMenuItem(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE menu_items SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), id, tenantId]
  );
}

export async function toggleMenuItemAvailability(
  tenantId: string,
  id: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE menu_items
     SET is_available = CASE WHEN is_available = 1 THEN 0 ELSE 1 END,
         updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [now(), id, tenantId]
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export async function listTables(tenantId: string): Promise<RestaurantTable[]> {
  const db = await getDb();
  return db.select<RestaurantTable[]>(
    `SELECT
       t.*,
       o.id AS open_order_id,
       COALESCE(SUM(oi.quantity), 0) AS open_items_count,
       COALESCE(o.total, 0) AS open_total
     FROM restaurant_tables t
     LEFT JOIN restaurant_orders o
       ON o.table_id = t.id AND o.status = 'open' AND o.deleted_at IS NULL
     LEFT JOIN restaurant_order_items oi
       ON oi.order_id = o.id AND oi.deleted_at IS NULL
     WHERE t.tenant_id = ? AND t.deleted_at IS NULL
     GROUP BY t.id
     ORDER BY t.name ASC`,
    [tenantId]
  );
}

export async function createTable(
  tenantId: string,
  data: { name: string; capacity?: number }
): Promise<RestaurantTable> {
  const db = await getDb();
  const id = uuid();
  const ts = now();
  await db.execute(
    `INSERT INTO restaurant_tables (id, tenant_id, name, capacity, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'empty', ?, ?)`,
    [id, tenantId, data.name.trim(), data.capacity ?? 4, ts, ts]
  );
  const rows = await db.select<RestaurantTable[]>(
    `SELECT t.*, NULL AS open_order_id, 0 AS open_items_count, 0 AS open_total
     FROM restaurant_tables t WHERE t.id = ?`,
    [id]
  );
  return rows[0];
}

export async function updateTableStatus(
  tenantId: string,
  id: string,
  status: 'empty' | 'occupied' | 'reserved'
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE restaurant_tables SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [status, now(), id, tenantId]
  );
}

export async function deleteTable(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE restaurant_tables SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [now(), now(), id, tenantId]
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────

async function nextOrderNumber(tenantId: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ max_num: string | null }[]>(
    `SELECT MAX(order_number) AS max_num
     FROM restaurant_orders
     WHERE tenant_id = ? AND order_number LIKE 'RES-%'`,
    [tenantId]
  );
  const max = rows[0]?.max_num;
  const num = max ? parseInt(max.replace('RES-', ''), 10) + 1 : 1;
  return `RES-${String(num).padStart(4, '0')}`;
}

export async function getOpenOrderForTable(
  tenantId: string,
  tableId: string
): Promise<RestaurantOrder | null> {
  const db = await getDb();
  const rows = await db.select<RestaurantOrder[]>(
    `SELECT * FROM restaurant_orders
     WHERE tenant_id = ? AND table_id = ? AND status = 'open' AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, tableId]
  );
  return rows[0] ?? null;
}

export async function createRestaurantOrder(
  tenantId: string,
  data: {
    table_id?: string | null;
    table_name?: string | null;
    order_type?: 'dine-in' | 'takeaway' | 'delivery';
    customer_name?: string | null;
    customer_phone?: string | null;
    notes?: string | null;
  }
): Promise<RestaurantOrder> {
  const db = await getDb();
  const id = uuid();
  const ts = now();
  const orderNumber = await nextOrderNumber(tenantId);
  await db.execute(
    `INSERT INTO restaurant_orders
       (id, tenant_id, table_id, table_name, order_number, status, order_type,
        customer_name, customer_phone, subtotal, tax_total, discount, total,
        payment_status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, 0, 0, 0, 0, 'pending', ?, ?, ?)`,
    [
      id, tenantId,
      data.table_id ?? null,
      data.table_name ?? null,
      orderNumber,
      data.order_type ?? 'dine-in',
      data.customer_name ?? null,
      data.customer_phone ?? null,
      data.notes ?? null,
      ts, ts,
    ]
  );
  // Mark table occupied
  if (data.table_id) {
    await updateTableStatus(tenantId, data.table_id, 'occupied');
  }
  const rows = await db.select<RestaurantOrder[]>(
    `SELECT * FROM restaurant_orders WHERE id = ?`, [id]
  );
  return rows[0];
}

async function recalcOrderTotals(tenantId: string, orderId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ subtotal: number; tax_total: number }[]>(
    `SELECT
       COALESCE(SUM(total / (1 + gst_rate / 100.0)), 0) AS subtotal,
       COALESCE(SUM(total - total / (1 + gst_rate / 100.0)), 0) AS tax_total
     FROM restaurant_order_items
     WHERE order_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
    [orderId, tenantId]
  );
  const { subtotal, tax_total } = rows[0] ?? { subtotal: 0, tax_total: 0 };
  const orderRows = await db.select<{ discount: number }[]>(
    `SELECT discount FROM restaurant_orders WHERE id = ?`, [orderId]
  );
  const discount = orderRows[0]?.discount ?? 0;
  const total = Math.max(0, subtotal + tax_total - discount);
  await db.execute(
    `UPDATE restaurant_orders SET subtotal = ?, tax_total = ?, total = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [subtotal, tax_total, total, now(), orderId, tenantId]
  );
}

export async function addItemsToOrder(
  tenantId: string,
  orderId: string,
  items: Array<{
    menu_item_id?: string | null;
    item_name: string;
    variant?: string | null;
    quantity: number;
    unit_price: number;
    gst_rate?: number;
    notes?: string | null;
  }>
): Promise<void> {
  const db = await getDb();
  const ts = now();
  for (const item of items) {
    const id = uuid();
    const gstRate = item.gst_rate ?? 5;
    const total = item.quantity * item.unit_price * (1 + gstRate / 100);
    await db.execute(
      `INSERT INTO restaurant_order_items
         (id, tenant_id, order_id, menu_item_id, item_name, variant,
          quantity, unit_price, gst_rate, total, notes, kot_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id, tenantId, orderId,
        item.menu_item_id ?? null,
        item.item_name,
        item.variant ?? null,
        item.quantity,
        item.unit_price,
        gstRate,
        total,
        item.notes ?? null,
        ts, ts,
      ]
    );
  }
  await recalcOrderTotals(tenantId, orderId);
}

export async function updateOrderItemKotStatus(
  tenantId: string,
  itemId: string,
  status: 'pending' | 'preparing' | 'served'
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE restaurant_order_items SET kot_status = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [status, now(), itemId, tenantId]
  );
}

export async function removeOrderItem(tenantId: string, itemId: string): Promise<void> {
  const db = await getDb();
  // Get order_id before soft delete
  const rows = await db.select<{ order_id: string }[]>(
    `SELECT order_id FROM restaurant_order_items WHERE id = ? AND tenant_id = ?`,
    [itemId, tenantId]
  );
  await db.execute(
    `UPDATE restaurant_order_items SET deleted_at = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [now(), now(), itemId, tenantId]
  );
  if (rows[0]?.order_id) {
    await recalcOrderTotals(tenantId, rows[0].order_id);
  }
}

export async function settleOrder(
  tenantId: string,
  orderId: string,
  opts: {
    payment_method: string;
    discount?: number;
    customer_name?: string | null;
    customer_phone?: string | null;
  }
): Promise<RestaurantOrder> {
  const db = await getDb();
  const discount = opts.discount ?? 0;
  // Apply discount first then recalc
  await db.execute(
    `UPDATE restaurant_orders SET discount = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [discount, now(), orderId, tenantId]
  );
  await recalcOrderTotals(tenantId, orderId);
  const ts = now();
  // Fetch table_id
  const orderRows = await db.select<{ table_id: string | null }[]>(
    `SELECT table_id FROM restaurant_orders WHERE id = ?`, [orderId]
  );
  const tableId = orderRows[0]?.table_id ?? null;
  await db.execute(
    `UPDATE restaurant_orders
     SET status = 'settled', payment_method = ?, payment_status = 'paid',
         customer_name = COALESCE(?, customer_name),
         customer_phone = COALESCE(?, customer_phone),
         updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      opts.payment_method,
      opts.customer_name ?? null,
      opts.customer_phone ?? null,
      ts,
      orderId, tenantId,
    ]
  );
  // Free table
  if (tableId) {
    await updateTableStatus(tenantId, tableId, 'empty');
  }
  const rows = await db.select<RestaurantOrder[]>(
    `SELECT * FROM restaurant_orders WHERE id = ?`, [orderId]
  );
  return rows[0];
}

export async function cancelOrder(tenantId: string, orderId: string): Promise<void> {
  const db = await getDb();
  const orderRows = await db.select<{ table_id: string | null }[]>(
    `SELECT table_id FROM restaurant_orders WHERE id = ?`, [orderId]
  );
  const tableId = orderRows[0]?.table_id ?? null;
  await db.execute(
    `UPDATE restaurant_orders SET status = 'cancelled', updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [now(), orderId, tenantId]
  );
  if (tableId) {
    await updateTableStatus(tenantId, tableId, 'empty');
  }
}

export async function listRestaurantOrders(
  tenantId: string,
  opts?: { page?: number; perPage?: number; status?: string }
): Promise<{ items: RestaurantOrder[]; total: number }> {
  const db = await getDb();
  const page = opts?.page ?? 1;
  const perPage = opts?.perPage ?? 30;
  const offset = (page - 1) * perPage;
  const statusFilter = opts?.status && opts.status !== 'all' ? opts.status : null;

  const where = statusFilter
    ? `WHERE tenant_id = ? AND status = ? AND deleted_at IS NULL`
    : `WHERE tenant_id = ? AND deleted_at IS NULL`;
  const params = statusFilter ? [tenantId, statusFilter] : [tenantId];

  const countRows = await db.select<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM restaurant_orders ${where}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const items = await db.select<RestaurantOrder[]>(
    `SELECT * FROM restaurant_orders ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );
  return { items, total };
}

export async function getOrderWithItems(
  tenantId: string,
  orderId: string
): Promise<{ order: RestaurantOrder; items: RestaurantOrderItem[] }> {
  const db = await getDb();
  const orderRows = await db.select<RestaurantOrder[]>(
    `SELECT * FROM restaurant_orders WHERE id = ? AND tenant_id = ?`,
    [orderId, tenantId]
  );
  const items = await db.select<RestaurantOrderItem[]>(
    `SELECT * FROM restaurant_order_items
     WHERE order_id = ? AND tenant_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [orderId, tenantId]
  );
  return { order: orderRows[0], items };
}

export async function getRestaurantSummary(
  tenantId: string,
  from: string,
  to: string
): Promise<{
  total_revenue: number;
  total_orders: number;
  by_type: Array<{ order_type: string; count: number; revenue: number }>;
}> {
  const db = await getDb();
  const totals = await db.select<{ total_revenue: number; total_orders: number }[]>(
    `SELECT
       COALESCE(SUM(total), 0) AS total_revenue,
       COUNT(*) AS total_orders
     FROM restaurant_orders
     WHERE tenant_id = ? AND status = 'settled' AND deleted_at IS NULL
       AND created_at >= ? AND created_at <= ?`,
    [tenantId, from, to]
  );
  const byType = await db.select<{ order_type: string; count: number; revenue: number }[]>(
    `SELECT
       order_type,
       COUNT(*) AS count,
       COALESCE(SUM(total), 0) AS revenue
     FROM restaurant_orders
     WHERE tenant_id = ? AND status = 'settled' AND deleted_at IS NULL
       AND created_at >= ? AND created_at <= ?
     GROUP BY order_type`,
    [tenantId, from, to]
  );
  return {
    total_revenue: totals[0]?.total_revenue ?? 0,
    total_orders: totals[0]?.total_orders ?? 0,
    by_type: byType,
  };
}

// ─── Kitchen ──────────────────────────────────────────────────────────────────

export async function getKitchenItems(tenantId: string): Promise<KitchenItem[]> {
  const db = await getDb();
  return db.select<KitchenItem[]>(
    `SELECT
       oi.*,
       o.table_name,
       o.order_number
     FROM restaurant_order_items oi
     JOIN restaurant_orders o ON o.id = oi.order_id
     WHERE oi.tenant_id = ?
       AND oi.kot_status IN ('pending', 'preparing')
       AND o.status = 'open'
       AND oi.deleted_at IS NULL
       AND o.deleted_at IS NULL
     ORDER BY oi.created_at ASC`,
    [tenantId]
  );
}
