// [events] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Phone } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listVendors, createVendor, deleteVendor } from '@/lib/db/events';
import { toast } from 'sonner';

const CATEGORIES = ['Catering', 'Decoration', 'Photography', 'Videography', 'DJ / Music', 'Flowers', 'Venue', 'Transport', 'Other'];

export function VendorsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filterCat, setFilterCat] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', phone: '', notes: '' });

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['ev-vendors', tenantId, filterCat],
    queryFn: () => listVendors(tenantId, filterCat || undefined),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createVendor(tenantId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ev-vendors'] }); setShowAdd(false); setForm({ name: '', category: '', phone: '', notes: '' }); toast.success('Vendor added'); },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteVendor(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ev-vendors'] }); toast.success('Vendor removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-500">
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterCat === '' ? 'bg-pink-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCat === c ? 'bg-pink-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-300'}`}>{c}</button>
        ))}
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vendors.map(v => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{v.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 font-medium">{v.category || 'Other'}</span>
                  {v.phone && <div className="flex items-center gap-1 mt-1 text-xs text-slate-500"><Phone className="h-3 w-3" />{v.phone}</div>}
                  {v.notes && <p className="text-xs text-slate-400 mt-1">{v.notes}</p>}
                </div>
                <button onClick={() => { if (confirm('Remove vendor?')) del.mutate(v.id); }} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {vendors.length === 0 && <p className="text-slate-400 text-sm text-center py-8 col-span-2">No vendors found</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Vendor</h2>
            {[
              { key: 'name', label: 'Vendor Name *', placeholder: 'e.g. Raj Catering' },
              { key: 'phone', label: 'Phone', placeholder: '9xxxxxxxxx' },
              { key: 'notes', label: 'Notes', placeholder: 'Pricing, specialty, etc.' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                <option value="">— Select category —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.name.trim() || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
