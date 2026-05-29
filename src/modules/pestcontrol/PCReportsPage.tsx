// [pestcontrol] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getPCReportData } from '@/lib/db/pestcontrol';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function today() { return new Date().toISOString().substring(0, 10); }
function monthStart() { return new Date().toISOString().substring(0, 7) + '-01'; }

export function PCReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const { data, isLoading } = useQuery({
    queryKey: ['pc-report', tenantId, from, to],
    queryFn: () => getPCReportData(tenantId, from, to),
    enabled: !!tenantId && !!from && !!to,
  });

  const jobs = data?.jobs ?? [];
  const dueJobs = data?.dueJobs ?? [];
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const totalRevenue = completedJobs.reduce((s, j) => s + j.amount, 0);

  // By service type
  const byService: Record<string, { count: number; revenue: number }> = {};
  completedJobs.forEach(j => {
    const s = j.service_type || 'Unknown';
    if (!byService[s]) byService[s] = { count: 0, revenue: 0 };
    byService[s].count += 1;
    byService[s].revenue += j.amount;
  });

  const overdue = dueJobs.filter(j => j.next_service_date && j.next_service_date <= today());

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Pest Control Reports</h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Revenue', value: fmt(totalRevenue), color: '#7c3aed' },
              { label: 'Jobs', value: jobs.length, color: '#2563eb' },
              { label: 'Completed', value: completedJobs.length, color: '#16a34a' },
              { label: 'Overdue Follow-ups', value: overdue.length, color: '#dc2626' },
            ].map(c => (
              <div key={c.label} className="p-4 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p>
                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {Object.keys(byService).length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Revenue by Service Type</h2>
              <div className="space-y-2">
                {Object.entries(byService).sort((a, b) => b[1].revenue - a[1].revenue).map(([svc, d]) => (
                  <div key={svc} className="flex items-center justify-between text-sm py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{svc}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{d.count} job{d.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue follow-ups */}
          {overdue.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Overdue Follow-ups ({overdue.length})</h2>
              </div>
              <div className="space-y-2">
                {overdue.map(j => (
                  <div key={j.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{j.customer_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{j.service_type} · {j.customer_phone}</p>
                    </div>
                    <p className="text-xs font-semibold text-red-600">{j.next_service_date ? new Date(j.next_service_date).toLocaleDateString('en-IN') : '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All jobs in period */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Jobs in Period ({jobs.length})</h2>
            {jobs.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No jobs in this period</p>
            ) : (
              <div className="space-y-2">
                {jobs.map(j => (
                  <div key={j.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{j.customer_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{j.job_no} · {j.service_type} · {new Date(j.job_date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(j.amount)}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: j.status === 'completed' ? '#dcfce7' : '#fef3c7', color: j.status === 'completed' ? '#16a34a' : '#d97706' }}>{j.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
