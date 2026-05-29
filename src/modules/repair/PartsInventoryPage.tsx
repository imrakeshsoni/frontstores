// [repair] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listRepairParts, saveRepairPart, deleteRepairPart, type RepairPart } from '@/lib/db/repair';

const EMPTY: Partial<RepairPart> & { name: string } = {
  name: '', category: '', stock: 0, purchase_price: 0, selling_price: 0,
};

export function PartsInventoryPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: parts = [] } = useQuery({
    queryKey: ['repair-parts', tenantId],
    queryFn: () => listRepairParts(tenantId),
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveRepairPart(tenantId, data as RepairPart & { name: string }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repair-parts'] }); setForm(null); toast.success('Saved'); },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRepairPart(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repair-parts'] }); toast.success('Part deleted'); },
  });

  const up = (k: keyof typeof EMPTY, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = parts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));
  const lowStock = parts.filter(p => p.stock <= 3 && p.stock >= 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Parts Inventory</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#dc2626' }}>
          <Plus className="h-4 w-4" /> Add Part
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Low Stock Alert</p>
            <p className="text-xs text-orange-700">{lowStock.map(p => `${p.name} (${p.stock})`).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-4xl mb-2">📦</p>
            <p className="font-medium">No parts found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Part Name', 'Category', 'Stock', 'Buy Price', 'Sell Price', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--surface-border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.category || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.stock <= 3 ? 'text-orange-600 bg-orange-100' : 'text-slate-600 bg-slate-100'}`}>{p.stock}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>₹{p.purchase_price}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>₹{p.selling_price}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setForm({ ...p })} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Part' : 'Add Part'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium mb-1 text-slate-600">Part Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} autoFocus /></div>
              <div className="col-span-2"><label className="block text-xs font-medium mb-1 text-slate-600">Category</label><input className="input w-full" value={form.category} onChange={e => up('category', e.target.value)} placeholder="e.g. Screen, Battery" /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Stock</label><input type="number" className="input w-full" value={form.stock} onChange={e => up('stock', parseInt(e.target.value)||0)} min="0" /></div>
              <div><label className="block text-xs font-medium mb-1 text-slate-600">Buy Price (₹)</label><input type="number" className="input w-full" value={form.purchase_price} onChange={e => up('purchase_price', parseFloat(e.target.value)||0)} min="0" /></div>
              <div className="col-span-2"><label className="block text-xs font-medium mb-1 text-slate-600">Sell Price (₹)</label><input type="number" className="input w-full" value={form.selling_price} onChange={e => up('selling_price', parseFloat(e.target.value)||0)} min="0" /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#dc2626' }}>
                {save.isPending ? 'Saving…' : 'Save Part'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
