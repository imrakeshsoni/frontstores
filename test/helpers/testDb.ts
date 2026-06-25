// In-memory SQLite that matches the tauri-plugin-sql Database interface ({ select, execute }),
// loaded with the real app migrations. Lets us run the actual db-layer logic (orders.ts,
// inventory.ts, …) against a real SQLite engine in Node — no Tauri required.
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';

const MIG_DIR = fileURLToPath(new URL('../../src-tauri/migrations', import.meta.url));

export interface TestDb {
  select<T = any>(sql: string, params?: unknown[]): Promise<T>;
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }>;
  raw: Database.Database;
}

const clean = (params?: unknown[]) => (params ?? []).map((p) => (p === undefined ? null : p));

export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = OFF'); // match runtime: writes happen across tables out of FK order
  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    try { sqlite.exec(readFileSync(`${MIG_DIR}/${f}`, 'utf8')); }
    catch { /* tolerate migrations for tables unrelated to the flows under test */ }
  }
  return {
    async select(sql, params) { return sqlite.prepare(sql).all(...clean(params)) as any; },
    async execute(sql, params) {
      const r = sqlite.prepare(sql).run(...clean(params));
      return { rowsAffected: r.changes, lastInsertId: Number(r.lastInsertRowid) };
    },
    raw: sqlite,
  };
}

// Seed a tenant with a product (+ batch), a customer, and an invoice sequence.
export function seedMedical(db: TestDb, opts: {
  tenantId: string; productId: string; stock?: number; batchQty?: number;
  customerId?: string; creditLimit?: number; mrp?: number; gst?: number;
}) {
  const { tenantId, productId, stock = 10, batchQty = 10, customerId, creditLimit = 0, mrp = 20, gst = 5 } = opts;
  db.raw.prepare(
    `INSERT INTO products (id, tenant_id, name, unit, mrp, selling_price, gst_rate, stock_qty, min_stock_qty, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,1)`
  ).run(productId, tenantId, 'Test Med', 'piece', mrp, mrp, gst, stock, 0);
  db.raw.prepare(
    `INSERT INTO inventory_batches (id, tenant_id, product_id, batch_no, expiry_date, quantity)
     VALUES (?,?,?,?,?,?)`
  ).run(`batch-${productId}`, tenantId, productId, 'B1', '2030-01-01', batchQty);
  db.raw.prepare(
    `INSERT INTO bill_sequences (id, tenant_id, sequence_type, prefix, current_number) VALUES (?,?,?,?,0)`
  ).run(`seq-${tenantId}`, tenantId, 'invoice', 'INV');
  if (customerId) {
    db.raw.prepare(
      `INSERT INTO customers (id, tenant_id, name, credit_limit) VALUES (?,?,?,?)`
    ).run(customerId, tenantId, 'Test Customer', creditLimit);
  }
}

// Convenience readers.
export const stockQty = (db: TestDb, id: string) =>
  (db.raw.prepare('SELECT stock_qty FROM products WHERE id = ?').get(id) as any).stock_qty;
export const batchSum = (db: TestDb, productId: string) =>
  (db.raw.prepare('SELECT COALESCE(SUM(quantity),0) AS s FROM inventory_batches WHERE product_id = ? AND deleted_at IS NULL').get(productId) as any).s;
export const khataBalance = (db: TestDb, tenantId: string, customerId: string) =>
  (db.raw.prepare(`SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END),0) AS b FROM khata_entries WHERE tenant_id=? AND customer_id=? AND deleted_at IS NULL`).get(tenantId, customerId) as any).b;
