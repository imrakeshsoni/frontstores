// [repair] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listRepairJobs, listRepairParts } from '@/lib/db/repair';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function RepairReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: jobs = [] } = useQuery({
    queryKey: ['repair-jobs-all', tenantId],
    queryFn: () => listRepairJobs(tenantId),
    enabled: !!tenantId,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['repair-parts', tenantId],
    queryFn: () => listRepairParts(tenantId),
    enabled: !!tenantId,
  });

  // Monthly revenue
  const monthlyRevenue: Record<string, number> = {};
  jobs.filter(j => j.status === 'delivered' && j.delivered_at).forEach(j => {
    const month = j.delivered_at!.slice(0, 7);
    monthlyRevenue[month] = (monthlyRevenue[month] ?? 0) + (j.final_amount || j.estimated_cost);
  });
  const months = Object.keys(monthlyRevenue).sort().reverse().slice(0, 6);

  // By device type
  const deviceCounts: Record<string, number> = {};
  jobs.forEach(j => { if (j.device_type) deviceCounts[j.device_type] = (deviceCounts[j.device_type] ?? 0) + 1; });

  // Technician-wise
  const techStats: Record<string, { count: number; revenue: number }> = {};
  jobs.forEach(j => {
    const t = j.technician || 'Unassigned';
    if (!techStats[t]) techStats[t] = { count: 0, revenue: 0 };
    techStats[t].count++;
    if (j.status === 'delivered') techStats[t].revenue += j.final_amount || j.estimated_cost;
  });

  // Low stock parts
  const lowStockParts = parts.filter(p => p.stock <= 3);

  const totalRevenue = jobs.filter(j => j.status === 'delivered').reduce((s, j) => s + (j.final_amount || j.estimated_cost), 0);
  const totalJobs = jobs.length;
  const deliveredJobs = jobs.filter(j => j.status === 'delivered').length;
  const pendingJobs = jobs.filter(j => j.status !== 'delivered').length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(totalRevenue), bg: '#dcfce7', color: '#16a34a' },
          { label: 'Total Jobs', value: totalJobs, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Delivered', value: deliveredJobs, bg: '#f0fdf4', color: '#15803d' },
          { label: 'Pending', value: pendingJobs, bg: '#fef3c7', color: '#d97706' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly revenue */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Revenue</h2>
          {months.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No data yet</p> : (
            <div className="space-y-3">
              {months.map(m => {
                const rev = monthlyRevenue[m];
                const maxRev = Math.max(...months.map(mo => monthlyRevenue[mo]));
                const pct = maxRev ? (rev / maxRev) * 100 : 0;
                return (
                  <div key={m}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(rev)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: '#dc2626' }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* By device type */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Jobs by Device Type</h2>
          {Object.keys(deviceCounts).length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No data yet</p> : (
            <div className="space-y-3">
              {Object.entries(deviceCounts).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                const maxCount = Math.max(...Object.values(deviceCounts));
                const pct = maxCount ? (count / maxCount) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{type}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: '#7c3aed' }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Technician-wise */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Technician Performance</h2>
          {Object.keys(techStats).length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No data yet</p> : (
            <div className="space-y-3">
              {Object.entries(techStats).sort((a,b) => b[1].count-a[1].count).map(([tech, s]) => (
                <div key={tech} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{tech}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.count} jobs</p>
                  </div>
                  <span className="font-semibold" style={{ color: '#dc2626' }}>{fmt(s.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Low Stock Parts</h2>
          {lowStockParts.length === 0 ? <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>All parts well stocked</p> : (
            <div className="space-y-2">
              {lowStockParts.map(p => (
                <div key={p.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.category}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.stock === 0 ? 'text-red-600 bg-red-100' : 'text-orange-600 bg-orange-100'}`}>{p.stock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
