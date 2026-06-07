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
  barcode: string;
  hsn_code: string;
  gst_rate: number;
  variant: string;
  supplier_id: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwSale {
  id: string;
  tenant_id: string;
  bill_no: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  paid: number;
  payment_mode: string;
  staff_id: string;
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
  gst_rate: number;
  discount: number;
  amount: number;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwStockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  qty_delta: number;
  reason: 'sale' | 'purchase' | 'adjustment' | 'return';
  reference_type: string;
  reference_id: string;
  note: string;
  created_at: string;
}

export interface HwQuotation {
  id: string;
  tenant_id: string;
  quote_no: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  valid_until: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'expired' | 'converted';
  notes: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwQuotationItem {
  id: string;
  tenant_id: string;
  quotation_id: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  discount: number;
  amount: number;
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
  reference_bill_no: string;
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
    gst_rate: Number(r.gst_rate ?? 0),
    barcode: r.barcode ?? '',
    hsn_code: r.hsn_code ?? '',
    variant: r.variant ?? '',
    supplier_id: r.supplier_id ?? '',
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
    conditions.push(`(name LIKE ? OR brand LIKE ? OR category LIKE ? OR barcode LIKE ? OR variant LIKE ?)`);
    params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`);
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
       purchase_price=?,selling_price=?,barcode=?,hsn_code=?,gst_rate=?,variant=?,supplier_id=?,updated_at=? WHERE id=? AND tenant_id=?`,
      [
        data.name, data.category ?? '', data.unit ?? 'piece', data.brand ?? '',
        data.stock ?? 0, data.min_stock ?? 0,
        data.purchase_price ?? 0, data.selling_price ?? 0,
        data.barcode ?? '', data.hsn_code ?? '', data.gst_rate ?? 18, data.variant ?? '', data.supplier_id ?? '',
        now(), data.id, tenantId,
      ]
    );
    return data.id;
  }
  const id = uuid();
  await db.execute(
    `INSERT INTO hw_products(id,tenant_id,name,category,unit,brand,stock,min_stock,purchase_price,selling_price,barcode,hsn_code,gst_rate,variant,supplier_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.category ?? '', data.unit ?? 'piece', data.brand ?? '',
     data.stock ?? 0, data.min_stock ?? 0, data.purchase_price ?? 0, data.selling_price ?? 0,
     data.barcode ?? '', data.hsn_code ?? '', data.gst_rate ?? 18, data.variant ?? '', data.supplier_id ?? '']
  );
  return id;
}

// ─── Stock Movements (audit trail) ──────────────────────────────────────────

export async function recordHwStockMovement(
  tenantId: string,
  data: { product_id: string; product_name: string; qty_delta: number; reason: HwStockMovement['reason']; reference_type?: string; reference_id?: string; note?: string }
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO hw_stock_movements(id,tenant_id,product_id,product_name,qty_delta,reason,reference_type,reference_id,note)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.product_id, data.product_name, data.qty_delta, data.reason,
     data.reference_type ?? '', data.reference_id ?? '', data.note ?? '']
  );
}

export async function listHwStockMovements(
  tenantId: string,
  opts: { productId?: string; reason?: string; from?: string; to?: string } = {}
): Promise<HwStockMovement[]> {
  const db = await getDb();
  const conditions = [`tenant_id=?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.productId) { conditions.push(`product_id=?`); params.push(opts.productId); }
  if (opts.reason) { conditions.push(`reason=?`); params.push(opts.reason); }
  if (opts.from) { conditions.push(`created_at >= ?`); params.push(opts.from); }
  if (opts.to) { conditions.push(`created_at <= ?`); params.push(opts.to); }
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_stock_movements WHERE ${where} ORDER BY created_at DESC LIMIT 500`,
    params
  );
  return rows.map(r => ({ ...r, qty_delta: Number(r.qty_delta) }));
}

// ─── Bill Numbering ──────────────────────────────────────────────────────────

export async function getNextHwBillNumber(tenantId: string): Promise<string> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO bill_sequences (id, tenant_id, sequence_type, prefix, current_number) VALUES (?, ?, 'hardware', 'HW', 0)`,
    [uuid(), tenantId]
  );
  await db.execute(
    `UPDATE bill_sequences SET current_number = current_number + 1, updated_at = ? WHERE tenant_id = ? AND sequence_type = 'hardware'`,
    [now(), tenantId]
  );
  const rows = await db.select<{ prefix: string; current_number: number }[]>(
    `SELECT prefix, current_number FROM bill_sequences WHERE tenant_id = ? AND sequence_type = 'hardware'`,
    [tenantId]
  );
  const seq = rows[0];
  return `${seq.prefix}${String(seq.current_number).padStart(6, '0')}`;
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
  opts: { date?: string; month?: string; from?: string; to?: string } = {}
): Promise<HwSale[]> {
  const db = await getDb();
  const conditions = [`tenant_id=?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.date) { conditions.push(`sale_date=?`); params.push(opts.date); }
  if (opts.month) { conditions.push(`strftime('%Y-%m', sale_date)=?`); params.push(opts.month); }
  if (opts.from) { conditions.push(`sale_date >= ?`); params.push(opts.from); }
  if (opts.to) { conditions.push(`sale_date <= ?`); params.push(opts.to); }
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_sales WHERE ${where} ORDER BY sale_date DESC, updated_at DESC`,
    params
  );
  return rows.map(r => ({
    ...r, subtotal: Number(r.subtotal ?? 0), discount: Number(r.discount ?? 0),
    tax_total: Number(r.tax_total ?? 0), total: Number(r.total), paid: Number(r.paid),
  }));
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
    gst_rate: Number(r.gst_rate ?? 0),
    discount: Number(r.discount ?? 0),
    amount: Number(r.amount),
  }));
}

export interface CreateHwSalePayload {
  bill_no?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount?: number;
  tax_total?: number;
  total: number;
  paid: number;
  payment_mode?: string;
  staff_id?: string;
  credit_account_id?: string;
  sale_date: string;
  items: Array<{
    product_id: string;
    product_name: string;
    unit: string;
    quantity: number;
    rate: number;
    gst_rate?: number;
    discount?: number;
    amount: number;
  }>;
}

export async function createHwSale(tenantId: string, data: CreateHwSalePayload): Promise<{ saleId: string; billNo: string }> {
  const db = await getDb();
  const saleId = uuid();
  const billNo = data.bill_no || await getNextHwBillNumber(tenantId);
  await db.execute(
    `INSERT INTO hw_sales(id,tenant_id,bill_no,customer_name,customer_phone,subtotal,discount,tax_total,total,paid,payment_mode,staff_id,sale_date)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [saleId, tenantId, billNo, data.customer_name ?? '', data.customer_phone ?? '',
     data.subtotal, data.discount ?? 0, data.tax_total ?? 0, data.total, data.paid,
     data.payment_mode ?? 'cash', data.staff_id ?? '', data.sale_date]
  );
  for (const item of data.items) {
    await db.execute(
      `INSERT INTO hw_sale_items(id,tenant_id,sale_id,product_id,product_name,unit,quantity,rate,gst_rate,discount,amount)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, saleId, item.product_id, item.product_name, item.unit,
       item.quantity, item.rate, item.gst_rate ?? 0, item.discount ?? 0, item.amount]
    );
    // deduct stock + record audit movement
    await adjustHwStock(tenantId, item.product_id, -item.quantity);
    await recordHwStockMovement(tenantId, {
      product_id: item.product_id, product_name: item.product_name,
      qty_delta: -item.quantity, reason: 'sale', reference_type: 'sale', reference_id: saleId,
    });
  }
  // bridge to credit ledger when sold on credit
  if (data.payment_mode === 'credit' && data.credit_account_id) {
    const due = data.total - data.paid;
    if (due > 0) {
      await addHwCreditTransaction(tenantId, {
        account_id: data.credit_account_id, type: 'debit', amount: due,
        description: `Bill ${billNo}`, date: data.sale_date, reference_bill_no: billNo,
      });
    }
  }
  return { saleId, billNo };
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
  return rows.map(r => ({ ...r, amount: Number(r.amount), reference_bill_no: r.reference_bill_no ?? '' }));
}

export async function addHwCreditTransaction(
  tenantId: string,
  data: { account_id: string; type: 'debit' | 'credit'; amount: number; description: string; date: string; reference_bill_no?: string }
): Promise<void> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO hw_credit_transactions(id,tenant_id,account_id,type,amount,description,reference_bill_no,date) VALUES(?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.account_id, data.type, data.amount, data.description, data.reference_bill_no ?? '', data.date]
  );
  // update running balance
  const delta = data.type === 'debit' ? data.amount : -data.amount;
  await db.execute(
    `UPDATE hw_credit_accounts SET balance=balance+?,updated_at=? WHERE id=? AND tenant_id=?`,
    [delta, now(), data.account_id, tenantId]
  );
}

// ─── Quotations / Estimates ──────────────────────────────────────────────────

export async function listHwQuotations(
  tenantId: string,
  opts: { status?: string; search?: string } = {}
): Promise<HwQuotation[]> {
  const db = await getDb();
  const conditions = [`tenant_id=?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.status) { conditions.push(`status=?`); params.push(opts.status); }
  if (opts.search) {
    conditions.push(`(quote_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`);
    params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`);
  }
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_quotations WHERE ${where} ORDER BY created_at DESC`,
    params
  );
  return rows.map(r => ({
    ...r, subtotal: Number(r.subtotal), discount: Number(r.discount),
    tax_total: Number(r.tax_total), total: Number(r.total),
  }));
}

export async function getHwQuotationItems(tenantId: string, quotationId: string): Promise<HwQuotationItem[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT * FROM hw_quotation_items WHERE tenant_id=? AND quotation_id=? AND deleted_at IS NULL`,
    [tenantId, quotationId]
  );
  return rows.map(r => ({
    ...r, quantity: Number(r.quantity), rate: Number(r.rate),
    gst_rate: Number(r.gst_rate), discount: Number(r.discount), amount: Number(r.amount),
  }));
}

export interface SaveHwQuotationPayload {
  id?: string;
  customer_name: string;
  customer_phone?: string;
  subtotal: number;
  discount?: number;
  tax_total?: number;
  total: number;
  valid_until?: string;
  status?: HwQuotation['status'];
  notes?: string;
  items: Array<{ product_id?: string | null; product_name: string; unit: string; quantity: number; rate: number; gst_rate?: number; discount?: number; amount: number }>;
}

export async function saveHwQuotation(tenantId: string, data: SaveHwQuotationPayload): Promise<string> {
  const db = await getDb();
  if (data.id) {
    await db.execute(
      `UPDATE hw_quotations SET customer_name=?,customer_phone=?,subtotal=?,discount=?,tax_total=?,total=?,valid_until=?,status=?,notes=?,updated_at=?
       WHERE id=? AND tenant_id=?`,
      [data.customer_name, data.customer_phone ?? '', data.subtotal, data.discount ?? 0, data.tax_total ?? 0,
       data.total, data.valid_until ?? null, data.status ?? 'draft', data.notes ?? '', now(), data.id, tenantId]
    );
    await db.execute(`UPDATE hw_quotation_items SET deleted_at=? WHERE quotation_id=? AND tenant_id=?`, [now(), data.id, tenantId]);
    for (const item of data.items) {
      await db.execute(
        `INSERT INTO hw_quotation_items(id,tenant_id,quotation_id,product_id,product_name,unit,quantity,rate,gst_rate,discount,amount)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [uuid(), tenantId, data.id, item.product_id ?? null, item.product_name, item.unit,
         item.quantity, item.rate, item.gst_rate ?? 0, item.discount ?? 0, item.amount]
      );
    }
    return data.id;
  }
  const id = uuid();
  const quoteNo = `EST${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO hw_quotations(id,tenant_id,quote_no,customer_name,customer_phone,subtotal,discount,tax_total,total,valid_until,status,notes)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, quoteNo, data.customer_name, data.customer_phone ?? '', data.subtotal, data.discount ?? 0,
     data.tax_total ?? 0, data.total, data.valid_until ?? null, data.status ?? 'draft', data.notes ?? '']
  );
  for (const item of data.items) {
    await db.execute(
      `INSERT INTO hw_quotation_items(id,tenant_id,quotation_id,product_id,product_name,unit,quantity,rate,gst_rate,discount,amount)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), tenantId, id, item.product_id ?? null, item.product_name, item.unit,
       item.quantity, item.rate, item.gst_rate ?? 0, item.discount ?? 0, item.amount]
    );
  }
  return id;
}

export async function deleteHwQuotation(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE hw_quotations SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`, [now(), now(), id, tenantId]);
}

export async function convertHwQuotationToSale(tenantId: string, quotationId: string, paymentMode: string = 'cash'): Promise<string> {
  const [quotes, items] = await Promise.all([
    listHwQuotations(tenantId, {}),
    getHwQuotationItems(tenantId, quotationId),
  ]);
  const quote = quotes.find(q => q.id === quotationId);
  if (!quote) throw new Error('Quotation not found');
  const { saleId } = await createHwSale(tenantId, {
    customer_name: quote.customer_name,
    customer_phone: quote.customer_phone,
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax_total: quote.tax_total,
    total: quote.total,
    paid: quote.total,
    payment_mode: paymentMode,
    sale_date: now().slice(0, 10),
    items: items.map(i => ({
      product_id: i.product_id ?? '', product_name: i.product_name, unit: i.unit,
      quantity: i.quantity, rate: i.rate, gst_rate: i.gst_rate, discount: i.discount, amount: i.amount,
    })),
  });
  const db = await getDb();
  await db.execute(`UPDATE hw_quotations SET status='converted',updated_at=? WHERE id=? AND tenant_id=?`, [now(), quotationId, tenantId]);
  return saleId;
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

export interface HwMonthRevenue { month: string; revenue: number; bills: number }

export async function getHwRevenueTrend(tenantId: string, months: number = 12): Promise<HwMonthRevenue[]> {
  const db = await getDb();
  const rows = await db.select<{ month: string; revenue: number; bills: number }[]>(
    `SELECT strftime('%Y-%m', sale_date) as month, COALESCE(SUM(total),0) as revenue, COUNT(*) as bills
     FROM hw_sales WHERE tenant_id=? AND deleted_at IS NULL
     GROUP BY month ORDER BY month DESC LIMIT ?`,
    [tenantId, months]
  );
  return rows.map(r => ({ month: r.month, revenue: Number(r.revenue), bills: Number(r.bills) })).reverse();
}

export interface HwTopProduct { product_id: string; product_name: string; quantity: number; revenue: number }

export async function getHwTopProducts(tenantId: string, opts: { from?: string; to?: string; limit?: number } = {}): Promise<HwTopProduct[]> {
  const db = await getDb();
  const conditions = [`si.tenant_id=?`, `si.deleted_at IS NULL`, `s.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.from) { conditions.push(`s.sale_date >= ?`); params.push(opts.from); }
  if (opts.to) { conditions.push(`s.sale_date <= ?`); params.push(opts.to); }
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT si.product_id, si.product_name, SUM(si.quantity) as quantity, SUM(si.amount) as revenue
     FROM hw_sale_items si JOIN hw_sales s ON s.id = si.sale_id
     WHERE ${where} GROUP BY si.product_id, si.product_name ORDER BY revenue DESC LIMIT ?`,
    [...params, opts.limit ?? 8]
  );
  return rows.map(r => ({ ...r, quantity: Number(r.quantity), revenue: Number(r.revenue) }));
}

export interface HwCategoryMix { category: string; revenue: number; quantity: number }

export async function getHwCategoryMix(tenantId: string, opts: { from?: string; to?: string; limit?: number } = {}): Promise<HwCategoryMix[]> {
  const db = await getDb();
  const conditions = [`si.tenant_id=?`, `si.deleted_at IS NULL`, `s.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.from) { conditions.push(`s.sale_date >= ?`); params.push(opts.from); }
  if (opts.to) { conditions.push(`s.sale_date <= ?`); params.push(opts.to); }
  const where = conditions.join(' AND ');
  const rows = await db.select<any[]>(
    `SELECT COALESCE(NULLIF(p.category,''),'Uncategorized') as category, SUM(si.amount) as revenue, SUM(si.quantity) as quantity
     FROM hw_sale_items si
     JOIN hw_sales s ON s.id = si.sale_id
     LEFT JOIN hw_products p ON p.id = si.product_id
     WHERE ${where} GROUP BY category ORDER BY revenue DESC LIMIT ?`,
    [...params, opts.limit ?? 6]
  );
  return rows.map(r => ({ ...r, revenue: Number(r.revenue), quantity: Number(r.quantity) }));
}

export interface HwGstSlab { gst_rate: number; taxable: number; tax: number }
export interface HwProfitSummary {
  revenue: number; cost: number; profit: number;
  gstSlabs: HwGstSlab[];
  stockValuation: number;
}

export async function getHwProfitAndGstSummary(tenantId: string, opts: { from?: string; to?: string } = {}): Promise<HwProfitSummary> {
  const db = await getDb();
  const conditions = [`si.tenant_id=?`, `si.deleted_at IS NULL`, `s.deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (opts.from) { conditions.push(`s.sale_date >= ?`); params.push(opts.from); }
  if (opts.to) { conditions.push(`s.sale_date <= ?`); params.push(opts.to); }
  const where = conditions.join(' AND ');

  const rows = await db.select<any[]>(
    `SELECT si.quantity as quantity, si.amount as amount, si.gst_rate as gst_rate,
            COALESCE(p.purchase_price, 0) as purchase_price
     FROM hw_sale_items si
     JOIN hw_sales s ON s.id = si.sale_id
     LEFT JOIN hw_products p ON p.id = si.product_id
     WHERE ${where}`,
    params
  );

  let revenue = 0, cost = 0;
  const slabMap = new Map<number, { taxable: number; tax: number }>();
  for (const r of rows) {
    const amount = Number(r.amount);
    const gstRate = Number(r.gst_rate ?? 0);
    const taxable = gstRate > 0 ? amount / (1 + gstRate / 100) : amount;
    const tax = amount - taxable;
    revenue += amount;
    cost += Number(r.quantity) * Number(r.purchase_price);
    const slab = slabMap.get(gstRate) ?? { taxable: 0, tax: 0 };
    slab.taxable += taxable; slab.tax += tax;
    slabMap.set(gstRate, slab);
  }
  const gstSlabs = Array.from(slabMap.entries())
    .map(([gst_rate, v]) => ({ gst_rate, taxable: v.taxable, tax: v.tax }))
    .sort((a, b) => a.gst_rate - b.gst_rate);

  const [{ valuation }] = await db.select<{ valuation: number }[]>(
    `SELECT COALESCE(SUM(stock * purchase_price), 0) as valuation FROM hw_products WHERE tenant_id=? AND deleted_at IS NULL`,
    [tenantId]
  );

  return { revenue, cost, profit: revenue - cost, gstSlabs, stockValuation: Number(valuation) };
}

// ── Staff / Attendance / Salary ─────────────────────────────────────────────
// [hardware] [all tenants]

export interface HardwareStaff {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  monthly_salary: number;
  joining_date: string | null;
  deduct_half_day: boolean;
  deduct_full_day_leave: boolean;
}

export type HwAttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave' | 'holiday';

export interface HardwareAttendance {
  id: string;
  tenant_id: string;
  staff_id: string;
  date: string;
  status: HwAttendanceStatus;
  note: string | null;
  updated_at: string;
}

export interface HardwareSalaryAdvance {
  id: string;
  tenant_id: string;
  staff_id: string;
  month: string;
  amount: number;
  note: string | null;
  given_at: string | null;
  created_at: string;
}

export interface HardwareSalaryPayment {
  id: string;
  tenant_id: string;
  staff_id: string;
  month: string;
  amount_paid: number;
  payment_method: string;
  note: string | null;
  paid_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface HwStaffSalarySummary {
  staff: HardwareStaff;
  present: number;
  half_day: number;
  absent: number;
  leave: number;
  holiday: number;
  working_days: number;
  per_day_rate: number;
  payable_days: number;
  net_salary: number;
  deductions: number;
  advance: number;
  payable_amount: number;
}

function mapHwStaff(r: any): HardwareStaff {
  return {
    ...r,
    is_active: r.is_active === 1,
    deduct_half_day: r.deduct_half_day === 1,
    deduct_full_day_leave: r.deduct_full_day_leave === 1,
    monthly_salary: r.monthly_salary ?? 0,
  };
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export async function listHwStaff(tenantId: string): Promise<HardwareStaff[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM hardware_staff WHERE tenant_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY name`, [tenantId]);
  return rows.map(mapHwStaff);
}

export async function listAllHwStaff(tenantId: string): Promise<HardwareStaff[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM hardware_staff WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name`, [tenantId]);
  return rows.map(mapHwStaff);
}

export async function createHwStaff(tenantId: string, data: {
  name: string; phone?: string; role?: string;
  monthly_salary?: number; joining_date?: string;
  deduct_half_day?: boolean; deduct_full_day_leave?: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO hardware_staff (id, tenant_id, name, phone, role, monthly_salary, joining_date, deduct_half_day, deduct_full_day_leave) VALUES (?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.name, data.phone ?? null, data.role ?? 'salesman',
     data.monthly_salary ?? 0, data.joining_date ?? null,
     data.deduct_half_day !== false ? 1 : 0, data.deduct_full_day_leave ? 1 : 0]
  );
}

export async function updateHwStaff(tenantId: string, id: string, data: {
  name?: string; phone?: string; role?: string;
  monthly_salary?: number; joining_date?: string;
  deduct_half_day?: boolean; deduct_full_day_leave?: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE hardware_staff SET name=?, phone=?, role=?, monthly_salary=?, joining_date=?, deduct_half_day=?, deduct_full_day_leave=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [data.name, data.phone ?? null, data.role, data.monthly_salary ?? 0, data.joining_date ?? null,
     data.deduct_half_day !== false ? 1 : 0, data.deduct_full_day_leave ? 1 : 0, now(), id, tenantId]
  );
}

export async function deleteHwStaff(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE hardware_staff SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function upsertHwAttendance(tenantId: string, staffId: string, date: string, status: HwAttendanceStatus, note?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO hardware_attendance (id, tenant_id, staff_id, date, status, note, updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(tenant_id, staff_id, date) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at, deleted_at=NULL`,
    [uuid(), tenantId, staffId, date, status, note ?? null, now()]
  );
}

export async function getHwAttendanceForMonth(tenantId: string, year: number, month: number): Promise<HardwareAttendance[]> {
  const db = await getDb();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return db.select<HardwareAttendance[]>(
    `SELECT * FROM hardware_attendance WHERE tenant_id = ? AND date LIKE ? AND deleted_at IS NULL`,
    [tenantId, `${prefix}-%`]
  );
}

export async function getHwAttendanceForStaffMonth(tenantId: string, staffId: string, year: number, month: number): Promise<HardwareAttendance[]> {
  const db = await getDb();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return db.select<HardwareAttendance[]>(
    `SELECT * FROM hardware_attendance WHERE tenant_id = ? AND staff_id = ? AND date LIKE ? AND deleted_at IS NULL`,
    [tenantId, staffId, `${prefix}-%`]
  );
}

export function computeHwSalary(staff: HardwareStaff, attendance: HardwareAttendance[], year: number, month: number): HwStaffSalarySummary {
  const daysInMonth = new Date(year, month, 0).getDate();

  // Determine first payable day
  let startDay = 1;
  if (staff.joining_date) {
    const jd = new Date(staff.joining_date);
    // Validate date parsed correctly (guard against "Feb 30" overflow, etc.)
    if (!isNaN(jd.getTime())) {
      if (jd.getFullYear() === year && jd.getMonth() + 1 === month) {
        startDay = Math.min(Math.max(jd.getDate(), 1), daysInMonth);
      } else if (jd > new Date(year, month - 1, daysInMonth)) {
        // Joined after this month — 0 salary
        return { staff, present: 0, half_day: 0, absent: 0, leave: 0, holiday: 0, working_days: 0, per_day_rate: 0, payable_days: 0, net_salary: 0, deductions: 0, advance: 0, payable_amount: 0 };
      }
      // If joined before this month, startDay stays 1
    }
  }

  const working_days = daysInMonth - startDay + 1;
  const per_day_rate = staff.monthly_salary > 0 ? staff.monthly_salary / daysInMonth : 0;

  // Only count attendance within the payable period
  const payableAttendance = attendance.filter(a => {
    const d = parseInt(a.date.slice(8, 10));
    return d >= startDay;
  });

  const present = payableAttendance.filter(a => a.status === 'present').length;
  const half_day = payableAttendance.filter(a => a.status === 'half_day').length;
  const absent = payableAttendance.filter(a => a.status === 'absent').length;
  const leave = payableAttendance.filter(a => a.status === 'leave').length;
  const holiday = payableAttendance.filter(a => a.status === 'holiday').length;

  // Days not yet marked = treated as present for display (partial month)
  const marked = present + half_day + absent + leave + holiday;
  const unmarked = Math.max(0, working_days - marked);

  const payable_present = present + unmarked + holiday; // holiday = always paid
  const payable_half = staff.deduct_half_day ? half_day * 0.5 : half_day;
  const payable_leave = staff.deduct_full_day_leave ? 0 : leave;
  const payable_days = payable_present + payable_half + payable_leave;

  const net_salary = Math.round(per_day_rate * payable_days);
  const deductions = Math.round(staff.monthly_salary - net_salary);

  return { staff, present, half_day, absent, leave, holiday, working_days, per_day_rate, payable_days, net_salary, deductions, advance: 0, payable_amount: net_salary };
}

export async function getHwAttendanceSummaryForMonth(tenantId: string, year: number, month: number): Promise<HwStaffSalarySummary[]> {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const [staffList, allAttendance, advances] = await Promise.all([
    listAllHwStaff(tenantId),
    getHwAttendanceForMonth(tenantId, year, month),
    getHwSalaryAdvancesForMonth(tenantId, monthStr),
  ]);
  return staffList.map(staff => {
    const att = allAttendance.filter(a => a.staff_id === staff.id);
    const summary = computeHwSalary(staff, att, year, month);
    const advance = Math.min(
      advances.filter(a => a.staff_id === staff.id).reduce((s, a) => s + a.amount, 0),
      summary.net_salary  // advance can never exceed net salary
    );
    return { ...summary, advance, payable_amount: Math.max(0, summary.net_salary - advance) };
  });
}

// ── Salary Advance ────────────────────────────────────────────────────────────

export async function getHwSalaryAdvancesForMonth(tenantId: string, month: string): Promise<HardwareSalaryAdvance[]> {
  const db = await getDb();
  return db.select<HardwareSalaryAdvance[]>(
    `SELECT * FROM hardware_salary_advances WHERE tenant_id = ? AND month = ? AND deleted_at IS NULL ORDER BY created_at`,
    [tenantId, month]
  );
}

export async function addHwSalaryAdvance(tenantId: string, staffId: string, month: string, amount: number, note?: string, givenAt?: string): Promise<void> {
  if (!amount || amount <= 0) throw new Error('Advance amount must be greater than zero');
  const db = await getDb();
  await db.execute(
    `INSERT INTO hardware_salary_advances (id, tenant_id, staff_id, month, amount, note, given_at) VALUES (?,?,?,?,?,?,?)`,
    [uuid(), tenantId, staffId, month, amount, note ?? null, givenAt ?? now()]
  );
}

export async function deleteHwSalaryAdvance(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE hardware_salary_advances SET deleted_at = ? WHERE id = ? AND tenant_id = ?`, [now(), id, tenantId]);
}

// Returns all attendance rows for a YYYY-MM range (inclusive)
export async function getHwAttendanceForDateRange(tenantId: string, fromMonth: string, toMonth: string): Promise<HardwareAttendance[]> {
  const db = await getDb();
  return db.select<HardwareAttendance[]>(
    `SELECT * FROM hardware_attendance WHERE tenant_id = ? AND substr(date,1,7) >= ? AND substr(date,1,7) <= ? AND deleted_at IS NULL ORDER BY date`,
    [tenantId, fromMonth, toMonth]
  );
}

// Returns all advances for a YYYY-MM range (inclusive)
export async function getHwSalaryAdvancesForDateRange(tenantId: string, fromMonth: string, toMonth: string): Promise<HardwareSalaryAdvance[]> {
  const db = await getDb();
  return db.select<HardwareSalaryAdvance[]>(
    `SELECT * FROM hardware_salary_advances WHERE tenant_id = ? AND month >= ? AND month <= ? AND deleted_at IS NULL ORDER BY month, created_at`,
    [tenantId, fromMonth, toMonth]
  );
}

// ── Salary Payments ───────────────────────────────────────────────────────────

export async function recordHwSalaryPayment(
  tenantId: string, staffId: string, month: string,
  amountPaid: number, paymentMethod: string, note?: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO hardware_salary_payments (id, tenant_id, staff_id, month, amount_paid, payment_method, note, paid_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, staffId, month, amountPaid, paymentMethod, note ?? null, now(), now()]
  );
}

export async function getHwSalaryPaymentsForMonth(tenantId: string, month: string): Promise<HardwareSalaryPayment[]> {
  const db = await getDb();
  return db.select<HardwareSalaryPayment[]>(
    `SELECT * FROM hardware_salary_payments WHERE tenant_id = ? AND month = ? AND deleted_at IS NULL ORDER BY paid_at DESC`,
    [tenantId, month]
  );
}

export async function getHwSalaryPaymentsForStaff(tenantId: string, staffId: string): Promise<HardwareSalaryPayment[]> {
  const db = await getDb();
  return db.select<HardwareSalaryPayment[]>(
    `SELECT * FROM hardware_salary_payments WHERE tenant_id = ? AND staff_id = ? AND deleted_at IS NULL ORDER BY month DESC, paid_at DESC`,
    [tenantId, staffId]
  );
}
