// [restaurant] [all tenants]
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Users, X, ChefHat, CreditCard, Trash2, Minus, Printer } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { appCacheDir } from '@tauri-apps/api/path';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import {
  listTables,
  createTable,
  deleteTable,
  listMenuItems,
  listMenuCategories,
  getOpenOrderForTable,
  createRestaurantOrder,
  addItemsToOrder,
  settleOrder,
  cancelOrder,
  getOrderWithItems,
  type RestaurantTable,
  type RestaurantOrder,
  type RestaurantOrderItem,
  type MenuItem,
  type MenuCategory,
} from '@/lib/db/restaurant';

type OrderType = 'dine-in' | 'takeaway' | 'delivery';

interface CartItem {
  menu_item_id: string;
  item_name: string;
  variant: 'full' | 'half';
  quantity: number;
  unit_price: number;
  gst_rate: number;
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  'dine-in': 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

export function TablesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [currentOrder, setCurrentOrder] = useState<RestaurantOrder | null>(null);
  const [existingItems, setExistingItems] = useState<RestaurantOrderItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [settleForm, setSettleForm] = useState({ payment_method: 'cash', discount: '', customer_name: '', customer_phone: '' });
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableForm, setNewTableForm] = useState({ name: '', capacity: '4' });

  const invalidateTables = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['restaurant-tables', tenantId] });
    qc.invalidateQueries({ queryKey: ['restaurant-orders', tenantId] });
    qc.invalidateQueries({ queryKey: ['kitchen-items', tenantId] });
  }, [qc, tenantId]);

  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['restaurant-tables', tenantId],
    queryFn: () => listTables(tenantId),
    enabled: !!tenantId,
    refetchInterval: 10000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories', tenantId],
    queryFn: () => listMenuCategories(tenantId),
    enabled: !!tenantId && !!selectedTable,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items', tenantId, selectedCategoryId],
    queryFn: () => listMenuItems(tenantId, selectedCategoryId),
    enabled: !!tenantId && !!selectedTable,
  });

  const createTableMutation = useMutation({
    mutationFn: () => createTable(tenantId, {
      name: newTableForm.name.trim(),
      capacity: Number(newTableForm.capacity) || 4,
    }),
    onSuccess: () => {
      toast.success('Table added');
      invalidateTables();
      setShowAddTable(false);
      setNewTableForm({ name: '', capacity: '4' });
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to add table'),
  });

  const deleteTableMutation = useMutation({
    mutationFn: (id: string) => deleteTable(tenantId, id),
    onSuccess: () => { toast.success('Table removed'); invalidateTables(); },
  });

  const sendKotMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable) throw new Error('No table selected');
      if (cart.length === 0) throw new Error('Cart is empty');
      let order = currentOrder;
      if (!order) {
        order = await createRestaurantOrder(tenantId, {
          table_id: orderType === 'dine-in' ? selectedTable.id : null,
          table_name: selectedTable.name,
          order_type: orderType,
        });
        setCurrentOrder(order);
      }
      await addItemsToOrder(tenantId, order.id, cart.map((ci) => ({
        menu_item_id: ci.menu_item_id,
        item_name: ci.item_name,
        variant: ci.variant === 'half' ? 'Half' : 'Full',
        quantity: ci.quantity,
        unit_price: ci.unit_price,
        gst_rate: ci.gst_rate,
      })));
      // Refresh existing items
      const { items } = await getOrderWithItems(tenantId, order.id);
      setExistingItems(items);
      setCart([]);
      return order;
    },
    onSuccess: () => {
      toast.success('Sent to kitchen!');
      invalidateTables();
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to send KOT'),
  });

  const settleMutation = useMutation({
    mutationFn: async ({ withPrint }: { withPrint: boolean }) => {
      if (!currentOrder) throw new Error('No open order');
      if (cart.length > 0) {
        await addItemsToOrder(tenantId, currentOrder.id, cart.map((ci) => ({
          menu_item_id: ci.menu_item_id,
          item_name: ci.item_name,
          variant: ci.variant === 'half' ? 'Half' : 'Full',
          quantity: ci.quantity,
          unit_price: ci.unit_price,
          gst_rate: ci.gst_rate,
        })));
      }
      await settleOrder(tenantId, currentOrder.id, {
        payment_method: settleForm.payment_method,
        discount: settleForm.discount ? Number(settleForm.discount) : 0,
        customer_name: settleForm.customer_name.trim() || null,
        customer_phone: settleForm.customer_phone.trim() || null,
      });
      if (withPrint) {
        const allItems = [
          ...existingItems.map(i => ({ item_name: i.item_name, variant: i.variant, quantity: i.quantity, unit_price: i.unit_price, gst_rate: i.gst_rate, total: i.total })),
          ...cart.map(c => ({ item_name: c.item_name, variant: c.variant === 'half' ? 'Half' : 'Full', quantity: c.quantity, unit_price: c.unit_price, gst_rate: c.gst_rate, total: c.quantity * c.unit_price })),
        ];
        const disc = settleForm.discount ? Number(settleForm.discount) : 0;
        await printBill({
          orderNumber: currentOrder.order_number,
          orderType: ORDER_TYPE_LABELS[orderType],
          tableName: selectedTable?.name ?? '',
          allItems,
          subtotal: existingSubtotal + cartSubtotal,
          tax: existingTax + cartTax,
          discount: disc,
          total: Math.max(0, grandTotal - disc),
          paymentMethod: settleForm.payment_method,
          customerName: settleForm.customer_name.trim() || undefined,
        });
      }
    },
    onSuccess: () => {
      toast.success('Order settled!');
      invalidateTables();
      closePanel();
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to settle order'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!currentOrder) throw new Error('No open order');
      return cancelOrder(tenantId, currentOrder.id);
    },
    onSuccess: () => {
      toast.success('Order cancelled');
      invalidateTables();
      closePanel();
    },
  });

  async function openTable(table: RestaurantTable) {
    setSelectedTable(table);
    setCart([]);
    setSelectedCategoryId(null);
    setShowSettle(false);
    setSettleForm({ payment_method: 'cash', discount: '', customer_name: '', customer_phone: '' });

    if (table.open_order_id) {
      const { order, items } = await getOrderWithItems(tenantId, table.open_order_id);
      setCurrentOrder(order);
      setExistingItems(items);
    } else {
      setCurrentOrder(null);
      setExistingItems([]);
    }
  }

  function closePanel() {
    setSelectedTable(null);
    setCurrentOrder(null);
    setExistingItems([]);
    setCart([]);
    setShowSettle(false);
  }

  function addToCart(item: MenuItem, variant: 'full' | 'half') {
    const unitPrice = variant === 'half' ? (item.half_price ?? item.price) : item.price;
    setCart((prev) => {
      const key = `${item.id}:${variant}`;
      const existing = prev.find((c) => `${c.menu_item_id}:${c.variant}` === key);
      if (existing) {
        return prev.map((c) =>
          `${c.menu_item_id}:${c.variant}` === key
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, {
        menu_item_id: item.id,
        item_name: item.name,
        variant,
        quantity: 1,
        unit_price: unitPrice,
        gst_rate: item.gst_rate,
      }];
    });
  }

  function updateCartQty(idx: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + delta };
      if (next[idx].quantity <= 0) next.splice(idx, 1);
      return next;
    });
  }

  const cartSubtotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const cartTax = cart.reduce((s, c) => s + c.quantity * c.unit_price * (c.gst_rate / 100), 0);
  const cartTotal = cartSubtotal + cartTax;

  const existingSubtotal = existingItems.reduce((s, i) => s + i.total / (1 + i.gst_rate / 100), 0);
  const existingTax = existingItems.reduce((s, i) => s + i.total - i.total / (1 + i.gst_rate / 100), 0);
  const grandTotal = existingSubtotal + existingTax + cartTotal;
  const discount = settleForm.discount ? Number(settleForm.discount) : 0;
  const finalTotal = Math.max(0, grandTotal - discount);

  const fmt = (n: number) => `₹${n.toFixed(2)}`;

  // [restaurant] [all tenants] — Bill print
  async function printBill(opts: {
    orderNumber: string; orderType: string; tableName: string;
    allItems: Array<{ item_name: string; variant?: string | null; quantity: number; unit_price: number; gst_rate: number; total: number }>;
    subtotal: number; tax: number; discount: number; total: number;
    paymentMethod: string; customerName?: string;
  }) {
    const config = useAppStore.getState().config;
    const s = (config?.settings ?? {}) as any;
    const storeName = s.invoiceStoreDisplayName || config?.shop_name || 'Restaurant';
    const address = config?.address_line1 || '';
    const gstin = config?.gstin || '';
    const footerNote = s.invoiceFooterNote || 'Thank you! Visit again!';
    const dateStr = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const itemRows = opts.allItems.map(i => `
      <div class="row">
        <span class="item-name">${i.item_name}${i.variant && i.variant !== 'Full' ? ` (${i.variant})` : ''}</span>
        <span class="item-qty">${i.quantity}</span>
        <span class="item-price">₹${i.total.toFixed(2)}</span>
      </div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 72mm; }
  .center { text-align: center; }
  .store-name { font-size: 15px; font-weight: 900; text-align: center; margin: 3px 0; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border-top: 2px solid #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; margin: 1px 0; }
  .item-name { flex: 1; margin-right: 4px; word-break: break-word; }
  .item-qty { width: 22px; text-align: right; margin-right: 4px; }
  .item-price { width: 55px; text-align: right; }
  .bold { font-weight: bold; }
  .total-row { font-weight: 900; font-size: 13px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="store-name">${storeName}</div>
${address ? `<p class="center">${address}</p>` : ''}
${gstin ? `<p class="center">GSTIN: ${gstin}</p>` : ''}
<div class="divider"></div>
<div class="row"><span>${opts.tableName}</span><span>${dateStr}</span></div>
<div class="row"><span>Order#: ${opts.orderNumber}</span><span>${opts.orderType}</span></div>
${opts.customerName ? `<div class="row"><span>Customer: ${opts.customerName}</span></div>` : ''}
<div class="divider"></div>
<div class="row bold"><span class="item-name">Item</span><span class="item-qty">Qty</span><span class="item-price">Amt</span></div>
<div class="divider"></div>
${itemRows}
<div class="solid"></div>
<div class="row"><span>Subtotal</span><span>₹${opts.subtotal.toFixed(2)}</span></div>
<div class="row"><span>Tax</span><span>₹${opts.tax.toFixed(2)}</span></div>
${opts.discount > 0 ? `<div class="row"><span>Discount</span><span>-₹${opts.discount.toFixed(2)}</span></div>` : ''}
<div class="row total-row"><span>TOTAL</span><span>₹${opts.total.toFixed(2)}</span></div>
<div class="divider"></div>
<div class="row"><span>Payment</span><span>${opts.paymentMethod.toUpperCase()}</span></div>
<div class="divider"></div>
<p class="center">${footerNote}</p>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});<\/script>
</body></html>`;

    try {
      const cacheDir = await appCacheDir();
      const sep = cacheDir.endsWith('/') ? '' : '/';
      const filePath = `${cacheDir}${sep}restaurant-bill-${Date.now()}.html`;
      await writeTextFile(filePath, html);
      await shellOpen(filePath);
    } catch (err: any) {
      toast.error('Could not open print: ' + (err?.message ?? err));
    }
  }

  const statusColor: Record<string, string> = {
    empty: '#16a34a',
    occupied: '#d97706',
    reserved: '#dc2626',
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Main area — table grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div
          className="p-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}
        >
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Tables & Orders</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {tables.filter((t) => t.status === 'occupied').length} of {tables.length} tables occupied
            </p>
          </div>

          {/* Order type toggle */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
            {(['dine-in', 'takeaway', 'delivery'] as OrderType[]).map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: orderType === type ? 'var(--accent)' : 'transparent',
                  color: orderType === type ? 'white' : 'var(--text-secondary)',
                }}
              >
                {ORDER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => setShowAddTable(true)}
          >
            <Plus size={14} /> Add Table
          </button>
        </div>

        {/* Table grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {tablesLoading && (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
              ))}
            </div>
          )}

          {!tablesLoading && tables.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-4" style={{ color: 'var(--text-tertiary)' }}>
              <Users className="h-16 w-16 opacity-20" />
              <p className="text-sm">No tables yet. Add tables to get started.</p>
              <button className="btn-primary" onClick={() => setShowAddTable(true)}>
                <Plus size={14} /> Add First Table
              </button>
            </div>
          )}

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {/* Quick takeaway / delivery order button */}
            {orderType !== 'dine-in' && (
              <button
                onClick={() => {
                  const pseudoTable: RestaurantTable = {
                    id: `quick-${orderType}`,
                    tenant_id: tenantId,
                    name: orderType === 'takeaway' ? 'Takeaway' : 'Delivery',
                    capacity: 1,
                    status: 'empty',
                    open_order_id: null,
                    open_items_count: 0,
                    open_total: 0,
                    created_at: '',
                    updated_at: '',
                    deleted_at: null,
                  };
                  openTable(pseudoTable);
                }}
                className="h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:scale-105"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                <Plus size={24} />
                <span className="text-sm font-semibold">New {ORDER_TYPE_LABELS[orderType]}</span>
              </button>
            )}

            {tables.map((table) => (
              <div
                key={table.id}
                className="relative group"
              >
                <button
                  onClick={() => openTable(table)}
                  className="w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 hover:shadow-lg"
                  style={{
                    background: 'var(--surface)',
                    border: `2px solid ${statusColor[table.status] ?? '#94a3b8'}`,
                    boxShadow: table.status === 'occupied' ? `0 0 0 1px ${statusColor.occupied}22` : undefined,
                  }}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ background: statusColor[table.status] ?? '#94a3b8' }}
                  />
                  <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{table.name}</p>
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <Users size={10} /> {table.capacity}
                  </div>
                  {table.status === 'occupied' && (
                    <div className="text-center">
                      <p className="text-xs font-semibold" style={{ color: '#d97706' }}>
                        {table.open_items_count} items
                      </p>
                      <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                        {fmt(table.open_total)}
                      </p>
                    </div>
                  )}
                </button>
                {/* Delete button — only on empty tables */}
                {table.status === 'empty' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTableMutation.mutate(table.id); }}
                    className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-rose-100 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    title="Remove table"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — order */}
      {selectedTable && (
        <div
          className="w-96 flex-shrink-0 flex flex-col h-full overflow-hidden"
          style={{
            borderLeft: '1px solid var(--surface-border)',
            background: 'var(--surface)',
          }}
        >
          {/* Panel header */}
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <div>
              <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                {selectedTable.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {ORDER_TYPE_LABELS[orderType]}
                {currentOrder && ` · ${currentOrder.order_number}`}
              </p>
            </div>
            <button onClick={closePanel} className="p-2 rounded-full hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>

          {/* Menu — category tabs + items */}
          <div style={{ borderBottom: '1px solid var(--surface-border)' }}>
            {/* Category tabs */}
            <div className="flex gap-1 overflow-x-auto px-3 py-2">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  background: selectedCategoryId === null ? 'var(--accent)' : 'var(--surface-2)',
                  color: selectedCategoryId === null ? 'white' : 'var(--text-secondary)',
                }}
              >
                All
              </button>
              {categories.map((cat: MenuCategory) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: selectedCategoryId === cat.id ? 'var(--accent)' : 'var(--surface-2)',
                    color: selectedCategoryId === cat.id ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu items */}
            <div className="max-h-56 overflow-y-auto px-3 pb-2">
              {menuItems.filter((i: MenuItem) => i.is_available).map((item: MenuItem) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid var(--surface-border)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex-shrink-0 h-2.5 w-2.5 rounded-full"
                      style={{ background: item.is_veg ? '#16a34a' : '#dc2626' }}
                    />
                    <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {item.half_price && (
                      <button
                        onClick={() => addToCart(item, 'half')}
                        className="px-2 py-0.5 rounded text-xs font-medium transition-all"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                        title={`Half: ${fmt(item.half_price)}`}
                      >
                        ½ {fmt(item.half_price ?? 0)}
                      </button>
                    )}
                    <button
                      onClick={() => addToCart(item, 'full')}
                      className="px-2 py-0.5 rounded text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: 'var(--accent)', color: 'white' }}
                      title={`Full: ${fmt(item.price)}`}
                    >
                      + {fmt(item.price)}
                    </button>
                  </div>
                </div>
              ))}
              {menuItems.filter((i: MenuItem) => i.is_available).length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                  No items available
                </p>
              )}
            </div>
          </div>

          {/* Existing order items */}
          {existingItems.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                Ordered
              </p>
              <div className="max-h-32 overflow-y-auto px-4 pb-2">
                {existingItems.map((oi) => (
                  <div key={oi.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: oi.kot_status === 'served' ? '#dcfce7' : oi.kot_status === 'preparing' ? '#dbeafe' : '#fef9c3',
                          color: oi.kot_status === 'served' ? '#166534' : oi.kot_status === 'preparing' ? '#1e40af' : '#854d0e',
                        }}
                      >
                        {oi.kot_status}
                      </span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                        {oi.quantity}× {oi.item_name}{oi.variant ? ` (${oi.variant})` : ''}
                      </span>
                    </div>
                    <span className="text-xs font-medium flex-shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>
                      {fmt(oi.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="flex-1 overflow-y-auto">
            {cart.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                  New Items
                </p>
                {cart.map((ci, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                        {ci.item_name}{ci.variant === 'half' ? ' (Half)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartQty(idx, -1)}
                          className="h-6 w-6 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-xs font-semibold w-5 text-center" style={{ color: 'var(--text-primary)' }}>
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQty(idx, 1)}
                          className="h-6 w-6 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <span className="text-xs font-medium w-14 text-right" style={{ color: 'var(--accent)' }}>
                        {fmt(ci.quantity * ci.unit_price)}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {cart.length === 0 && existingItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-6" style={{ color: 'var(--text-tertiary)' }}>
                <ChefHat className="h-10 w-10 opacity-20" />
                <p className="text-sm text-center">Add items from the menu above</p>
              </div>
            )}
          </div>

          {/* Totals + actions */}
          <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span style={{ color: 'var(--text-primary)' }}>{fmt(existingSubtotal + cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Tax</span>
              <span style={{ color: 'var(--text-primary)' }}>{fmt(existingTax + cartTax)}</span>
            </div>
            <div className="flex justify-between font-bold text-base">
              <span style={{ color: 'var(--text-primary)' }}>Total</span>
              <span style={{ color: 'var(--accent)' }}>{fmt(grandTotal)}</span>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 btn-secondary flex items-center justify-center gap-1.5 text-sm"
                onClick={() => sendKotMutation.mutate()}
                disabled={sendKotMutation.isPending || cart.length === 0}
              >
                <ChefHat size={14} />
                {sendKotMutation.isPending ? 'Sending…' : 'Send to Kitchen'}
              </button>
              <button
                className="flex-1 btn-primary flex items-center justify-center gap-1.5 text-sm"
                onClick={() => setShowSettle(true)}
                disabled={(existingItems.length === 0 && cart.length === 0)}
              >
                <CreditCard size={14} />
                Bill & Close
              </button>
            </div>

            {currentOrder && (
              <button
                onClick={() => cancelMutation.mutate()}
                className="w-full text-xs py-1.5 rounded-lg transition-colors"
                style={{ color: '#dc2626', background: '#fee2e2' }}
                disabled={cancelMutation.isPending}
              >
                <Trash2 size={10} className="inline mr-1" />
                Cancel Order
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settlement modal */}
      {showSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Settle Order</h2>
              <button onClick={() => setShowSettle(false)} className="p-2 rounded-full hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'upi', 'card'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSettleForm((f) => ({ ...f, payment_method: m }))}
                      className="py-2 rounded-xl text-sm font-medium capitalize transition-all"
                      style={{
                        background: settleForm.payment_method === m ? 'var(--accent)' : 'var(--surface-2)',
                        color: settleForm.payment_method === m ? 'white' : 'var(--text-primary)',
                      }}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Discount (₹)
                </label>
                <input
                  type="number"
                  className="input w-full"
                  value={settleForm.discount}
                  onChange={(e) => setSettleForm((f) => ({ ...f, discount: e.target.value }))}
                  min="0"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Customer Name (optional)
                </label>
                <input
                  className="input w-full"
                  value={settleForm.customer_name}
                  onChange={(e) => setSettleForm((f) => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Walk-in customer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Phone (optional)
                </label>
                <input
                  className="input w-full"
                  value={settleForm.customer_phone}
                  onChange={(e) => setSettleForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  placeholder="9876543210"
                />
              </div>

              {/* Final total */}
              <div
                className="rounded-2xl p-4"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: 'var(--text-secondary)' }}>Grand Total</span>
                  <span style={{ color: 'var(--text-primary)' }}>{fmt(grandTotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                    <span style={{ color: '#dc2626' }}>−{fmt(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span style={{ color: 'var(--text-primary)' }}>To Collect</span>
                  <span style={{ color: 'var(--accent)' }}>{fmt(finalTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-6">
              <button
                className="btn-primary flex items-center justify-center gap-2"
                onClick={() => settleMutation.mutate({ withPrint: true })}
                disabled={settleMutation.isPending}
              >
                <Printer size={15} />
                {settleMutation.isPending ? 'Processing…' : 'Print & Collect'}
              </button>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setShowSettle(false)}>Cancel</button>
                <button
                  className="btn-secondary flex-1"
                  onClick={() => settleMutation.mutate({ withPrint: false })}
                  disabled={settleMutation.isPending}
                >
                  Collect (No Print)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add table modal */}
      {showAddTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add Table</h2>
              <button onClick={() => setShowAddTable(false)} className="p-2 rounded-full hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Table Name / Number *
                </label>
                <input
                  className="input w-full"
                  value={newTableForm.name}
                  onChange={(e) => setNewTableForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Table 1, T-5, Counter"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Seating Capacity
                </label>
                <input
                  type="number"
                  className="input w-full"
                  value={newTableForm.capacity}
                  onChange={(e) => setNewTableForm((f) => ({ ...f, capacity: e.target.value }))}
                  min="1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="btn-secondary" onClick={() => setShowAddTable(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => createTableMutation.mutate()}
                disabled={createTableMutation.isPending || !newTableForm.name.trim()}
              >
                {createTableMutation.isPending ? 'Adding…' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
