// [hardware] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listHwProducts, createHwSale, type HwProduct } from '@/lib/db/hardware';

interface CartItem {
  product: HwProduct;
  quantity: number;
  rate: number;
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

export function HardwarePOSPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paid, setPaid] = useState('');
  const [billDone, setBillDone] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['hw-products-pos', tenantId, search],
    queryFn: () => listHwProducts(tenantId, { search: search || undefined }),
    enabled: !!tenantId && search.length > 0,
  });

  function addToCart(product: HwProduct) {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        return prev.map(c =>
          c.product.id === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { product, quantity: 1, rate: product.selling_price }];
    });
    setSearch('');
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.product.id !== productId));
    } else {
      setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
    }
  }

  function updateRate(productId: string, rate: number) {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, rate } : c));
  }

  const total = cart.reduce((s, c) => s + c.quantity * c.rate, 0);
  const paidAmt = parseFloat(paid) || 0;
  const balance = paidAmt - total;

  const saveSale = useMutation({
    mutationFn: () => {
      if (cart.length === 0) throw new Error('Cart is empty');
      return createHwSale(tenantId, {
        customer_name: customerName,
        customer_phone: customerPhone,
        total,
        paid: paidAmt,
        payment_mode: paymentMode,
        sale_date: new Date().toISOString().split('T')[0],
        items: cart.map(c => ({
          product_id: c.product.id,
          product_name: c.product.name,
          unit: c.product.unit,
          quantity: c.quantity,
          rate: c.rate,
          amount: c.quantity * c.rate,
        })),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      qc.invalidateQueries({ queryKey: ['hw-low-stock'] });
      setBillDone(true);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save sale'),
  });

  if (billDone) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-bold text-slate-900">Bill Saved!</h2>
        <p className="text-slate-500">Total: {fmt(total)}</p>
        {balance > 0 && <p className="text-green-600 font-semibold">Change: {fmt(balance)}</p>}
        {balance < 0 && <p className="text-red-600 font-semibold">Balance due: {fmt(-balance)}</p>}
        <button
          onClick={() => { setCart([]); setCustomerName(''); setCustomerPhone(''); setPaid(''); setBillDone(false); }}
          className="px-6 py-3 rounded-2xl text-sm font-semibold text-white"
          style={{ background: '#d97706' }}
        >
          New Bill
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Billing / POS</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Product search */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          {products.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
                >
                  <div>
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category} · {p.brand} · Stock: {p.stock} {p.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{fmt(p.selling_price)}</p>
                    <p className="text-xs text-slate-400">/{p.unit}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Cart */}
          <div className="space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <p>Search and add products above</p>
              </div>
            ) : cart.map(item => (
              <div key={item.product.id} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm">{item.product.name}</p>
                  <p className="text-xs text-slate-400">{item.product.unit}</p>
                </div>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => updateQty(item.product.id, parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none"
                  step="0.01"
                  min="0"
                />
                <span className="text-xs text-slate-400">×</span>
                <input
                  type="number"
                  value={item.rate}
                  onChange={e => updateRate(item.product.id, parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none"
                />
                <span className="text-sm font-semibold text-slate-700 w-20 text-right">{fmt(item.quantity * item.rate)}</span>
                <button onClick={() => updateQty(item.product.id, 0)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Billing panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Customer (Optional)</h2>
            <input
              placeholder="Customer name"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
            <input
              placeholder="Phone"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'upi', 'card'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMode(m)}
                    className="py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                    style={paymentMode === m
                      ? { background: '#d97706', color: 'white' }
                      : { background: '#f1f5f9', color: '#64748b' }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount Received (₹)</label>
              <input
                type="number"
                value={paid}
                onChange={e => setPaid(e.target.value)}
                placeholder={String(Math.ceil(total))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
              />
            </div>

            {paidAmt > 0 && (
              <div className={`flex justify-between text-sm font-semibold rounded-xl px-3 py-2 ${balance >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span>{balance >= 0 ? 'Change' : 'Balance Due'}</span>
                <span>{fmt(Math.abs(balance))}</span>
              </div>
            )}

            <button
              onClick={() => saveSale.mutate()}
              disabled={cart.length === 0 || saveSale.isPending}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: '#d97706' }}
            >
              {saveSale.isPending ? 'Saving…' : 'Save Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
