// [crm] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, TrendingUp, Clock, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getCRMStats, listCRMFollowUps, listCRMLeads } from '@/lib/db/crm';

const C = {
  bg: '#f0ece4',
  nav: '#0f1523',
  surface: '#ffffff',
  surface2: '#f8f5f0',
  border: '#e5dfd3',
  border2: '#ccc5b5',
  text: '#111520',
  muted: '#7c7869',
  accent: '#b8922a',
  accent2: '#d4aa44',
  green: '#16a34a',
  red: '#dc2626',
  gold: '#d97706',
  blue: '#2563eb',
  purple: '#7c3aed',
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  new:       { label: 'New',       bg: '#ede9fe', color: '#6d28d9' },
  working:   { label: 'Working',   bg: '#fef3c7', color: '#92400e' },
  converted: { label: 'Converted', bg: '#dcfce7', color: '#15803d' },
  dead:      { label: 'Dead',      bg: '#f1f5f9', color: '#64748b' },
};

export function CRMDashboard() {
  const tenantId  = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? 'there');
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
      return items.filter(f => f.due_at && f.due_at.slice(0, 10) <= today).slice(0, 6);
    },
    enabled: !!tenantId,
  });

  const { data: recentLeads = [] } = useQuery({
    queryKey: ['crm-recent-leads', tenantId],
    queryFn: () => listCRMLeads(tenantId, { status: 'all' }),
    enabled: !!tenantId,
    select: d => d.slice(0, 6),
  });

  const statCards = [
    { label: 'Total Leads',   value: stats?.totalLeads ?? 0,        sub: `${stats?.newLeads ?? 0} active`,             topColor: C.blue,   icon: '⚡', path: '/crm/leads' },
    { label: 'Contacts',      value: stats?.totalContacts ?? 0,      sub: 'total qualified',                            topColor: C.accent, icon: '👥', path: '/crm/contacts' },
    { label: 'Open Deals',    value: stats?.openDeals ?? 0,          sub: fmt(stats?.pipelineValue ?? 0),               topColor: C.purple, icon: '💼', path: '/crm/pipeline' },
    { label: 'Follow-ups Due',value: stats?.followUpsDueToday ?? 0,  sub: 'due today',                                  topColor: C.green,  icon: '⏰', path: '/crm/followups' },
    { label: 'Converted',     value: stats?.convertedLeads ?? 0,     sub: 'from leads',                                 topColor: '#16a34a',icon: '✅', path: '/crm/leads' },
    { label: 'Pipeline Value',value: fmt(stats?.pipelineValue ?? 0), sub: 'total open deals',                           topColor: C.gold,   icon: '📈', path: '/crm/pipeline' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Page header */}
      <div style={{ padding: '28px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>
            Hello, {ownerName.split(' ')[0]}
          </h1>
          <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            CRM — Sales Pipeline Overview
          </p>
        </div>
        <button onClick={() => navigate('/crm/leads')}
          style={{ background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'inherit' }}>
          + Add Lead
        </button>
      </div>

      <div style={{ padding: '24px 30px 30px' }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {statCards.map(card => (
            <button key={card.label} onClick={() => navigate(card.path)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', borderTop: `3px solid ${card.topColor}`, padding: '20px 20px 18px', textAlign: 'left', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.05)'; }}>
              <span style={{ position: 'absolute', right: '14px', top: '12px', fontSize: '22px', opacity: 0.12 }}>{card.icon}</span>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', color: C.muted }}>{card.label}</div>
              <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.05em', color: C.text }}>{card.value}</div>
              <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{card.sub}</div>
            </button>
          ))}
        </div>

        {/* Two-column: leads + follow-ups */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

          {/* Recent Leads */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>Recent Leads</span>
              <button onClick={() => navigate('/crm/leads')} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>View all →</button>
            </div>
            {recentLeads.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>No leads yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    {['Name', 'Company', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead, i) => {
                    const sm = STATUS_META[lead.status] ?? STATUS_META.new;
                    return (
                      <tr key={lead.id} onClick={() => navigate('/crm/leads')}
                        style={{ borderBottom: i < recentLeads.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 700, color: C.text }}>{lead.name}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: C.muted }}>{lead.company || '—'}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ background: sm.bg, color: sm.color, borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em' }}>{sm.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Follow-ups Due */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>Follow-ups Due</span>
                {dueFollowUps.length > 0 && (
                  <span style={{ background: '#dc2626', color: 'white', borderRadius: '999px', padding: '0 6px', fontSize: '10px', fontWeight: 700, height: '16px', display: 'inline-flex', alignItems: 'center' }}>{dueFollowUps.length}</span>
                )}
              </div>
              <button onClick={() => navigate('/crm/followups')} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>View all →</button>
            </div>
            {dueFollowUps.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                <p style={{ color: C.muted, fontSize: '13px' }}>All caught up!</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.surface2 }}>
                    {['Task', 'Type', 'Due'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dueFollowUps.map((f, i) => (
                    <tr key={f.id} onClick={() => navigate('/crm/followups')}
                      style={{ borderBottom: i < dueFollowUps.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 700, color: C.text }}>{f.title}</td>
                      <td style={{ padding: '11px 16px', fontSize: '12px', color: C.muted, textTransform: 'capitalize' }}>{f.type}</td>
                      <td style={{ padding: '11px 16px', fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
                        {f.due_at ? new Date(f.due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Conversion funnel */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginRight: '28px', flexShrink: 0 }}>Sales Funnel</div>
          {[
            { label: 'Leads',     value: stats?.totalLeads ?? 0,     color: C.blue },
            { label: 'Active',    value: stats?.newLeads ?? 0,        color: C.accent },
            { label: 'Converted', value: stats?.convertedLeads ?? 0,  color: C.green },
            { label: 'Deals Open',value: stats?.openDeals ?? 0,       color: C.purple },
          ].map((item, i) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', color: item.color }}>{item.value}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{item.label}</div>
              </div>
              {i < 3 && <div style={{ color: C.border2, fontSize: '20px', padding: '0 4px' }}>›</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
