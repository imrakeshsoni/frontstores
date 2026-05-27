// [medical] [all tenants] — AI tool calling: DB access for Dolphin 3.0
import { aiNavigate } from './aiNavigator';
import { useCartStore } from '@/app/store/cart.store';
import { searchProductsForPOS, listProducts, createProduct } from '../db/products';
import { listCustomers, getCustomerByPhone } from '../db/customers';
import { listOrders, getSalesSummary, createOrder } from '../db/orders';
import { getExpiryAlerts, getLowStockAlerts, adjustStock } from '../db/inventory';
import { listKhataCustomers, listKhataEntries, addKhataEntry, getCustomerBalance } from '../db/khata';
import { addExpense, getExpenseSummary } from '../db/expenses';
import { getDb, now } from '../db/index';
import { upsertAIMemory } from '../db/ai';

function today() { return now().substring(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().substring(0, 10);
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

type ToolExecutor = (tenantId: string, args: Record<string, unknown>) => Promise<ToolResult>;

const TOOLS: Record<string, { description: string; executor: ToolExecutor }> = {

  search_products: {
    description: 'Search products by name. Args: { query: string }',
    executor: async (tid, args) => {
      const q = String(args.query || '');
      const results = await searchProductsForPOS(tid, q);
      const top = results.slice(0, 8).map(p => ({
        name: p.name, stock: p.stock_qty, price: p.selling_price, unit: p.unit,
      }));
      return { ok: true, data: top };
    },
  },

  get_low_stock: {
    description: 'Get products that are low on stock / out of stock. No args needed.',
    executor: async (tid) => {
      const alerts = await getLowStockAlerts(tid);
      return { ok: true, data: alerts.slice(0, 15) };
    },
  },

  get_expiry_alerts: {
    description: 'Get products expiring soon. Args: { days?: number } (default 90)',
    executor: async (tid, args) => {
      const days = Number(args.days || 90);
      const alerts = await getExpiryAlerts(tid, days);
      return { ok: true, data: alerts.slice(0, 15) };
    },
  },

  get_sales_summary: {
    description: 'Get sales summary (total, orders, items) for a date range. Args: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }. Use today\'s date for today.',
    executor: async (tid, args) => {
      const from = String(args.from || daysAgo(30));
      const to = String(args.to || today());
      const summary = await getSalesSummary(tid, from, to);
      return { ok: true, data: { ...summary, from, to } };
    },
  },

  get_recent_orders: {
    description: 'Get recent bills/orders. Args: { limit?: number } (default 10)',
    executor: async (tid, args) => {
      const limit = Math.min(Number(args.limit || 10), 20);
      const { items } = await listOrders(tid, { page: 1, perPage: limit });
      const orders = items.map(o => ({
        bill: o.bill_number, customer: o.customer_name || 'Walk-in',
        total: o.total, date: o.order_date.substring(0, 10), status: o.payment_status,
      }));
      return { ok: true, data: orders };
    },
  },

  search_customers: {
    description: 'Search customers by name or phone. Args: { query: string }',
    executor: async (tid, args) => {
      const q = String(args.query || '');
      const phone = q.match(/^\d{7,}$/) ? q : undefined;
      if (phone) {
        const c = await getCustomerByPhone(tid, phone);
        return { ok: true, data: c ? [c] : [] };
      }
      const { items } = await listCustomers(tid, { search: q, perPage: 8 });
      return { ok: true, data: items.map(c => ({ id: c.id, name: c.name, phone: c.phone, city: c.city })) };
    },
  },

  get_khata_customers: {
    description: 'Get all customers in Khata (credit ledger) with their outstanding balance. No args needed.',
    executor: async (tid) => {
      const customers = await listKhataCustomers(tid);
      return { ok: true, data: customers.slice(0, 20) };
    },
  },

  get_customer_balance: {
    description: 'Get khata balance for a specific customer. Args: { customer_id: string }',
    executor: async (tid, args) => {
      const customerId = String(args.customer_id || '');
      if (!customerId) return { ok: false, error: 'customer_id is required. Use search_customers first.' };
      const balance = await getCustomerBalance(tid, customerId);
      const entries = await listKhataEntries(tid, customerId);
      return { ok: true, data: { balance, entries: entries.slice(0, 10) } };
    },
  },

  add_khata_entry: {
    description: 'Add a khata (credit ledger) entry. Args: { customer_id: string, type: "credit"|"debit", amount: number, notes?: string }. "credit" = customer owes money (gave goods on credit). "debit" = customer paid money.',
    executor: async (tid, args) => {
      const customerId = String(args.customer_id || '');
      if (!customerId) return { ok: false, error: 'customer_id is required.' };
      const type = String(args.type) as 'credit' | 'debit';
      if (!['credit', 'debit'].includes(type)) return { ok: false, error: 'type must be "credit" or "debit".' };
      const amount = Number(args.amount);
      if (!amount || amount <= 0) return { ok: false, error: 'amount must be positive.' };
      await addKhataEntry(tid, {
        customer_id: customerId,
        type,
        amount,
        notes: String(args.notes || '') || undefined,
      });
      return { ok: true, data: { message: `${type === 'credit' ? 'Credit' : 'Payment'} of ₹${amount} recorded.` } };
    },
  },

  get_expense_summary: {
    description: 'Get expense summary by category for a date range. Args: { from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }',
    executor: async (tid, args) => {
      const from = String(args.from || daysAgo(30));
      const to = String(args.to || today());
      const summary = await getExpenseSummary(tid, from, to);
      return { ok: true, data: { summary, from, to } };
    },
  },

  add_expense: {
    description: 'Record an expense. Args: { category: string, amount: number, description?: string, payment_method?: "cash"|"upi"|"card" }. Valid categories: Rent, Electricity, Salaries, "Purchase / Stock", Transport, Maintenance, Marketing, Packaging, Miscellaneous.',
    executor: async (tid, args) => {
      const validCategories = ['Rent', 'Electricity', 'Salaries', 'Purchase / Stock', 'Transport', 'Maintenance', 'Marketing', 'Packaging', 'Miscellaneous'];
      const category = String(args.category || '');
      if (!validCategories.includes(category)) {
        return { ok: false, error: `Invalid category. Use one of: ${validCategories.join(', ')}` };
      }
      const amount = Number(args.amount);
      if (!amount || amount <= 0) return { ok: false, error: 'amount must be positive.' };
      const payment_method = (['cash', 'upi', 'card'].includes(String(args.payment_method)) ? String(args.payment_method) : 'cash') as 'cash' | 'upi' | 'card';
      await addExpense(tid, {
        category,
        amount,
        description: String(args.description || '') || null,
        expense_date: today(),
        payment_method,
        notes: null,
      });
      return { ok: true, data: { message: `Expense of ₹${amount} (${category}) recorded.` } };
    },
  },

  adjust_stock: {
    description: 'Adjust stock quantity for a product. Args: { product_id: string, quantity: number, direction: "add"|"remove", notes?: string }. Use search_products to get product_id first.',
    executor: async (tid, args) => {
      const productId = String(args.product_id || '');
      if (!productId) return { ok: false, error: 'product_id is required. Use search_products first.' };
      const quantity = Number(args.quantity);
      if (!quantity || quantity <= 0) return { ok: false, error: 'quantity must be positive.' };
      const direction = String(args.direction) === 'remove' ? 'remove' : 'add';
      await adjustStock(tid, {
        product_id: productId,
        quantity,
        direction,
        type: 'manual',
        notes: String(args.notes || 'Voice adjustment'),
      });
      return { ok: true, data: { message: `Stock ${direction === 'add' ? 'added' : 'reduced'} by ${quantity} units.` } };
    },
  },

  get_all_products: {
    description: 'List all products with stock info. Args: { page?: number } (20 per page). Use for overview questions.',
    executor: async (tid, args) => {
      const page = Number(args.page || 1);
      const { items, total } = await listProducts(tid, { page, perPage: 20 });
      return {
        ok: true,
        data: {
          total,
          page,
          items: items.map(p => ({ id: p.id, name: p.name, stock: p.stock_qty, price: p.selling_price, unit: p.unit })),
        },
      };
    },
  },

  // [medical] [all tenants] — create a full bill via voice
  create_bill: {
    description: 'Create a bill/order. Args: { items: [{product_id, product_name, quantity, loose_qty?, unit_price, mrp, gst_rate, discount?, batch_no?, expiry_date?}], customer_id?, customer_name?, payment_method? ("cash"|"upi"|"card"|"credit"), notes? }',
    executor: async (tid, args) => {
      const rawItems = (args.items as Record<string, unknown>[]) || [];
      if (!rawItems.length) return { ok: false, error: 'No items provided.' };

      const orderItems: {
        product_id: string | null;
        product_name: string;
        quantity: number;
        unit_price: number;
        mrp: number;
        discount: number;
        gst_rate: number;
        total: number;
        batch_no: string | null;
        expiry_date: string | null;
      }[] = [];

      for (const raw of rawItems) {
        const productId = raw.product_id ? String(raw.product_id) : null;
        const productName = String(raw.product_name || '');
        const quantity = Number(raw.quantity || 0);
        const looseQty = Number(raw.loose_qty || 0);
        const unitPrice = Number(raw.unit_price || 0);
        const mrp = Number(raw.mrp || unitPrice);
        const gstRate = Number(raw.gst_rate || 0);
        const discount = Number(raw.discount || 0);
        const batchNo = raw.batch_no ? String(raw.batch_no) : null;
        const expiryDate = raw.expiry_date ? String(raw.expiry_date) : null;

        if (quantity > 0) {
          orderItems.push({
            product_id: productId,
            product_name: productName,
            quantity,
            unit_price: unitPrice,
            mrp,
            discount,
            gst_rate: gstRate,
            total: quantity * unitPrice - discount,
            batch_no: batchNo,
            expiry_date: expiryDate,
          });
        }

        // Add loose item as a separate line
        if (looseQty > 0) {
          const looseUnitPrice = unitPrice / 10;
          orderItems.push({
            product_id: productId,
            product_name: `${productName} (loose)`,
            quantity: looseQty,
            unit_price: looseUnitPrice,
            mrp: mrp / 10,
            discount: 0,
            gst_rate: gstRate,
            total: looseQty * looseUnitPrice,
            batch_no: batchNo,
            expiry_date: expiryDate,
          });
        }
      }

      const paymentMethod = String(args.payment_method || 'cash');
      const subtotal = orderItems.reduce((s, i) => s + (i.quantity * i.unit_price - i.discount), 0);
      const taxTotal = orderItems.reduce((s, i) => s + (i.quantity * i.unit_price * i.gst_rate / 100), 0);
      const total = subtotal + taxTotal;
      const paymentStatus = paymentMethod === 'credit' ? 'pending' : 'paid';
      const amountPaid = paymentMethod === 'credit' ? 0 : total;

      const order = await createOrder(tid, {
        customer_id: args.customer_id ? String(args.customer_id) : null,
        customer_name: String(args.customer_name || 'Walk-in'),
        items: orderItems,
        subtotal,
        discount: orderItems.reduce((s, i) => s + i.discount, 0),
        tax_total: taxTotal,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_paid: amountPaid,
        notes: args.notes ? String(args.notes) : null,
      });

      return { ok: true, data: { bill_number: order.bill_number, total: order.total, items_count: orderItems.length } };
    },
  },

  // [medical] [all tenants] — morning briefing data
  get_briefing_data: {
    description: 'Get morning briefing data: today\'s sales, low stock, expiry alerts, khata outstanding. No args.',
    executor: async (tid) => {
      const todayStr = now().substring(0, 10);
      const [salesSummary, lowStock, expiryAlerts, khataCustomers] = await Promise.all([
        getSalesSummary(tid, todayStr, todayStr),
        getLowStockAlerts(tid),
        getExpiryAlerts(tid, 30),
        listKhataCustomers(tid),
      ]);
      const outstanding = khataCustomers.filter(c => c.balance > 0);
      const outstandingTotal = outstanding.reduce((s, c) => s + c.balance, 0);
      return {
        ok: true,
        data: {
          today_sales: salesSummary,
          low_stock_count: lowStock.length,
          low_stock_top3: lowStock.slice(0, 3).map((p: { name: string }) => p.name),
          expiry_alerts_count: expiryAlerts.length,
          expiry_top3: expiryAlerts.slice(0, 3).map((p: { name: string }) => p.name),
          khata_customers_with_balance: outstanding.length,
          khata_total_outstanding: outstandingTotal,
          khata_top3: outstanding.slice(0, 3).map(c => ({ name: c.customer_name, balance: c.balance })),
        },
      };
    },
  },

  // [medical] [all tenants] — stock velocity (30d sales rate + days remaining)
  get_stock_velocity: {
    description: 'Get stock velocity: daily sales rate and days of stock remaining per product. Args: { product_name?: string }',
    executor: async (tid, args) => {
      const db = await getDb();
      const nameFilter = args.product_name ? `%${String(args.product_name)}%` : null;
      const rows = await db.select<{ product_name: string; sold_30d: number; stock_qty: number }[]>(
        `SELECT oi.product_name, SUM(oi.quantity) as sold_30d, p.stock_qty
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE oi.tenant_id = ? AND o.deleted_at IS NULL AND o.order_date >= date('now','-30 days')
         AND (? IS NULL OR p.name LIKE ?)
         GROUP BY p.id ORDER BY sold_30d DESC LIMIT 10`,
        [tid, nameFilter, nameFilter]
      );
      const result = rows.map(r => ({
        product_name: r.product_name,
        sold_30d: r.sold_30d,
        daily_rate: +(r.sold_30d / 30).toFixed(2),
        stock_qty: r.stock_qty,
        days_remaining: r.sold_30d > 0 ? +(r.stock_qty / (r.sold_30d / 30)).toFixed(1) : null,
      }));
      return { ok: true, data: result };
    },
  },

  // [medical] [all tenants] — save customer alias to AI memory
  remember_name: {
    description: 'Remember a nickname/alias for a customer. Args: { alias: string, customer_id: string, customer_name: string }',
    executor: async (tid, args) => {
      const alias = String(args.alias || '').trim().toLowerCase();
      const customerId = String(args.customer_id || '');
      const customerName = String(args.customer_name || '');
      if (!alias || !customerId) return { ok: false, error: 'alias and customer_id are required.' };
      await upsertAIMemory(tid, `alias:${alias}`, `${customerId}|${customerName}`);
      return { ok: true, data: { message: `Remembered: "${alias}" → ${customerName}` } };
    },
  },

  // [all apps] [all tenants] — add a new product to the catalogue
  add_product: {
    description: 'Add a new product. Args: { name: string, mrp: number, selling_price: number, unit?: string, cost_price?: number, gst_rate?: number, stock_qty?: number, min_stock_qty?: number, category?: string, brand?: string, hsn_code?: string, total_units?: number }. Navigate to /products first so user can see.',
    executor: async (tid, args) => {
      const name = String(args.name || '').trim();
      if (!name) return { ok: false, error: 'Product name is required.' };
      const mrp = Number(args.mrp || 0);
      const selling_price = Number(args.selling_price || mrp);
      if (mrp <= 0) return { ok: false, error: 'MRP must be provided.' };

      const product = await createProduct(tid, {
        name,
        sku: null,
        barcode: null,
        category: args.category ? String(args.category) : null,
        brand: args.brand ? String(args.brand) : null,
        description: null,
        unit: String(args.unit || 'strip'),
        mrp,
        selling_price,
        cost_price: args.cost_price ? Number(args.cost_price) : null,
        gst_rate: Number(args.gst_rate || 12),
        hsn_code: args.hsn_code ? String(args.hsn_code) : null,
        dosage_form: null,
        salt_composition: null,
        manufacturer: null,
        requires_prescription: false,
        total_units: args.total_units ? Number(args.total_units) : null,
        ml_volume: null,
        min_stock_qty: Number(args.min_stock_qty || 10),
        wholesale_price: null,
        is_active: true,
        deleted_at: null,
      } as Parameters<typeof createProduct>[1]);

      // Add opening stock if provided
      if (Number(args.stock_qty) > 0) {
        const { adjustStock } = await import('../db/inventory');
        await adjustStock(tid, {
          product_id: product.id,
          quantity: Number(args.stock_qty),
          direction: 'add',
          type: 'manual',
          notes: 'Opening stock via AI',
        });
      }

      return { ok: true, data: { id: product.id, name: product.name, mrp, selling_price, message: `${name} product add ho gaya.` } };
    },
  },

  // [all apps] [all tenants] — navigate to any page in the app
  navigate_to_page: {
    description: 'Navigate to a page in the app. Args: { page: "dashboard"|"pos"|"products"|"inventory"|"orders"|"customers"|"khata"|"expenses"|"suppliers"|"reports"|"settings" }',
    executor: async (_tid, args) => {
      const pageMap: Record<string, string> = {
        dashboard: '/dashboard', pos: '/pos', products: '/products',
        inventory: '/inventory', orders: '/orders', customers: '/customers',
        khata: '/khata', expenses: '/expenses', suppliers: '/suppliers',
        'purchase-orders': '/purchase-orders', reports: '/reports', settings: '/settings',
      };
      const page = String(args.page || '').toLowerCase();
      const path = pageMap[page];
      if (!path) return { ok: false, error: `Unknown page: ${page}. Valid: ${Object.keys(pageMap).join(', ')}` };
      aiNavigate(path);
      return { ok: true, data: { message: `Navigated to ${page}` } };
    },
  },

  // [all apps] [all tenants] — populate POS cart with products and navigate to billing page
  prepare_bill_in_pos: {
    description: 'Open the POS page and add products to cart so the owner can review and bill. Args: { items: [{product_name: string, quantity: number, loose_qty?: number}], customer_name?: string }. Search product names first if you do not have IDs.',
    executor: async (tid, args) => {
      const rawItems = (args.items as Record<string, unknown>[]) || [];
      if (!rawItems.length) return { ok: false, error: 'No items provided.' };

      aiNavigate('/pos');
      await new Promise(r => setTimeout(r, 400)); // let page mount

      const cart = useCartStore.getState();
      cart.clearCart();

      const added: string[] = [];
      const notFound: string[] = [];

      for (const raw of rawItems) {
        const productName = String(raw.product_name || '');
        const quantity = Math.max(1, Number(raw.quantity || 1));
        const looseQty = Number(raw.loose_qty || 0);

        const results = await searchProductsForPOS(tid, productName);
        const product = results[0];
        if (!product) { notFound.push(productName); continue; }

        const itemKey = [product.id, 'no-batch', 'no-exp'].join(':');
        cart.addItem({
          itemKey,
          productId: product.id,
          name: product.name,
          sku: product.sku ?? '',
          unit: product.unit ?? 'pc',
          unitPrice: Number(product.selling_price ?? 0),
          looseUnitPrice: undefined,
          gstRate: Number(product.gst_rate ?? 0),
          discount: 0,
          quantity,
        });
        if (quantity > 1) cart.updateQty(itemKey, quantity);
        if (looseQty > 0) { cart.toggleLoose(itemKey, true); cart.updateLooseQty(itemKey, looseQty); }
        added.push(`${product.name} ×${quantity}`);
      }

      const msg = added.length
        ? `Cart ready: ${added.join(', ')}${notFound.length ? `. Not found: ${notFound.join(', ')}` : ''}. Please review and confirm.`
        : `Could not find products: ${notFound.join(', ')}`;
      return { ok: true, data: { message: msg, added, not_found: notFound } };
    },
  },

  // [medical] [all tenants] — look up a customer by remembered alias
  recall_name: {
    description: 'Look up a customer by a remembered nickname/alias. Args: { alias: string }',
    executor: async (tid, args) => {
      const alias = String(args.alias || '').trim().toLowerCase();
      if (!alias) return { ok: false, error: 'alias is required.' };
      const db = await getDb();
      const rows = await db.select<{ value: string }[]>(
        `SELECT value FROM ai_memory WHERE tenant_id = ? AND key = ? AND deleted_at IS NULL LIMIT 1`,
        [tid, `alias:${alias}`]
      );
      if (!rows.length) return { ok: true, data: null };
      const [customerId, customerName] = rows[0].value.split('|');
      return { ok: true, data: { customer_id: customerId, customer_name: customerName } };
    },
  },
};

export function getToolsDescription(): string {
  return Object.entries(TOOLS)
    .map(([name, t]) => `- ${name}: ${t.description}`)
    .join('\n');
}

export async function executeTool(
  tenantId: string,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = TOOLS[name];
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    return await tool.executor(tenantId, args);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
