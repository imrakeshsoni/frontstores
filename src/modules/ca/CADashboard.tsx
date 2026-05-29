// [ca] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getCAStats, listCATasks } from '@/lib/db/ca';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CADashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? 'CA Office');
  const navigate  = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['ca-stats', tenantId],
    queryFn: () => getCAStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['ca-overdue-tasks', tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const tasks = await listCATasks(tenantId);
      return tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date < today).slice(0, 5);
    },
    enabled: !!tenantId,
  });

  const { data: dueSoonTasks = [] } = useQuery({
    queryKey: ['ca-due-soon-tasks', tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const tasks = await listCATasks(tenantId);
      return tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date >= today && t.due_date <= weekEnd).slice(0, 5);
    },
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Total Clients', value: stats?.totalClients ?? 0, icon: Users, color: '#2563eb', bg: '#dbeafe', path: '/ca/clients' },
    { label: 'Due This Week', value: stats?.tasksDueThisWeek ?? 0, icon: Clock, color: '#d97706', bg: '#fef3c7', path: '/ca/tasks' },
    { label: 'Overdue Tasks', value: stats?.overdueTasks ?? 0, icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2', path: '/ca/tasks' },
    { label: 'Pending Fees', value: fmt(stats?.pendingFees ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/ca/tasks' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">CA / Tax Consultant</p>
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

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-800">Overdue Tasks</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{overdueTasks.length}</span>
          </div>
          <div className="space-y-2">
            {overdueTasks.map(t => (
              <div key={t.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{t.task_type}</p>
                  <p className="text-xs text-slate-400">FY: {t.financial_year || '—'}</p>
                </div>
                <span className="text-xs font-semibold text-red-600">{t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/ca/tasks')} className="mt-3 text-sm font-medium text-red-700 hover:underline">View all tasks →</button>
        </div>
      )}

      {/* Due this week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-slate-900">Due This Week</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{dueSoonTasks.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dueSoonTasks.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No tasks due this week</p>
            ) : dueSoonTasks.map(t => (
              <div key={t.id} className="flex justify-between items-center text-sm">
                <span className="font-medium text-slate-800">{t.task_type}</span>
                <span className="text-xs text-slate-400">{t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/ca/tasks')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors">Manage Tasks →</button>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Add Client', icon: '👤', path: '/ca/clients' },
              { label: 'New Task', icon: '✅', path: '/ca/tasks' },
              { label: 'Documents', icon: '📁', path: '/ca/documents' },
              { label: 'Reports', icon: '📊', path: '/ca/reports' },
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
