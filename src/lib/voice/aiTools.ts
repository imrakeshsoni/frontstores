// [medical] [all tenants] — AI tool calling: DB access for Dolphin 3.0
import { searchProductsForPOS, listProducts } from '../db/products';
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
