// [crm] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, TrendingUp, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getCRMStats, listCRMFollowUps } from '@/lib/db/crm';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CRMDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? 'CRM');
  const navigate  = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['crm-stats', tenantId],
    queryFn: () => getCRMStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: dueFollowUps = [] } = useQuery({
    queryKey: ['crm-due-followups', tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const items = await listCRMFollowUps(tenantId, { status: 'pending' });
      return items.filter(f => f.due_at && f.due_at.slice(0, 10) <= today).slice(0, 5);
    },
    enabled: !!tenantId,
  });

  const cards = [
    { label: 'Total Contacts', value: stats?.totalContacts ?? 0, icon: Users, color: '#2563eb', bg: '#dbeafe', path: '/crm/contacts' },
    { label: 'Open Deals', value: stats?.openDeals ?? 0, icon: Briefcase, color: '#7c3aed', bg: '#ede9fe', path: '/crm/pipeline' },
    { label: 'Pipeline Value', value: fmt(stats?.pipelineValue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/crm/pipeline' },
    { label: 'Follow-ups Due', value: stats?.followUpsDueToday ?? 0, icon: Clock, color: '#d97706', bg: '#fef3c7', path: '/crm/followups' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">CRM — Leads, Deals &amp; Follow-ups</p>
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

      {dueFollowUps.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold text-amber-800">Follow-ups Due</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{dueFollowUps.length}</span>
          </div>
          <div className="space-y-2">
            {dueFollowUps.map(f => (
              <div key={f.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{f.title}</p>
                  <p className="text-xs text-slate-400">{f.type}</p>
                </div>
                <span className="text-xs font-semibold text-amber-700">{f.due_at ? new Date(f.due_at).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/crm/followups')} className="mt-3 text-sm font-medium text-amber-700 hover:underline">View all follow-ups →</button>
        </div>
      )}
    </div>
  );
}
