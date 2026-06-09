// [crm] [all tenants]
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listCRMCommissions, updateCRMCommissionStatus, type CRMCommission } from '@/lib/db/crm';

const C = {
  bg: '#f0ece4', nav: '#0f1523', surface: '#ffffff', border: '#e5dfd3',
  text: '#111520', muted: '#7c7869', accent: '#b8922a',
};

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  paid:    { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  waived:  { bg: '#f1f5f9', color: '#64748b', label: 'Waived' },
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CommissionsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const { data: commissions = [] } = useQuery({
    queryKey: ['crm-commissions', tenantId],
    queryFn: () => listCRMCommissions(tenantId),
    enabled: !!tenantId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMCommissionStatus(tenantId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-commissions', tenantId] }),
  });

  const totalPending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0);
  const totalPaid    = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.commission_amount, 0);

  // Group by deal
  const byDeal: Record<string, CRMCommission[]> = {};
  for (const c of commissions) {
    if (!byDeal[c.deal_id]) byDeal[c.deal_id] = [];
    byDeal[c.deal_id].push(c);
  }

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ padding: '28px 30px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>Commissions</h1>
        <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
          50/50 deal commission splits
        </p>
      </div>

      <div style={{ padding: '24px 30px' }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Pending Commissions', value: fmt(totalPending), color: '#d97706', icon: '⏳' },
            { label: 'Total Paid Out',       value: fmt(totalPaid),    color: '#16a34a', icon: '✅' },
            { label: 'Total Records',         value: commissions.length, color: C.nav,   icon: '📋' },
          ].map(card => (
            <div key={card.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', borderTop: `3px solid ${card.color}`, padding: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginBottom: '10px' }}>{card.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {commissions.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '60px 20px', textAlign: 'center', color: C.muted }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💰</div>
            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No commissions yet</p>
            <p style={{ fontSize: '13px' }}>Commissions are created automatically when a deal is marked as Won.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(byDeal).map(([dealId, items]) => {
              const dealTitle = items[0]?.deal_title || dealId;
              const dealValue = items[0]?.deal_value || 0;
              return (
                <div key={dealId} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: '#f8f5f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: C.text }}>{dealTitle}</span>
                      <span style={{ marginLeft: '10px', fontSize: '12px', color: C.muted }}>Deal value: {fmt(dealValue)}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: C.muted }}>50/50 split</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Person', 'Type', 'Split', 'Amount', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c, i) => {
                        const sm = STATUS_META[c.status] ?? STATUS_META.pending;
                        return (
                          <tr key={c.id} style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: C.text }}>{c.person_name}</td>
                            <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted, textTransform: 'capitalize' }}>
                              {c.person_type === 'owner' ? '🏢 Deal Owner' : '🤝 Referrer'}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', color: C.accent }}>{c.commission_pct}%</td>
                            <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: '14px', color: '#16a34a' }}>{fmt(c.commission_amount)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ background: sm.bg, color: sm.color, borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 600 }}>{sm.label}</span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {c.status === 'pending' && (
                                  <button onClick={() => statusMutation.mutate({ id: c.id, status: 'paid' })}
                                    style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '3px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', color: '#15803d' }}>
                                    Mark Paid
                                  </button>
                                )}
                                {c.status === 'pending' && (
                                  <button onClick={() => statusMutation.mutate({ id: c.id, status: 'waived' })}
                                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', color: '#64748b' }}>
                                    Waive
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
