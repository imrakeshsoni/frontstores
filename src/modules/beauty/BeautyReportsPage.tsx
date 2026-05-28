// [beauty] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Scissors, Users } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getDailyRevenue, getTopServices, getStaffPerformance } from '@/lib/db/beauty';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function last30() {
  const to   = new Date();
  const from = new Date(); from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function BeautyReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [range, setRange] = useState<'7d' | '30d' | 'month'>('30d');

  const dates = (() => {
    const to = new Date();
    if (range === '7d')    { const from = new Date(); from.setDate(from.getDate() - 6); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; }
    if (range === 'month') { const from = new Date(to.getFullYear(), to.getMonth(), 1); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; }
    return last30();
  })();

  const { data: daily = [] } = useQuery({
    queryKey: ['beauty-daily', tenantId, dates.from, dates.to],
    queryFn:  () => getDailyRevenue(tenantId, dates.from, dates.to),
    enabled:  !!tenantId,
  });

  const { data: topSvcs = [] } = useQuery({
    queryKey: ['beauty-top-svcs', tenantId, dates.from, dates.to],
    queryFn:  () => getTopServices(tenantId, dates.from, dates.to),
    enabled:  !!tenantId,
  });

  const { data: staffPerf = [] } = useQuery({
    queryKey: ['beauty-staff-perf-report', tenantId, todayISO()],
    queryFn:  () => getStaffPerformance(tenantId, todayISO()),
    enabled:  !!tenantId,
  });

  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const totalAppts   = daily.reduce((s, d) => s + d.appts, 0);
  const avgPerAppt   = totalAppts > 0 ? totalRevenue / totalAppts : 0;
  const maxRev       = Math.max(...daily.map(d => d.revenue), 1);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Beauty Parlor</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', 'month'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={range === r ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
              {r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(totalRevenue), icon: <TrendingUp size={18} />, bg: '#dcfce7', color: '#16a34a' },
          { label: 'Appointments', value: String(totalAppts), icon: <Scissors size={18} />, bg: '#ede9fe', color: '#7c3aed' },
          { label: 'Avg per Visit', value: fmt(avgPerAppt), icon: <BarChart3 size={18} />, bg: '#fef3c7', color: '#d97706' },
          { label: 'Days Active', value: String(daily.filter(d => d.revenue > 0).length), icon: <Users size={18} />, bg: '#dbeafe', color: '#2563eb' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
            <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p><p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p></div>
          </div>
        ))}
      </div>

      {/* Revenue bar chart */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Daily Revenue</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No data for this period</p>
        ) : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
            {daily.map(d => (
              <div key={d.date} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: '28px' }}>
                <div
                  className="rounded-t-md w-full transition-all"
                  style={{ height: `${Math.max((d.revenue / maxRev) * 128, 4)}px`, background: 'var(--accent)', opacity: d.revenue > 0 ? 1 : 0.15, minWidth: '20px' }}
                  title={`${d.date}: ${fmt(d.revenue)} (${d.appts} appts)`}
                />
                <p className="text-xs rotate-45 origin-left whitespace-nowrap" style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>
                  {d.date.slice(5)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top services */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Top Services</h2>
          {topSvcs.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No completed appointments in this period</p>
          ) : (
            <div className="space-y-2">
              {topSvcs.map((s, i) => (
                <div key={s.service_name} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: ['#f59e0b', '#9ca3af', '#cd7f32'][i] ?? 'var(--accent)' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.service_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.count} times</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(s.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff performance today */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Staff Today</h2>
          {staffPerf.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No completed appointments today</p>
          ) : (
            <div className="space-y-2">
              {staffPerf.map((s, i) => (
                <div key={s.staff_name} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : '#cd7f32' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.staff_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.appts} appointments</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(s.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily breakdown table */}
      {daily.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Day-wise Breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                  <th className="text-center px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>Appointments</th>
                  <th className="text-right px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d, idx) => (
                  <tr key={d.date} style={{ borderBottom: idx < daily.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{d.date}</td>
                    <td className="text-center px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{d.appts}</td>
                    <td className="text-right px-4 py-2.5 font-semibold" style={{ color: 'var(--accent)' }}>{fmt(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
