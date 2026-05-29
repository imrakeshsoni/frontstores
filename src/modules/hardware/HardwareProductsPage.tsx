// [hardware] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listHwProducts, saveHwProduct, deleteHwProduct, listHwCategories, type HwProduct } from '@/lib/db/hardware';

const UNITS = ['piece', 'kg', 'meter', 'liter', 'box', 'bag', 'bundle', 'pair', 'set', 'roll'];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

const emptyForm = (): Partial<HwProduct> => ({
  name: '', category: '', unit: 'piece', brand: '',
  stock: 0, min_stock: 0, purchase_price: 0, selling_price: 0,
});

export function HardwareProductsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<HwProduct>>(emptyForm());

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['hw-products', tenantId, search, filterCat],
    queryFn: () => listHwProducts(tenantId, { search: search || undefined, category: filterCat || undefined }),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['hw-categories', tenantId],
    queryFn: () => listHwCategories(tenantId),
    enabled: !!tenantId,
  });

  const saveProduct = useMutation({
    mutationFn: () => saveHwProduct(tenantId, form as Partial<HwProduct> & { name: string }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-categories'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success('Product saved');
      setShowForm(false);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => deleteHwProduct(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success('Product deleted');
    },
  });

  function editProduct(p: HwProduct) {
    setForm({ ...p });
    setShowForm(true);
  }

  function upd(k: keyof HwProduct, v: string | number) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Products</h1>
        <button
          onClick={() => { setForm(emptyForm()); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#d97706' }}
        >
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">{form.id ? 'Edit Product' : 'New Product'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
              <input value={form.name ?? ''} onChange={e => upd('name', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="Product name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <input value={form.category ?? ''} onChange={e => upd('category', e.target.value)} list="cat-list" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="Category" />
              <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Brand</label>
              <input value={form.brand ?? ''} onChange={e => upd('brand', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="Brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
              <select value={form.unit ?? 'piece'} onChange={e => upd('unit', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Stock</label>
              <input type="number" value={form.stock ?? 0} onChange={e => upd('stock', parseFloat(e.target.value) || 0)} step="0.01" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Stock Alert</label>
              <input type="number" value={form.min_stock ?? 0} onChange={e => upd('min_stock', parseFloat(e.target.value) || 0)} step="0.01" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Price (₹)</label>
              <input type="number" value={form.purchase_price ?? 0} onChange={e => upd('purchase_price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Selling Price (₹)</label>
              <input type="number" value={form.selling_price ?? 0} onChange={e => upd('selling_price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => saveProduct.mutate()}
              disabled={!form.name?.trim() || saveProduct.isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#d97706' }}
            >
              {saveProduct.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Product table */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🔧</p>
          <p>No products yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div
              key={p.id}
              className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${p.stock <= p.min_stock ? 'border-orange-200' : 'border-slate-100'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  {p.stock <= p.min_stock && (
                    <span className="flex items-center gap-1 text-xs text-orange-600 font-semibold">
                      <AlertTriangle className="h-3 w-3" /> Low Stock
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{p.category}{p.brand ? ` · ${p.brand}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700">{p.stock} {p.unit}</p>
                <p className="text-xs text-slate-400">min: {p.min_stock}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{fmt(p.selling_price)}</p>
                <p className="text-xs text-slate-400">cost: {fmt(p.purchase_price)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editProduct(p)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete product?')) deleteProduct.mutate(p.id); }}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
