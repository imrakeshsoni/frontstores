// [crm] [all tenants] — CRM command center: today's focus, KPIs, pipeline, alerts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Zap, Target, IndianRupee, Wrench, Timer, Phone, Users, MessageSquare, Plus, Check, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import { getCRMStats, listCRMFollowUps, listCRMLeads, listCRMDeals, updateCRMFollowUp, listCRMContacts } from '@/lib/db/crm';
import { getCRMSalesStats } from '@/lib/db/crmSales';
import { getCRMServiceStats, listCRMContracts } from '@/lib/db/crmService';
import { CRMPage, PageHead, StatCard, Panel, PanelTitle, EmptyState, Badge, Avatar, Btn, C, fmtINR, fmtDate, daysUntil } from './components/kit';

const STAGE_META = [
  { key: 'new',         label: 'New',         color: C.slate },
  { key: 'proposal',    label: 'Proposal',    color: C.blue },
  { key: 'negotiation', label: 'Negotiation', color: C.amber },
  { key: 'won',         label: 'Won',         color: C.green },
];

const FU_ICONS: Record<string, string> = { call: '📞', meeting: '🤝', whatsapp: '💬', email: '✉️', other: '📌' };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function CRMDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['crm-stats', tenantId], queryFn: () => getCRMStats(tenantId), enabled: !!tenantId });
  const { data: salesStats } = useQuery({ queryKey: ['crm-sales-stats', tenantId], queryFn: () => getCRMSalesStats(tenantId), enabled: !!tenantId });
  const { data: svcStats } = useQuery({ queryKey: ['crm-service-stats', tenantId], queryFn: () => getCRMServiceStats(tenantId), enabled: !!tenantId });
  const { data: followups = [] } = useQuery({ queryKey: ['crm-followups', tenantId], queryFn: () => listCRMFollowUps(tenantId, { status: 'pending' }), enabled: !!tenantId });
  const { data: leads = [] } = useQuery({ queryKey: ['crm-leads', tenantId, 'dash'], queryFn: () => listCRMLeads(tenantId, {}), enabled: !!tenantId });
  const { data: deals = [] } = useQuery({ queryKey: ['crm-deals', tenantId], queryFn: () => listCRMDeals(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const { data: contracts = [] } = useQuery({ queryKey: ['crm-contracts', tenantId, 'active'], queryFn: () => listCRMContracts(tenantId, { status: 'active' }), enabled: !!tenantId });

  const markDone = useMutation({
    mutationFn: (id: string) => updateCRMFollowUp(tenantId, id, { status: 'done' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-followups'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); toast.success('Follow-up done ✅'); },
  });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '';
  const today = new Date().toISOString().slice(0, 10);
  const todaysFocus = followups.filter(f => f.due_at && f.due_at.slice(0, 10) <= today).slice(0, 6);
  const hotLeads = leads.filter(l => l.status === 'new' || l.status === 'working').slice(0, 5);
  const openDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const stageTotals = STAGE_META.map(s => ({
    ...s,
    count: deals.filter(d => d.stage === s.key).length,
    value: deals.filter(d => d.stage === s.key).reduce((sum, d) => sum + (d.value || 0), 0),
  }));
  const maxStageValue = Math.max(1, ...stageTotals.map(s => s.value));
  const expiring = contracts.filter(ct => { const d = daysUntil(ct.end_date); return d !== null && d <= 30; });

  return (
    <CRMPage>
      <PageHead
        title={`${greeting()}${ownerName ? `, ${ownerName.split(' ')[0]}` : ''} 👋`}
        subtitle={todaysFocus.length > 0 ? `You have ${todaysFocus.length} follow-up${todaysFocus.length > 1 ? 's' : ''} needing attention today.` : 'All caught up — nothing overdue today.'}
        actions={
          <>
            <Btn variant="ghost" small onClick={() => navigate('/crm/sales')}><Plus size={13} /> New Quote</Btn>
            <Btn variant="ghost" small onClick={() => navigate('/crm/service')}><Plus size={13} /> New Ticket</Btn>
            <Btn small onClick={() => navigate('/crm/leads')}><Plus size={13} /> New Lead</Btn>
          </>
        }
      />

      {/* KPI row */}
      <div className="crm-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Pipeline" value={fmtINR(stats?.pipelineValue ?? 0)} sub={`${openDeals.length} open deals`} icon={<Target size={15} />} tint={C.violet} tintBg={C.violetBg} onClick={() => navigate('/crm/pipeline')} />
        <StatCard label="New Leads" value={stats?.newLeads ?? 0} sub={`${stats?.totalLeads ?? 0} total`} icon={<Zap size={15} />} tint={C.amber} tintBg={C.amberBg} onClick={() => navigate('/crm/leads')} />
        <StatCard label="Revenue" value={fmtINR(salesStats?.totalRevenue ?? 0)} sub={`${fmtINR(salesStats?.totalDue ?? 0)} due`} icon={<IndianRupee size={15} />} tint={C.green} tintBg={C.greenBg} onClick={() => navigate('/crm/sales')} />
        <StatCard label="Open Tickets" value={svcStats?.openTickets ?? 0} sub={`${svcStats?.inProgressTickets ?? 0} in progress`} icon={<Wrench size={15} />} tint={C.blue} tintBg={C.blueBg} onClick={() => navigate('/crm/service')} />
        <StatCard label="Follow-ups Due" value={stats?.followUpsDueToday ?? 0} sub="today or overdue" icon={<Timer size={15} />} tint={C.red} tintBg={C.redBg} onClick={() => navigate('/crm/followups')} />
      </div>

      {/* AMC expiry alert */}
      {expiring.length > 0 && (
        <div className="crm-fade-up" style={{ background: C.amberBg, border: '1px solid rgba(251,191,36,0.35)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          onClick={() => navigate('/crm/service')}>
          <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: C.amber, fontWeight: 600 }}>
            {expiring.length} service contract{expiring.length > 1 ? 's' : ''} expiring within 30 days — review for renewal →
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'start' }}>
        {/* Today's focus */}
        <Panel>
          <PanelTitle action={<button onClick={() => navigate('/crm/followups')} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>View all →</button>}>
            🎯 Today's Focus
          </PanelTitle>
          {todaysFocus.length === 0 ? (
            <EmptyState emoji="🌴" title="Nothing due today" hint="New follow-ups land here when due." />
          ) : (
            <div>
              {todaysFocus.map(f => {
                const overdue = (f.due_at ?? '').slice(0, 10) < today;
                return (
                  <div key={f.id} className="crm-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '18px' }}>{FU_ICONS[f.type] ?? '📌'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
                      <div style={{ fontSize: '11px', color: C.muted }}>
                        {contactName(f.contact_id) || '—'} · {overdue ? <span style={{ color: C.red, fontWeight: 700 }}>overdue · {fmtDate(f.due_at)}</span> : 'due today'}
                      </div>
                    </div>
                    <Btn variant="subtle" small onClick={() => markDone.mutate(f.id)}><Check size={12} /> Done</Btn>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pipeline funnel */}
          <Panel>
            <PanelTitle action={<button onClick={() => navigate('/crm/pipeline')} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Open board →</button>}>
              📊 Pipeline by Stage
            </PanelTitle>
            <div style={{ padding: '16px 18px' }}>
              {stageTotals.map(s => (
                <div key={s.key} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: C.text }}>{s.label} <span style={{ color: C.muted, fontWeight: 500 }}>({s.count})</span></span>
                    <span style={{ fontWeight: 700, color: C.muted }}>{fmtINR(s.value)}</span>
                  </div>
                  <div style={{ height: '8px', background: C.surface2, borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.value / maxStageValue) * 100}%`, background: s.color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Hot leads */}
          <Panel>
            <PanelTitle action={<button onClick={() => navigate('/crm/leads')} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>View all →</button>}>
              🔥 Active Leads
            </PanelTitle>
            {hotLeads.length === 0 ? (
              <EmptyState emoji="✨" title="No active leads" hint="Capture your next lead from the Leads tab or WhatsApp Inbox." />
            ) : (
              <div>
                {hotLeads.map(l => (
                  <div key={l.id} className="crm-row" onClick={() => navigate('/crm/leads')}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                    <Avatar name={l.name} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                      <div style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.company || l.phone || l.source || '—'}</div>
                    </div>
                    {l.lead_value > 0 && <span style={{ fontSize: '12px', fontWeight: 800, color: C.green }}>{fmtINR(l.lead_value)}</span>}
                    <Badge bg={l.status === 'new' ? C.amberBg : C.blueBg} color={l.status === 'new' ? C.amber : C.blue}>{l.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Quick links strip */}
      <div className="crm-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '20px' }}>
        {[
          { icon: <MessageSquare size={14} />, label: 'WA Inbox', path: '/crm/wa-inbox' },
          { icon: <Users size={14} />, label: 'Contacts', path: '/crm/contacts' },
          { icon: <Phone size={14} />, label: 'Comm. Log', path: '/crm/communications' },
          { icon: <IndianRupee size={14} />, label: 'Commissions', path: '/crm/commissions' },
        ].map(q => (
          <button key={q.path} className="crm-hover-lift" onClick={() => navigate(q.path)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, color: C.text, boxShadow: C.shadow }}>
            <span style={{ color: C.accent }}>{q.icon}</span> {q.label}
          </button>
        ))}
      </div>
    </CRMPage>
  );
}
