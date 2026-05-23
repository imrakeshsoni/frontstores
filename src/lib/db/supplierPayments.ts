import { getDb, uuid, now } from './index';

export interface SupplierPayment {
  id: string; tenant_id: string; supplier_id: string;
  po_id: string | null; amount: number; payment_method: string;
  reference_no: string | null; notes: string | null;
  payment_date: string; created_at: string;
}

export async function addSupplierPayment(tenantId: string, data: {
  supplier_id: string; po_id?: string; amount: number;
  payment_method?: string; reference_no?: string; notes?: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO supplier_payments (id,tenant_id,supplier_id,po_id,amount,payment_method,reference_no,notes,payment_date,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [uuid(), tenantId, data.supplier_id, data.po_id ?? null, data.amount,
     data.payment_method ?? 'cash', data.reference_no ?? null, data.notes ?? null, now(), now(), now()]
  );
  await db.execute(
    `UPDATE suppliers SET total_paid = total_paid + ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [data.amount, now(), data.supplier_id, tenantId]
  );
}

export async function listSupplierPayments(tenantId: string, supplierId: string): Promise<SupplierPayment[]> {
  const db = await getDb();
  return db.select<SupplierPayment[]>(
    `SELECT * FROM supplier_payments WHERE tenant_id = ? AND supplier_id = ? AND deleted_at IS NULL ORDER BY payment_date DESC`,
    [tenantId, supplierId]
  );
}

export async function getSupplierBalance(tenantId: string, supplierId: string): Promise<{ payable: number; paid: number; balance: number }> {
  const db = await getDb();
  const [paid] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount),0) as total FROM supplier_payments WHERE tenant_id = ? AND supplier_id = ? AND deleted_at IS NULL`,
    [tenantId, supplierId]
  );
  const [payable] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total),0) as total FROM purchase_orders WHERE tenant_id = ? AND supplier_id = ? AND deleted_at IS NULL AND status != 'cancelled'`,
    [tenantId, supplierId]
  );
  return { payable: payable.total, paid: paid.total, balance: payable.total - paid.total };
}
