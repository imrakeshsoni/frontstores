// [travel] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listBookings } from '@/lib/db/travel';
import { Plane, TrendingUp } from 'lucide-react';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function TravelReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: bookings = [] } = useQuery({
    queryKey: ['tr-bookings', tenantId, ''],
    queryFn: () => listBookings(tenantId),
    enabled: !!tenantId,
  });

  // Monthly revenue
  const byMonth = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce<Record<string, number>>((acc, b) => {
      const m = b.departure_date.slice(0, 7);
      acc[m] = (acc[m] ?? 0) + b.total_amount;
      return acc;
    }, {});
  const sortedMonths = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  // Domestic vs International
  const domestic = bookings.filter(b => b.trip_type === 'domestic' && b.status !== 'cancelled');
  const international = bookings.filter(b => b.trip_type === 'international' && b.status !== 'cancelled');
  const domRevenue = domestic.reduce((s, b) => s + b.total_amount, 0);
  const intRevenue = international.reduce((s, b) => s + b.total_amount, 0);

  const totalRevenue = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + b.total_amount, 0);
  const collected = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + b.advance_paid, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Bookings', value: bookings.length, icon: Plane, color: '#0891b2', bg: '#cffafe' },
          { label: 'Total Revenue', value: fmt(totalRevenue), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Collected', value: fmt(collected), icon: TrendingUp, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Pending', value: fmt(totalRevenue - collected), icon: TrendingUp, color: '#dc2626', bg: '#fee2e2' },
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

      {/* Domestic vs International */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Domestic vs International</h2>
        <div className="space-y-3">
          {[
            { label: `Domestic (${domestic.length})`, value: domRevenue, color: '#0891b2' },
            { label: `International (${international.length})`, value: intRevenue, color: '#7c3aed' },
          ].map(r => {
            const max = Math.max(domRevenue, intRevenue);
            const pct = max > 0 ? (r.value / max) * 100 : 0;
            return (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-medium text-slate-800">{fmt(r.value)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: r.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly revenue */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Monthly Revenue (Last 6 Months)</h2>
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
                    <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
