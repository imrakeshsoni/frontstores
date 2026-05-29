// [homeservice] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listJobs, type HsJob } from '@/lib/db/homeservice';

export function ServiceReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const { data: jobs = [] } = useQuery({ queryKey: ['hs-jobs', tenantId], queryFn: () => listJobs(tenantId) });

  const completed = (jobs as HsJob[]).filter((j: HsJob) => j.status === 'completed');
  const totalRevenue = completed.reduce((s: number, j: HsJob) => s + j.total_amount, 0);

  const byType: Record<string, number> = {};
  completed.forEach((j: HsJob) => { byType[j.service_type] = (byType[j.service_type] ?? 0) + j.total_amount; });
  const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  const byMonth: Record<string, number> = {};
  completed.forEach((j: HsJob) => {
    const m = j.job_date?.slice(0, 7) ?? '';
    if (m) byMonth[m] = (byMonth[m] ?? 0) + j.total_amount;
  });
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Jobs', value: completed.length },
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}` },
          { label: 'Pending', value: jobs.filter(j => j.status === 'scheduled').length },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Revenue by Service Type</p>
        {sorted.map(([type, rev]) => (
          <div key={type} className="flex items-center gap-3">
            <p className="text-sm w-32 truncate" style={{ color: 'var(--text-secondary)' }}>{type}</p>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full rounded-full" style={{ width: `${(rev / totalRevenue) * 100}%`, background: 'var(--accent)' }} />
            </div>
            <p className="text-sm font-semibold w-20 text-right" style={{ color: 'var(--text-primary)' }}>₹{rev.toLocaleString('en-IN')}</p>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No completed jobs yet</p>}
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Monthly Revenue</p>
        {months.map(([month, rev]) => (
          <div key={month} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--surface-border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{month}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>₹{rev.toLocaleString('en-IN')}</p>
          </div>
        ))}
        {months.length === 0 && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>}
      </div>
    </div>
  );
}
