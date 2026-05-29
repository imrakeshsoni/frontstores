// [pestcontrol] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, TrendingUp, AlertTriangle, CheckCircle, PlusCircle, FlaskConical } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getPCStats, listPCJobs } from '@/lib/db/pestcontrol';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled:  { bg: '#dbeafe', text: '#2563eb' },
  'in-progress': { bg: '#fef3c7', text: '#d97706' },
  completed:  { bg: '#dcfce7', text: '#16a34a' },
  cancelled:  { bg: '#fee2e2', text: '#dc2626' },
};

export function PestDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Pest Control');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['pc-stats', tenantId],
    queryFn: () => getPCStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: todayJobs = [] } = useQuery({
    queryKey: ['pc-jobs-today', tenantId],
    queryFn: () => listPCJobs(tenantId, 'scheduled'),
    enabled: !!tenantId,
    select: data => data.slice(0, 5),
  });

  const cards = [
    { label: "Today's Jobs", value: stats?.jobsToday ?? 0, icon: CalendarDays, color: '#2563eb', bg: '#dbeafe', path: '/pestcontrol/jobs' },
    { label: 'Due This Week', value: stats?.dueThisWeek ?? 0, icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', path: '/pestcontrol/jobs' },
    { label: 'Month Revenue', value: fmt(stats?.monthRevenue ?? 0), icon: TrendingUp, color: '#7c3aed', bg: '#ede9fe', path: '/pestcontrol/reports' },
    { label: 'Active Contracts', value: stats?.activeContracts ?? 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', path: '/pestcontrol/contracts' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Pest Control Management</p>
        </div>
        <button onClick={() => navigate('/pestcontrol/jobs/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          New Job
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

      {/* Low stock alert */}
      {(stats?.lowStockChemicals ?? 0) > 0 && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
          <FlaskConical className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">{stats?.lowStockChemicals} chemical(s) low on stock</p>
            <p className="text-xs text-amber-700">Stock below 500ml — reorder soon</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's scheduled jobs */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Scheduled Jobs</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#2563eb' }}>
              {stats?.scheduledCount ?? 0}
            </span>
          </div>
          <div className="space-y-2">
            {todayJobs.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No scheduled jobs</p>
            ) : todayJobs.map(j => (
              <div key={j.id} className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{j.customer_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{j.service_type} · {j.pest_type}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{j.technician}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>{fmt(j.amount)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(j.job_date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/pestcontrol/jobs')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium" style={{ color: 'var(--accent)' }}>
            View all jobs →
          </button>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Job', icon: '🐛', path: '/pestcontrol/jobs/new' },
              { label: 'Customers', icon: '👥', path: '/pestcontrol/customers' },
              { label: 'Contracts', icon: '📄', path: '/pestcontrol/contracts' },
              { label: 'Reports', icon: '📊', path: '/pestcontrol/reports' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors"
                style={{ borderColor: 'var(--surface-border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
              </button>
            ))}
          </div>

          {/* Due jobs alert */}
          {(stats?.dueThisWeek ?? 0) > 0 && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: '#fef3c7' }}>
              <p className="text-sm font-semibold text-amber-800">{stats?.dueThisWeek} follow-up service(s) due this week</p>
              <button onClick={() => navigate('/pestcontrol/jobs')} className="text-xs text-amber-700 mt-1 underline">View jobs →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
