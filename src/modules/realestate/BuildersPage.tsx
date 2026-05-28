// [realestate] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building, Phone, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listBuilders, saveBuilder, deleteBuilder, type REBuilder } from '@/lib/db/realestate';

const EMPTY: Partial<REBuilder> & { name: string } = {
  name:'', contact_person:null, phone:null, email:null, address:null, rera_no:null, commission_pct:0, notes:null,
};

export function BuildersPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: builders = [] } = useQuery({ queryKey: ['re-builders', tenantId], queryFn: () => listBuilders(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveBuilder(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-builders'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteBuilder(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['re-builders'] }),
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = builders.filter(b => {
    const q = search.toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || (b.contact_person ?? '').toLowerCase().includes(q) || (b.phone ?? '').includes(q);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Builders / Developers</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Builder
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search builders…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(b => (
          <div key={b.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{b.name}</p>
                {b.contact_person && <p className="text-xs text-slate-400">{b.contact_person}</p>}
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              {b.phone && <div className="flex items-center gap-1.5 text-slate-600"><Phone className="h-3.5 w-3.5" />{b.phone}</div>}
              {b.email && <p className="text-xs text-slate-400">{b.email}</p>}
              {b.rera_no && <p className="text-xs text-slate-400">RERA: {b.rera_no}</p>}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">My Commission</span>
                <span className="font-semibold text-emerald-700">{b.commission_pct}%</span>
              </div>
            </div>
            {b.notes && <p className="text-xs text-slate-400 mt-2 italic">{b.notes}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setForm({ ...EMPTY, ...b })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200">Edit</button>
              <button onClick={() => { if (confirm('Delete?')) del.mutate(b.id); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400 text-sm">No builders added. Add builders you work with.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{form.id ? 'Edit Builder' : 'Add Builder'}</h2>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Builder Name *</label>
                <input value={form.name} onChange={e => up('name', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g. Godrej Properties" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Contact Person</label>
                <input value={form.contact_person ?? ''} onChange={e => up('contact_person', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="Channel partner manager name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                <input value={form.phone ?? ''} onChange={e => up('phone', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                <input value={form.email ?? ''} onChange={e => up('email', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">RERA Number</label>
                <input value={form.rera_no ?? ''} onChange={e => up('rera_no', e.target.value || null)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">My Commission %</label>
                <input type="number" step="0.25" value={form.commission_pct ?? 0} onChange={e => up('commission_pct', +e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Office Address</label>
                <textarea value={form.address ?? ''} onChange={e => up('address', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => form.name.trim() && save.mutate(form)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : (form.id ? 'Update' : 'Add Builder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
