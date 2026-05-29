// [furniture] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listFurnProducts, createFurnOrder } from '@/lib/db/furniture';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

interface CartItem { product_id: string; product_name: string; qty: number; rate: number; }

export function NewOrderPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['furn-products', tenantId],
    queryFn: () => listFurnProducts(tenantId),
    enabled: !!tenantId,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_address: '',
    delivery_date: '', advance_paid: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  function addToCart(p: (typeof products)[0]) {
    setCart(c => {
      const existing = c.find(x => x.product_id === p.id);
      if (existing) return c.map(x => x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { product_id: p.id, product_name: p.name, qty: 1, rate: p.selling_price }];
    });
  }

  const total = cart.reduce((s, x) => s + x.qty * x.rate, 0);

  async function handleSave() {
    if (!form.customer_name || cart.length === 0) { toast.error('Customer name and items required'); return; }
    setSaving(true);
    try {
      const count = Date.now();
      await createFurnOrder(tenantId, {
        order_no: `FO-${count.toString().slice(-6)}`,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address,
        items: JSON.stringify(cart),
        total_amount: total,
        advance_paid: parseFloat(form.advance_paid) || 0,
        delivery_date: form.delivery_date || null,
        status: 'confirmed',
        notes: form.notes,
      });
      toast.success('Order created');
      qc.invalidateQueries({ queryKey: ['furn-orders', tenantId] });
      qc.invalidateQueries({ queryKey: ['furn-stats', tenantId] });
      navigate('/furniture/orders');
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/furniture/orders')} className="text-slate-500 hover:text-slate-900">←</button>
        <h1 className="text-2xl font-bold text-slate-900">New Order</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product selection */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Select Products</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {products.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No products — add from Products page</p>
            ) : products.map(p => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="w-full text-left flex justify-between items-center p-3 rounded-xl border border-slate-100 hover:bg-amber-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.category} · {p.material}</p>
                </div>
                <span className="text-sm font-semibold text-amber-700">{fmt(p.selling_price)}</span>
              </button>
            ))}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Cart</h3>
              <div className="space-y-2">
                {cart.map((item, i) => (
                  <div key={item.product_id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-slate-800">{item.product_name}</span>
                    <input type="number" min="1" value={item.qty}
                      onChange={e => setCart(c => c.map((x, idx) => idx === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-center text-sm focus:outline-none"
                    />
                    <span className="w-24 text-right font-medium">{fmt(item.qty * item.rate)}</span>
                    <button onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-amber-700">{fmt(total)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Customer details */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Customer Details</h2>
          <div className="space-y-4">
            {[
              ['Customer Name *', 'customer_name', 'text', 'e.g. Rahul Sharma'],
              ['Phone', 'customer_phone', 'tel', '9999999999'],
              ['Address', 'customer_address', 'text', 'Delivery address'],
              ['Delivery Date', 'delivery_date', 'date', ''],
              ['Advance Paid (₹)', 'advance_paid', 'number', '0'],
            ].map(([label, key, type, ph]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type={type} value={(form as any)[key]} placeholder={ph}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.customer_name || cart.length === 0}
            className="mt-4 w-full py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-semibold text-sm transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
