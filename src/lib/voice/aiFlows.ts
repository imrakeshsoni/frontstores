// [all apps] [all tenants] — Intent-driven state machine for AI flows
// Handles billing, add product, stock, khata without relying on LLM to call tools.
// LLM is only used for free-form Q&A. Structured flows are deterministic.

import { aiNavigate } from './aiNavigator';
import { useCartStore } from '@/app/store/cart.store';
import { searchProductsForPOS, listProducts, createProduct } from '@/lib/db/products';
import { listCustomers } from '@/lib/db/customers';
import { createOrder } from '@/lib/db/orders';
import { adjustStock } from '@/lib/db/inventory';
import { addKhataEntry, listKhataCustomers, getCustomerBalance } from '@/lib/db/khata';
import { addExpense } from '@/lib/db/expenses';
import { now } from '@/lib/db/index';
import { invalidateAfterAIAction } from './aiQueryInvalidator';

function today() { return now().substring(0, 10); }

export type FlowName = 'billing' | 'add_product' | 'stock' | 'khata' | 'expense';

export interface FlowContext {
  step: number;
  [key: string]: unknown;
}

export interface StepResult {
  say: string;
  done?: boolean;
  retry?: boolean;
  newContext?: Partial<FlowContext>;
}

// ── Intent detection ─────────────────────────────────────────────────────────

const BILLING_KEYWORDS = /bill|billing|invoice|receipt|बिल|बिलिंग|bill karo|bana do|banao|sell|becho|de do|checkout/i;
const ADD_PRODUCT_KEYWORDS = /add product|naya product|product add|product dalna|नया product|product जोड़|add kar|create product|new product|product banao|product create|build.*product|product.*build|product.*add|product.*create/i;
const STOCK_KEYWORDS = /stock (badha|ghata|update|add|adjust)|inventory|stock karo|माल आया|stock in|stock out|maal aaya/i;
const KHATA_KEYWORDS = /khata|उधार|credit|payment (mili|aayi|di)|baki|ledger/i;
const EXPENSE_KEYWORDS = /expense|kharcha|खर्चा|kharche|bijli|rent|salary/i;
const LIST_PRODUCTS_KEYWORDS = /which product|kaun.?sa product|kya products|products (hain|hai|dikhao|list|batao|show)|product list|what product|hamare products|products we have/i;
const SALES_KEYWORDS = /sales|aaj ki bikri|today.?s sale|kitna bika|revenue|kitni kamai/i;
const LOW_STOCK_KEYWORDS = /low stock|kam stock|khatam|out of stock|stock alert/i;

export type DataQuery = 'list_products' | 'sales_today' | 'low_stock';

export function detectDataQuery(text: string): DataQuery | null {
  const t = text.toLowerCase();
  if (LIST_PRODUCTS_KEYWORDS.test(t)) return 'list_products';
  if (SALES_KEYWORDS.test(t)) return 'sales_today';
  if (LOW_STOCK_KEYWORDS.test(t)) return 'low_stock';
  return null;
}

export async function handleDataQuery(query: DataQuery, tenantId: string): Promise<string> {
  if (query === 'list_products') {
    const { items, total } = await listProducts(tenantId, { page: 1, perPage: 10 });
    if (!items.length) return 'Abhi koi product add nahi hua hai.';
    const names = items.map(p => `${p.name} (₹${p.selling_price})`).join(', ');
    return `${total} products hain. Pehle 10: ${names}.`;
  }
  if (query === 'sales_today') {
    const { getSalesSummary } = await import('@/lib/db/orders');
    const t = now().substring(0, 10);
    const s = await getSalesSummary(tenantId, t, t);
    return `Aaj ${s.total_orders ?? 0} bills bane, total ₹${(s.total_revenue ?? 0).toFixed(0)} ki bikri.`;
  }
  if (query === 'low_stock') {
    const { getLowStockAlerts } = await import('@/lib/db/inventory');
    const alerts = await getLowStockAlerts(tenantId);
    if (!alerts.length) return 'Sab products ka stock theek hai.';
    const names = alerts.slice(0, 5).map((p: { name: string; stock_qty: number }) => `${p.name} (${p.stock_qty})`).join(', ');
    return `${alerts.length} products low stock mein hain: ${names}.`;
  }
  return '';
}

export function detectIntent(text: string): FlowName | null {
  const t = text.toLowerCase();
  if (BILLING_KEYWORDS.test(t)) return 'billing';
  if (ADD_PRODUCT_KEYWORDS.test(t)) return 'add_product';
  if (STOCK_KEYWORDS.test(t)) return 'stock';
  if (KHATA_KEYWORDS.test(t)) return 'khata';
  if (EXPENSE_KEYWORDS.test(t)) return 'expense';
  return null;
}

// ── Flow: start message (spoken immediately, no LLM) ─────────────────────────

export async function startFlow(
  flow: FlowName,
  originalText = ''
): Promise<{ say: string; ctx: FlowContext }> {
  switch (flow) {
    case 'billing': {
      aiNavigate('/pos');
      // Try to extract customer name from original text: "bill X to Rakesh" / "Rakesh customer ko bill karo"
      const customerMatch = originalText.match(/(?:to|ko|customer)\s+([A-Za-zऀ-ॿ]+)/i);
      const prefilledCustomer = customerMatch ? customerMatch[1] : null;
      return {
        say: 'Kaun sa product chahiye?',
        ctx: { step: 1, fresh: true, ...(prefilledCustomer ? { customerName: prefilledCustomer } : {}) },
      };
    }
    case 'add_product':
      aiNavigate('/products');
      return { say: 'Product ka naam kya hai?', ctx: { step: 1 } };
    case 'stock':
      aiNavigate('/inventory');
      return { say: 'Kaun sa product ka stock update karna hai?', ctx: { step: 1 } };
    case 'khata':
      aiNavigate('/khata');
      return { say: 'Kaun sa customer ka khata?', ctx: { step: 1 } };
    case 'expense':
      aiNavigate('/expenses');
      return { say: 'Kitna kharcha hua?', ctx: { step: 1 } };
  }
}

// ── Flow: handle each user answer ────────────────────────────────────────────

export async function handleFlowStep(
  flow: FlowName,
  ctx: FlowContext,
  answer: string,
  tenantId: string
): Promise<StepResult> {
  switch (flow) {
    case 'billing': return billingStep(ctx, answer, tenantId);
    case 'add_product': return addProductStep(ctx, answer, tenantId);
    case 'stock': return stockStep(ctx, answer, tenantId);
    case 'khata': return khataStep(ctx, answer, tenantId);
    case 'expense': return expenseStep(ctx, answer, tenantId);
  }
}

// ── Billing flow ─────────────────────────────────────────────────────────────

async function billingStep(ctx: FlowContext, answer: string, tenantId: string): Promise<StepResult> {
  const step = ctx.step as number;

  if (step === 1) {
    // Got product name — smart search
    const { product, suggestions } = await smartSearchProduct(tenantId, answer);
    if (!product) {
      const hint = suggestions?.length
        ? `Products hain: ${suggestions.slice(0, 4).join(', ')}. Kaunsa chahiye?`
        : `Koi product nahi mila. Dobaara naam batao.`;
      return { say: hint, retry: true };
    }
    // Add to cart immediately so user sees it
    const cart = useCartStore.getState();
    if (ctx.fresh) cart.clearCart();
    const itemKey = [product.id, 'no-batch', 'no-exp'].join(':');
    cart.addItem({
      itemKey, productId: product.id, name: product.name,
      sku: product.sku ?? '', unit: product.unit ?? 'pc',
      unitPrice: Number(product.selling_price), gstRate: Number(product.gst_rate ?? 0),
      discount: 0, quantity: 1,
    });
    return {
      say: `${product.name} — ₹${product.selling_price}. Kitni quantity?`,
      newContext: {
        step: 2,
        productId: product.id, productName: product.name,
        unitPrice: Number(product.selling_price), mrp: Number(product.mrp),
        gstRate: Number(product.gst_rate ?? 0), itemKey,
        fresh: false,
      },
    };
  }

  if (step === 2) {
    // Got quantity
    const qty = parseNumber(answer);
    if (!qty || qty <= 0) return { say: 'Quantity samajh nahi aaya. Sirf number batao jaise 2 ya 5.', retry: true };
    const cart = useCartStore.getState();
    cart.updateQty(ctx.itemKey as string, qty);
    return {
      say: `${qty} set ho gaya. Aur kuch product add karna hai?`,
      newContext: { step: 3, quantity: qty },
    };
  }

  if (step === 3) {
    // More products or move on?
    const lower = answer.toLowerCase();
    if (/haan|yes|aur|more|ek aur|add karo/i.test(lower)) {
      return { say: 'Kaun sa product?', newContext: { step: 1, fresh: false } };
    }
    // Skip asking customer if already captured from original utterance
    if (ctx.customerName) {
      return { say: `Cash hai ya UPI? (Customer: ${ctx.customerName})`, newContext: { step: 5 } };
    }
    return { say: 'Customer ka naam?', newContext: { step: 4 } };
  }

  if (step === 4) {
    const customerName = /walk.?in|nahi|no|skip|default/i.test(answer) ? 'Walk-in' : answer.trim() || 'Walk-in';
    return { say: 'Cash hai ya UPI?', newContext: { step: 5, customerName } };
  }

  if (step === 5) {
    // Got payment method
    const pm = /upi|gpay|paytm|online|card/i.test(answer) ? 'upi'
      : /credit|udhar|baki/i.test(answer) ? 'credit' : 'cash';
    const cart = useCartStore.getState();
    const items = cart.items;
    const subtotal = cart.subtotal();
    const taxTotal = cart.taxAmount();
    const total = cart.total();
    const customerName = ctx.customerName as string ?? 'Walk-in';
    const paymentStatus = pm === 'credit' ? 'pending' : 'paid';

    try {
      const order = await createOrder(tenantId, {
        customer_id: null, customer_name: customerName,
        items: items.map(i => ({
          product_id: i.productId, product_name: i.name,
          quantity: i.quantity, unit_price: i.unitPrice,
          mrp: i.unitPrice, discount: i.discount,
          gst_rate: i.gstRate, total: i.quantity * i.unitPrice - i.discount,
          batch_no: i.batchNo ?? null, expiry_date: i.expiryDate ?? null,
        })),
        subtotal, discount: 0, tax_total: taxTotal, total,
        payment_method: pm, payment_status: paymentStatus,
        amount_paid: pm === 'credit' ? 0 : total, notes: null,
      });
      cart.clearCart();
      invalidateAfterAIAction('billing');
      return { say: `Bill ban gaya! ₹${total.toFixed(0)}, bill number ${order.bill_number}.`, done: true };
    } catch (e) {
      return { say: `Bill nahi bana — ${e instanceof Error ? e.message : 'error'}. Dobara try karein?`, done: true };
    }
  }

  return { say: 'Kuch aur?', done: true };
}

// ── Add Product flow ──────────────────────────────────────────────────────────

async function addProductStep(ctx: FlowContext, answer: string, tenantId: string): Promise<StepResult> {
  const step = ctx.step as number;

  if (step === 1) {
    if (!answer.trim()) return { say: 'Naam batao product ka.', retry: true };
    return { say: 'MRP kya hai?', newContext: { step: 2, name: answer.trim() } };
  }

  if (step === 2) {
    const mrp = parseNumber(answer);
    if (!mrp || mrp <= 0) return { say: 'MRP samajh nahi aaya. Number batao jaise 25 ya 150.', retry: true };
    return { say: `Selling price? (MRP ₹${mrp} hi rakhna ho to "same" bolo)`, newContext: { step: 3, mrp } };
  }

  if (step === 3) {
    const mrp = ctx.mrp as number;
    const sp = /same|haan|yes|wahi|ok/i.test(answer) ? mrp : parseNumber(answer) || mrp;
    return { say: 'Opening stock kitna hai? (nahi hai to 0 bolo)', newContext: { step: 4, sellingPrice: sp } };
  }

  if (step === 4) {
    const stock = parseNumber(answer) || 0;
    const name = ctx.name as string;
    const mrp = ctx.mrp as number;
    const sp = ctx.sellingPrice as number;
    try {
      const product = await createProduct(tenantId, {
        name, sku: null, barcode: null, category: null, brand: null,
        description: null, unit: 'strip', mrp, selling_price: sp,
        cost_price: null, gst_rate: 12, hsn_code: null, dosage_form: null,
        salt_composition: null, manufacturer: null, requires_prescription: false,
        total_units: null, ml_volume: null, wholesale_price: null, min_stock_qty: 10, is_active: true,
        deleted_at: null,
      } as Parameters<typeof createProduct>[1]);
      if (stock > 0) {
        await adjustStock(tenantId, { product_id: product.id, quantity: stock, direction: 'add', type: 'manual', notes: 'Opening stock via AI' });
      }
      invalidateAfterAIAction('product');
      return { say: `Done! "${name}" add ho gaya — ₹${sp}, ${stock} units stock.`, done: true };
    } catch (e) {
      return { say: `Product nahi ban saka — ${e instanceof Error ? e.message : 'error'}.`, done: true };
    }
  }

  return { say: 'Kuch aur?', done: true };
}

// ── Stock flow ────────────────────────────────────────────────────────────────

async function stockStep(ctx: FlowContext, answer: string, tenantId: string): Promise<StepResult> {
  const step = ctx.step as number;

  if (step === 1) {
    const { product, suggestions } = await smartSearchProduct(tenantId, answer);
    if (!product) {
      const hint = suggestions?.length
        ? `Products hain: ${suggestions.slice(0, 4).join(', ')}. Kaunsa chahiye?`
        : `"${answer}" nahi mila. Dobaara batao.`;
      return { say: hint, retry: true };
    }
    return {
      say: `${product.name} mila — abhi ${product.stock_qty} stock hai. Kitna add karna hai?`,
      newContext: { step: 2, productId: product.id, productName: product.name },
    };
  }

  if (step === 2) {
    const qty = parseNumber(answer);
    if (!qty || qty <= 0) return { say: 'Quantity samajh nahi aaya. Number batao.', retry: true };
    const dir = /ghata|remove|nikalo|kam/i.test(answer) ? 'remove' : 'add';
    await adjustStock(tenantId, {
      product_id: ctx.productId as string, quantity: qty,
      direction: dir, type: 'manual', notes: 'AI stock update',
    });
    invalidateAfterAIAction('stock');
    return { say: `${ctx.productName} ka stock ${dir === 'add' ? 'badh' : 'kam ho'} gaya — ${qty} units.`, done: true };
  }

  return { say: 'Kuch aur?', done: true };
}

// ── Khata flow ────────────────────────────────────────────────────────────────

async function khataStep(ctx: FlowContext, answer: string, tenantId: string): Promise<StepResult> {
  const step = ctx.step as number;

  if (step === 1) {
    const { items } = await listCustomers(tenantId, { search: answer, perPage: 5 });
    if (!items.length) return { say: `Customer "${answer}" nahi mila. Dobaara naam batao.`, retry: true };
    const customer = items[0];
    const balance = await getCustomerBalance(tenantId, customer.id);
    return {
      say: `${customer.name} — abhi ₹${balance.toFixed(0)} baki hai. Kitna amount?`,
      newContext: { step: 2, customerId: customer.id, customerName: customer.name },
    };
  }

  if (step === 2) {
    const amount = parseNumber(answer);
    if (!amount || amount <= 0) return { say: 'Amount samajh nahi aaya. Number batao.', retry: true };
    return { say: 'Payment mili ya credit dena hai? (payment/credit)', newContext: { step: 3, amount } };
  }

  if (step === 3) {
    const type = /payment|mila|diya|paid|debit/i.test(answer) ? 'debit' : 'credit';
    const amount = ctx.amount as number;
    await addKhataEntry(tenantId, {
      customer_id: ctx.customerId as string,
      type, amount,
      notes: type === 'debit' ? 'Payment received via AI' : 'Credit via AI',
    });
    invalidateAfterAIAction('khata');
    const label = type === 'debit' ? 'payment' : 'credit';
    return { say: `${ctx.customerName} ka ₹${amount} ${label} entry ho gayi.`, done: true };
  }

  return { say: 'Kuch aur?', done: true };
}

// ── Expense flow ──────────────────────────────────────────────────────────────

async function expenseStep(ctx: FlowContext, answer: string, tenantId: string): Promise<StepResult> {
  const step = ctx.step as number;

  if (step === 1) {
    const amount = parseNumber(answer);
    if (!amount || amount <= 0) return { say: 'Amount batao. Jaise 500 ya 1200.', retry: true };
    return { say: 'Kahan ka kharcha hai? (Rent/Electricity/Salaries/Purchase/Transport/Miscellaneous)', newContext: { step: 2, amount } };
  }

  if (step === 2) {
    const categoryMap: Record<string, string> = {
      rent: 'Rent', bijli: 'Electricity', electricity: 'Electricity',
      salary: 'Salaries', salaries: 'Salaries', purchase: 'Purchase / Stock',
      transport: 'Transport', marketing: 'Marketing', maintenance: 'Maintenance',
      packaging: 'Packaging',
    };
    const lower = answer.toLowerCase();
    const cat = Object.keys(categoryMap).find(k => lower.includes(k));
    const category = cat ? categoryMap[cat] : 'Miscellaneous';
    await addExpense(tenantId, {
      category, amount: ctx.amount as number,
      description: answer, expense_date: today(),
      payment_method: 'cash', notes: null,
    });
    invalidateAfterAIAction('expense');
    return { say: `₹${ctx.amount} ${category} kharcha record ho gaya.`, done: true };
  }

  return { say: 'Kuch aur?', done: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNumber(text: string): number {
  const match = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

// Smart product search: try full query, then each word, then show top products
export async function smartSearchProduct(tenantId: string, query: string) {
  // 1. Try full query
  let results = await searchProductsForPOS(tenantId, query);
  if (results.length) return { product: results[0], ambiguous: results.slice(1, 4) };

  // 2. Try each word individually — pick best result
  const words = query.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    results = await searchProductsForPOS(tenantId, word);
    if (results.length) return { product: results[0], ambiguous: results.slice(1, 4) };
  }

  // 3. Nothing found — return top 5 available products so AI can suggest
  const { items } = await listProducts(tenantId, { page: 1, perPage: 5 });
  return { product: null, suggestions: items.map(p => p.name) };
}

// Suppress unused import warning for listKhataCustomers
void listKhataCustomers;
