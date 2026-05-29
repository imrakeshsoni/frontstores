// [insurance] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listInsRenewals, createInsRenewal, markRenewalPaid, listInsPolicies } from '@/lib/db/insurance';
import { toast } from 'sonner';

export function InsRenewalsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showPaid, setShowPaid] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ policy_id: '', due_date: '', premium: '' });
  const today = new Date().toISOString().slice(0, 10);

  const { data: renewals = [], isLoading } = useQuery({
    queryKey: ['ins-renewals', tenantId, showPaid],
    queryFn: () => listInsRenewals(tenantId, showPaid ? true : false),
    enabled: !!tenantId,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['ins-policies', tenantId],
    queryFn: () => listInsPolicies(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createInsRenewal(tenantId, {
      policy_id: form.policy_id, due_date: form.due_date,
      premium: parseFloat(form.premium) || 0, paid: 0, paid_date: null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-renewals'] }); setShowAdd(false); toast.success('Renewal added'); },
    onError: (e) => toast.error(String(e)),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => markRenewalPaid(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-renewals'] }); qc.invalidateQueries({ queryKey: ['insurance-stats'] }); toast.success('Marked as paid'); },
  });

  function policyLabel(id: string) {
    const p = policies.find(p => p.id === id);
    return p ? `${p.policy_no} — ${p.plan_name || p.policy_type}` : id;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Renewals</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPaid(p => !p)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showPaid ? 'bg-green-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {showPaid ? 'Showing Paid' : 'Showing Unpaid'}
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-500">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {renewals.map(r => {
            const isOverdue = !r.paid && r.due_date < today;
            return (
              <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between ${isOverdue ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    {isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : r.paid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    <p className="text-sm font-semibold text-slate-800">{policyLabel(r.policy_id)}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(r.due_date).toLocaleDateString('en-IN')} · ₹{r.premium.toLocaleString('en-IN')}</p>
                  {r.paid && r.paid_date && <p className="text-xs text-green-600">Paid on {new Date(r.paid_date).toLocaleDateString('en-IN')}</p>}
                </div>
                {!r.paid && (
                  <button onClick={() => markPaid.mutate(r.id)} className="px-3 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors">
                    Mark Paid
                  </button>
                )}
              </div>
            );
          })}
          {renewals.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No {showPaid ? 'paid' : 'unpaid'} renewals</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Add Renewal</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Policy *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.policy_id} onChange={e => setForm(p => ({ ...p, policy_id: e.target.value }))}>
                <option value="">— Select policy —</option>
                {policies.map(p => <option key={p.id} value={p.id}>{p.policy_no} — {p.plan_name || p.policy_type}</option>)}
              </select>
            </div>
            {[
              { key: 'due_date', label: 'Due Date *', type: 'date' },
              { key: 'premium', label: 'Premium (₹)', placeholder: '10000', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.policy_id || !form.due_date || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Renewal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
