// [gym] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getGymStats, getExpiringMembers, getExpiredMembers, listPlans } from '@/lib/db/gym';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function GymReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: stats } = useQuery({ queryKey: ['gym-stats', tenantId], queryFn: () => getGymStats(tenantId), enabled: !!tenantId });
  const { data: expiring = [] } = useQuery({ queryKey: ['gym-expiring', tenantId], queryFn: () => getExpiringMembers(tenantId, 30), enabled: !!tenantId });
  const { data: expired = [] } = useQuery({ queryKey: ['gym-expired', tenantId], queryFn: () => getExpiredMembers(tenantId), enabled: !!tenantId });
  const { data: plans = [] } = useQuery({ queryKey: ['gym-plans', tenantId], queryFn: () => listPlans(tenantId), enabled: !!tenantId });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Reports</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Members', value: stats?.totalMembers ?? 0, color: '#2563eb' },
          { label: 'Active Members', value: stats?.activeMembers ?? 0, color: '#16a34a' },
          { label: 'Today\'s Check-ins', value: stats?.todayCheckins ?? 0, color: '#7c3aed' },
          { label: 'Expiring in 7 Days', value: stats?.expiringIn7Days ?? 0, color: '#d97706' },
          { label: 'Expired Members', value: stats?.expiredCount ?? 0, color: '#dc2626' },
          { label: 'Today\'s Revenue', value: fmt(stats?.todayRevenue ?? 0), color: '#16a34a' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expiring in 30 days */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Expiring in 30 Days ({expiring.length})</h2>
          {expiring.length === 0 ? <p className="text-slate-400 text-sm">None expiring soon</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {expiring.map(m => (
                <div key={m.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.plan_name}</p>
                  </div>
                  <span className="text-xs font-medium text-orange-600">
                    {m.membership_end ? new Date(m.membership_end).toLocaleDateString('en-IN') : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plans summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Membership Plans</h2>
          {plans.length === 0 ? <p className="text-slate-400 text-sm">No plans created</p> : (
            <div className="space-y-2">
              {plans.map(p => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.duration_days} days</p>
                  </div>
                  <span className="font-semibold text-blue-600">{fmt(p.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
