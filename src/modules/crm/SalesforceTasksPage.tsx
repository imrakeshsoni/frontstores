// [crm] [tenant: FrontStores.com] — Salesforce-style Tasks object (follow-ups):
// split view: task list with due buckets on the left, task detail on the right
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Clock3, Trash2, CheckSquare } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import { listCRMFollowUps, createCRMFollowUp, updateCRMFollowUp, deleteCRMFollowUp, listCRMContacts, type CRMFollowUp } from '@/lib/db/crm';
import { fmtDate, timeAgo } from './components/kit';
import {
  SF, SF_ICONS, SFPage, SFObjectHeader, SFCard, SFBtn, SFBadge, SFTabs, SFStat, SFIconTile,
  SFHighlights, SFHL, SFModal, SFField, SFFormGrid, SFEmpty, SFSplit, SFListRow, sfInp,
} from './components/lightning';

const TYPES = [
  { key: 'call', label: '📞 Call' },
  { key: 'meeting', label: '🤝 Meeting' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'email', label: '✉️ Email' },
  { key: 'other', label: '📌 Other' },
];
const TYPE_ICON: Record<string, string> = { call: '📞', meeting: '🤝', whatsapp: '💬', email: '✉️', other: '📌' };

const emptyForm = { contact_id: '', title: '', type: 'call', due_at: '', notes: '' };

export function SalesforceTasksPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: followups = [] } = useQuery({ queryKey: ['crm-followups', tenantId, tab], queryFn: () => listCRMFollowUps(tenantId, { status: tab }), enabled: !!tenantId });
  const { data: allFollowups = [] } = useQuery({ queryKey: ['crm-followups', tenantId, 'counts'], queryFn: () => listCRMFollowUps(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';
  // Split view: when nothing is explicitly selected, the first task is shown
  const view = allFollowups.find(f => f.id === viewId) ?? followups.find(f => f.id === viewId) ?? followups[0] ?? null;
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-followups'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); };

  const add = useMutation({
    mutationFn: () => createCRMFollowUp(tenantId, {
      contact_id: form.contact_id, deal_id: '', title: form.title, type: form.type,
      due_at: form.due_at || null, status: 'pending', notes: form.notes,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm); toast.success('Task created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDone = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMFollowUp(tenantId, id, { status }),
    onSuccess: (_, { status }) => { invalidate(); toast.success(status === 'done' ? 'Task completed ✅' : 'Reopened'); },
  });

  const snooze = useMutation({
    mutationFn: ({ f, days }: { f: CRMFollowUp; days: number }) => {
      const base = f.due_at ? new Date(f.due_at) : new Date();
      const next = new Date(Math.max(base.getTime(), Date.now()));
      next.setDate(next.getDate() + days);
      return updateCRMFollowUp(tenantId, f.id, { due_at: next.toISOString().slice(0, 10) });
    },
    onSuccess: (_, { days }) => { invalidate(); toast.success(`Snoozed +${days}d`); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMFollowUp(tenantId, id),
    onSuccess: () => { invalidate(); setViewId(null); toast.success('Task deleted'); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const dueBucket = (f: CRMFollowUp) => {
    if (f.status === 'done') return { label: 'Done', tone: 'green' as const };
    if (f.due_at && f.due_at.slice(0, 10) < today) return { label: 'Overdue', tone: 'red' as const };
    if (f.due_at && f.due_at.slice(0, 10) === today) return { label: 'Due Today', tone: 'amber' as const };
    return { label: 'Upcoming', tone: 'gray' as const };
  };

  const pendingCount = allFollowups.filter(f => f.status === 'pending').length;
  const doneCount = allFollowups.filter(f => f.status === 'done').length;
  const overdueCount = allFollowups.filter(f => f.status === 'pending' && f.due_at && f.due_at.slice(0, 10) < today).length;

  const snoozeButtons = (f: CRMFollowUp) => [1, 3, 7].map(d => (
    <SFBtn key={d} small onClick={() => snooze.mutate({ f, days: d })}><Clock3 size={10} /> +{d}d</SFBtn>
  ));

  return (
    <SFPage>
      <SFObjectHeader
        icon={<CheckSquare size={18} />} iconColor={SF_ICONS.task} objectLabel="Tasks"
        title={tab === 'pending' ? 'Open Tasks' : 'Completed Tasks'} sub={`${followups.length} item${followups.length === 1 ? '' : 's'}`}
        actions={<SFBtn variant="brand" onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> New Task</SFBtn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <SFStat label="Open Tasks" value={pendingCount} accent={SF_ICONS.task} />
        <SFStat label="Overdue" value={overdueCount} accent={SF.red} />
        <SFStat label="Completed" value={doneCount} accent={SF.green} />
      </div>

      <SFTabs style={{ marginBottom: '10px' }} active={tab} onChange={k => setTab(k as typeof tab)}
        tabs={[{ key: 'pending', label: 'Open', count: pendingCount }, { key: 'done', label: 'Completed', count: doneCount }]} />

      {/* ── Split view: task list left, record detail right ── */}
      <SFSplit list={
        <SFCard noPad>
          <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 330px)', overflowY: 'auto' }}>
            {followups.length === 0 ? (
              <SFEmpty title={tab === 'pending' ? 'Nothing pending — enjoy!' : 'Nothing completed yet'}
                hint="Create tasks so the right call happens at the right time."
                action={tab === 'pending' ? <SFBtn variant="brand" onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> New Task</SFBtn> : undefined} />
            ) : followups.map(f => {
              const bucket = dueBucket(f);
              return (
                <SFListRow key={f.id}
                  icon={<span style={{ fontSize: '13px' }}>{TYPE_ICON[f.type] ?? '📌'}</span>} iconColor={SF_ICONS.task}
                  title={<span style={{ textDecoration: f.status === 'done' ? 'line-through' : 'none', opacity: f.status === 'done' ? 0.65 : 1 }}>{f.title}</span>}
                  sub={`${contactName(f.contact_id)}${f.due_at ? ` · due ${fmtDate(f.due_at)}` : ''}`}
                  right={<SFBadge tone={bucket.tone}>{bucket.label}</SFBadge>}
                  selected={view?.id === f.id}
                  onClick={() => setViewId(f.id)} />
              );
            })}
          </div>
        </SFCard>
      }>
        {!view ? (
          <SFCard><SFEmpty title="Select a task" hint="Pick a task from the list on the left — its details open here." /></SFCard>
        ) : (
          <>
            {/* Record header + actions */}
            <SFCard noPad style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                <SFIconTile color={SF_ICONS.task}><CheckSquare size={16} /></SFIconTile>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Task</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: SF.heading, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{view.title}</div>
                </div>
                <SFBadge tone={dueBucket(view).tone}>{dueBucket(view).label}</SFBadge>
                <SFBtn small variant="destructive" onClick={() => { if (confirm('Delete this task?')) remove.mutate(view.id); }}><Trash2 size={12} /> Delete</SFBtn>
                {view.status === 'pending' && snoozeButtons(view)}
                {view.status === 'pending'
                  ? <SFBtn small variant="success" onClick={() => setDone.mutate({ id: view.id, status: 'done' })}><Check size={12} /> Mark Complete</SFBtn>
                  : <SFBtn small onClick={() => setDone.mutate({ id: view.id, status: 'pending' })}>Reopen</SFBtn>}
              </div>
            </SFCard>

            <SFHighlights>
              <SFHL label="Type">{TYPE_ICON[view.type] ?? '📌'} {view.type}</SFHL>
              <SFHL label="Name">{contactName(view.contact_id)}</SFHL>
              <SFHL label="Due Date">{view.due_at ? fmtDate(view.due_at) : '—'}</SFHL>
              <SFHL label="Last Updated">{timeAgo(view.updated_at)}</SFHL>
            </SFHighlights>
            {view.notes && (
              <SFCard title="Comments">
                <div style={{ fontSize: '13px', color: SF.text, whiteSpace: 'pre-wrap' }}>{view.notes}</div>
              </SFCard>
            )}
          </>
        )}
      </SFSplit>


      {/* New Task */}
      {showForm && (
        <SFModal title="New Task" onClose={() => setShowForm(false)}
          footer={
            <>
              <SFBtn onClick={() => setShowForm(false)}>Cancel</SFBtn>
              <SFBtn variant="brand" disabled={add.isPending}
                onClick={() => form.title.trim() ? add.mutate() : toast.error('Subject is required')}>Save Task</SFBtn>
            </>
          }>
          <SFFormGrid>
            <SFField label="Subject" required span2><input className="sf-inp" style={sfInp()} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus placeholder="e.g. Call Sharma about renewal quote" /></SFField>
            <SFField label="Name (Contact)">
              <select className="sf-inp" style={sfInp()} value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— None —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </SFField>
            <SFField label="Type">
              <select className="sf-inp" style={sfInp()} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </SFField>
            <SFField label="Due Date"><input className="sf-inp" type="date" style={sfInp()} value={form.due_at} onChange={e => setForm(p => ({ ...p, due_at: e.target.value }))} /></SFField>
            <SFField label="Comments"><input className="sf-inp" style={sfInp()} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}
    </SFPage>
  );
}
