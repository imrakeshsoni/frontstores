// [crm] [all tenants] — Commissions: auto-created on deal win, tracked per person until paid
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, CheckCircle2, Hourglass } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import { listCRMCommissions, updateCRMCommissionStatus } from '@/lib/db/crm';
import { CRMPage, PageHead, Segments, StatCard, Panel, EmptyState, Badge, Btn, Avatar, C, fmtINR, timeAgo, th, td } from './components/kit';
import { SF_TENANT_ID } from './components/lightning';
import { SalesforceCommissionsPage } from './SalesforceOpsPages';

export function CommissionsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  // [crm] [tenant: FrontStores.com] — Salesforce-style commissions (table + wide record popup)
  if (tenantId === SF_TENANT_ID) return <SalesforceCommissionsPage />;
  return <AuroraCommissionsPage tenantId={tenantId} />;
}

// [crm] [all tenants] — original Aurora commissions UI
function AuroraCommissionsPage({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'paid' | 'all'>('pending');

  const { data: commissions = [] } = useQuery({ queryKey: ['crm-commissions', tenantId], queryFn: () => listCRMCommissions(tenantId), enabled: !!tenantId });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMCommissionStatus(tenantId, id, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['crm-commissions'] });
      toast.success(status === 'paid' ? 'Commission marked paid 💸' : 'Moved back to pending');
    },
  });

  const pending = commissions.filter(c => c.status === 'pending');
  const paid = commissions.filter(c => c.status === 'paid');
  const visible = tab === 'all' ? commissions : tab === 'paid' ? paid : pending;

  const pendingTotal = pending.reduce((s, c) => s + (c.commission_amount || 0), 0);
  const paidTotal = paid.reduce((s, c) => s + (c.commission_amount || 0), 0);

  // Totals per person (pending)
  const perPerson = pending.reduce<Record<string, number>>((acc, c) => {
    acc[c.person_name] = (acc[c.person_name] ?? 0) + (c.commission_amount || 0);
    return acc;
  }, {});

  return (
    <CRMPage>
      <PageHead title="Commissions" subtitle="Created automatically when a deal is won — owner and referrer each get their share." />

      <div className="crm-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <StatCard label="Pending Payout" value={fmtINR(pendingTotal)} sub={`${pending.length} commissions`} icon={<Hourglass size={15} />} tint={C.amber} tintBg={C.amberBg} />
        <StatCard label="Paid Out" value={fmtINR(paidTotal)} sub={`${paid.length} commissions`} icon={<CheckCircle2 size={15} />} tint={C.green} tintBg={C.greenBg} />
        <StatCard label="Total" value={fmtINR(pendingTotal + paidTotal)} icon={<IndianRupee size={15} />} tint={C.violet} tintBg={C.violetBg} />
      </div>

      {/* Owed per person */}
      {Object.keys(perPerson).length > 0 && (
        <div className="crm-fade-up" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {Object.entries(perPerson).map(([name, amt]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '6px 14px 6px 6px', boxShadow: C.shadow }}>
              <Avatar name={name} size={26} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>{name}</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: C.amber }}>{fmtINR(amt)} due</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <Segments value={tab} onChange={k => setTab(k as typeof tab)}
          options={[
            { key: 'pending', label: 'Pending', count: pending.length },
            { key: 'paid', label: 'Paid', count: paid.length },
            { key: 'all', label: 'All', count: commissions.length },
          ]} />
      </div>

      <Panel>
        {visible.length === 0 ? (
          <EmptyState emoji="💸" title={tab === 'pending' ? 'No pending commissions' : 'Nothing here yet'}
            hint="Win a deal in the Pipeline and commissions appear here automatically." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Person</th><th style={th}>Deal</th><th style={th}>Deal Value</th><th style={th}>Share</th><th style={th}>Commission</th><th style={th}>Status</th><th style={th}></th></tr></thead>
            <tbody>
              {visible.map(c => (
                <tr key={c.id} className="crm-row">
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Avatar name={c.person_name} size={28} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{c.person_name}</div>
                        <div style={{ fontSize: '11px', color: C.muted }}>{c.person_type}</div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>{c.deal_title}</td>
                  <td style={td}>{fmtINR(c.deal_value)}</td>
                  <td style={td}>{c.commission_pct}%</td>
                  <td style={{ ...td, fontWeight: 800, color: C.green }}>{fmtINR(c.commission_amount)}</td>
                  <td style={td}>
                    <Badge bg={c.status === 'paid' ? C.greenBg : C.amberBg} color={c.status === 'paid' ? C.green : C.amber}>
                      {c.status === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                    <div style={{ fontSize: '10px', color: C.faint, marginTop: '2px' }}>{timeAgo(c.updated_at)}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {c.status === 'pending'
                      ? <Btn variant="success" small onClick={() => setStatus.mutate({ id: c.id, status: 'paid' })}><CheckCircle2 size={12} /> Mark Paid</Btn>
                      : <Btn variant="ghost" small onClick={() => setStatus.mutate({ id: c.id, status: 'pending' })}>Undo</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </CRMPage>
  );
}
