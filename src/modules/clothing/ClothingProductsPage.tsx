// [clothing] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listClProducts, createClProduct, updateClProduct, deleteClProduct, listClStock, upsertClStock } from '@/lib/db/clothing';

const GENDERS = ['unisex', 'men', 'women', 'kids'];
const CATEGORIES = ['Shirt', 'T-Shirt', 'Jeans', 'Trousers', 'Dress', 'Saree', 'Kurta', 'Shoes', 'Sandals', 'Sneakers', 'Other'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '5', '6', '7', '8', '9', '10', '11'];
const COLORS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Brown', 'Grey', 'Navy', 'Maroon', 'Orange'];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function ClothingProductsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showStock, setShowStock] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', brand: '', gender: 'unisex', purchase_price: '', selling_price: '' });
  const [stockSize, setStockSize] = useState('');
  const [stockColor, setStockColor] = useState('');
  const [stockQty, setStockQty] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['cl-products', tenantId, search],
    queryFn: () => listClProducts(tenantId, search),
    enabled: !!tenantId,
  });

  const { data: stockList = [] } = useQuery({
    queryKey: ['cl-stock', tenantId, showStock],
    queryFn: () => listClStock(tenantId, showStock!),
    enabled: !!showStock,
  });

  function resetForm() { setForm({ name: '', category: '', brand: '', gender: 'unisex', purchase_price: '', selling_price: '' }); setEditId(null); setShowForm(false); }

  async function handleSave() {
    if (!form.name) { toast.error('Product name required'); return; }
    try {
      const data = { name: form.name, category: form.category, brand: form.brand, gender: form.gender, variants: '[]', purchase_price: Number(form.purchase_price) || 0, selling_price: Number(form.selling_price) || 0 };
      if (editId) { await updateClProduct(tenantId, editId, data); toast.success('Product updated'); }
      else { await createClProduct(tenantId, data); toast.success('Product added'); }
      qc.invalidateQueries({ queryKey: ['cl-products'] });
      resetForm();
    } catch { toast.error('Failed to save'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return;
    await deleteClProduct(tenantId, id);
    qc.invalidateQueries({ queryKey: ['cl-products'] });
    toast.success('Deleted');
  }

  async function handleAddStock() {
    if (!showStock || !stockSize || !stockColor) { toast.error('Select size and color'); return; }
    const qty = Number(stockQty);
    if (isNaN(qty) || qty < 0) { toast.error('Enter valid quantity'); return; }
    await upsertClStock(tenantId, showStock, stockSize, stockColor, qty);
    qc.invalidateQueries({ queryKey: ['cl-stock'] });
    qc.invalidateQueries({ queryKey: ['clothing-stats'] });
    setStockSize(''); setStockColor(''); setStockQty('');
    toast.success('Stock updated');
  }

  function startEdit(p: any) {
    setForm({ name: p.name, category: p.category, brand: p.brand, gender: p.gender, purchase_price: String(p.purchase_price), selling_price: String(p.selling_price) });
    setEditId(p.id); setShowForm(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Products</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#db2777' }}>
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">{editId ? 'Edit Product' : 'New Product'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Name *</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Category</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Brand</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Gender</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Purchase Price</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Selling Price</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#db2777' }}>Save</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  {p.brand && <span className="text-xs text-slate-400">{p.brand}</span>}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">{p.category}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">{p.gender}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Cost {fmt(p.purchase_price)} · Sell {fmt(p.selling_price)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowStock(showStock === p.id ? null : p.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Stock
                </button>
                <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {showStock === p.id && (
              <div className="mt-4 pt-4 border-t border-slate-50 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" value={stockSize} onChange={e => setStockSize(e.target.value)}>
                    <option value="">Size</option>{SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" value={stockColor} onChange={e => setStockColor(e.target.value)}>
                    <option value="">Color</option>{COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    value={stockQty} onChange={e => setStockQty(e.target.value)} />
                  <button onClick={handleAddStock} className="rounded-lg text-xs font-semibold text-white px-3" style={{ background: '#db2777' }}>Set</button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-h-32 overflow-y-auto">
                  {stockList.map(s => (
                    <div key={s.id} className={`text-center p-2 rounded-lg text-xs ${s.quantity === 0 ? 'bg-red-50 text-red-600' : s.quantity <= 3 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-700'}`}>
                      <p className="font-semibold">{s.size}/{s.color}</p>
                      <p>{s.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {products.length === 0 && <p className="text-center text-slate-400 py-12">No products found</p>}
      </div>
    </div>
  );
}
