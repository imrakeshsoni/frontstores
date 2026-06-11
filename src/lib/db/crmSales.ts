// [crm] [all tenants]
import { getDb, uuid, now } from './index';

export interface CRMSaleItem {
  description: string;
  qty: number;
  rate: number;
}

export interface CRMSale {
  id: string; tenant_id: string;
  contact_id: string; account_id: string;
  doc_type: string; doc_no: string; title: string;
  items: string; subtotal: number; discount: number; tax: number; total: number;
  status: string; due_date: string | null; notes: string; owner: string;
  updated_at: string; deleted_at: string | null;
}

export interface CRMPayment {
  id: string; tenant_id: string; sale_id: string;
  amount: number; method: string; paid_at: string; notes: string;
  updated_at: string; deleted_at: string | null;
}

export async function listCRMSales(tenantId: string, opts: { docType?: string; contactId?: string; status?: string } = {}): Promise<CRMSale[]> {
  const db = await getDb();
  const conds = ['tenant_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  if (opts.docType) { conds.push('doc_type = ?'); params.push(opts.docType); }
  if (opts.contactId) { conds.push('contact_id = ?'); params.push(opts.contactId); }
  if (opts.status) { conds.push('status = ?'); params.push(opts.status); }
  return db.select<CRMSale[]>(`SELECT * FROM crm_sales WHERE ${conds.join(' AND ')} ORDER BY updated_at DESC`, params);
}

export async function createCRMSale(tenantId: string, data: Partial<CRMSale>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const docNo = data.doc_no || `${(data.doc_type || 'quote').toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO crm_sales (id,tenant_id,contact_id,account_id,doc_type,doc_no,title,items,subtotal,discount,tax,total,status,due_date,notes,owner,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.contact_id ?? '', data.account_id ?? '', data.doc_type || 'quote', docNo, data.title ?? '',
     data.items ?? '[]', data.subtotal ?? 0, data.discount ?? 0, data.tax ?? 0, data.total ?? 0,
     data.status || 'draft', data.due_date ?? null, data.notes ?? '', data.owner ?? '', now()]
  );
  return id;
}

export async function updateCRMSale(tenantId: string, id: string, data: Partial<CRMSale>): Promise<void> {
  const db = await getDb();
  const fields = ['contact_id','account_id','doc_type','doc_no','title','items','subtotal','discount','tax','total','status','due_date','notes','owner'];
  const updates: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now()];
  for (const f of fields) { if (f in data) { updates.push(`${f} = ?`); vals.push((data as Record<string, unknown>)[f]); } }
  await db.execute(`UPDATE crm_sales SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, [...vals, id, tenantId]);
}

export async function deleteCRMSale(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_sales SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function listCRMPayments(tenantId: string, saleId?: string): Promise<CRMPayment[]> {
  const db = await getDb();
  if (saleId) {
    return db.select<CRMPayment[]>(`SELECT * FROM crm_payments WHERE tenant_id = ? AND sale_id = ? AND deleted_at IS NULL ORDER BY paid_at DESC`, [tenantId, saleId]);
  }
  return db.select<CRMPayment[]>(`SELECT * FROM crm_payments WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY paid_at DESC`, [tenantId]);
}

export async function createCRMPayment(tenantId: string, data: Omit<CRMPayment, 'id' | 'tenant_id' | 'updated_at' | 'deleted_at'>): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO crm_payments (id,tenant_id,sale_id,amount,method,paid_at,notes,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.sale_id, data.amount ?? 0, data.method || 'cash', data.paid_at, data.notes ?? '', now()]
  );
  return id;
}

export async function deleteCRMPayment(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE crm_payments SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface CRMSalesStats {
  totalQuotes: number;
  totalOrders: number;
  totalInvoices: number;
  totalRevenue: number;
  totalReceived: number;
  totalDue: number;
}

export async function getCRMSalesStats(tenantId: string): Promise<CRMSalesStats> {
  const db = await getDb();
  const [{ total: totalQuotes }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_sales WHERE tenant_id = ? AND deleted_at IS NULL AND doc_type = 'quote'`, [tenantId]);
  const [{ total: totalOrders }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_sales WHERE tenant_id = ? AND deleted_at IS NULL AND doc_type = 'order'`, [tenantId]);
  const [{ total: totalInvoices }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM crm_sales WHERE tenant_id = ? AND deleted_at IS NULL AND doc_type = 'invoice'`, [tenantId]);
  const invRows = await db.select<{ total: number }[]>(`SELECT total FROM crm_sales WHERE tenant_id = ? AND deleted_at IS NULL AND doc_type = 'invoice'`, [tenantId]);
  const totalRevenue = invRows.reduce((s, r) => s + (r.total || 0), 0);
  const payRows = await db.select<{ amount: number }[]>(
    `SELECT p.amount as amount FROM crm_payments p JOIN crm_sales s ON s.id = p.sale_id WHERE p.tenant_id = ? AND p.deleted_at IS NULL AND s.doc_type = 'invoice'`, [tenantId]
  );
  const totalReceived = payRows.reduce((s, r) => s + (r.amount || 0), 0);
  return { totalQuotes, totalOrders, totalInvoices, totalRevenue, totalReceived, totalDue: totalRevenue - totalReceived };
}
