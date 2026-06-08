// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCRMDeals, createCRMDeal, updateCRMDeal, deleteCRMDeal, listCRMContacts } from '@/lib/db/crm';
import { toast } from 'sonner';

const STAGES = [
  { key: 'new', label: 'New', color: '#64748b', bg: '#f1f5f9' },
  { key: 'proposal', label: 'Proposal', color: '#2563eb', bg: '#dbeafe' },
  { key: 'negotiation', label: 'Negotiation', color: '#d97706', bg: '#fef3c7' },
  { key: 'won', label: 'Won', color: '#16a34a', bg: '#dcfce7' },
  { key: 'lost', label: 'Lost', color: '#dc2626', bg: '#fee2e2' },
];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CRMPipelinePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ contact_id: '', title: '', value: '', expected_close_date: '', notes: '' });

  const { data: deals = [] } = useQuery({
    queryKey: ['crm-deals', tenantId],
    queryFn: () => listCRMDeals(tenantId),
    enabled: !!tenantId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts', tenantId, ''],
    queryFn: () => listCRMContacts(tenantId),
    enabled: !!tenantId,
  });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? 'Unknown';

  const add = useMutation({
    mutationFn: () => createCRMDeal(tenantId, { contact_id: form.contact_id, title: form.title, value: Number(form.value) || 0, stage: 'new', expected_close_date: form.expected_close_date || null, notes: form.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-deals'] }); setShowAdd(false); setForm({ contact_id: '', title: '', value: '', expected_close_date: '', notes: '' }); toast.success('Deal added'); },
    onError: (e) => toast.error(String(e)),
  });

  const moveStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => updateCRMDeal(tenantId, id, { stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-deals'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCRMDeal(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-deals'] }); toast.success('Deal removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors">
          <Plus className="h-4 w-4" /> Add Deal
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key);
          const total = stageDeals.reduce((s, d) => s + d.value, 0);
          return (
            <div key={stage.key} className="rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col">
              <div className="p-3 rounded-t-2xl flex items-center justify-between" style={{ background: stage.bg }}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: stage.color }}>{stage.label}</span>
                <span className="text-xs font-semibold" style={{ color: stage.color }}>{fmt(total)}</span>
              </div>
              <div className="p-2 space-y-2 flex-1 min-h-[80px]">
                {stageDeals.map(d => (
                  <div key={d.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{d.title}</p>
                        <p className="text-xs text-slate-400">{contactName(d.contact_id)}</p>
                      </div>
                      <button onClick={() => { if (confirm('Remove this deal?')) del.mutate(d.id); }} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className="text-sm font-bold" style={{ color: stage.color }}>{fmt(d.value)}</p>
                    {d.expected_close_date && <p className="text-[11px] text-slate-400">Close: {new Date(d.expected_close_date).toLocaleDateString('en-IN')}</p>}
                    <select value={d.stage} onChange={e => moveStage.mutate({ id: d.id, stage: e.target.value })}
                      className="w-full text-xs font-medium rounded-lg px-2 py-1.5 border border-slate-200 outline-none cursor-pointer bg-white">
                      {STAGES.map(s => <option key={s.key} value={s.key}>Move to: {s.label}</option>)}
                    </select>
                  </div>
                ))}
                {stageDeals.length === 0 && <p className="text-xs text-slate-300 text-center py-6">No deals</p>}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Deal</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">Select contact…</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Deal title *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Annual subscription" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Value (₹)</label>
                <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expected close</label>
                <input type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.contact_id || !form.title.trim() || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
