// [jewellery] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Wrench } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listRepairs, saveRepair, type RepairJob } from '@/lib/db/jewellery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  received:    { label: 'Received',    color: '#d97706', bg: '#fef3c7' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#dbeafe' },
  ready:       { label: 'Ready',       color: '#16a34a', bg: '#dcfce7' },
  delivered:   { label: 'Delivered',   color: '#6b7280', bg: '#f3f4f6' },
};

const EMPTY: Partial<RepairJob> & { customer_name: string; item_description: string } = {
  customer_name: '', customer_phone: null, item_description: '', issue: null,
  estimated_price: 0, advance_paid: 0, final_price: null, status: 'received', expected_date: null,
};

export function RepairsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: repairs = [] } = useQuery({ queryKey: ['jewellery-repairs', tenantId], queryFn: () => listRepairs(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => saveRepair(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jewellery-repairs'] }); qc.invalidateQueries({ queryKey: ['jewellery-stats'] }); setForm(null); },
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const filtered = statusFilter ? repairs.filter(r => r.status === statusFilter) : repairs.filter(r => r.status !== 'delivered');

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Repair Jobs</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> New Repair
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!statusFilter ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Active</button>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === k ? 'text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}
            style={statusFilter === k ? { background: v.color } : { color: v.color }}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No active repairs</p>
          </div>
        ) : filtered.map(r => {
          const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.received;
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{r.customer_name}</h3>
                    <span className="text-xs text-slate-400">#{r.job_number}</span>
                  </div>
                  {r.customer_phone && <p className="text-xs text-slate-400 mt-0.5">{r.customer_phone}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                  <button onClick={() => setForm({ ...r })} className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-1">{r.item_description}</p>
              {r.issue && <p className="text-xs text-slate-500 mb-2">Issue: {r.issue}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {r.expected_date && <span>📅 {new Date(r.expected_date).toLocaleDateString('en-IN')}</span>}
                <span>Est: <strong className="text-slate-700">{fmt(r.estimated_price)}</strong></span>
                {r.advance_paid > 0 && <span>Advance: <strong className="text-green-600">{fmt(r.advance_paid)}</strong></span>}
                {r.final_price !== null && r.final_price !== undefined && <span>Final: <strong className="text-amber-600">{fmt(r.final_price)}</strong></span>}
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Repair' : 'New Repair Job'}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label><input className="input w-full" value={form.customer_name} onChange={e => up('customer_name', e.target.value)} autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.customer_phone ?? ''} onChange={e => up('customer_phone', e.target.value || null)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Item Description *</label><textarea className="input w-full" rows={2} value={form.item_description} onChange={e => up('item_description', e.target.value)} placeholder="e.g. Gold necklace, broken clasp" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Issue / Problem</label><input className="input w-full" value={form.issue ?? ''} onChange={e => up('issue', e.target.value || null)} placeholder="e.g. Broken chain, resize needed" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Est. Price (₹)</label><input type="number" className="input w-full" value={form.estimated_price} onChange={e => up('estimated_price', Number(e.target.value))} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Advance (₹)</label><input type="number" className="input w-full" value={form.advance_paid} onChange={e => up('advance_paid', Number(e.target.value))} /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Expected Date</label><input type="date" className="input w-full" value={form.expected_date ?? ''} onChange={e => up('expected_date', e.target.value || null)} /></div>
              {form.id && <>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select className="input w-full" value={form.status} onChange={e => up('status', e.target.value)}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Final Price (₹)</label><input type="number" className="input w-full" value={form.final_price ?? ''} onChange={e => up('final_price', e.target.value ? Number(e.target.value) : null)} /></div>
              </>}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.customer_name.trim() || !form.item_description.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
