// [beauty] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Scissors, Clock, CheckCircle, TrendingUp, Users, Star } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listAppointments, getTodayStats, getStaffPerformance } from '@/lib/db/beauty';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
}

const STATUS_CONFIG = {
  scheduled:   { label: 'Scheduled',   color: '#f59e0b', bg: '#fef3c7' },
  walk_in:     { label: 'Walk-in',     color: '#8b5cf6', bg: '#ede9fe' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#eff6ff' },
  completed:   { label: 'Completed',   color: '#10b981', bg: '#d1fae5' },
  cancelled:   { label: 'Cancelled',   color: '#6b7280', bg: '#f3f4f6' },
};

export function BeautyDashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName  = useAppStore((s) => s.config?.shop_name ?? 'Beauty Parlor');
  const navigate  = useNavigate();
  const today     = todayISO();

  const { data: stats } = useQuery({
    queryKey: ['beauty-stats', tenantId, today],
    queryFn:  () => getTodayStats(tenantId),
    enabled:  !!tenantId,
    refetchInterval: 15000,
  });

  const { data: todayAppts = [] } = useQuery({
    queryKey: ['beauty-appts-today', tenantId, today],
    queryFn:  () => listAppointments(tenantId, { date: today }),
    enabled:  !!tenantId,
    refetchInterval: 10000,
  });

  const { data: staffPerf = [] } = useQuery({
    queryKey: ['beauty-staff-perf', tenantId, today],
    queryFn:  () => getStaffPerformance(tenantId, today),
    enabled:  !!tenantId,
    refetchInterval: 30000,
  });

  const scheduled   = todayAppts.filter(a => a.status === 'scheduled');
  const inProgress  = todayAppts.filter(a => a.status === 'in_progress');
  const walkIn      = todayAppts.filter(a => a.status === 'walk_in');
  const completed   = todayAppts.filter(a => a.status === 'completed');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/beauty/appointments/new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg"
          style={{ background: 'var(--accent)' }}
        >
          <Scissors className="h-4 w-4" />
          New Appointment
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={18} />} bg="#dcfce7" color="#16a34a"
          label="Today's Revenue" value={fmt(stats?.revenue ?? 0)} sub={`${stats?.completed ?? 0} completed`} />
        <StatCard icon={<Clock size={18} />} bg="#ede9fe" color="#7c3aed"
          label="In Progress" value={String(stats?.inProgress ?? 0)} sub="currently serving" />
        <StatCard icon={<Scissors size={18} />} bg="#fef3c7" color="#d97706"
          label="Scheduled" value={String(stats?.pending ?? 0)} sub="upcoming today" />
        <StatCard icon={<CheckCircle size={18} />} bg="#d1fae5" color="#059669"
          label="Total Today" value={String(stats?.totalAppts ?? 0)} sub="appointments" />
      </div>

      {/* Live Kanban */}
      <div>
        <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Today's Queue</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <KanbanColumn title="Scheduled / Walk-in" count={scheduled.length + walkIn.length} color="#8b5cf6" bg="#ede9fe">
            {[...scheduled, ...walkIn].map(a => <ApptCard key={a.id} appt={a} onClick={() => navigate(`/beauty/appointments/${a.id}`)} />)}
          </KanbanColumn>
          <KanbanColumn title="In Progress" count={inProgress.length} color="#3b82f6" bg="#eff6ff">
            {inProgress.map(a => <ApptCard key={a.id} appt={a} onClick={() => navigate(`/beauty/appointments/${a.id}`)} />)}
          </KanbanColumn>
          <KanbanColumn title="Completed Today" count={completed.length} color="#10b981" bg="#d1fae5">
            {completed.slice(0, 8).map(a => <ApptCard key={a.id} appt={a} onClick={() => navigate(`/beauty/appointments/${a.id}`)} />)}
          </KanbanColumn>
        </div>
      </div>

      {/* Staff performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {staffPerf.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Staff Performance Today</h2>
            </div>
            <div className="space-y-2">
              {staffPerf.map((s, i) => (
                <div key={s.staff_name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-sm text-white"
                      style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : '#cd7f32' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.staff_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{s.appts} appts</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmt(s.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4" style={{ color: '#f59e0b' }} />
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Recently Completed</h2>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {completed.slice(0, 8).map(a => (
                <div key={a.id} className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2"
                  onClick={() => navigate(`/beauty/appointments/${a.id}`)}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {a.customer_name || 'Walk-in'} · {a.appointment_number}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {a.staff_name || 'No staff'} · {a.completed_at ? timeAgo(a.completed_at) : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(a.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {staffPerf.length === 0 && completed.length === 0 && (
          <div className="lg:col-span-2 rounded-2xl p-8 flex flex-col items-center justify-center gap-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <Scissors className="h-10 w-10 opacity-30" />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No appointments today yet</p>
            <button onClick={() => navigate('/beauty/appointments/new')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
              Create First Appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, bg, color, label, value, sub }: { icon: React.ReactNode; bg: string; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      </div>
    </div>
  );
}

function KanbanColumn({ title, count, color, bg, children }: { title: string; count: number; color: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: bg }}>
        <span className="text-sm font-bold" style={{ color }}>{title}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{count}</span>
      </div>
      <div className="p-3 space-y-2 min-h-[120px]" style={{ background: 'var(--surface)' }}>
        {children}
        {count === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>Empty</p>}
      </div>
    </div>
  );
}

function ApptCard({ appt, onClick }: { appt: any; onClick: () => void }) {
  const cfg = STATUS_CONFIG[appt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.walk_in;
  return (
    <div onClick={onClick} className="rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{appt.customer_name || 'Walk-in'}</p>
          {appt.time_slot && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>⏰ {appt.time_slot}</p>}
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {appt.staff_name || 'Unassigned'} · {appt.appointment_number}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: cfg.color }}>₹{appt.total}</p>
        </div>
      </div>
      {appt.items && appt.items.length > 0 && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {appt.items.slice(0, 2).map((i: any) => i.service_name).join(' · ')}
          {appt.items.length > 2 ? ` +${appt.items.length - 2}` : ''}
        </p>
      )}
    </div>
  );
}
