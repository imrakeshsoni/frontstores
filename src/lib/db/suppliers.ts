import { getDb, uuid, now } from './index';

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  drug_license_no: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listSuppliers(tenantId: string, opts: { search?: string; page?: number; perPage?: number } = {}): Promise<{ items: Supplier[]; total: number }> {
  const db = await getDb();
  const { search = '', page = 1, perPage = 30 } = opts;
  const offset = (page - 1) * perPage;
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (search) { conditions.push(`(name LIKE ? OR phone LIKE ? OR gstin LIKE ?)`); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const where = conditions.join(' AND ');
  const [{ total }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM suppliers WHERE ${where}`, params);
  const items = await db.select<Supplier[]>(`SELECT * FROM suppliers WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`, [...params, perPage, offset]);
  return { items, total };
}

export async function createSupplier(tenantId: string, data: Pick<Supplier, 'name' | 'phone' | 'email' | 'address' | 'gstin' | 'drug_license_no' | 'notes'>): Promise<Supplier> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO suppliers (id, tenant_id, name, phone, email, address, gstin, drug_license_no, notes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone ?? null, data.email ?? null, data.address ?? null,
     data.gstin ?? null, data.drug_license_no ?? null, data.notes ?? null]
  );
  const rows = await db.select<Supplier[]>(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  return rows[0];
}

export async function updateSupplier(tenantId: string, id: string, data: Partial<Supplier>): Promise<void> {
  const db = await getDb();
  const safe: any = { ...data, updated_at: now() };
  delete safe.id; delete safe.tenant_id; delete safe.created_at;
  const fields = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  await db.execute(`UPDATE suppliers SET ${fields} WHERE id = ? AND tenant_id = ?`, [...Object.values(safe), id, tenantId]);
}

export async function deleteSupplier(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE suppliers SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}
