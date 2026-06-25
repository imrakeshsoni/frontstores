// Money-critical flow tests — billing (POS), stock/inventory, khata.
// These run the REAL db-layer code against in-memory SQLite. The headline test is the one
// that would have caught the batch-stock-drift bug: a sale must reduce BOTH stock_qty and the
// batch the POS search sums.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedMedical, stockQty, batchSum, khataBalance, type TestDb } from './helpers/testDb';

// Hold the per-test db; the mock reads it so each test gets a fresh schema.
const h = vi.hoisted(() => ({ db: null as TestDb | null }));

const pad = (n: number) => String(n).padStart(2, '0');
function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Replace the db module entirely so we never load the Tauri SQL plugin.
vi.mock('@/lib/db/index', () => ({
  getDb: async () => h.db,
  uuid: () => crypto.randomUUID(),
  now: () => nowStr(),
  localDateISO: () => nowStr().slice(0, 10),
}));

import { createOrder, voidOrder } from '@/lib/db/orders';
import { addStock, reconcileBatchStock } from '@/lib/db/inventory';

const TENANT = 'tenant-1';
const PROD = 'prod-1';
const CUST = 'cust-1';

function item(over: Partial<any> = {}) {
  return {
    product_id: PROD, product_name: 'Test Med', quantity: 1, unit_price: 20, mrp: 20,
    discount: 0, gst_rate: 5, total: 0, batch_no: 'B1', expiry_date: '2030-01-01', hsn_code: null,
    ...over,
  };
}
const cashSale = (items: any[]) => ({
  items, subtotal: 0, discount: 0, tax_total: 0, total: 0,
  payment_method: 'cash', payment_status: 'paid', amount_paid: 0,
});

beforeEach(() => { h.db = createTestDb(); });

describe('POS billing ↔ stock', () => {
  it('a sale reduces BOTH stock_qty and the batch (regression: POS/Inventory must agree)', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 10, batchQty: 10 });
    await createOrder(TENANT, cashSale([item({ quantity: 3 })]));
    expect(stockQty(h.db!, PROD)).toBe(7);   // Inventory page number
    expect(batchSum(h.db!, PROD)).toBe(7);   // POS billing-search number — must match
  });

  it('recomputes totals server-side and does not trust client totals', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 10, batchQty: 10 });
    const order = await createOrder(TENANT, cashSale([item({ quantity: 2, unit_price: 50, gst_rate: 5 })]));
    expect(order.total).toBe(105); // 2*50 = 100 + 5% = 105
    expect(order.subtotal).toBe(100);
    expect(order.tax_total).toBe(5);
  });

  it('rejects selling an expired batch', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 10, batchQty: 10 });
    await expect(createOrder(TENANT, cashSale([item({ quantity: 1, expiry_date: '2000-01-01' })]))).rejects.toThrow(/expired/i);
  });

  it('rejects zero / negative quantity', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD });
    await expect(createOrder(TENANT, cashSale([item({ quantity: 0 })]))).rejects.toThrow();
  });
});

describe('khata (credit) posting', () => {
  it('a credit bill posts a khata debit for the bill total', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 10, batchQty: 10, customerId: CUST, creditLimit: 0 });
    await createOrder(TENANT, {
      ...cashSale([item({ quantity: 5 })]),
      payment_method: 'credit', payment_status: 'unpaid', customer_id: CUST,
    });
    expect(khataBalance(h.db!, TENANT, CUST)).toBe(105); // 5*20 + 5%
  });

  it('enforces the credit limit', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 100, batchQty: 100, customerId: CUST, creditLimit: 50 });
    await expect(createOrder(TENANT, {
      ...cashSale([item({ quantity: 5 })]),
      payment_method: 'credit', payment_status: 'unpaid', customer_id: CUST,
    })).rejects.toThrow(/credit limit/i);
  });
});

describe('void restores everything', () => {
  it('void puts back stock + batch and reverses the khata debit', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 10, batchQty: 10, customerId: CUST, creditLimit: 0 });
    const order = await createOrder(TENANT, {
      ...cashSale([item({ quantity: 4 })]),
      payment_method: 'credit', payment_status: 'unpaid', customer_id: CUST,
    });
    expect(stockQty(h.db!, PROD)).toBe(6);
    expect(khataBalance(h.db!, TENANT, CUST)).toBeGreaterThan(0);

    await voidOrder(TENANT, order.id);
    expect(stockQty(h.db!, PROD)).toBe(10);
    expect(batchSum(h.db!, PROD)).toBe(10);
    expect(khataBalance(h.db!, TENANT, CUST)).toBe(0);
  });
});

describe('reconcileBatchStock self-heal', () => {
  it('draws over-counted batches down to match stock_qty', async () => {
    // Simulate historic drift: batches say 10 but the true net stock is 6.
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 6, batchQty: 10 });
    expect(batchSum(h.db!, PROD)).toBe(10);
    await reconcileBatchStock(TENANT);
    expect(batchSum(h.db!, PROD)).toBe(6);
  });

  it('is idempotent and never touches already-correct products', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 8, batchQty: 8 });
    await reconcileBatchStock(TENANT);
    await reconcileBatchStock(TENANT);
    expect(batchSum(h.db!, PROD)).toBe(8);
    expect(stockQty(h.db!, PROD)).toBe(8);
  });
});

describe('addStock keeps both counters in lockstep', () => {
  it('adds to stock_qty and creates a batch of the same amount', async () => {
    seedMedical(h.db!, { tenantId: TENANT, productId: PROD, stock: 5, batchQty: 5 });
    await addStock(TENANT, { product_id: PROD, quantity: 7, batch_no: 'B2', expiry_date: '2031-01-01' });
    expect(stockQty(h.db!, PROD)).toBe(12);
    expect(batchSum(h.db!, PROD)).toBe(12);
  });
});
