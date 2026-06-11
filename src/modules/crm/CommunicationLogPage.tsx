// [crm] [all tenants] — Communication log: timeline of every call, message & meeting
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import { listCRMCommunications, createCRMCommunication, deleteCRMCommunication, listCRMContacts } from '@/lib/db/crm';
import { CRMPage, PageHead, Panel, EmptyState, Btn, Modal, Field, FormGrid, inp, Avatar, C, fmtDate, timeAgo } from './components/kit';

const TYPE_META: Record<string, { icon: string; label: string }> = {
  call:     { icon: '📞', label: 'Call' },
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  email:    { icon: '✉️', label: 'Email' },
  meeting:  { icon: '🤝', label: 'Meeting' },
  sms:      { icon: '📱', label: 'SMS' },
  other:    { icon: '📌', label: 'Other' },
};

const emptyForm = { contact_id: '', type: 'call', direction: 'outgoing', summary: '' };

export function CRMCommunicationLogPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: comms = [] } = useQuery({ queryKey: ['crm-comms', tenantId], queryFn: () => listCRMCommunications(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';

  const add = useMutation({
    mutationFn: () => createCRMCommunication(tenantId, { ...form, occurred_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-comms'] }); setShowForm(false); setForm(emptyForm); toast.success('Logged 📝'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMCommunication(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-comms'] }); toast.success('Deleted'); },
  });

  // Group by day for timeline dividers
  const byDay = comms.reduce<Record<string, typeof comms>>((acc, cm) => {
    const day = (cm.occurred_at || '').slice(0, 10) || 'unknown';
    (acc[day] = acc[day] ?? []).push(cm);
    return acc;
  }, {});

  return (
    <CRMPage>
      <PageHead title="Communication Log" subtitle="A clean timeline of every interaction with your customers."
        actions={<Btn onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus size={14} /> Log Interaction</Btn>} />

      {comms.length === 0 ? (
        <Panel>
          <EmptyState emoji="📜" title="No interactions logged" hint="Log calls, WhatsApp chats and meetings so the whole story stays in one place."
            action={<Btn small onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> Log First Interaction</Btn>} />
        </Panel>
      ) : (
        Object.entries(byDay).map(([day, items]) => (
          <div key={day} style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px 4px' }}>
              {fmtDate(day)}
            </div>
            <Panel>
              {items.map(cm => {
                const tm = TYPE_META[cm.type] ?? TYPE_META.other;
                const incoming = cm.direction === 'incoming';
                return (
                  <div key={cm.id} className="crm-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '18px', marginTop: '2px' }}>{tm.icon}</span>
                    <Avatar name={contactName(cm.contact_id)} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{contactName(cm.contact_id)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, color: incoming ? C.green : C.blue, background: incoming ? C.greenBg : C.blueBg, borderRadius: '999px', padding: '2px 8px' }}>
                          {incoming ? <ArrowDownLeft size={9} /> : <ArrowUpRight size={9} />}
                          {incoming ? 'Incoming' : 'Outgoing'} {tm.label}
                        </span>
                        <span style={{ fontSize: '11px', color: C.faint }}>{timeAgo(cm.occurred_at)}</span>
                      </div>
                      {cm.summary && <div style={{ fontSize: '12px', color: C.muted, whiteSpace: 'pre-wrap' }}>{cm.summary}</div>}
                    </div>
                    <button onClick={() => { if (confirm('Delete this entry?')) remove.mutate(cm.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: '4px', display: 'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </Panel>
          </div>
        ))
      )}

      {showForm && (
        <Modal title="Log Interaction" onClose={() => setShowForm(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn onClick={() => {
              if (!form.contact_id) return toast.error('Pick a contact');
              add.mutate();
            }} disabled={add.isPending}>Save Log</Btn>
          </>}>
          <FormGrid>
            <Field label="Contact *">
              <select style={inp()} value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} autoFocus>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select style={inp()} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
              </select>
            </Field>
            <Field label="Direction">
              <select style={inp()} value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>
                <option value="outgoing">Outgoing</option><option value="incoming">Incoming</option>
              </select>
            </Field>
            <Field label="Summary" span2><textarea style={inp({ minHeight: '80px', resize: 'vertical' })} value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="What was discussed?" /></Field>
          </FormGrid>
        </Modal>
      )}
    </CRMPage>
  );
}
