// [hardware] [all tenants]
import { getDb, uuid, now } from './index';

export interface HwProduct {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  unit: string;
  brand: string;
  stock: number;
  min_stock: number;
  purchase_price: number;
  selling_price: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwSale {
  id: string;
  tenant_id: string;
  bill_no: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  paid: number;
  payment_mode: string;
  sale_date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwSaleItem {
  id: string;
  tenant_id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwCreditAccount {
  id: string;
  tenant_id: string;
  customer_name: string;
  phone: string;
  address: string;
  balance: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwCreditTransaction {
  id: string;
  tenant_id: string;
  account_id: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  date: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HardwareStats {
  todaySales: number;
  todayRevenue: number;
  lowStockCount: number;
  creditOutstanding: number;
  monthRevenue: number;
}

// ─── Products ────────────────────────────────────────────────────────────────

function mapHwProduct(r: any): HwProduct {
  return {
    ...r,
    stock: Number(r.stock),
    min_stock: Number(r.min_stock),
    purchase_price: Number(r.purchase_price),
    selling_price: Number(r.selling_price),
  };
}

export async function listHwProducts(
  tenantId: string,
  opts: { search?: string; category?: string; lowStock?: boolean } = {}
): Promise<HwProduct[]> {
  const db = await getDb();
  const conditions = [`tenant_id=?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.category) { conditions.push(`category=?`); params.push(opts.category); }
  if (opts.search) {
    conditions.push(`(name LIKE ? OR brand LIKE ? OR category LIKE ?)`);
    params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts.lowStock) conditions.push(`stock <= min_stock`);
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_products WHERE ${where} ORDER BY category, name`,
    params
  );
  return rows.map(mapHwProduct);
}

export async function saveHwProduct(
  tenantId: string,
  data: Partial<HwProduct> & { name: string }
): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hw_products SET name=?,category=?,unit=?,brand=?,stock=?,min_stock=?,
       purchase_price=?,selling_price=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [
        data.name, data.category ?? '', data.unit ?? 'piece', data.brand ?? '',
        data.stock ?? 0, data.min_stock ?? 0,
        data.purchase_price ?? 0, data.selling_price ?? 0,
        now(), data.id, tenantId,
      ]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO hw_products(id,tenant_id,name,category,unit,brand,stock,min_stock,purchase_price,selling_price)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category ?? '', data.unit ?? 'piece', data.brand ?? '',
     data.stock ?? 0, data.min_stock ?? 0, data.purchase_price ?? 0, data.selling_price ?? 0]
  );
  return id;
}

export async function adjustHwStock(tenantId: string, productId: string, qty: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hw_products SET stock=stock+?,updated_at=? WHERE id=? AND tenant_id=?`,
    [qty, now(), productId, tenantId]
  );
}

export async function deleteHwProduct(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hw_products SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

export async function listHwCategories(tenantId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ category: string }[]>(
    `SELECT DISTINCT category FROM hw_products WHERE tenant_id=? AND deleted_at IS NULL AND category!='' ORDER BY category`,
    [tenantId]
  );
  return rows.map(r => r.category);
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export async function listHwSales(
  tenantId: string,
  opts: { date?: string; month?: string } = {}
): Promise<HwSale[]> {
  const db = await getDb();
  const conditions = [`tenant_id=?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.date) { conditions.push(`sale_date=?`); params.push(opts.date); }
  if (opts.month) { conditions.push(`strftime('%Y-%m', sale_date)=?`); params.push(opts.month); }
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_sales WHERE ${where} ORDER BY sale_date DESC, updated_at DESC`,
    params
  );
  return rows.map(r => ({ ...r, total: Number(r.total), paid: Number(r.paid) }));
}

export async function getHwSaleItems(tenantId: string, saleId: string): Promise<HwSaleItem[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_sale_items WHERE tenant_id=? AND sale_id=? AND deleted_at IS NULL`,
    [tenantId, saleId]
  );
  return rows.map(r => ({
    ...r,
    quantity: Number(r.quantity),
    rate: Number(r.rate),
    amount: Number(r.amount),
  }));
}

export interface CreateHwSalePayload {
  bill_no?: string;
  customer_name?: string;
  customer_phone?: string;
  total: number;
  paid: number;
  payment_mode?: string;
  sale_date: string;
  items: Array<{
    product_id: string;
    product_name: string;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
}

export async function createHwSale(tenantId: string, data: CreateHwSalePayload): Promise<string> {
  const db = await getDb();
  const saleId = uuid();
  const billNo = data.bill_no || `HW${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO hw_sales(id,tenant_id,bill_no,customer_name,customer_phone,total,paid,payment_mode,sale_date)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    [saleId, tenantId, billNo, data.customer_name ?? '', data.customer_phone ?? '',
     data.total, data.paid, data.payment_mode ?? 'cash', data.sale_date]
  );
  for (const item of data.items) {
    await db.execute(
      `INSERT INTO hw_sale_items(id,tenant_id,sale_id,product_id,product_name,unit,quantity,rate,amount)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, saleId, item.product_id, item.product_name, item.unit,
       item.quantity, item.rate, item.amount]
    );
    // deduct stock
    await adjustHwStock(tenantId, item.product_id, -item.quantity);
  }
  return saleId;
}

export async function deleteHwSale(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hw_sales SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

// ─── Credit Accounts ─────────────────────────────────────────────────────────

export async function listHwCreditAccounts(
  tenantId: string,
  search?: string
): Promise<HwCreditAccount[]> {
  const db = await getDb();
  if (search) {
    const rows = await db.select<any[]>(
      `SELECT * FROM hw_credit_accounts WHERE tenant_id=? AND deleted_at IS NULL
       AND (customer_name LIKE ? OR phone LIKE ?) ORDER BY customer_name`,
      [tenantId, `%${search}%`, `%${search}%`]
    );
    return rows.map(r => ({ ...r, balance: Number(r.balance) }));
  }
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_credit_accounts WHERE tenant_id=? AND deleted_at IS NULL ORDER BY customer_name`,
    [tenantId]
  );
  return rows.map(r => ({ ...r, balance: Number(r.balance) }));
}

export async function saveHwCreditAccount(
  tenantId: string,
  data: Partial<HwCreditAccount> & { customer_name: string }
): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hw_credit_accounts SET customer_name=?,phone=?,address=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [data.customer_name, data.phone ?? '', data.address ?? '', now(), data.id, tenantId]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO hw_credit_accounts(id,tenant_id,customer_name,phone,address,balance) VALUES(?,?,?,?,?,0)`,
    [id, tenantId, data.customer_name, data.phone ?? '', data.address ?? '']
  );
  return id;
}

export async function deleteHwCreditAccount(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hw_credit_accounts SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`,
    [now(), now(), id, tenantId]
  );
}

export async function listHwCreditTransactions(
  tenantId: string,
  accountId: string
): Promise<HwCreditTransaction[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_credit_transactions WHERE tenant_id=? AND account_id=? AND deleted_at IS NULL ORDER BY date DESC`,
    [tenantId, accountId]
  );
  return rows.map(r => ({ ...r, amount: Number(r.amount) }));
}

export async function addHwCreditTransaction(
  tenantId: string,
  data: { account_id: string; type: 'debit' | 'credit'; amount: number; description: string; date: string }
): Promise<void> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO hw_credit_transactions(id,tenant_id,account_id,type,amount,description,date) VALUES(?,?,?,?,?,?,?)`,
    [id, tenantId, data.account_id, data.type, data.amount, data.description, data.date]
  );
  // update running balance
  const delta = data.type === 'debit' ? data.amount : -data.amount;
  await db.execute(
    `UPDATE hw_credit_accounts SET balance=balance+?,updated_at=? WHERE id=? AND tenant_id=?`,
    [delta, now(), data.account_id, tenantId]
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getHardwareStats(tenantId: string): Promise<HardwareStats> {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  const monthStr = today.slice(0, 7);

  const [todaySalesRow] = await db.select<{ cnt: number; rev: number }[]>(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as rev FROM hw_sales
     WHERE tenant_id=? AND deleted_at IS NULL AND sale_date=?`,
    [tenantId, today]
  );
  const [monthRev] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total FROM hw_sales
     WHERE tenant_id=? AND deleted_at IS NULL AND strftime('%Y-%m', sale_date)=?`,
    [tenantId, monthStr]
  );
  const [lowStock] = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM hw_products WHERE tenant_id=? AND deleted_at IS NULL AND stock <= min_stock`,
    [tenantId]
  );
  const [credit] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(balance),0) as total FROM hw_credit_accounts WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );

  return {
    todaySales: todaySalesRow.cnt,
    todayRevenue: Number(todaySalesRow.rev),
    lowStockCount: lowStock.cnt,
    creditOutstanding: Number(credit?.total ?? 0),
    monthRevenue: Number(monthRev?.total ?? 0),
  };
}
