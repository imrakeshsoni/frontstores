// [events] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckSquare, TrendingUp, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getEventStats, listEvents } from '@/lib/db/events';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function EventsDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? 'Events');
  const navigate  = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['event-stats', tenantId],
    queryFn: () => getEventStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['events-upcoming', tenantId],
    queryFn: () => listEvents(tenantId, 'confirmed'),
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'This Month Events', value: stats?.upcomingThisMonth ?? 0, icon: CalendarDays, color: '#db2777', bg: '#fce7f3', path: '/events/list' },
    { label: 'Tasks Due Today', value: stats?.tasksDueToday ?? 0, icon: CheckSquare, color: '#d97706', bg: '#fef3c7', path: '/events/list' },
    { label: 'Total Revenue', value: fmt(stats?.totalRevenue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/events/reports' },
    { label: 'Pending Balance', value: fmt(stats?.pendingBalance ?? 0), icon: AlertCircle, color: '#dc2626', bg: '#fee2e2', path: '/events/list' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Event Planner</p>
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

      {/* Upcoming confirmed events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-pink-500" />
              <h2 className="font-semibold text-slate-900">Confirmed Events</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">{upcoming.length}</span>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {upcoming.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No confirmed events</p>
            ) : upcoming.slice(0, 6).map(e => (
              <div key={e.id} className="flex justify-between items-center text-sm bg-slate-50 rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{e.client_name}</p>
                  <p className="text-xs text-slate-400">{e.event_type} · {e.venue}</p>
                </div>
                <span className="text-xs font-semibold text-pink-600">{new Date(e.event_date).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/events/list')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-pink-600 hover:bg-pink-50 transition-colors">View All Events →</button>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Event', icon: '🎉', path: '/events/new' },
              { label: 'All Events', icon: '📋', path: '/events/list' },
              { label: 'Vendors', icon: '🤝', path: '/events/vendors' },
              { label: 'Reports', icon: '📊', path: '/events/reports' },
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
