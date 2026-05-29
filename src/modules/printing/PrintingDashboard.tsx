// [printing] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Printer, CheckCircle, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getPRStats, listPRJobs } from '@/lib/db/printing';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function PrintingDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Printing Shop');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['pr-stats', tenantId],
    queryFn: () => getPRStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: readyJobs = [] } = useQuery({
    queryKey: ['pr-jobs-ready', tenantId],
    queryFn: () => listPRJobs(tenantId, 'ready'),
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Jobs Received', value: stats?.jobsReceived ?? 0, icon: ClipboardList, color: '#2563eb', bg: '#dbeafe', path: '/printing/jobs' },
    { label: 'Printing', value: stats?.jobsPrinting ?? 0, icon: Printer, color: '#d97706', bg: '#fef3c7', path: '/printing/jobs' },
    { label: 'Ready for Pickup', value: stats?.jobsReady ?? 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', path: '/printing/jobs' },
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#7c3aed', bg: '#ede9fe', path: '/printing/reports' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Printing & Stationery Shop</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)} className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
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

      {/* Ready for pickup */}
      {readyJobs.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <h2 className="font-semibold text-green-800">Ready for Pickup</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {readyJobs.slice(0, 6).map(j => (
              <div key={j.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{j.customer_name}</p>
                  <p className="text-xs text-slate-400">{j.job_no} · {j.job_type}</p>
                </div>
                <span className="text-xs font-semibold text-green-600">{fmt(j.total_amount)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/printing/jobs')} className="mt-3 text-sm font-medium text-green-700 hover:underline">View all jobs →</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Job', icon: '🖨️', path: '/printing/jobs/new' },
            { label: 'All Jobs', icon: '📋', path: '/printing/jobs' },
            { label: 'Stationery', icon: '✏️', path: '/printing/stationery' },
            { label: 'Reports', icon: '📊', path: '/printing/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
