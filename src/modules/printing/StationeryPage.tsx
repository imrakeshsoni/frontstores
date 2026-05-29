// [printing] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listPRStationery, createPRStationery, updatePRStationery, deletePRStationery, createPRStationerySale } from '@/lib/db/printing';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

interface CartItem { product_id: string; product_name: string; qty: number; rate: number; }

export function StationeryPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', stock: '', unit: 'piece', purchase_price: '', selling_price: '' });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [selling, setSelling] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ['pr-stationery', tenantId, search],
    queryFn: () => listPRStationery(tenantId, search),
    enabled: !!tenantId,
  });

  async function handleAddProduct() {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      await createPRStationery(tenantId, {
        name: form.name, category: form.category,
        stock: parseFloat(form.stock) || 0, unit: form.unit,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
      });
      toast.success('Item added');
      setForm({ name: '', category: '', stock: '', unit: 'piece', purchase_price: '', selling_price: '' });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ['pr-stationery', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  function addToCart(item: (typeof items)[0]) {
    setCart(c => {
      const ex = c.find(x => x.product_id === item.id);
      if (ex) return c.map(x => x.product_id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { product_id: item.id, product_name: item.name, qty: 1, rate: item.selling_price }];
    });
  }

  const total = cart.reduce((s, x) => s + x.qty * x.rate, 0);

  async function handleBill() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setSelling(true);
    try {
      const count = Date.now();
      await createPRStationerySale(
        tenantId,
        { bill_no: `ST${count.toString().slice(-6)}`, customer_name: customer, total, payment_mode: payMode, sale_date: new Date().toISOString().slice(0, 10) },
        cart.map(x => ({ sale_id: '', product_id: x.product_id, product_name: x.product_name, quantity: x.qty, rate: x.rate, amount: x.qty * x.rate }))
      );
      toast.success('Sale recorded');
      setCart([]);
      setCustomer('');
      qc.invalidateQueries({ queryKey: ['pr-stationery', tenantId] });
      qc.invalidateQueries({ queryKey: ['pr-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSelling(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Stationery</h1>
        <button onClick={() => setShowAdd(s => !s)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
          + Add Item
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">New Stationery Item</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[['Name *', 'name', 'text'], ['Category', 'category', 'text'], ['Stock', 'stock', 'number'], ['Unit', 'unit', 'text'], ['Purchase Price (₹)', 'purchase_price', 'number'], ['Selling Price (₹)', 'selling_price', 'number']].map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddProduct} disabled={saving} className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">
              {saving ? 'Saving…' : 'Add Item'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Product list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">No items yet</p> : items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.category} · Stock: {item.stock} {item.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-700">{fmt(item.selling_price)}</span>
                  <button onClick={() => addToCart(item)} className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart / Quick billing */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Billing</h2>
          {cart.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Add items from the left</p>
          ) : (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                {cart.map((item, i) => (
                  <div key={item.product_id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-slate-800">{item.product_name}</span>
                    <button onClick={() => setCart(c => c.map((x, idx) => idx === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} className="p-1 rounded hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center font-medium">{item.qty}</span>
                    <button onClick={() => setCart(c => c.map((x, idx) => idx === i ? { ...x, qty: x.qty + 1 } : x))} className="p-1 rounded hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                    <span className="w-20 text-right font-medium">{fmt(item.qty * item.rate)}</span>
                    <button onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-3 mb-4 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-blue-700">{fmt(total)}</span>
              </div>
              <div className="space-y-3">
                <input value={customer} onChange={e => setCustomer(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Customer name (optional)"
                />
                <div className="flex gap-2">
                  {['cash', 'upi', 'card'].map(m => (
                    <button key={m} onClick={() => setPayMode(m)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${payMode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleBill} disabled={selling}
                className="mt-3 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-40">
                {selling ? 'Saving…' : `Bill — ${fmt(total)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
