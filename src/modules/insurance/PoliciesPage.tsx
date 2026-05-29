// [insurance] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, Trash2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listInsPolicies, listInsClients, createInsPolicy, deleteInsPolicy } from '@/lib/db/insurance';
import { toast } from 'sonner';

const POLICY_TYPES = ['Life', 'Health', 'Vehicle', 'Term', 'ULIP', 'Endowment', 'Critical Illness', 'Home', 'Travel', 'Other'];
const PREMIUM_MODES = ['annual', 'semi-annual', 'quarterly', 'monthly'];

export function PoliciesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const soon  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    client_id: '', policy_no: '', insurer: '', policy_type: '', plan_name: '',
    premium: '', premium_mode: 'annual', start_date: '', maturity_date: '',
    next_due_date: '', status: 'active', commission: '',
  });

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['ins-policies', tenantId],
    queryFn: () => listInsPolicies(tenantId),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ins-clients', tenantId, ''],
    queryFn: () => listInsClients(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createInsPolicy(tenantId, {
      client_id: form.client_id, policy_no: form.policy_no, insurer: form.insurer,
      policy_type: form.policy_type, plan_name: form.plan_name,
      premium: parseFloat(form.premium) || 0, premium_mode: form.premium_mode,
      start_date: form.start_date, maturity_date: form.maturity_date || null,
      next_due_date: form.next_due_date || null, status: form.status,
      commission: parseFloat(form.commission) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-policies'] }); qc.invalidateQueries({ queryKey: ['insurance-stats'] }); setShowAdd(false); toast.success('Policy added'); },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteInsPolicy(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ins-policies'] }); toast.success('Policy removed'); },
  });

  function clientName(id: string) { return clients.find(c => c.id === id)?.name ?? '—'; }
  function isExpiringSoon(p: { next_due_date: string | null }) { return p.next_due_date && p.next_due_date >= today && p.next_due_date <= soon; }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-500">
          <Plus className="h-4 w-4" /> Add Policy
        </button>
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {policies.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${isExpiringSoon(p) ? 'border-amber-200 bg-amber-50' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 flex-shrink-0">
                    {isExpiringSoon(p) ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <Shield className="h-5 w-5 text-green-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{p.plan_name || p.policy_no}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{p.policy_type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{clientName(p.client_id)} · {p.insurer}</p>
                    <p className="text-xs text-slate-400">Policy: {p.policy_no} · Premium: ₹{p.premium.toLocaleString('en-IN')} ({p.premium_mode})</p>
                    <p className="text-xs text-slate-400">Start: {p.start_date ? new Date(p.start_date).toLocaleDateString('en-IN') : '—'} · Next Due: {p.next_due_date ? new Date(p.next_due_date).toLocaleDateString('en-IN') : '—'}</p>
                  </div>
                </div>
                <button onClick={() => { if (confirm('Remove policy?')) del.mutate(p.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {policies.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No policies found</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800">Add Policy</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                <option value="">— Select client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Policy Type</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.policy_type} onChange={e => setForm(p => ({ ...p, policy_type: e.target.value }))}>
                <option value="">— Select —</option>
                {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { key: 'policy_no', label: 'Policy Number *', placeholder: 'Policy number' },
              { key: 'insurer', label: 'Insurer / Company', placeholder: 'e.g. LIC, HDFC Life' },
              { key: 'plan_name', label: 'Plan Name', placeholder: 'Plan name' },
              { key: 'premium', label: 'Premium (₹)', placeholder: '10000', type: 'number' },
              { key: 'commission', label: 'Commission (₹)', placeholder: '500', type: 'number' },
              { key: 'start_date', label: 'Start Date *', type: 'date' },
              { key: 'maturity_date', label: 'Maturity Date', type: 'date' },
              { key: 'next_due_date', label: 'Next Due Date', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Premium Mode</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.premium_mode} onChange={e => setForm(p => ({ ...p, premium_mode: e.target.value }))}>
                {PREMIUM_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.client_id || !form.policy_no || !form.start_date || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
