// [carwash] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Car, Clock, CheckCircle, TrendingUp, Users, Star } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listJobs, getTodayStats, getStaffPerformance } from '@/lib/db/carwash';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
}

const STATUS_CONFIG = {
  waiting:     { label: 'Waiting',     color: '#f59e0b', bg: '#fef3c7', dot: 'bg-yellow-400' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#eff6ff', dot: 'bg-blue-500' },
  ready:       { label: 'Ready',       color: '#10b981', bg: '#d1fae5', dot: 'bg-emerald-400 animate-pulse' },
  delivered:   { label: 'Delivered',   color: '#6b7280', bg: '#f3f4f6', dot: 'bg-gray-400' },
};

const VEHICLE_ICONS: Record<string, string> = { hatchback: '🚗', sedan: '🚙', suv: '🚐', luxury: '🏎️' };

export function CarwashDashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName  = useAppStore((s) => s.config?.shop_name ?? 'Car Wash');
  const navigate  = useNavigate();
  const today     = todayISO();

  const { data: stats } = useQuery({
    queryKey: ['carwash-stats', tenantId, today],
    queryFn: () => getTodayStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const { data: activeJobs = [] } = useQuery({
    queryKey: ['carwash-active-jobs', tenantId, today],
    queryFn: () => listJobs(tenantId, { date: today }),
    enabled: !!tenantId,
    refetchInterval: 10000,
  });

  const { data: staffPerf = [] } = useQuery({
    queryKey: ['carwash-staff-perf', tenantId, today],
    queryFn: () => getStaffPerformance(tenantId, today),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const waiting    = activeJobs.filter(j => j.status === 'waiting');
  const inProgress = activeJobs.filter(j => j.status === 'in_progress');
  const ready      = activeJobs.filter(j => j.status === 'ready');
  const delivered  = activeJobs.filter(j => j.status === 'delivered');

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
          onClick={() => navigate('/carwash/jobs/new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg"
          style={{ background: 'var(--accent)' }}
        >
          <Car className="h-4 w-4" />
          New Job Card
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={18} />} bg="#dcfce7" color="#16a34a"
          label="Today's Revenue" value={fmt(stats?.revenue ?? 0)} sub={`${stats?.delivered ?? 0} cars delivered`} />
        <StatCard icon={<Clock size={18} />} bg="#fef3c7" color="#d97706"
          label="In Queue" value={String((stats?.pending ?? 0) + (stats?.inProgress ?? 0))}
          sub={`${stats?.pending ?? 0} waiting · ${stats?.inProgress ?? 0} in progress`} />
        <StatCard icon={<CheckCircle size={18} />} bg="#d1fae5" color="#059669"
          label="Ready to Collect" value={String(stats?.ready ?? 0)} sub="notify customers" />
        <StatCard icon={<Car size={18} />} bg="#ede9fe" color="#7c3aed"
          label="Total Today" value={String(stats?.totalJobs ?? 0)} sub="job cards" />
      </div>

      {/* Live Kanban board */}
      <div>
        <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Live Queue</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <KanbanColumn title="Waiting" count={waiting.length} color="#f59e0b" bg="#fef3c7">
            {waiting.map(j => <JobCard key={j.id} job={j} onClick={() => navigate(`/carwash/jobs/${j.id}`)} />)}
          </KanbanColumn>
          <KanbanColumn title="In Progress" count={inProgress.length} color="#3b82f6" bg="#eff6ff">
            {inProgress.map(j => <JobCard key={j.id} job={j} onClick={() => navigate(`/carwash/jobs/${j.id}`)} />)}
          </KanbanColumn>
          <KanbanColumn title="Ready for Pickup 🔔" count={ready.length} color="#10b981" bg="#d1fae5">
            {ready.map(j => <JobCard key={j.id} job={j} onClick={() => navigate(`/carwash/jobs/${j.id}`)} />)}
          </KanbanColumn>
        </div>
      </div>

      {/* Staff performance + recent delivered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff today */}
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
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : '#cd7f32' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.staff_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{s.jobs} cars</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmt(s.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently delivered */}
        {delivered.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4" style={{ color: '#f59e0b' }} />
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Delivered Today</h2>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {delivered.slice(0, 10).map(j => (
                <div key={j.id} className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2"
                  onClick={() => navigate(`/carwash/jobs/${j.id}`)}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {VEHICLE_ICONS[j.vehicle_type]} {j.reg_number}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {j.customer_name || 'Walk-in'} · {j.delivered_at ? timeAgo(j.delivered_at) : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(j.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no staff or delivered jobs */}
        {staffPerf.length === 0 && delivered.length === 0 && (
          <div className="lg:col-span-2 rounded-2xl p-8 flex flex-col items-center justify-center gap-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <Car className="h-10 w-10 opacity-30" />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No jobs today yet</p>
            <button onClick={() => navigate('/carwash/jobs/new')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
              Create First Job Card
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

function JobCard({ job, onClick }: { job: any; onClick: () => void }) {
  const cfg = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG];
  return (
    <div onClick={onClick} className="rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            {VEHICLE_ICONS[job.vehicle_type] ?? '🚗'} {job.reg_number}
          </p>
          {(job.make || job.model) && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{[job.make, job.model].filter(Boolean).join(' ')}</p>
          )}
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {job.customer_name || 'Walk-in'} · {job.job_number}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: cfg.color }}>₹{job.total}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{timeAgo(job.created_at)}</p>
        </div>
      </div>
      {job.items && job.items.length > 0 && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {job.items.slice(0, 2).map((i: any) => i.service_name).join(' · ')}
          {job.items.length > 2 ? ` +${job.items.length - 2}` : ''}
        </p>
      )}
      {job.staff_name && (
        <p className="mt-1 text-xs font-medium" style={{ color: cfg.color }}>👤 {job.staff_name}</p>
      )}
    </div>
  );
}
