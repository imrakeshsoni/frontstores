// [insurance] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listInsPolicies, listInsClients } from '@/lib/db/insurance';
import { Shield, Users, TrendingUp } from 'lucide-react';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function InsReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: policies = [] } = useQuery({
    queryKey: ['ins-policies', tenantId],
    queryFn: () => listInsPolicies(tenantId),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ins-clients', tenantId, ''],
    queryFn: () => listInsClients(tenantId),
    enabled: !!tenantId,
  });

  // Commission by month
  const commByMonth = policies.reduce<Record<string, number>>((acc, p) => {
    const m = p.start_date.slice(0, 7);
    acc[m] = (acc[m] ?? 0) + p.commission;
    return acc;
  }, {});
  const sortedMonths = Object.entries(commByMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  // Policy type breakdown
  const byType = policies.reduce<Record<string, number>>((acc, p) => {
    const t = p.policy_type || 'Other';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  const totalCommission = policies.reduce((s, p) => s + p.commission, 0);
  const activePolicies = policies.filter(p => p.status === 'active').length;
  const totalPremium = policies.filter(p => p.status === 'active').reduce((s, p) => s + p.premium, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Clients', value: clients.length, icon: Users, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Active Policies', value: activePolicies, icon: Shield, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Total Commission', value: fmt(totalCommission), icon: TrendingUp, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Annual Premium', value: fmt(totalPremium), icon: TrendingUp, color: '#d97706', bg: '#fef3c7' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">{c.label}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg }}>
                <c.icon className="h-3.5 w-3.5" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Commission by Month</h2>
        {sortedMonths.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No data yet</p> : (
          <div className="space-y-3">
            {sortedMonths.map(([month, amount]) => {
              const max = Math.max(...sortedMonths.map(m => m[1]));
              const pct = max > 0 ? (amount / max) * 100 : 0;
              return (
                <div key={month}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{month}</span>
                    <span className="font-medium text-slate-800">{fmt(amount)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Policy Type Breakdown</h2>
        <div className="space-y-2">
          {topTypes.map(([type, count]) => (
            <div key={type} className="flex justify-between items-center text-sm">
              <span className="text-slate-700">{type}</span>
              <span className="font-semibold text-slate-800 bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full">{count}</span>
            </div>
          ))}
          {topTypes.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No policies yet</p>}
        </div>
      </div>
    </div>
  );
}
