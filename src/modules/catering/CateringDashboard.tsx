// [catering] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, TrendingUp, Clock, CheckCircle, PlusCircle, Users } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getCateringStats, listCateringEvents } from '@/lib/db/catering';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  inquiry:   { bg: '#fef3c7', text: '#d97706' },
  confirmed: { bg: '#dcfce7', text: '#16a34a' },
  completed: { bg: '#dbeafe', text: '#2563eb' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
};

export function CateringDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Catering');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['catering-stats', tenantId],
    queryFn: () => getCateringStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['catering-events-upcoming', tenantId],
    queryFn: () => listCateringEvents(tenantId, 'confirmed'),
    enabled: !!tenantId,
    select: data => data.slice(0, 5),
  });

  const cards = [
    { label: 'Month Revenue', value: fmt(stats?.monthRevenue ?? 0), icon: TrendingUp, color: '#7c3aed', bg: '#ede9fe', path: '/catering/reports' },
    { label: 'This Week', value: stats?.upcomingThisWeek ?? 0, icon: CalendarDays, color: '#0891b2', bg: '#cffafe', path: '/catering/events' },
    { label: 'Confirmed', value: stats?.confirmedCount ?? 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', path: '/catering/events' },
    { label: 'Pending Balance', value: fmt(stats?.pendingAdvances ?? 0), icon: Clock, color: '#d97706', bg: '#fef3c7', path: '/catering/events' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Catering Business Management</p>
        </div>
        <button onClick={() => navigate('/catering/events/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          New Event
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)}
            className="text-left p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming confirmed events */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" style={{ color: '#16a34a' }} />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming Events</h2>
            </div>
          </div>
          <div className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No upcoming confirmed events</p>
            ) : upcoming.map(ev => (
              <div key={ev.id} className="p-3 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{ev.customer_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{ev.event_type} · {ev.venue}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>{new Date(ev.event_date).toLocaleDateString('en-IN')}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmt(ev.total_amount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Users className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{ev.guest_count} guests</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/catering/events')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium" style={{ color: 'var(--accent)' }}>
            View all events →
          </button>
        </div>

        {/* Quick actions + stats */}
        <div className="space-y-4">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Event Status</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Confirmed', value: stats?.confirmedCount ?? 0, status: 'confirmed' },
                { label: 'Inquiries', value: stats?.pendingCount ?? 0, status: 'inquiry' },
              ].map(s => {
                const c = STATUS_COLORS[s.status];
                return (
                  <button key={s.label} onClick={() => navigate(`/catering/events?status=${s.status}`)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl"
                    style={{ background: c.bg }}>
                    <span className="text-2xl font-bold" style={{ color: c.text }}>{s.value}</span>
                    <span className="text-xs font-medium" style={{ color: c.text }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'New Event', icon: '🍱', path: '/catering/events/new' },
                { label: 'All Events', icon: '📋', path: '/catering/events' },
                { label: 'Menu', icon: '🍽️', path: '/catering/menu' },
                { label: 'Reports', icon: '📊', path: '/catering/reports' },
              ].map(a => (
                <button key={a.label} onClick={() => navigate(a.path)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors"
                  style={{ borderColor: 'var(--surface-border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
