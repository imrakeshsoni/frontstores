// [insurance] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getInsuranceStats, listInsRenewals } from '@/lib/db/insurance';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function InsuranceDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? 'Insurance');
  const navigate  = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['insurance-stats', tenantId],
    queryFn: () => getInsuranceStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: dueRenewals = [] } = useQuery({
    queryKey: ['insurance-renewals-due', tenantId],
    queryFn: () => listInsRenewals(tenantId, false),
    enabled: !!tenantId,
  });

  const thisMonthRenewals = dueRenewals.filter(r => {
    const today = new Date().toISOString().slice(0, 10);
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
    return r.due_date >= today && r.due_date <= monthEnd;
  });

  const cards = [
    { label: 'Renewals Due', value: stats?.renewalsDueThisMonth ?? 0, icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2', path: '/insurance/renewals' },
    { label: 'Active Policies', value: stats?.activePolicies ?? 0, icon: Shield, color: '#16a34a', bg: '#dcfce7', path: '/insurance/policies' },
    { label: 'Commission (Month)', value: fmt(stats?.commissionThisMonth ?? 0), icon: TrendingUp, color: '#2563eb', bg: '#dbeafe', path: '/insurance/reports' },
    { label: 'Total Clients', value: stats?.totalClients ?? 0, icon: Users, color: '#7c3aed', bg: '#ede9fe', path: '/insurance/clients' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Insurance Agent</p>
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

      {/* Renewals alert */}
      {thisMonthRenewals.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-800">Renewals Due This Month</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{thisMonthRenewals.length}</span>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {thisMonthRenewals.slice(0, 6).map(r => (
              <div key={r.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <span className="font-medium text-slate-800">{r.policy_id}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{fmt(r.premium)}</span>
                  <span className="text-xs font-semibold text-red-600">{new Date(r.due_date).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/insurance/renewals')} className="mt-3 text-sm font-medium text-red-700 hover:underline">Manage Renewals →</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Add Client', icon: '👤', path: '/insurance/clients' },
            { label: 'New Policy', icon: '🛡️', path: '/insurance/policies' },
            { label: 'Renewals', icon: '🔄', path: '/insurance/renewals' },
            { label: 'Claims', icon: '📋', path: '/insurance/claims' },
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
  );
}
