// [events] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listEvents } from '@/lib/db/events';
import { TrendingUp, CalendarDays } from 'lucide-react';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function EventReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: events = [] } = useQuery({
    queryKey: ['events', tenantId, ''],
    queryFn: () => listEvents(tenantId),
    enabled: !!tenantId,
  });

  const completed = events.filter(e => e.status === 'completed');

  // Revenue by event type
  const byType = completed.reduce<Record<string, number>>((acc, e) => {
    const t = e.event_type || 'Other';
    acc[t] = (acc[t] ?? 0) + e.quoted_amount;
    return acc;
  }, {});
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  // Monthly bookings
  const byMonth = events.reduce<Record<string, number>>((acc, e) => {
    const m = e.event_date.slice(0, 7);
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});
  const sortedMonths = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  const totalRevenue = completed.reduce((s, e) => s + e.quoted_amount, 0);
  const pendingBalance = events.filter(e => e.status !== 'cancelled').reduce((s, e) => s + (e.quoted_amount - e.advance_paid), 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Events', value: events.length, icon: CalendarDays, color: '#db2777', bg: '#fce7f3' },
          { label: 'Completed', value: completed.length, icon: TrendingUp, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Total Revenue', value: fmt(totalRevenue), icon: TrendingUp, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Pending Balance', value: fmt(pendingBalance), icon: TrendingUp, color: '#dc2626', bg: '#fee2e2' },
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
        <h2 className="font-semibold text-slate-800 mb-4">Revenue by Event Type</h2>
        {topTypes.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No completed events yet</p> : (
          <div className="space-y-3">
            {topTypes.map(([type, amount]) => {
              const max = Math.max(...topTypes.map(t => t[1]));
              const pct = max > 0 ? (amount / max) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{type}</span>
                    <span className="font-medium text-slate-800">{fmt(amount)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Monthly Bookings (Last 6 Months)</h2>
        {sortedMonths.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">No data yet</p> : (
          <div className="space-y-2">
            {sortedMonths.map(([month, count]) => (
              <div key={month} className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{month}</span>
                <span className="font-semibold text-slate-800 bg-pink-50 text-pink-700 px-2.5 py-0.5 rounded-full">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
