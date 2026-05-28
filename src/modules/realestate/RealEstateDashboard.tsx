// [realestate] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Handshake, IndianRupee, Calendar, Bell, TrendingUp, Home, Building2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getREStats, listFollowUps } from '@/lib/db/realestate';

const ROLE_LABELS: Record<string, string> = {
  resale: 'Resale Broker',
  channel: 'Channel Partner',
  individual: 'Individual Agent',
  rental: 'Rental Agent',
  commercial: 'Commercial Broker',
  builder: 'Builder / Developer',
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function RealEstateDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Real Estate');
  const role = useAppStore(s => (s.config?.settings as any)?.re_role ?? 'resale');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['re-stats', tenantId],
    queryFn: () => getREStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ['re-follow-ups', tenantId],
    queryFn: () => listFollowUps(tenantId),
    enabled: !!tenantId,
  });

  const pending = followUps.filter(f => !f.done);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = pending.filter(f => f.due_date < today);
  const dueToday = pending.filter(f => f.due_date === today);

  const cards = [
    { label: 'Total Leads', value: stats?.totalLeads ?? 0, sub: `${stats?.newLeads ?? 0} new`, icon: Users, color: '#2563eb', bg: '#dbeafe', to: '/realestate/leads' },
    { label: 'Active Deals', value: stats?.activeDeals ?? 0, sub: `Pipeline: ${fmt(stats?.pipelineValue ?? 0)}`, icon: Handshake, color: '#15803d', bg: '#dcfce7', to: '/realestate/deals' },
    { label: 'Commission This Month', value: fmt(stats?.commissionThisMonth ?? 0), sub: `Pending: ${fmt(stats?.commissionPending ?? 0)}`, icon: IndianRupee, color: '#ca8a04', bg: '#fef9c3', to: '/realestate/commissions' },
    { label: 'Site Visits Today', value: stats?.siteVisitsToday ?? 0, sub: `Follow-ups due: ${stats?.followUpsDueToday ?? 0}`, icon: Calendar, color: '#7c3aed', bg: '#ede9fe', to: '/realestate/site-visits' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{ROLE_LABELS[role] ?? 'Real Estate'} Dashboard</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">{ROLE_LABELS[role]}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.to)} className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
          </button>
        ))}
      </div>

      {/* Follow-ups + closed this month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-orange-500" />
            <h2 className="font-semibold text-slate-900">Follow-ups</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-red-50 text-center">
              <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
              <p className="text-xs text-red-500 mt-0.5">Overdue</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 text-center">
              <p className="text-2xl font-bold text-orange-600">{dueToday.length}</p>
              <p className="text-xs text-orange-500 mt-0.5">Due Today</p>
            </div>
          </div>
          {(overdue.length > 0 || dueToday.length > 0) && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {[...overdue, ...dueToday].slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800 capitalize">{f.mode}</p>
                    <p className="text-xs text-slate-400">{f.notes?.slice(0,40) ?? '—'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.due_date < today ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                    {f.due_date < today ? 'Overdue' : 'Today'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/realestate/leads')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors">
            View All Leads →
          </button>
        </div>

        {/* This month summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">This Month</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="text-sm text-slate-600">Deals Closed</span>
              <span className="font-bold text-slate-900">{stats?.closedDealsThisMonth ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50">
              <span className="text-sm text-emerald-700">Commission Earned</span>
              <span className="font-bold text-emerald-800">{fmt(stats?.commissionThisMonth ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50">
              <span className="text-sm text-amber-700">Commission Pending</span>
              <span className="font-bold text-amber-800">{fmt(stats?.commissionPending ?? 0)}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/realestate/properties')} className="flex items-center gap-1.5 justify-center py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
              <Home className="h-4 w-4" /> Properties
            </button>
            <button onClick={() => navigate('/realestate/projects')} className="flex items-center gap-1.5 justify-center py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
              <Building2 className="h-4 w-4" /> Projects
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
