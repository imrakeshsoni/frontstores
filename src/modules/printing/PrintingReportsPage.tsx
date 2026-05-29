// [printing] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listPRJobs, listPRStationerySales } from '@/lib/db/printing';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function PrintingReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: jobs = [] } = useQuery({
    queryKey: ['pr-jobs-report', tenantId],
    queryFn: () => listPRJobs(tenantId),
    enabled: !!tenantId,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['pr-stationery-sales-report', tenantId],
    queryFn: () => listPRStationerySales(tenantId, 200),
    enabled: !!tenantId,
  });

  const totalJobRevenue = jobs.filter(j => j.status === 'delivered').reduce((s, j) => s + j.total_amount, 0);
  const totalStatRevenue = sales.reduce((s, x) => s + x.total, 0);
  const pendingJobs = jobs.filter(j => j.status !== 'delivered' && j.status !== 'cancelled').length;

  // Revenue by job type
  const byJobType: Record<string, { count: number; revenue: number }> = {};
  for (const j of jobs.filter(j => j.status === 'delivered')) {
    const t = j.job_type || 'Other';
    byJobType[t] = byJobType[t] ?? { count: 0, revenue: 0 };
    byJobType[t].count++;
    byJobType[t].revenue += j.total_amount;
  }

  // Monthly job revenue
  const byMonth: Record<string, number> = {};
  for (const j of jobs) {
    if (!j.delivered_at) continue;
    const month = j.delivered_at.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + j.total_amount;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Printing Reports</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Printing Revenue', value: fmt(totalJobRevenue), color: '#2563eb', bg: '#dbeafe' },
          { label: 'Stationery Revenue', value: fmt(totalStatRevenue), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Total Revenue', value: fmt(totalJobRevenue + totalStatRevenue), color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Pending Jobs', value: String(pendingJobs), color: '#d97706', bg: '#fef3c7' },
        ].map(c => (
          <div key={c.label} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* By job type */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Revenue by Job Type</h2>
        {Object.keys(byJobType).length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No delivered jobs yet</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(byJobType).sort(([, a], [, b]) => b.revenue - a.revenue).map(([type, data]) => (
              <div key={type} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="font-medium text-slate-700">{type}</span>
                <div className="text-right">
                  <span className="font-bold text-blue-700">{fmt(data.revenue)}</span>
                  <span className="text-xs text-slate-400 ml-2">({data.count} jobs)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Monthly Summary</h2>
        {Object.keys(byMonth).length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No data yet</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, rev]) => (
              <div key={month} className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                <span className="font-medium text-slate-700">{new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                <span className="font-bold text-blue-700">{fmt(rev)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
