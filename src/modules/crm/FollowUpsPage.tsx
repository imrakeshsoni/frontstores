// [crm] [all tenants] — Follow-ups: overdue/today/upcoming with one-click done & snooze
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Clock3, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import { listCRMFollowUps, createCRMFollowUp, updateCRMFollowUp, deleteCRMFollowUp, listCRMContacts, type CRMFollowUp } from '@/lib/db/crm';
import { CRMPage, PageHead, Segments, Panel, PanelTitle, EmptyState, Btn, Modal, Field, FormGrid, inp, Avatar, C, fmtDate } from './components/kit';

const TYPES = [
  { key: 'call', label: '📞 Call' },
  { key: 'meeting', label: '🤝 Meeting' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'email', label: '✉️ Email' },
  { key: 'other', label: '📌 Other' },
];
const TYPE_ICON: Record<string, string> = { call: '📞', meeting: '🤝', whatsapp: '💬', email: '✉️', other: '📌' };

const emptyForm = { contact_id: '', title: '', type: 'call', due_at: '', notes: '' };

export function CRMFollowUpsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: followups = [] } = useQuery({
    queryKey: ['crm-followups', tenantId, tab],
    queryFn: () => listCRMFollowUps(tenantId, { status: tab }),
    enabled: !!tenantId,
  });
  const { data: allFollowups = [] } = useQuery({ queryKey: ['crm-followups', tenantId, 'counts'], queryFn: () => listCRMFollowUps(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-followups'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); };

  const add = useMutation({
    mutationFn: () => createCRMFollowUp(tenantId, {
      contact_id: form.contact_id, deal_id: '', title: form.title, type: form.type,
      due_at: form.due_at || null, status: 'pending', notes: form.notes,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm); toast.success('Follow-up scheduled ⏰'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const markDone = useMutation({
    mutationFn: (id: string) => updateCRMFollowUp(tenantId, id, { status: 'done' }),
    onSuccess: () => { invalidate(); toast.success('Done ✅'); },
  });

  const snooze = useMutation({
    mutationFn: ({ f, days }: { f: CRMFollowUp; days: number }) => {
      const base = f.due_at ? new Date(f.due_at) : new Date();
      const next = new Date(Math.max(base.getTime(), Date.now()));
      next.setDate(next.getDate() + days);
      return updateCRMFollowUp(tenantId, f.id, { due_at: next.toISOString().slice(0, 10) });
    },
    onSuccess: (_, { days }) => { invalidate(); toast.success(`Snoozed +${days}d 😴`); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMFollowUp(tenantId, id),
    onSuccess: () => { invalidate(); toast.success('Deleted'); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const groups = tab === 'pending' ? [
    { title: '🔴 Overdue', items: followups.filter(f => f.due_at && f.due_at.slice(0, 10) < today) },
    { title: '🟡 Today', items: followups.filter(f => f.due_at && f.due_at.slice(0, 10) === today) },
    { title: '🟢 Upcoming', items: followups.filter(f => !f.due_at || f.due_at.slice(0, 10) > today) },
  ] : [{ title: '✅ Completed', items: followups }];

  const pendingCount = allFollowups.filter(f => f.status === 'pending').length;
  const doneCount = allFollowups.filter(f => f.status === 'done').length;

  return (
    <CRMPage>
      <PageHead title="Follow-ups" subtitle="Never miss a call, meeting or promise again."
        actions={<Btn onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus size={14} /> New Follow-up</Btn>} />

      <div style={{ marginBottom: '16px' }}>
        <Segments value={tab} onChange={k => setTab(k as typeof tab)}
          options={[{ key: 'pending', label: 'Pending', count: pendingCount }, { key: 'done', label: 'Done', count: doneCount }]} />
      </div>

      {followups.length === 0 ? (
        <Panel>
          <EmptyState emoji={tab === 'pending' ? '🌴' : '📭'} title={tab === 'pending' ? 'Nothing pending — enjoy!' : 'Nothing completed yet'}
            hint="Schedule follow-ups so the right call happens at the right time."
            action={tab === 'pending' ? <Btn small onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> Schedule One</Btn> : undefined} />
        </Panel>
      ) : (
        groups.filter(g => g.items.length > 0).map(g => (
          <Panel key={g.title} style={{ marginBottom: '14px' }}>
            <PanelTitle>{g.title} ({g.items.length})</PanelTitle>
            {g.items.map(f => (
              <div key={f.id} className="crm-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: '18px' }}>{TYPE_ICON[f.type] ?? '📌'}</span>
                <Avatar name={contactName(f.contact_id)} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, textDecoration: f.status === 'done' ? 'line-through' : 'none', opacity: f.status === 'done' ? 0.6 : 1 }}>{f.title}</div>
                  <div style={{ fontSize: '11px', color: C.muted }}>
                    {contactName(f.contact_id)}{f.due_at ? ` · due ${fmtDate(f.due_at)}` : ' · no due date'}{f.notes ? ` · ${f.notes}` : ''}
                  </div>
                </div>
                {tab === 'pending' && (
                  <>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[1, 3, 7].map(d => (
                        <button key={d} onClick={() => snooze.mutate({ f, days: d })}
                          title={`Snooze +${d} day${d > 1 ? 's' : ''}`}
                          style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: C.muted, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Clock3 size={9} />+{d}d
                        </button>
                      ))}
                    </div>
                    <Btn variant="success" small onClick={() => markDone.mutate(f.id)}><Check size={12} /> Done</Btn>
                  </>
                )}
                <button onClick={() => { if (confirm('Delete this follow-up?')) remove.mutate(f.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: '4px', display: 'flex' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </Panel>
        ))
      )}

      {showForm && (
        <Modal title="New Follow-up" onClose={() => setShowForm(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn onClick={() => {
              if (!form.title.trim()) return toast.error('Title is required');
              add.mutate();
            }} disabled={add.isPending}>Schedule</Btn>
          </>}>
          <FormGrid>
            <Field label="What needs doing? *" span2><input style={inp()} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus placeholder="e.g. Call Sharma about renewal quote" /></Field>
            <Field label="Contact">
              <select style={inp()} value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select style={inp()} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Due Date"><input type="date" style={inp()} value={form.due_at} onChange={e => setForm(p => ({ ...p, due_at: e.target.value }))} /></Field>
            <Field label="Notes"><input style={inp()} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}
    </CRMPage>
  );
}
