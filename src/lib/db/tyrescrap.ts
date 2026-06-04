// [tyrescrap] [all tenants]
import { getDb, uuid, now } from './index';

export type TyreType = 'car' | 'truck' | 'bike' | 'tractor' | 'bus' | 'suv' | 'cycle' | 'mixed';
export type TyreCategory = 'resale' | 'retreading' | 'crumb_rubber' | 'wire_scrap' | 'lot';
export type PaymentMode = 'cash' | 'upi' | 'credit';
export type ExpenseCategory = 'transport' | 'labor' | 'rent' | 'maintenance' | 'other';

export const TYRE_TYPE_LABELS: Record<TyreType, string> = {
  car: 'Car Tyre', truck: 'Truck / Lorry', bike: 'Bike / Scooter',
  tractor: 'Tractor', bus: 'Bus', suv: 'Jeep / SUV', cycle: 'Cycle', mixed: 'Mixed / Lot',
};

export const TYRE_CATEGORY_LABELS: Record<TyreCategory, string> = {
  resale: 'Resale (Whole)', retreading: 'Retreading', crumb_rubber: 'Crumb Rubber',
  wire_scrap: 'Wire / Steel Scrap', lot: 'Mixed Lot',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  transport: 'Transport', labor: 'Labor / Loading', rent: 'Rent / Yard',
  maintenance: 'Maintenance', other: 'Other',
};

// ── VENDORS ──────────────────────────────────────────────────────────────────
export interface TyreVendor {
  id: string; tenant_id: string; name: string; phone: string;
  address: string; notes: string; created_at: string;
}

export async function listVendors(tenantId: string): Promise<TyreVendor[]> {
  const db = await getDb();
  return db.select<TyreVendor[]>(
    `SELECT * FROM tyre_vendors WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name ASC`,
    [tenantId],
  );
}

export async function saveVendor(
  tenantId: string,
  data: { name: string; phone: string; address: string; notes: string },
  id?: string,
): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE tyre_vendors SET name=?,phone=?,address=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone, data.address, data.notes, now(), id, tenantId],
    );
  } else {
    await db.execute(
      `INSERT INTO tyre_vendors(id,tenant_id,name,phone,address,notes,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.name, data.phone, data.address, data.notes, now(), now()],
    );
  }
}

export async function deleteVendor(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tyre_vendors SET deleted_at=? WHERE id=? AND tenant_id=?`,
    [now(), id, tenantId],
  );
}

// ── BUYERS ───────────────────────────────────────────────────────────────────
export interface TyreBuyer {
  id: string; tenant_id: string; name: string; phone: string;
  address: string; gst_number: string; notes: string; created_at: string;
}

export async function listBuyers(tenantId: string): Promise<TyreBuyer[]> {
  const db = await getDb();
  return db.select<TyreBuyer[]>(
    `SELECT * FROM tyre_buyers WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name ASC`,
    [tenantId],
  );
}

export async function saveBuyer(
  tenantId: string,
  data: { name: string; phone: string; address: string; gst_number: string; notes: string },
  id?: string,
): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE tyre_buyers SET name=?,phone=?,address=?,gst_number=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.name, data.phone, data.address, data.gst_number, data.notes, now(), id, tenantId],
    );
  } else {
    await db.execute(
      `INSERT INTO tyre_buyers(id,tenant_id,name,phone,address,gst_number,notes,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.name, data.phone, data.address, data.gst_number, data.notes, now(), now()],
    );
  }
}

export async function deleteBuyer(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tyre_buyers SET deleted_at=? WHERE id=? AND tenant_id=?`,
    [now(), id, tenantId],
  );
}

// ── PURCHASES ─────────────────────────────────────────────────────────────────
export interface TyrePurchase {
  id: string; tenant_id: string; vendor_id: string; vendor_name: string;
  date: string; tyre_type: string; category: string;
  quantity_pieces: number; weight_kg: number; rate_per_kg: number;
  total_amount: number; payment_mode: string; notes: string; created_at: string;
}

export async function listPurchases(
  tenantId: string,
  opts?: { from?: string; to?: string },
): Promise<TyrePurchase[]> {
  const db = await getDb();
  let sql = `SELECT * FROM tyre_purchases WHERE tenant_id=? AND deleted_at IS NULL`;
  const params: unknown[] = [tenantId];
  if (opts?.from) { sql += ` AND date>=?`; params.push(opts.from); }
  if (opts?.to)   { sql += ` AND date<=?`; params.push(opts.to); }
  sql += ` ORDER BY date DESC, created_at DESC`;
  return db.select<TyrePurchase[]>(sql, params);
}

export async function savePurchase(
  tenantId: string,
  data: Omit<TyrePurchase, 'id' | 'tenant_id' | 'created_at'>,
  id?: string,
): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE tyre_purchases SET vendor_id=?,vendor_name=?,date=?,tyre_type=?,category=?,
       quantity_pieces=?,weight_kg=?,rate_per_kg=?,total_amount=?,payment_mode=?,notes=?,updated_at=?
       WHERE id=? AND tenant_id=?`,
      [data.vendor_id, data.vendor_name, data.date, data.tyre_type, data.category,
       data.quantity_pieces, data.weight_kg, data.rate_per_kg, data.total_amount,
       data.payment_mode, data.notes, now(), id, tenantId],
    );
  } else {
    await db.execute(
      `INSERT INTO tyre_purchases(id,tenant_id,vendor_id,vendor_name,date,tyre_type,category,
       quantity_pieces,weight_kg,rate_per_kg,total_amount,payment_mode,notes,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.vendor_id, data.vendor_name, data.date, data.tyre_type, data.category,
       data.quantity_pieces, data.weight_kg, data.rate_per_kg, data.total_amount,
       data.payment_mode, data.notes, now(), now()],
    );
  }
}

export async function deletePurchase(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tyre_purchases SET deleted_at=? WHERE id=? AND tenant_id=?`,
    [now(), id, tenantId],
  );
}

// ── SALES ─────────────────────────────────────────────────────────────────────
export interface TyreSale {
  id: string; tenant_id: string; buyer_id: string; buyer_name: string;
  bill_number: string; date: string; tyre_type: string; category: string;
  quantity_pieces: number; weight_kg: number; rate_per_kg: number;
  total_amount: number; payment_mode: string; notes: string; created_at: string;
}

export async function listSales(
  tenantId: string,
  opts?: { from?: string; to?: string },
): Promise<TyreSale[]> {
  const db = await getDb();
  let sql = `SELECT * FROM tyre_sales WHERE tenant_id=? AND deleted_at IS NULL`;
  const params: unknown[] = [tenantId];
  if (opts?.from) { sql += ` AND date>=?`; params.push(opts.from); }
  if (opts?.to)   { sql += ` AND date<=?`; params.push(opts.to); }
  sql += ` ORDER BY date DESC, created_at DESC`;
  return db.select<TyreSale[]>(sql, params);
}

export async function saveSale(
  tenantId: string,
  data: Omit<TyreSale, 'id' | 'tenant_id' | 'created_at'>,
  id?: string,
): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE tyre_sales SET buyer_id=?,buyer_name=?,bill_number=?,date=?,tyre_type=?,category=?,
       quantity_pieces=?,weight_kg=?,rate_per_kg=?,total_amount=?,payment_mode=?,notes=?,updated_at=?
       WHERE id=? AND tenant_id=?`,
      [data.buyer_id, data.buyer_name, data.bill_number, data.date, data.tyre_type, data.category,
       data.quantity_pieces, data.weight_kg, data.rate_per_kg, data.total_amount,
       data.payment_mode, data.notes, now(), id, tenantId],
    );
  } else {
    await db.execute(
      `INSERT INTO tyre_sales(id,tenant_id,buyer_id,buyer_name,bill_number,date,tyre_type,category,
       quantity_pieces,weight_kg,rate_per_kg,total_amount,payment_mode,notes,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.buyer_id, data.buyer_name, data.bill_number, data.date,
       data.tyre_type, data.category, data.quantity_pieces, data.weight_kg, data.rate_per_kg,
       data.total_amount, data.payment_mode, data.notes, now(), now()],
    );
  }
}

export async function deleteSale(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tyre_sales SET deleted_at=? WHERE id=? AND tenant_id=?`,
    [now(), id, tenantId],
  );
}

// ── EXPENSES ─────────────────────────────────────────────────────────────────
export interface TyreExpense {
  id: string; tenant_id: string; date: string; category: string;
  description: string; amount: number; notes: string; created_at: string;
}

export async function listExpenses(
  tenantId: string,
  opts?: { from?: string; to?: string },
): Promise<TyreExpense[]> {
  const db = await getDb();
  let sql = `SELECT * FROM tyre_expenses WHERE tenant_id=? AND deleted_at IS NULL`;
  const params: unknown[] = [tenantId];
  if (opts?.from) { sql += ` AND date>=?`; params.push(opts.from); }
  if (opts?.to)   { sql += ` AND date<=?`; params.push(opts.to); }
  sql += ` ORDER BY date DESC, created_at DESC`;
  return db.select<TyreExpense[]>(sql, params);
}

export async function saveExpense(
  tenantId: string,
  data: { date: string; category: string; description: string; amount: number; notes: string },
  id?: string,
): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.execute(
      `UPDATE tyre_expenses SET date=?,category=?,description=?,amount=?,notes=?,updated_at=?
       WHERE id=? AND tenant_id=?`,
      [data.date, data.category, data.description, data.amount, data.notes, now(), id, tenantId],
    );
  } else {
    await db.execute(
      `INSERT INTO tyre_expenses(id,tenant_id,date,category,description,amount,notes,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, data.date, data.category, data.description, data.amount, data.notes, now(), now()],
    );
  }
}

export async function deleteExpense(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tyre_expenses SET deleted_at=? WHERE id=? AND tenant_id=?`,
    [now(), id, tenantId],
  );
}

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
export interface TyreScrapStats {
  todayPurchaseAmt: number;
  todaySaleAmt: number;
  todayPurchaseKg: number;
  todaySaleKg: number;
  monthPurchaseAmt: number;
  monthSaleAmt: number;
  monthExpenses: number;
  totalStockKg: number;
}

export async function getTyreScrapStats(tenantId: string): Promise<TyreScrapStats> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [todayP] = await db.select<{ amt: number; kg: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) amt, COALESCE(SUM(weight_kg),0) kg
     FROM tyre_purchases WHERE tenant_id=? AND date=? AND deleted_at IS NULL`,
    [tenantId, today],
  );
  const [todayS] = await db.select<{ amt: number; kg: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) amt, COALESCE(SUM(weight_kg),0) kg
     FROM tyre_sales WHERE tenant_id=? AND date=? AND deleted_at IS NULL`,
    [tenantId, today],
  );
  const [monthP] = await db.select<{ amt: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) amt FROM tyre_purchases
     WHERE tenant_id=? AND date>=? AND deleted_at IS NULL`,
    [tenantId, monthStart],
  );
  const [monthSale] = await db.select<{ amt: number }[]>(
    `SELECT COALESCE(SUM(total_amount),0) amt FROM tyre_sales
     WHERE tenant_id=? AND date>=? AND deleted_at IS NULL`,
    [tenantId, monthStart],
  );
  const [monthExp] = await db.select<{ amt: number }[]>(
    `SELECT COALESCE(SUM(amount),0) amt FROM tyre_expenses
     WHERE tenant_id=? AND date>=? AND deleted_at IS NULL`,
    [tenantId, monthStart],
  );
  const [totalBought] = await db.select<{ kg: number }[]>(
    `SELECT COALESCE(SUM(weight_kg),0) kg FROM tyre_purchases WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId],
  );
  const [totalSold] = await db.select<{ kg: number }[]>(
    `SELECT COALESCE(SUM(weight_kg),0) kg FROM tyre_sales WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId],
  );

  return {
    todayPurchaseAmt: todayP?.amt ?? 0,
    todaySaleAmt: todayS?.amt ?? 0,
    todayPurchaseKg: todayP?.kg ?? 0,
    todaySaleKg: todayS?.kg ?? 0,
    monthPurchaseAmt: monthP?.amt ?? 0,
    monthSaleAmt: monthSale?.amt ?? 0,
    monthExpenses: monthExp?.amt ?? 0,
    totalStockKg: Math.max(0, (totalBought?.kg ?? 0) - (totalSold?.kg ?? 0)),
  };
}

// ── STOCK (computed from purchases - sales by tyre_type + category) ───────────
export interface StockRow {
  tyre_type: string;
  category: string;
  purchased_kg: number;
  sold_kg: number;
  stock_kg: number;
  purchased_pieces: number;
  sold_pieces: number;
  stock_pieces: number;
}

export async function getStockSummary(tenantId: string): Promise<StockRow[]> {
  const db = await getDb();
  const purchases = await db.select<{ tyre_type: string; category: string; kg: number; pieces: number }[]>(
    `SELECT tyre_type, category, SUM(weight_kg) kg, SUM(quantity_pieces) pieces
     FROM tyre_purchases WHERE tenant_id=? AND deleted_at IS NULL GROUP BY tyre_type, category`,
    [tenantId],
  );
  const sales = await db.select<{ tyre_type: string; category: string; kg: number; pieces: number }[]>(
    `SELECT tyre_type, category, SUM(weight_kg) kg, SUM(quantity_pieces) pieces
     FROM tyre_sales WHERE tenant_id=? AND deleted_at IS NULL GROUP BY tyre_type, category`,
    [tenantId],
  );
  const map = new Map<string, StockRow>();
  for (const p of purchases) {
    const key = `${p.tyre_type}|${p.category}`;
    map.set(key, {
      tyre_type: p.tyre_type, category: p.category,
      purchased_kg: p.kg, sold_kg: 0,
      stock_kg: p.kg, purchased_pieces: p.pieces, sold_pieces: 0, stock_pieces: p.pieces,
    });
  }
  for (const s of sales) {
    const key = `${s.tyre_type}|${s.category}`;
    const row = map.get(key) ?? {
      tyre_type: s.tyre_type, category: s.category,
      purchased_kg: 0, sold_kg: 0, stock_kg: 0, purchased_pieces: 0, sold_pieces: 0, stock_pieces: 0,
    };
    row.sold_kg += s.kg;
    row.stock_kg = Math.max(0, row.purchased_kg - row.sold_kg);
    row.sold_pieces += s.pieces;
    row.stock_pieces = Math.max(0, row.purchased_pieces - row.sold_pieces);
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => a.tyre_type.localeCompare(b.tyre_type));
}
