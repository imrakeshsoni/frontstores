// [crm] [all tenants] — WhatsApp Inbox: incoming enquiries → one-click import to Leads
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Download, MessageSquare, CheckCircle2, MessagesSquare, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import { listCRMWaInbox, importWaLeadToLead, listCRMTeamMembers, listCRMWaMessages } from '@/lib/db/crm';
import { CRMPage, PageHead, Segments, Panel, EmptyState, Badge, Avatar, Btn, C, timeAgo } from './components/kit';

export function WhatsAppInboxPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [openChat, setOpenChat] = useState<string | null>(null); // from_phone of expanded transcript

  const { data: entries = [] } = useQuery({
    queryKey: ['crm-wa-inbox', tenantId, tab],
    queryFn: () => listCRMWaInbox(tenantId, tab === 'pending' ? 'pending' : undefined),
    enabled: !!tenantId,
  });
  const { data: allEntries = [] } = useQuery({ queryKey: ['crm-wa-inbox', tenantId, 'all'], queryFn: () => listCRMWaInbox(tenantId), enabled: !!tenantId });
  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });

  const importLead = useMutation({
    mutationFn: (id: string) => importWaLeadToLead(tenantId, id, team[0]?.name ?? ownerName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-wa-inbox'] });
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Imported to Leads 🎉');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingCount = allEntries.filter(e => !e.imported_at).length;

  return (
    <CRMPage>
      <PageHead title="WhatsApp Inbox" subtitle="Enquiries from your WhatsApp Business number — import them as leads in one click." />

      <div style={{ marginBottom: '16px' }}>
        <Segments value={tab} onChange={k => setTab(k as 'pending' | 'all')}
          options={[{ key: 'pending', label: 'New', count: pendingCount }, { key: 'all', label: 'All', count: allEntries.length }]} />
      </div>

      <Panel>
        {entries.length === 0 ? (
          <EmptyState emoji="💬" title={tab === 'pending' ? 'No new enquiries' : 'Inbox is empty'}
            hint="When customers message your WhatsApp Business number, their enquiries appear here automatically." />
        ) : (
          <div>
            {entries.map(e => (
              <div key={e.id} className="crm-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
                <Avatar name={e.from_name || e.from_phone} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: C.text }}>{e.from_name || e.from_phone}</span>
                    <span style={{ fontSize: '11px', color: C.muted }}>{e.from_phone}</span>
                    {e.company && <Badge bg={C.surface2} color={C.muted}>{e.company}</Badge>}
                    {e.business_type && <Badge bg={C.violetBg} color={C.violet}>{e.business_type}</Badge>}
                    {e.software_interest && <Badge bg={C.blueBg} color={C.blue}>{e.software_interest}</Badge>}
                  </div>
                  {e.message_preview && (
                    <div style={{ fontSize: '12px', color: C.muted, background: C.surface2, borderRadius: '8px', padding: '8px 10px', marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <MessageSquare size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'pre-wrap' }}>{e.message_preview}</span>
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: C.faint, marginTop: '4px' }}>{timeAgo(e.received_at)}</div>
                  {openChat === e.from_phone && <ChatTranscript tenantId={tenantId} phone={e.from_phone} />}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                  {e.imported_at ? (
                    <Btn variant="subtle" small onClick={() => navigate('/crm/leads')}>
                      <CheckCircle2 size={12} style={{ color: C.green }} /> Imported
                    </Btn>
                  ) : (
                    <Btn variant="success" small onClick={() => importLead.mutate(e.id)} disabled={importLead.isPending}>
                      <Download size={12} /> Import to Leads
                    </Btn>
                  )}
                  <Btn variant="subtle" small onClick={() => setOpenChat(openChat === e.from_phone ? null : e.from_phone)}>
                    {openChat === e.from_phone ? <ChevronUp size={12} /> : <MessagesSquare size={12} />}
                    {openChat === e.from_phone ? 'Hide chat' : 'View chat'}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </CRMPage>
  );
}

// [crm] [all tenants] — full bot conversation, WhatsApp-style bubbles.
// Every message in and out of the bot is logged on the server and mirrored
// into crm_wa_messages, so the team sees the entire chat — not just the
// extracted lead fields.
function ChatTranscript({ tenantId, phone }: { tenantId: string; phone: string }) {
  const { data: msgs = [] } = useQuery({
    queryKey: ['crm-wa-chat', tenantId, phone],
    queryFn: () => listCRMWaMessages(tenantId, phone),
    enabled: !!tenantId && !!phone,
  });
  if (msgs.length === 0) {
    return <div style={{ fontSize: '12px', color: C.faint, marginTop: '8px' }}>No chat history synced yet — it appears within ~30 seconds of the next poll.</div>;
  }
  return (
    <div style={{ marginTop: '10px', background: C.surface2, borderRadius: '10px', padding: '12px', maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {msgs.map(m => (
        <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
          <div style={{
            maxWidth: '78%', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            padding: '7px 11px', borderRadius: m.direction === 'out' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
            background: m.direction === 'out' ? C.greenBg : C.surface,
            color: C.text, border: `1px solid ${C.border}`,
          }}>
            {m.message}
            <div style={{ fontSize: '10px', color: C.faint, marginTop: '3px', textAlign: 'right' }}>
              {m.direction === 'out' ? '🤖 bot · ' : ''}{m.sent_at ? timeAgo(m.sent_at) : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
