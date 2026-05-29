// [homeservice] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Wrench, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getHomeServiceStats, listJobs } from '@/lib/db/homeservice';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function ServiceDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? 'Home Services');
  const navigate  = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['homeservice-stats', tenantId],
    queryFn: () => getHomeServiceStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: todayJobs = [] } = useQuery({
    queryKey: ['homeservice-jobs-today', tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const all = await listJobs(tenantId);
      return all.filter(j => j.job_date === today);
    },
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const cards = [
    { label: 'Jobs Today', value: stats?.jobsToday ?? 0, icon: Wrench, color: '#d97706', bg: '#fef3c7', path: '/homeservice/jobs' },
    { label: 'Pending Jobs', value: stats?.pendingJobs ?? 0, icon: Clock, color: '#2563eb', bg: '#dbeafe', path: '/homeservice/jobs' },
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/homeservice/reports' },
    { label: 'AMC Due', value: stats?.amcRenewalsDue ?? 0, icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2', path: '/homeservice/amc' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Home Service / Electrician</p>
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

      {/* Today's jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold text-slate-900">Today's Jobs</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{todayJobs.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {todayJobs.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No jobs today</p>
            ) : todayJobs.map(j => (
              <div key={j.id} className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium text-slate-800">{j.customer_name}</p>
                  <p className="text-xs text-slate-400">{j.service_type} · {j.technician || 'Unassigned'}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${j.status === 'completed' ? 'bg-green-100 text-green-700' : j.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {j.status}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/homeservice/jobs')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors">View All Jobs →</button>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Job', icon: '🔧', path: '/homeservice/new-job' },
              { label: 'Technicians', icon: '👷', path: '/homeservice/technicians' },
              { label: 'Materials', icon: '📦', path: '/homeservice/materials' },
              { label: 'AMC Contracts', icon: '📅', path: '/homeservice/amc' },
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
