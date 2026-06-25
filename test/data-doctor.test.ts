// Data Doctor tests — the launch-time integrity check must heal safe issues and flag the rest.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedMedical, batchSum, stockQty, type TestDb } from './helpers/testDb';

const h = vi.hoisted(() => ({ db: null as TestDb | null }));
const pad = (n: number) => String(n).padStart(2, '0');
const nowStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

vi.mock('@/lib/db/index', () => ({
  getDb: async () => h.db,
  uuid: () => crypto.randomUUID(),
  now: () => nowStr(),
  localDateISO: () => nowStr().slice(0, 10),
}));

import { runDataDoctor } from '@/lib/db/dataDoctor';

const TENANT = 'tenant-1';
const PROD = 'prod-1';

beforeEach(() => { h.db = createTestDb(); });

describe('Data Doctor', () => {
  it('heals batch over-count down to stock_qty and reports the count', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 4, batchQty: 6 });
    const report = await runDataDoctor(TENANT);
    expect(report.batchDriftFixed).toBe(1);
    expect(batchSum(h.db!, PROD)).toBe(4);
  });

  it('clamps impossible negative stock to 0', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 5, batchQty: 5 });
    h.db!.raw.prepare('UPDATE products SET stock_qty = -3 WHERE id = ?').run(PROD);
    const report = await runDataDoctor(TENANT);
    expect(report.negativeStockFixed).toBe(1);
    expect(stockQty(h.db!, PROD)).toBe(0);
  });

  it('flags orphan order_items without deleting them', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD });
    // line item pointing at a non-existent bill
    h.db!.raw.prepare(
      `INSERT INTO order_items (id, tenant_id, order_id, product_name, quantity, unit_price, total)
       VALUES (?,?,?,?,?,?,?)`
    ).run('oi-1', TENANT, 'ghost-order', 'X', 1, 10, 10);
    const report = await runDataDoctor(TENANT);
    expect(report.orphanOrderItems).toBe(1);
    // not deleted — still present for investigation
    const still = h.db!.raw.prepare('SELECT COUNT(*) AS c FROM order_items WHERE id = ?').get('oi-1') as any;
    expect(still.c).toBe(1);
  });

  it('is a no-op on healthy data', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 8, batchQty: 8 });
    const report = await runDataDoctor(TENANT);
    expect(report).toEqual({ batchDriftFixed: 0, negativeStockFixed: 0, orphanOrderItems: 0 });
  });
});
