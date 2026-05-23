import { getDb, uuid, now } from './index';

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  tags: string[];
  loyalty_points: number;
  credit_limit: number;
  credit_balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapCustomer(r: any): Customer {
  return { ...r, tags: JSON.parse(r.tags || '[]') };
}

export async function listCustomers(tenantId: string, opts: { search?: string; page?: number; perPage?: number } = {}): Promise<{ items: Customer[]; total: number }> {
  const db = await getDb();
  const { search = '', page = 1, perPage = 30 } = opts;
  const offset = (page - 1) * perPage;
  const conditions = [`tenant_id = ?`, `deleted_at IS NULL`];
  const params: any[] = [tenantId];
  if (search) { conditions.push(`(name LIKE ? OR phone LIKE ?)`); params.push(`%${search}%`, `%${search}%`); }
  const where = conditions.join(' AND ');
  const [{ total }] = await db.select<{ total: number }[]>(`SELECT COUNT(*) as total FROM customers WHERE ${where}`, params);
  const items = await db.select<any[]>(`SELECT * FROM customers WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`, [...params, perPage, offset]);
  return { items: items.map(mapCustomer), total };
}

export async function getCustomerByPhone(tenantId: string, phone: string): Promise<Customer | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT * FROM customers WHERE tenant_id = ? AND phone = ? AND deleted_at IS NULL LIMIT 1`, [tenantId, phone]);
  return rows.length ? mapCustomer(rows[0]) : null;
}

export async function createCustomer(tenantId: string, data: Pick<Customer, 'name' | 'phone' | 'email' | 'address' | 'city' | 'tags' | 'credit_limit' | 'notes'>): Promise<Customer> {
  const db = await getDb();
  const id = uuid();
  await db.execute(
    `INSERT INTO customers (id, tenant_id, name, phone, email, address, city, tags, credit_limit, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, data.name, data.phone ?? null, data.email ?? null, data.address ?? null,
     data.city ?? null, JSON.stringify(data.tags ?? []), data.credit_limit ?? 0, data.notes ?? null]
  );
  const rows = await db.select<any[]>(`SELECT * FROM customers WHERE id = ?`, [id]);
  return mapCustomer(rows[0]);
}

export async function updateCustomer(tenantId: string, id: string, data: Partial<Customer>): Promise<void> {
  const db = await getDb();
  const safe: any = { ...data, updated_at: now() };
  delete safe.id; delete safe.tenant_id; delete safe.created_at;
  if ('tags' in safe) safe.tags = JSON.stringify(safe.tags);
  const fields = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  await db.execute(`UPDATE customers SET ${fields} WHERE id = ? AND tenant_id = ?`, [...Object.values(safe), id, tenantId]);
}

export async function deleteCustomer(tenantId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`, [now(), now(), id, tenantId]);
}
