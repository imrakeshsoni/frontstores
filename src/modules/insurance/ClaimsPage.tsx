// [insurance] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listInsClaims, createInsClaim, updateInsClaim, deleteInsClaim, listInsPolicies } from '@/lib/db/insurance';
import { toast } from 'sonner';

const CLAIM_STATUSES = ['filed', 'under-review', 'approved', 'settled', 'rejected'];
const STATUS_COLORS: Record<string, string> = {
  filed: 'bg-yellow-100 text-yellow-700',
  'under-review': 'bg-blue-100 text-blue-700',
  approved: 'bg-cyan-100 text-cyan-700',
  settled: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export function InsClaimsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ policy_id: '', claim_no: '', amount: '', filed_date: new Date().toISOString().slice(0, 10), status: 'filed', settled_amount: '0' });

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['ins-claims', tenantId],
    queryFn: () => listInsClaims(tenantId),
    enabled: !!tenantId,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['ins-policies', tenantId],
    queryFn: () => listInsPolicies(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createInsClaim(tenantId, {
      policy_id: form.policy_id, claim_no: form.claim_no, amount: parseFloat(form.amount) || 0,
      filed_date: form.filed_date, status: form.status, settled_amount: parseFloat(form.settled_amount) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-claims'] }); setShowAdd(false); toast.success('Claim added'); },
    onError: (e) => toast.error(String(e)),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateInsClaim(tenantId, id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-claims'] }); toast.success('Status updated'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteInsClaim(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-claims'] }); toast.success('Claim removed'); },
  });

  function policyLabel(id: string) {
    const p = policies.find(p => p.id === id);
    return p ? `${p.policy_no} — ${p.plan_name || p.policy_type}` : id;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Claims</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-500">
          <Plus className="h-4 w-4" /> Add Claim
        </button>
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {claims.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">Claim {c.claim_no || '#'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{policyLabel(c.policy_id)}</p>
                <p className="text-xs text-slate-400">Claim Amount: ₹{c.amount.toLocaleString('en-IN')} · Settled: ₹{c.settled_amount.toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400">Filed: {new Date(c.filed_date).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={c.status} onChange={ev => updateStatus.mutate({ id: c.id, status: ev.target.value })}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
                  {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => { if (confirm('Delete claim?')) del.mutate(c.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {claims.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No claims</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Claim</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Policy *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.policy_id} onChange={e => setForm(p => ({ ...p, policy_id: e.target.value }))}>
                <option value="">— Select policy —</option>
                {policies.map(p => <option key={p.id} value={p.id}>{p.policy_no} — {p.plan_name || p.policy_type}</option>)}
              </select>
            </div>
            {[
              { key: 'claim_no', label: 'Claim Number', placeholder: 'Claim ref number' },
              { key: 'amount', label: 'Claim Amount (₹) *', placeholder: '100000', type: 'number' },
              { key: 'filed_date', label: 'Filed Date', type: 'date' },
              { key: 'settled_amount', label: 'Settled Amount (₹)', placeholder: '0', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.policy_id || !form.amount || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
