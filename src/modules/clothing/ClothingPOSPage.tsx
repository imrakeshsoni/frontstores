// [clothing] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listClProducts, listClStock, createClSale } from '@/lib/db/clothing';
import { now } from '@/lib/db/index';

interface CartItem {
  product_id: string; product_name: string;
  size: string; color: string;
  quantity: number; rate: number; amount: number;
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function ClothingPOSPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['cl-products', tenantId, search],
    queryFn: () => listClProducts(tenantId, search),
    enabled: !!tenantId,
  });

  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [addQty, setAddQty] = useState(1);

  const { data: stockVariants = [] } = useQuery({
    queryKey: ['cl-stock', tenantId, selectedProduct],
    queryFn: () => listClStock(tenantId, selectedProduct!),
    enabled: !!selectedProduct,
  });

  const selectedProductObj = products.find(p => p.id === selectedProduct);
  const availableSizes = [...new Set(stockVariants.filter(s => s.quantity > 0).map(s => s.size))];
  const availableColors = [...new Set(stockVariants.filter(s => s.size === selectedSize && s.quantity > 0).map(s => s.color))];

  function addToCart() {
    if (!selectedProduct || !selectedProductObj) { toast.error('Select a product'); return; }
    const stock = stockVariants.find(s => s.size === selectedSize && s.color === selectedColor);
    if (!stock || stock.quantity < addQty) { toast.error('Insufficient stock'); return; }
    const rate = selectedProductObj.selling_price;
    setCart(prev => {
      const existing = prev.findIndex(i => i.product_id === selectedProduct && i.size === selectedSize && i.color === selectedColor);
      if (existing >= 0) {
        return prev.map((item, idx) => idx === existing
          ? { ...item, quantity: item.quantity + addQty, amount: (item.quantity + addQty) * item.rate }
          : item);
      }
      return [...prev, { product_id: selectedProduct, product_name: selectedProductObj.name, size: selectedSize, color: selectedColor, quantity: addQty, rate, amount: addQty * rate }];
    });
    setSelectedProduct(null); setSelectedSize(''); setSelectedColor(''); setAddQty(1);
  }

  const subtotal = cart.reduce((s, i) => s + i.amount, 0);
  const total = Math.max(0, subtotal - discount);

  async function handleSave() {
    if (cart.length === 0) { toast.error('Add items to cart'); return; }
    setSaving(true);
    try {
      const billNo = `CL-${Date.now()}`;
      await createClSale(tenantId, {
        bill_no: billNo, customer_name: customerName, customer_phone: customerPhone,
        total, discount, paid: total, payment_mode: paymentMode,
        sale_date: now(),
      }, cart);
      toast.success(`Bill ${billNo} saved!`);
      setCart([]); setCustomerName(''); setCustomerPhone(''); setDiscount(0);
      qc.invalidateQueries({ queryKey: ['clothing-stats'] });
      qc.invalidateQueries({ queryKey: ['cl-stock'] });
    } catch (e) {
      toast.error('Failed to save bill');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 h-full flex gap-6">
      {/* Left: Product search */}
      <div className="flex-1 space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Billing</h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="Search product..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
          {products.map(p => (
            <button key={p.id} onClick={() => { setSelectedProduct(p.id); setSelectedSize(''); setSelectedColor(''); }}
              className={`text-left p-3 rounded-xl border text-sm transition-all ${selectedProduct === p.id ? 'border-pink-400 bg-pink-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
              <p className="font-medium text-slate-800 truncate">{p.name}</p>
              <p className="text-xs text-slate-400">{p.brand} · {p.category}</p>
              <p className="text-xs font-semibold text-pink-600 mt-1">{fmt(p.selling_price)}</p>
            </button>
          ))}
        </div>

        {selectedProduct && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <p className="font-semibold text-slate-800">{selectedProductObj?.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Size</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={selectedSize} onChange={e => { setSelectedSize(e.target.value); setSelectedColor(''); }}>
                  <option value="">Select size</option>
                  {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Color</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={selectedColor} onChange={e => setSelectedColor(e.target.value)} disabled={!selectedSize}>
                  <option value="">Select color</option>
                  {availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Quantity</label>
                <input type="number" min={1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={addQty} onChange={e => setAddQty(Number(e.target.value))} />
              </div>
              <button onClick={addToCart}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: '#db2777' }}>
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Cart ({cart.length} items)</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No items added</p>
            ) : cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                <div>
                  <p className="font-medium text-slate-800">{item.product_name}</p>
                  <p className="text-xs text-slate-400">{item.size} / {item.color} × {item.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-pink-600">{fmt(item.amount)}</span>
                  <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-50 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Customer name"
                value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Phone"
                value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Discount</span>
              <input type="number" min={0} className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-right"
                value={discount} onChange={e => setDiscount(Number(e.target.value))} />
            </div>
            <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2">
              <span>Total</span>
              <span className="text-pink-600">{fmt(total)}</span>
            </div>
            <div className="flex gap-2">
              {(['cash', 'upi', 'card'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMode(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${paymentMode === m ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-slate-200 text-slate-600'}`}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving || cart.length === 0}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ background: '#db2777' }}>
              <Printer className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save & Print Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
