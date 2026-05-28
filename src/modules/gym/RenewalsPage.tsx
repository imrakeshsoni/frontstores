// [gym] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getExpiringMembers, getExpiredMembers, listPlans, renewMembership } from '@/lib/db/gym';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function daysLeft(end: string | null) { if (!end) return null; return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000); }

export function RenewalsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'expiring' | 'expired'>('expiring');
  const [renewForm, setRenewForm] = useState<{ memberId: string; memberName: string; planId: string; amount: string; paymentMethod: string } | null>(null);

  const { data: expiring = [] } = useQuery({ queryKey: ['gym-expiring', tenantId], queryFn: () => getExpiringMembers(tenantId, 7), enabled: !!tenantId });
  const { data: expired = [] } = useQuery({ queryKey: ['gym-expired', tenantId], queryFn: () => getExpiredMembers(tenantId), enabled: !!tenantId });
  const { data: plans = [] } = useQuery({ queryKey: ['gym-plans', tenantId], queryFn: () => listPlans(tenantId), enabled: !!tenantId });

  const renew = useMutation({
    mutationFn: () => {
      const plan = plans.find(p => p.id === renewForm!.planId) ?? plans[0];
      const from = new Date().toISOString().slice(0, 10);
      const until = new Date(Date.now() + (plan?.duration_days ?? 30) * 86400000).toISOString().slice(0, 10);
      return renewMembership(tenantId, {
        member_id: renewForm!.memberId, member_name: renewForm!.memberName,
        plan_id: plan?.id ?? null, plan_name: plan?.name ?? 'Custom',
        duration_days: plan?.duration_days ?? 30,
        amount: Number(renewForm!.amount),
        payment_method: renewForm!.paymentMethod,
        renewed_at: new Date().toISOString(),
        valid_from: from, valid_until: until, notes: null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gym-expiring'] });
      qc.invalidateQueries({ queryKey: ['gym-expired'] });
      qc.invalidateQueries({ queryKey: ['gym-members'] });
      qc.invalidateQueries({ queryKey: ['gym-stats'] });
      setRenewForm(null);
    },
  });

  const members = tab === 'expiring' ? expiring : expired;

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Renewals</h1>

      <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-medium w-fit">
        <button onClick={() => setTab('expiring')} className={`px-4 py-2 flex items-center gap-2 transition-colors ${tab === 'expiring' ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
          <AlertTriangle className="h-3.5 w-3.5" /> Expiring Soon ({expiring.length})
        </button>
        <button onClick={() => setTab('expired')} className={`px-4 py-2 flex items-center gap-2 transition-colors ${tab === 'expired' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
          Expired ({expired.length})
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {members.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">🎉</p>
            <p>{tab === 'expiring' ? 'No memberships expiring in next 7 days' : 'No expired memberships'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {members.map(m => {
              const days = daysLeft(m.membership_end);
              return (
                <div key={m.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-slate-900">{m.name}</p>
                    <div className="flex gap-3 mt-0.5">
                      {m.phone && <span className="text-xs text-slate-400">{m.phone}</span>}
                      {m.plan_name && <span className="text-xs text-slate-400">{m.plan_name}</span>}
                      <span className={`text-xs font-medium ${days !== null && days < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                        {days !== null && days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const plan = plans.find(p => p.id === m.plan_id) ?? plans[0];
                      setRenewForm({ memberId: m.id!, memberName: m.name, planId: plan?.id ?? '', amount: String(plan?.price ?? ''), paymentMethod: 'cash' });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Renew
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {renewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Renew — {renewForm.memberName}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                <select className="input w-full" value={renewForm.planId} onChange={e => {
                  const p = plans.find(p => p.id === e.target.value);
                  setRenewForm(f => f ? { ...f, planId: e.target.value, amount: String(p?.price ?? f.amount) } : f);
                }}>
                  <option value="">Select plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)} ({p.duration_days}d)</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
                <input type="number" className="input w-full" value={renewForm.amount} onChange={e => setRenewForm(f => f ? { ...f, amount: e.target.value } : f)} />
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                <select className="input w-full" value={renewForm.paymentMethod} onChange={e => setRenewForm(f => f ? { ...f, paymentMethod: e.target.value } : f)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setRenewForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => renew.mutate()} disabled={!renewForm.planId || !renewForm.amount || renew.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {renew.isPending ? 'Processing…' : 'Confirm Renewal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
