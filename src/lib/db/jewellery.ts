// [jewellery] [all tenants]
import { getDb, uuid, now } from './index';

export interface GoldRate {
  id: string; tenant_id: string;
  rate_date: string; gold_22k: number; gold_24k: number;
  silver: number; platinum: number | null;
}

export interface JewelleryItem {
  id: string; tenant_id: string;
  name: string; category: string; metal: string; purity: string;
  gross_weight: number; net_weight: number; stone_weight: number;
  making_charges: number; making_type: string; wastage_pct: number;
  stock_qty: number; cost_price: number; selling_price: number;
  hsn_code: string | null; barcode: string | null; is_active: boolean;
}

export interface JewelleryBill {
  id: string; tenant_id: string;
  bill_number: string; customer_id: string | null;
  customer_name: string; customer_phone: string | null; customer_address: string | null;
  gold_rate_22k: number; gold_rate_24k: number;
  subtotal: number; making_total: number; discount: number;
  gst_amount: number; gst_rate: number; total: number;
  payment_method: string; advance_received: number; balance_due: number;
  notes: string | null; billed_at: string;
  items?: JewelleryBillItem[];
}

export interface JewelleryBillItem {
  id: string; tenant_id: string; bill_id: string;
  item_id: string | null; name: string; category: string | null;
  purity: string | null; gross_weight: number; net_weight: number;
  rate_per_gram: number; making_charges: number; stone_charges: number; subtotal: number;
}

export interface CustomOrder {
  id: string; tenant_id: string;
  order_number: string; customer_id: string | null;
  customer_name: string; customer_phone: string | null;
  description: string; category: string | null; metal: string; purity: string;
  approx_weight: number | null; design_notes: string | null;
  estimated_price: number; advance_paid: number; balance_due: number;
  status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';
  expected_date: string | null; delivered_at: string | null; notes: string | null;
}

export interface RepairJob {
  id: string; tenant_id: string;
  job_number: string; customer_id: string | null;
  customer_name: string; customer_phone: string | null;
  item_description: string; issue: string | null;
  estimated_price: number; advance_paid: number; final_price: number | null;
  status: 'received' | 'in_progress' | 'ready' | 'delivered';
  received_at: string; expected_date: string | null; delivered_at: string | null; notes: string | null;
}

// ─── Gold Rates ──────────────────────────────────────────────────────────────

export async function getTodayRate(tenantId: string): Promise<GoldRate | null> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select<GoldRate[]>(
    `SELECT * FROM jewellery_gold_rates WHERE tenant_id=? AND rate_date=?`,
    [tenantId, today]
  );
  return rows[0] ?? null;
}

export async function getLatestRate(tenantId: string): Promise<GoldRate | null> {
  const db = await getDb();
  const rows = await db.select<GoldRate[]>(
    `SELECT * FROM jewellery_gold_rates WHERE tenant_id=? ORDER BY rate_date DESC LIMIT 1`,
    [tenantId]
  );
  return rows[0] ?? null;
}

export async function listRates(tenantId: string, limit = 30): Promise<GoldRate[]> {
  const db = await getDb();
  return db.select<GoldRate[]>(
    `SELECT * FROM jewellery_gold_rates WHERE tenant_id=? ORDER BY rate_date DESC LIMIT ?`,
    [tenantId, limit]
  );
}

export async function saveRate(tenantId: string, data: Omit<GoldRate, 'id' | 'tenant_id'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO jewellery_gold_rates(id,tenant_id,rate_date,gold_22k,gold_24k,silver,platinum) VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(tenant_id,rate_date) DO UPDATE SET gold_22k=excluded.gold_22k,gold_24k=excluded.gold_24k,silver=excluded.silver,platinum=excluded.platinum,updated_at=datetime('now')`,
    [uuid(), tenantId, data.rate_date, data.gold_22k, data.gold_24k, data.silver, data.platinum??null]
  );
}

// ─── Jewellery Items ─────────────────────────────────────────────────────────

export async function listItems(tenantId: string, category?: string): Promise<JewelleryItem[]> {
  const db = await getDb();
  const query = category
    ? `SELECT * FROM jewellery_items WHERE tenant_id=? AND category=? AND deleted_at IS NULL ORDER BY name`
    : `SELECT * FROM jewellery_items WHERE tenant_id=? AND deleted_at IS NULL ORDER BY category,name`;
  const rows = await db.select<JewelleryItem[]>(query, category ? [tenantId, category] : [tenantId]);
  return rows.map(r => ({ ...r, is_active: !!r.is_active }));
}

export async function saveItem(tenantId: string, data: Partial<JewelleryItem> & { name: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE jewellery_items SET name=?,category=?,metal=?,purity=?,gross_weight=?,net_weight=?,stone_weight=?,making_charges=?,making_type=?,wastage_pct=?,stock_qty=?,cost_price=?,selling_price=?,hsn_code=?,barcode=?,is_active=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.category??'ring', data.metal??'gold', data.purity??'22k', data.gross_weight??0, data.net_weight??0, data.stone_weight??0, data.making_charges??0, data.making_type??'fixed', data.wastage_pct??0, data.stock_qty??1, data.cost_price??0, data.selling_price??0, data.hsn_code??null, data.barcode??null, data.is_active?1:0, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO jewellery_items(id,tenant_id,name,category,metal,purity,gross_weight,net_weight,stone_weight,making_charges,making_type,wastage_pct,stock_qty,cost_price,selling_price,hsn_code,barcode) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category??'ring', data.metal??'gold', data.purity??'22k', data.gross_weight??0, data.net_weight??0, data.stone_weight??0, data.making_charges??0, data.making_type??'fixed', data.wastage_pct??0, data.stock_qty??1, data.cost_price??0, data.selling_price??0, data.hsn_code??null, data.barcode??null]
  );
  return id;
}

export async function deleteItem(tenantId: string, id: string) {
  const db = await getDb();
  await db.execute(`UPDATE jewellery_items SET deleted_at=datetime('now') WHERE id=? AND tenant_id=?`, [id, tenantId]);
}

// ─── Bills ───────────────────────────────────────────────────────────────────

export async function listBills(tenantId: string, limit = 50): Promise<JewelleryBill[]> {
  const db = await getDb();
  return db.select<JewelleryBill[]>(
    `SELECT * FROM jewellery_bills WHERE tenant_id=? AND deleted_at IS NULL ORDER BY billed_at DESC LIMIT ?`,
    [tenantId, limit]
  );
}

export async function createBill(tenantId: string, bill: Omit<JewelleryBill, 'id' | 'tenant_id' | 'items'>, items: Omit<JewelleryBillItem, 'id' | 'tenant_id' | 'bill_id'>[]): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO jewellery_bills(id,tenant_id,bill_number,customer_id,customer_name,customer_phone,customer_address,gold_rate_22k,gold_rate_24k,subtotal,making_total,discount,gst_amount,gst_rate,total,payment_method,advance_received,balance_due,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, bill.bill_number, bill.customer_id??null, bill.customer_name, bill.customer_phone??null, bill.customer_address??null, bill.gold_rate_22k, bill.gold_rate_24k, bill.subtotal, bill.making_total, bill.discount, bill.gst_amount, bill.gst_rate, bill.total, bill.payment_method, bill.advance_received, bill.balance_due, bill.notes??null]
  );
  for (const item of items) {
    await db.execute(
      `INSERT INTO jewellery_bill_items(id,tenant_id,bill_id,item_id,name,category,purity,gross_weight,net_weight,rate_per_gram,making_charges,stone_charges,subtotal) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, id, item.item_id??null, item.name, item.category??null, item.purity??null, item.gross_weight, item.net_weight, item.rate_per_gram, item.making_charges, item.stone_charges, item.subtotal]
    );
    if (item.item_id) {
      await db.execute(
        `UPDATE jewellery_items SET stock_qty=MAX(0,stock_qty-1),updated_at=? WHERE id=? AND tenant_id=?`,
        [now(), item.item_id, tenantId]
      );
    }
  }
  return id;
}

// ─── Custom Orders ───────────────────────────────────────────────────────────

export async function listCustomOrders(tenantId: string): Promise<CustomOrder[]> {
  const db = await getDb();
  return db.select<CustomOrder[]>(
    `SELECT * FROM jewellery_custom_orders WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveCustomOrder(tenantId: string, data: Partial<CustomOrder> & { customer_name: string; description: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE jewellery_custom_orders SET customer_name=?,customer_phone=?,description=?,category=?,metal=?,purity=?,approx_weight=?,design_notes=?,estimated_price=?,advance_paid=?,balance_due=?,status=?,expected_date=?,delivered_at=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.customer_name, data.customer_phone??null, data.description, data.category??null, data.metal??'gold', data.purity??'22k', data.approx_weight??null, data.design_notes??null, data.estimated_price??0, data.advance_paid??0, data.balance_due??0, data.status??'pending', data.expected_date??null, data.delivered_at??null, data.notes??null, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  const orderNumber = `CO-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO jewellery_custom_orders(id,tenant_id,order_number,customer_id,customer_name,customer_phone,description,category,metal,purity,approx_weight,design_notes,estimated_price,advance_paid,balance_due,expected_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, orderNumber, data.customer_id??null, data.customer_name, data.customer_phone??null, data.description, data.category??null, data.metal??'gold', data.purity??'22k', data.approx_weight??null, data.design_notes??null, data.estimated_price??0, data.advance_paid??0, (data.estimated_price??0)-(data.advance_paid??0), data.expected_date??null]
  );
  return id;
}

// ─── Repairs ─────────────────────────────────────────────────────────────────

export async function listRepairs(tenantId: string): Promise<RepairJob[]> {
  const db = await getDb();
  return db.select<RepairJob[]>(
    `SELECT * FROM jewellery_repairs WHERE tenant_id=? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [tenantId]
  );
}

export async function saveRepair(tenantId: string, data: Partial<RepairJob> & { customer_name: string; item_description: string }): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE jewellery_repairs SET customer_name=?,customer_phone=?,item_description=?,issue=?,estimated_price=?,advance_paid=?,final_price=?,status=?,expected_date=?,delivered_at=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.customer_name, data.customer_phone??null, data.item_description, data.issue??null, data.estimated_price??0, data.advance_paid??0, data.final_price??null, data.status??'received', data.expected_date??null, data.delivered_at??null, data.notes??null, now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  const jobNumber = `R-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO jewellery_repairs(id,tenant_id,job_number,customer_id,customer_name,customer_phone,item_description,issue,estimated_price,advance_paid,expected_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, jobNumber, data.customer_id??null, data.customer_name, data.customer_phone??null, data.item_description, data.issue??null, data.estimated_price??0, data.advance_paid??0, data.expected_date??null]
  );
  return id;
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────

export async function getJewelleryStats(tenantId: string) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const rate = await getLatestRate(tenantId);
  const [todaySales] = await db.select<{ total: number; count: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM jewellery_bills WHERE tenant_id=? AND date(billed_at)=? AND deleted_at IS NULL`,
    [tenantId, today]
  );
  const [monthSales] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total FROM jewellery_bills WHERE tenant_id=? AND strftime('%Y-%m',billed_at)=? AND deleted_at IS NULL`,
    [tenantId, thisMonth]
  );
  const [pendingOrders] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM jewellery_custom_orders WHERE tenant_id=? AND status NOT IN ('delivered','cancelled') AND deleted_at IS NULL`,
    [tenantId]
  );
  const [pendingRepairs] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM jewellery_repairs WHERE tenant_id=? AND status!='delivered' AND deleted_at IS NULL`,
    [tenantId]
  );
  const [stockValue] = await db.select<{ value: number; count: number }[]>(
    `SELECT COALESCE(SUM(selling_price*stock_qty),0) as value, COALESCE(SUM(stock_qty),0) as count FROM jewellery_items WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );
  return {
    gold22k: rate?.gold_22k ?? 0,
    gold24k: rate?.gold_24k ?? 0,
    silver: rate?.silver ?? 0,
    todaySales: todaySales?.total ?? 0,
    todayBills: todaySales?.count ?? 0,
    monthSales: monthSales?.total ?? 0,
    pendingOrders: pendingOrders?.count ?? 0,
    pendingRepairs: pendingRepairs?.count ?? 0,
    stockValue: stockValue?.value ?? 0,
    stockCount: stockValue?.count ?? 0,
  };
}
