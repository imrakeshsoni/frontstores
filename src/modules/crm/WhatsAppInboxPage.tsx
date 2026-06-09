// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listCRMWaInbox, importWaLeadToLead, listCRMTeamMembers, type CRMWaInbox } from '@/lib/db/crm';

const SERVER = 'https://update.frontstores.com';

const C = {
  bg: '#f0ece4', nav: '#0f1523', surface: '#ffffff', border: '#e5dfd3',
  border2: '#ccc5b5', text: '#111520', muted: '#7c7869', accent: '#b8922a',
  green: '#25D366',
};

// Sync pending WA leads from the server into the local DB
async function syncWaLeadsFromServer(tenantId: string) {
  try {
    const res = await fetch(`${SERVER}/api/wa-leads/${tenantId}`);
    if (!res.ok) return;
    const { leads = [] } = await res.json() as { leads: Array<{
      id: string; from_phone: string; from_name: string; company: string;
      business_type: string; software_interest: string; message_preview: string;
      received_at: string; imported: boolean; tenant_id: string;
    }> };
    const { upsertCRMWaLead } = await import('@/lib/db/crm');
    for (const l of leads.filter(l => !l.imported)) {
      await upsertCRMWaLead(tenantId, {
        from_phone: l.from_phone,
        from_name: l.from_name,
        company: l.company,
        business_type: l.business_type,
        software_interest: l.software_interest,
        message_preview: l.message_preview,
        received_at: l.received_at,
      });
    }
  } catch { /* offline — ignore */ }
}

export function WhatsAppInboxPage() {
  const tenantId  = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [assignOwner, setAssignOwner] = useState<{ waId: string } | null>(null);
  const [selectedOwner, setSelectedOwner] = useState('');

  const { data: leads = [], isFetching } = useQuery({
    queryKey: ['crm-wa-inbox', tenantId, filter],
    queryFn: async () => {
      await syncWaLeadsFromServer(tenantId);
      return listCRMWaInbox(tenantId, filter === 'pending' ? 'pending' : undefined);
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['crm-team', tenantId],
    queryFn: () => listCRMTeamMembers(tenantId),
    enabled: !!tenantId,
  });

  const allOwners = [ownerName, ...teamMembers.map(m => m.name)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  const importMutation = useMutation({
    mutationFn: async ({ waId, owner }: { waId: string; owner: string }) => {
      await importWaLeadToLead(tenantId, waId, owner);
      // Mark as imported on server too
      try { await fetch(`${SERVER}/api/wa-leads/${tenantId}/${waId}/mark-imported`, { method: 'POST' }); } catch {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-wa-inbox', tenantId] });
      qc.invalidateQueries({ queryKey: ['crm-recent-leads', tenantId] });
      setAssignOwner(null);
    },
  });

  const pendingCount = leads.filter(l => !l.imported_at).length;

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ padding: '28px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>WhatsApp Inbox</h1>
            {pendingCount > 0 && (
              <span style={{ background: C.green, color: '#fff', borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{pendingCount} new</span>
            )}
          </div>
          <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            Leads captured via WhatsApp Business API
          </p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['crm-wa-inbox', tenantId] })}
          style={{ background: isFetching ? '#94a3b8' : C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {isFetching ? 'Syncing...' : '↻ Sync'}
        </button>
      </div>

      <div style={{ padding: '24px 30px' }}>
        {/* Info banner */}
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: '#14532d', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0 }}>📱</span>
          <div>
            <strong>WhatsApp Bot Active.</strong> When a new customer messages your WhatsApp Business number, the bot automatically collects their name, company, business type, and software interest — then saves it here for you to review and import as a lead.
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          {[{ key: 'pending', label: 'New Leads' }, { key: 'all', label: 'All Messages' }].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key as 'pending' | 'all')}
              style={{ background: filter === tab.key ? C.nav : C.surface, color: filter === tab.key ? '#fff' : C.text, border: `1px solid ${filter === tab.key ? C.nav : C.border2}`, borderRadius: '4px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {leads.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📱</div>
              <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                {filter === 'pending' ? 'No new WhatsApp leads' : 'No WhatsApp messages yet'}
              </p>
              <p style={{ fontSize: '13px' }}>When customers message your WA Business number, they'll appear here.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f5f0' }}>
                  {['From', 'Company', 'Business Type', 'Software Interest', 'Received', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: CRMWaInbox, i) => (
                  <tr key={lead.id} style={{ borderBottom: i < leads.length - 1 ? `1px solid ${C.border}` : 'none', background: lead.imported_at ? 'transparent' : '#f0fdf4' }}>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{lead.from_name || '(unknown)'}</div>
                      <div style={{ fontSize: '11px', color: C.muted }}>{lead.from_phone}</div>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '13px', color: C.muted }}>{lead.company || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: '13px', color: C.muted }}>{lead.business_type || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: '13px', color: C.muted, maxWidth: '200px' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lead.software_interest || '—'}</span>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '12px', color: C.muted, whiteSpace: 'nowrap' }}>
                      {new Date(lead.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {lead.imported_at ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 600 }}>Imported</span>
                      ) : (
                        <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 600 }}>New Lead</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {!lead.imported_at && (
                        <button onClick={() => { setAssignOwner({ waId: lead.id }); setSelectedOwner(ownerName); }}
                          style={{ background: C.green, color: '#fff', border: 'none', borderRadius: '3px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                          Import Lead
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Assign owner modal */}
      {assignOwner && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,21,35,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '420px', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: C.text }}>Import as Lead</h2>
              <button onClick={() => setAssignOwner(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>Assign an owner for this lead. They will be responsible for following up.</p>
              <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' }}>Assign Owner</label>
              <select value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border2}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', marginBottom: '8px' }}>
                {allOwners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setAssignOwner(null)}
                style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: '4px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.text }}>
                Cancel
              </button>
              <button onClick={() => importMutation.mutate({ waId: assignOwner.waId, owner: selectedOwner })}
                disabled={importMutation.isPending}
                style={{ background: C.green, color: '#fff', border: 'none', borderRadius: '4px', padding: '9px 22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: importMutation.isPending ? 0.7 : 1 }}>
                {importMutation.isPending ? 'Importing...' : 'Import Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
