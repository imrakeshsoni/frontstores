// [ca] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listCATasks, listCAClients } from '@/lib/db/ca';
import { BarChart3, TrendingUp, Users, CheckCircle2 } from 'lucide-react';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CAReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: tasks = [] } = useQuery({
    queryKey: ['ca-tasks', tenantId],
    queryFn: () => listCATasks(tenantId),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ca-clients', tenantId, ''],
    queryFn: () => listCAClients(tenantId),
    enabled: !!tenantId,
  });

  // Revenue by month
  const revenueByMonth = tasks
    .filter(t => t.fees_paid > 0)
    .reduce<Record<string, number>>((acc, t) => {
      const month = (t.updated_at ?? '').slice(0, 7);
      acc[month] = (acc[month] ?? 0) + t.fees_paid;
      return acc;
    }, {});

  const sortedMonths = Object.entries(revenueByMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  // Tasks by type
  const byType = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.task_type] = (acc[t.task_type] ?? 0) + 1;
    return acc;
  }, {});

  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const totalFees    = tasks.reduce((s, t) => s + t.fees, 0);
  const collectedFees = tasks.reduce((s, t) => s + t.fees_paid, 0);
  const pendingFees  = totalFees - collectedFees;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: clients.length, icon: Users, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Total Tasks', value: tasks.length, icon: BarChart3, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Completed', value: completedTasks, icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Pending Fees', value: fmt(pendingFees), icon: TrendingUp, color: '#dc2626', bg: '#fee2e2' },
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

      {/* Monthly revenue */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Monthly Revenue (Last 6 Months)</h2>
        {sortedMonths.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No revenue data yet</p>
        ) : (
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
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tasks by type */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Tasks by Type</h2>
        <div className="space-y-2">
          {topTypes.map(([type, count]) => (
            <div key={type} className="flex justify-between items-center text-sm">
              <span className="text-slate-700">{type}</span>
              <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full">{count}</span>
            </div>
          ))}
          {topTypes.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No tasks yet</p>}
        </div>
      </div>

      {/* Fees summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Fee Summary</h2>
        <div className="space-y-3">
          {[
            { label: 'Total Billed', value: totalFees, color: '#2563eb' },
            { label: 'Collected', value: collectedFees, color: '#16a34a' },
            { label: 'Pending', value: pendingFees, color: '#dc2626' },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center">
              <span className="text-sm text-slate-600">{r.label}</span>
              <span className="text-sm font-semibold" style={{ color: r.color }}>{fmt(r.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
