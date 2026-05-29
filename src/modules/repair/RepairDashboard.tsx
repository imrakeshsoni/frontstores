// [repair] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Wrench, AlertTriangle, TrendingUp, Clock, CheckCircle, Package } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getRepairStats, listRepairJobs } from '@/lib/db/repair';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  received:   { color: '#2563eb', bg: '#dbeafe' },
  diagnosing: { color: '#d97706', bg: '#fef3c7' },
  repairing:  { color: '#7c3aed', bg: '#ede9fe' },
  ready:      { color: '#16a34a', bg: '#dcfce7' },
  delivered:  { color: '#64748b', bg: '#f1f5f9' },
};

export function RepairDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Repair Shop');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['repair-stats', tenantId],
    queryFn: () => getRepairStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: overdueJobs = [] } = useQuery({
    queryKey: ['repair-overdue', tenantId],
    queryFn: () => listRepairJobs(tenantId),
    enabled: !!tenantId,
    select: jobs => jobs.filter(j => j.promised_date && j.promised_date < today && j.status !== 'delivered'),
  });

  const { data: readyJobs = [] } = useQuery({
    queryKey: ['repair-ready', tenantId],
    queryFn: () => listRepairJobs(tenantId, { status: 'ready' }),
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Received', value: stats?.received ?? 0, icon: Package, color: '#2563eb', bg: '#dbeafe', path: '/repair/jobs?status=received' },
    { label: 'Diagnosing', value: stats?.diagnosing ?? 0, icon: Clock, color: '#d97706', bg: '#fef3c7', path: '/repair/jobs?status=diagnosing' },
    { label: 'Repairing', value: stats?.repairing ?? 0, icon: Wrench, color: '#7c3aed', bg: '#ede9fe', path: '/repair/jobs?status=repairing' },
    { label: 'Ready for Pickup', value: stats?.ready ?? 0, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', path: '/repair/jobs?status=ready' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Mobile & Electronics Repair</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Today's Collections</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(stats?.todayCollections ?? 0)}</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Active Jobs</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{(stats?.received ?? 0) + (stats?.diagnosing ?? 0) + (stats?.repairing ?? 0) + (stats?.ready ?? 0)}</p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)} className="text-left p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
          </button>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueJobs.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-800">Overdue Jobs ({overdueJobs.length})</h2>
          </div>
          <div className="space-y-2">
            {overdueJobs.slice(0, 5).map(j => (
              <div key={j.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2 cursor-pointer hover:bg-red-50" onClick={() => navigate(`/repair/jobs/${j.id}`)}>
                <div>
                  <p className="font-medium text-slate-800">{j.job_no} — {j.customer_name}</p>
                  <p className="text-xs text-slate-400">{j.device_brand} {j.device_model}</p>
                </div>
                <span className="text-xs font-semibold text-red-600">Due: {j.promised_date}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/repair/jobs')} className="mt-3 text-sm font-medium text-red-700 hover:underline">View all jobs →</button>
        </div>
      )}

      {/* Ready for pickup */}
      {readyJobs.length > 0 && (
        <div className="rounded-2xl border p-5 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Ready for Pickup</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{readyJobs.length}</span>
          </div>
          <div className="space-y-2">
            {readyJobs.slice(0, 5).map(j => (
              <div key={j.id} className="flex justify-between items-center text-sm rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/repair/jobs/${j.id}`)}>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{j.job_no} — {j.customer_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{j.customer_phone} · {j.device_brand} {j.device_model}</p>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>{fmt(j.final_amount || j.estimated_cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="rounded-2xl border p-5 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'New Job', icon: '🔧', path: '/repair/jobs/new' },
            { label: 'All Jobs', icon: '📋', path: '/repair/jobs' },
            { label: 'Parts Inventory', icon: '📦', path: '/repair/parts' },
            { label: 'Reports', icon: '📊', path: '/repair/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--surface-border)' }}>
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's stats */}
      <div className="rounded-2xl border p-5 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Jobs by Status</h2>
        </div>
        <div className="space-y-2">
          {(['received','diagnosing','repairing','ready','delivered'] as const).map(s => {
            const count = stats?.[s as keyof typeof stats] as number ?? 0;
            const sc = STATUS_COLOR[s];
            return (
              <div key={s} className="flex items-center justify-between">
                <span className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: sc.color, background: sc.bg }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
