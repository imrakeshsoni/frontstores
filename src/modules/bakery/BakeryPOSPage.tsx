// [bakery] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listBkProducts, createBkSale } from '@/lib/db/bakery';
import { now } from '@/lib/db/index';

interface CartItem {
  product_id: string; product_name: string; unit: string;
  quantity: number; rate: number; amount: number;
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function BakeryPOSPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['bk-products', tenantId, search],
    queryFn: () => listBkProducts(tenantId, search),
    enabled: !!tenantId,
  });

  function addToCart(p: { id: string; name: string; unit: string; selling_price: number }) {
    setCart(prev => {
      const existing = prev.findIndex(i => i.product_id === p.id);
      if (existing >= 0) {
        return prev.map((item, idx) => idx === existing
          ? { ...item, quantity: item.quantity + 1, amount: (item.quantity + 1) * item.rate }
          : item);
      }
      return [...prev, { product_id: p.id, product_name: p.name, unit: p.unit, quantity: 1, rate: p.selling_price, amount: p.selling_price }];
    });
  }

  function updateQty(idx: number, qty: number) {
    if (qty <= 0) { setCart(prev => prev.filter((_, i) => i !== idx)); return; }
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty, amount: qty * item.rate } : item));
  }

  const total = cart.reduce((s, i) => s + i.amount, 0);

  async function handleSave() {
    if (cart.length === 0) { toast.error('Add items to cart'); return; }
    setSaving(true);
    try {
      const billNo = `BK-${Date.now()}`;
      await createBkSale(tenantId, {
        bill_no: billNo, customer_name: customerName, total, payment_mode: paymentMode, sale_date: now(),
      }, cart);
      toast.success(`Bill ${billNo} saved!`);
      setCart([]); setCustomerName('');
      qc.invalidateQueries({ queryKey: ['bakery-stats'] });
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 h-full flex gap-6">
      {/* Left: Product search */}
      <div className="flex-1 space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Counter Billing</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {products.map(p => (
            <button key={p.id} onClick={() => addToCart(p)}
              className="text-left p-3 rounded-xl border border-slate-100 bg-white hover:bg-amber-50 hover:border-amber-200 transition-all">
              <p className="font-medium text-slate-800 truncate">{p.name}</p>
              <p className="text-xs text-slate-400">{p.category} · {p.unit}</p>
              <p className="text-xs font-semibold text-amber-600 mt-1">{fmt(p.selling_price)}/{p.unit}</p>
            </button>
          ))}
          {products.length === 0 && <p className="col-span-3 text-slate-400 text-sm text-center py-8">No items found</p>}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Cart ({cart.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No items added</p>
            ) : cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{item.product_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateQty(idx, item.quantity - (item.unit === 'kg' || item.unit === 'g' ? 0.25 : 1))} className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center">-</button>
                    <span className="text-xs font-medium w-10 text-center">{item.quantity} {item.unit}</span>
                    <button onClick={() => updateQty(idx, item.quantity + (item.unit === 'kg' || item.unit === 'g' ? 0.25 : 1))} className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center">+</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-600">{fmt(item.amount)}</span>
                  <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-50 space-y-3">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Customer name (optional)"
              value={customerName} onChange={e => setCustomerName(e.target.value)} />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-amber-600">{fmt(total)}</span>
            </div>
            <div className="flex gap-2">
              {(['cash', 'upi', 'card'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMode(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${paymentMode === m ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'}`}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving || cart.length === 0}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#d97706' }}>
              <Printer className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save & Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
