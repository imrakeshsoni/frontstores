// [travel] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plane, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getTravelStats, listBookings } from '@/lib/db/travel';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function TravelDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? 'Travel Agency');
  const navigate  = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['travel-stats', tenantId],
    queryFn: () => getTravelStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: departing = [] } = useQuery({
    queryKey: ['travel-departing', tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const all = await listBookings(tenantId, 'confirmed');
      return all.filter(b => b.departure_date >= today && b.departure_date <= weekEnd);
    },
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Departing This Week', value: stats?.departingThisWeek ?? 0, icon: Plane, color: '#0891b2', bg: '#cffafe', path: '/travel/bookings' },
    { label: 'Total Bookings', value: stats?.totalBookings ?? 0, icon: Users, color: '#2563eb', bg: '#dbeafe', path: '/travel/bookings' },
    { label: 'Monthly Revenue', value: fmt(stats?.monthlyRevenue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/travel/reports' },
    { label: 'Pending Payments', value: fmt(stats?.pendingPayments ?? 0), icon: AlertCircle, color: '#dc2626', bg: '#fee2e2', path: '/travel/bookings' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Travel Agency</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)}
            className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </button>
        ))}
      </div>

      {/* Departing this week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Plane className="h-4 w-4 text-cyan-600" />
            <h2 className="font-semibold text-cyan-800">Departing This Week</h2>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {departing.length === 0 ? (
              <p className="text-cyan-600 text-sm text-center py-4">No departures this week</p>
            ) : departing.map(b => (
              <div key={b.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{b.customer_name}</p>
                  <p className="text-xs text-slate-400">{b.destination} · {b.pax} pax</p>
                </div>
                <span className="text-xs font-semibold text-cyan-700">{new Date(b.departure_date).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/travel/bookings')} className="mt-3 text-sm font-medium text-cyan-700 hover:underline">View all bookings →</button>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Booking', icon: '✈️', path: '/travel/new-booking' },
              { label: 'Bookings', icon: '📋', path: '/travel/bookings' },
              { label: 'Visa Tracker', icon: '🛂', path: '/travel/visa' },
              { label: 'Reports', icon: '📊', path: '/travel/reports' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium text-slate-700">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
