// [optician] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listOptInventory, createOptInventory, updateOptInventory, deleteOptInventory } from '@/lib/db/optician';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const CATEGORIES = ['frame', 'lens', 'sunglasses', 'accessories', 'contact_lens', 'solution'];
const CAT_LABELS: Record<string, string> = {
  frame: 'Frame', lens: 'Lens', sunglasses: 'Sunglasses',
  accessories: 'Accessories', contact_lens: 'Contact Lens', solution: 'Solution',
};
const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  frame: { bg: '#dbeafe', text: '#1d4ed8' },
  lens: { bg: '#dcfce7', text: '#166534' },
  sunglasses: { bg: '#fef3c7', text: '#92400e' },
  accessories: { bg: '#ede9fe', text: '#6d28d9' },
  contact_lens: { bg: '#cffafe', text: '#0e7490' },
  solution: { bg: '#f0fdf4', text: '#15803d' },
};

export function InventoryPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'frame', brand: '', stock: '', purchase_price: '', selling_price: '' });

  const { data: inventory = [] } = useQuery({
    queryKey: ['opt-inventory', tenantId, catFilter],
    queryFn: () => listOptInventory(tenantId, catFilter || undefined),
    enabled: !!tenantId,
  });

  const filtered = search ? inventory.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.brand.toLowerCase().includes(search.toLowerCase())) : inventory;

  function resetForm() { setForm({ name: '', category: 'frame', brand: '', stock: '', purchase_price: '', selling_price: '' }); setEditId(null); setShowForm(false); }

  async function handleSave() {
    if (!form.name) { toast.error('Name required'); return; }
    try {
      const data = { name: form.name, category: form.category, brand: form.brand, stock: Number(form.stock) || 0, purchase_price: Number(form.purchase_price) || 0, selling_price: Number(form.selling_price) || 0 };
      if (editId) { await updateOptInventory(tenantId, editId, data); toast.success('Updated'); }
      else { await createOptInventory(tenantId, data); toast.success('Added'); }
      qc.invalidateQueries({ queryKey: ['opt-inventory'] });
      qc.invalidateQueries({ queryKey: ['optician-stats'] });
      resetForm();
    } catch { toast.error('Failed'); }
  }

  function startEdit(item: any) {
    setForm({ name: item.name, category: item.category, brand: item.brand, stock: String(item.stock), purchase_price: String(item.purchase_price), selling_price: String(item.selling_price) });
    setEditId(item.id); setShowForm(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-sm">{filtered.length} items</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#0891b2' }}>
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">{editId ? 'Edit Item' : 'New Item'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Name *</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Category</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}</select></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Brand</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Stock</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Purchase Price</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Selling Price</label>
              <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#0891b2' }}>Save</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(item => {
          const cc = CAT_COLORS[item.category] ?? { bg: '#f1f5f9', text: '#64748b' };
          const lowStock = item.stock <= 5;
          return (
            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${lowStock ? 'border-orange-200' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  {item.brand && <p className="text-xs text-slate-400">{item.brand}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cc.bg, color: cc.text }}>
                  {CAT_LABELS[item.category] ?? item.category}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1.5">
                  {lowStock && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                  <span className={`text-sm font-bold ${lowStock ? 'text-orange-600' : 'text-slate-700'}`}>{item.stock} in stock</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Buy {fmt(item.purchase_price)}</p>
                  <p className="text-xs font-semibold text-cyan-600">Sell {fmt(item.selling_price)}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
                <button onClick={() => startEdit(item)} className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1">
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
                <button onClick={async () => { if (confirm('Delete?')) { await deleteOptInventory(tenantId, item.id); qc.invalidateQueries({ queryKey: ['opt-inventory'] }); toast.success('Deleted'); }}} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-100 text-red-400 hover:bg-red-50">Delete</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="col-span-3 text-center text-slate-400 py-12">No items found</p>}
      </div>
    </div>
  );
}
