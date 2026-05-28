// [realestate] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listLeads, listDeals, listCommissions, listSiteVisits } from '@/lib/db/realestate';
import { BarChart3, TrendingUp, Users, Handshake } from 'lucide-react';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtL(n: number) { return `₹${(n/100000).toFixed(1)}L`; }

export function REReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');

  const { data: leads = [] } = useQuery({ queryKey: ['re-leads', tenantId], queryFn: () => listLeads(tenantId), enabled: !!tenantId });
  const { data: deals = [] } = useQuery({ queryKey: ['re-deals', tenantId], queryFn: () => listDeals(tenantId), enabled: !!tenantId });
  const { data: commissions = [] } = useQuery({ queryKey: ['re-commissions', tenantId], queryFn: () => listCommissions(tenantId), enabled: !!tenantId });
  const { data: visits = [] } = useQuery({ queryKey: ['re-visits', tenantId], queryFn: () => listSiteVisits(tenantId), enabled: !!tenantId });

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);

  const leadsThisMonth = leads.filter(l => l.created_at >= monthStart).length;
  const leadsLastMonth = leads.filter(l => l.created_at >= prevMonthStart && l.created_at <= prevMonthEnd).length;
  const closedThisMonth = deals.filter(d => d.status === 'closed' && (d.closed_at ?? '') >= monthStart).length;
  const closedLastMonth = deals.filter(d => d.status === 'closed' && (d.closed_at ?? '') >= prevMonthStart && (d.closed_at ?? '') <= prevMonthEnd).length;
  const commThisMonth = commissions.filter(c => (c.received_date ?? '') >= monthStart).reduce((s, c) => s + c.received_amount, 0);
  const commLastMonth = commissions.filter(c => (c.received_date ?? '') >= prevMonthStart && (c.received_date ?? '') <= prevMonthEnd).reduce((s, c) => s + c.received_amount, 0);

  // Stage funnel
  const stageCounts: Record<string, number> = {};
  leads.forEach(l => { stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1; });
  const stageOrder = ['new','contacted','site_visit','negotiation','closed','lost'];
  const stageLabels: Record<string,string> = { new:'New', contacted:'Contacted', site_visit:'Site Visit', negotiation:'Negotiation', closed:'Closed', lost:'Lost' };
  const stageColors: Record<string,string> = { new:'bg-blue-400', contacted:'bg-yellow-400', site_visit:'bg-purple-400', negotiation:'bg-orange-400', closed:'bg-green-500', lost:'bg-red-400' };

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  leads.forEach(l => { sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1; });

  // Deal type breakdown
  const dealTypeCounts: Record<string, number> = {};
  deals.forEach(d => { dealTypeCounts[d.deal_type] = (dealTypeCounts[d.deal_type] ?? 0) + 1; });

  // Site visit conversion
  const completedVisits = visits.filter(v => v.status === 'completed').length;
  const highInterest = visits.filter(v => v.interest_level === 'high').length;

  const convRate = leads.length > 0 ? ((deals.filter(d => d.status === 'closed').length / leads.length) * 100).toFixed(1) : '0';
  const visitRate = leads.length > 0 ? ((visits.length / leads.length) * 100).toFixed(0) : '0';
  const avgDealValue = deals.filter(d => d.deal_value).length > 0
    ? deals.filter(d => d.deal_value).reduce((s, d) => s + (d.deal_value ?? 0), 0) / deals.filter(d => d.deal_value).length
    : 0;

  function pct(a: number, b: number) {
    if (b === 0) return null;
    const d = ((a - b) / b * 100).toFixed(0);
    return { val: +d, label: `${+d > 0 ? '+' : ''}${d}% vs last month` };
  }

  const cards = [
    { label: 'Leads This Month', value: leadsThisMonth, sub: pct(leadsThisMonth, leadsLastMonth), icon: Users, color: '#2563eb', bg: '#dbeafe' },
    { label: 'Deals Closed', value: closedThisMonth, sub: pct(closedThisMonth, closedLastMonth), icon: Handshake, color: '#15803d', bg: '#dcfce7' },
    { label: 'Commission Earned', value: fmt(commThisMonth), sub: pct(commThisMonth, commLastMonth), icon: TrendingUp, color: '#ca8a04', bg: '#fef9c3' },
    { label: 'Conversion Rate', value: `${convRate}%`, sub: null, icon: BarChart3, color: '#7c3aed', bg: '#ede9fe' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>

      {/* Month summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            {c.sub && <p className={`text-xs mt-0.5 ${c.sub.val > 0 ? 'text-green-600' : c.sub.val < 0 ? 'text-red-500' : 'text-slate-400'}`}>{c.sub.label}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline funnel */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Lead Pipeline Funnel</h2>
          <div className="space-y-3">
            {stageOrder.map(s => {
              const count = stageCounts[s] ?? 0;
              const max = Math.max(...Object.values(stageCounts), 1);
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0">{stageLabels[s]}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${stageColors[s]} transition-all`} style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead sources */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Lead Sources</h2>
          <div className="space-y-2">
            {Object.entries(sourceCounts).sort(([,a],[,b]) => b - a).map(([src, cnt]) => (
              <div key={src} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-700 capitalize">{src}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(cnt / leads.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-6 text-right">{cnt}</span>
                </div>
              </div>
            ))}
            {Object.keys(sourceCounts).length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data yet</p>}
          </div>
        </div>

        {/* Site visit stats */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Site Visit Performance</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-blue-50 text-center">
              <p className="text-2xl font-bold text-blue-700">{visits.length}</p>
              <p className="text-xs text-blue-600 mt-0.5">Total</p>
            </div>
            <div className="p-3 rounded-xl bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-700">{completedVisits}</p>
              <p className="text-xs text-green-600 mt-0.5">Completed</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-center">
              <p className="text-2xl font-bold text-amber-700">{highInterest}</p>
              <p className="text-xs text-amber-600 mt-0.5">High Interest</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><span>Visits per Lead</span><span className="font-semibold">{visitRate}%</span></div>
            <div className="flex justify-between"><span>Avg Deal Value</span><span className="font-semibold text-emerald-700">{avgDealValue > 0 ? fmtL(avgDealValue) : '—'}</span></div>
          </div>
        </div>

        {/* Commission breakdown */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Commission Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50">
              <span className="text-sm text-emerald-700">Total Received</span>
              <span className="font-bold text-emerald-800">{fmt(commissions.reduce((s,c) => s + c.received_amount, 0))}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50">
              <span className="text-sm text-amber-700">Pending</span>
              <span className="font-bold text-amber-800">{fmt(commissions.filter(c => c.status !== 'received').reduce((s,c) => s + (c.total_amount - c.received_amount), 0))}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
              <span className="text-sm text-slate-600">TDS Deducted</span>
              <span className="font-bold text-slate-700">{fmt(commissions.reduce((s,c) => s + c.tds_amount, 0))}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
              <span className="text-sm text-slate-600">GST Charged</span>
              <span className="font-bold text-slate-700">{fmt(commissions.reduce((s,c) => s + c.gst_amount, 0))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
