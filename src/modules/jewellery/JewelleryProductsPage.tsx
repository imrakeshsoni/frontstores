// [jewellery] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listItems, saveItem, deleteItem, type JewelleryItem } from '@/lib/db/jewellery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const CATEGORIES = ['ring', 'necklace', 'earring', 'bracelet', 'bangle', 'pendant', 'chain', 'anklet', 'mangalsutra', 'other'];
const PURITIES = ['24k', '22k', '18k', '14k', '925 silver', '999 silver', 'other'];

const EMPTY: Partial<JewelleryItem> & { name: string } = {
  name: '', category: 'ring', metal: 'gold', purity: '22k',
  gross_weight: 0, net_weight: 0, stone_weight: 0,
  making_charges: 0, making_type: 'fixed', wastage_pct: 0,
  stock_qty: 1, cost_price: 0, selling_price: 0,
  hsn_code: null, barcode: null, is_active: true,
};

export function JewelleryProductsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: items = [] } = useQuery({ queryKey: ['jewellery-items', tenantId, catFilter], queryFn: () => listItems(tenantId, catFilter || undefined), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveItem(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jewellery-items'] }); qc.invalidateQueries({ queryKey: ['jewellery-stats'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteItem(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jewellery-items'] }); qc.invalidateQueries({ queryKey: ['jewellery-stats'] }); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Jewellery Inventory</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none capitalize">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-2">💍</p>
            <p className="font-medium">No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 font-medium border-b border-slate-100">
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-left px-3 py-3">Purity</th>
                  <th className="text-right px-3 py-3">Wt (g)</th>
                  <th className="text-right px-3 py-3">Qty</th>
                  <th className="text-right px-3 py-3">Price</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{i.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{i.category} · {i.metal}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600 uppercase">{i.purity}</td>
                    <td className="text-right px-3 py-3 text-slate-600">{i.gross_weight}g</td>
                    <td className="text-right px-3 py-3">
                      <span className={`font-semibold ${i.stock_qty === 0 ? 'text-red-500' : 'text-slate-800'}`}>{i.stock_qty}</span>
                    </td>
                    <td className="text-right px-3 py-3 font-semibold text-amber-700">{fmt(i.selling_price)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setForm({ ...i })} className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (confirm(`Delete ${i.name}?`)) del.mutate(i.id!); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Item' : 'Add Item'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} placeholder="Item name" autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select className="input w-full capitalize" value={form.category} onChange={e => up('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Metal</label>
                <select className="input w-full" value={form.metal} onChange={e => up('metal', e.target.value)}>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="platinum">Platinum</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Purity</label>
                <select className="input w-full uppercase" value={form.purity} onChange={e => up('purity', e.target.value)}>
                  {PURITIES.map(p => <option key={p} value={p} className="uppercase">{p}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Stock Qty</label><input type="number" className="input w-full" value={form.stock_qty} onChange={e => up('stock_qty', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Gross Weight (g)</label><input type="number" step="0.001" className="input w-full" value={form.gross_weight} onChange={e => up('gross_weight', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Net Weight (g)</label><input type="number" step="0.001" className="input w-full" value={form.net_weight} onChange={e => up('net_weight', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Stone Weight (g)</label><input type="number" step="0.001" className="input w-full" value={form.stone_weight} onChange={e => up('stone_weight', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Making Charges (₹)</label><input type="number" className="input w-full" value={form.making_charges} onChange={e => up('making_charges', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Selling Price (₹)</label><input type="number" className="input w-full" value={form.selling_price} onChange={e => up('selling_price', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">HSN Code</label><input className="input w-full" value={form.hsn_code ?? ''} onChange={e => up('hsn_code', e.target.value || null)} placeholder="e.g. 7113" /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
