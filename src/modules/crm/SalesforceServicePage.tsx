// [crm] [tenant: FrontStores.com] — Salesforce-style Service Cloud:
// Cases (New → Working → Closed, escalation, origin, case feed) + Entitlements (AMC contracts)
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Headset, RefreshCcw, AlertTriangle, Send, Check, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMTickets, createCRMTicket, updateCRMTicket, deleteCRMTicket,
  listCRMContracts, createCRMContract, updateCRMContract, deleteCRMContract,
  listCRMCaseComments, createCRMCaseComment,
  type CRMTicket, type CRMContract,
} from '@/lib/db/crmService';
import { listCRMContacts, listCRMTeamMembers } from '@/lib/db/crm';
import { Confetti, Avatar, fmtINR, fmtDate, daysUntil, timeAgo } from './components/kit';
import {
  SF, SF_ICONS, SFPage, SFObjectHeader, SFCard, SFBtn, SFBadge, SFTabs, SFPath, SFStat,
  SFHighlights, SFHL, SFModal, SFField, SFFormGrid, SFEmpty, SFSplit, SFListRow, sfInp, sfTh, sfTd, type SFTone,
} from './components/lightning';

// ── Salesforce standard case statuses ─────────────────────────────────────────
const CASE_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'working', label: 'Working' },
  { key: 'closed', label: 'Closed' },
];
// Older tickets for this tenant may carry the Aurora board keys — map to case statuses
const LEGACY_STATUS: Record<string, string> = { open: 'new', in_progress: 'working', resolved: 'closed' };
const normStatus = (s: string) => LEGACY_STATUS[s] ?? (['new', 'working', 'escalated', 'closed'].includes(s) ? s : 'new');
const statusLabel = (s: string) => ({ new: 'New', working: 'Working', escalated: 'Escalated', closed: 'Closed' })[normStatus(s)] ?? s;
const STATUS_TONE: Record<string, SFTone> = { new: 'blue', working: 'amber', escalated: 'red', closed: 'green' };

const PRIORITY_TONE: Record<string, SFTone> = { low: 'gray', medium: 'blue', high: 'amber', urgent: 'red' };
const ORIGINS = ['phone', 'email', 'web', 'whatsapp', 'walk-in'];
const originLabel = (o: string) => ({ phone: 'Phone', email: 'Email', web: 'Web', whatsapp: 'WhatsApp', 'walk-in': 'Walk-in' })[o] ?? (o || 'Phone');

const FILTERS = [
  { key: 'open', label: 'All Open' },
  { key: 'new', label: 'New' },
  { key: 'working', label: 'Working' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

const emptyCase = { contact_id: '', subject: '', description: '', priority: 'medium', origin: 'phone', assigned_to: '', due_date: '' };
const emptyContract = { contact_id: '', title: '', start_date: '', end_date: '', value: '', notes: '' };

export function SalesforceServicePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const qc = useQueryClient();

  const [tab, setTab] = useState<'cases' | 'entitlements'>('cases');
  const [filter, setFilter] = useState('open');
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseForm, setCaseForm] = useState(emptyCase);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [pathSel, setPathSel] = useState<string | null>(null);
  const [caseTab, setCaseTab] = useState<'feed' | 'details'>('feed');
  const [comment, setComment] = useState('');
  const [detForm, setDetForm] = useState<typeof emptyCase | null>(null);
  const [showContractForm, setShowContractForm] = useState(false);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [celebrate, setCelebrate] = useState(false);

  const { data: tickets = [] } = useQuery({ queryKey: ['crm-tickets', tenantId], queryFn: () => listCRMTickets(tenantId), enabled: !!tenantId });
  const { data: contracts = [] } = useQuery({ queryKey: ['crm-contracts', tenantId, 'all'], queryFn: () => listCRMContracts(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-tickets'] }); qc.invalidateQueries({ queryKey: ['crm-contracts'] }); qc.invalidateQueries({ queryKey: ['crm-service-stats'] }); };

  // ── KPIs (computed client-side over normalized statuses) ───────────────────
  const counts = useMemo(() => {
    const c = { new: 0, working: 0, escalated: 0, closed: 0 };
    for (const t of tickets) c[normStatus(t.status) as keyof typeof c]++;
    return c;
  }, [tickets]);
  const today = new Date().toISOString().slice(0, 10);
  const closedToday = tickets.filter(t => t.resolved_at && t.resolved_at.slice(0, 10) === today).length;
  const activeContracts = contracts.filter(ct => ct.status === 'active');
  const expiringSoonCount = activeContracts.filter(ct => { const d = daysUntil(ct.end_date); return d !== null && d <= 30; }).length;

  const visible = tickets.filter(t => {
    const s = normStatus(t.status);
    if (filter === 'all') return true;
    if (filter === 'open') return s !== 'closed';
    return s === filter;
  });

  // Split view: when nothing is explicitly selected, the first case in the queue is shown
  const kase = tickets.find(t => t.id === caseId) ?? visible[0] ?? null;
  const { data: comments = [] } = useQuery({
    queryKey: ['crm-case-comments', tenantId, kase?.id],
    queryFn: () => listCRMCaseComments(tenantId, kase!.id),
    enabled: !!tenantId && !!kase,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const addCase = useMutation({
    mutationFn: () => createCRMTicket(tenantId, { ...caseForm, status: 'new', due_date: caseForm.due_date || null }),
    onSuccess: () => { invalidate(); setShowCaseForm(false); setCaseForm(emptyCase); toast.success('Case created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateCRMTicket(tenantId, id, status === 'escalated'
        ? { status, escalated_at: new Date().toISOString() }
        : { status }),
    onSuccess: (_, { status }) => {
      invalidate(); setPathSel(null);
      if (status === 'closed') { setCelebrate(true); setTimeout(() => setCelebrate(false), 2000); toast.success('Case closed ✓'); }
      else if (status === 'escalated') toast.warning('Case escalated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCase = useMutation({
    mutationFn: (id: string) => deleteCRMTicket(tenantId, id),
    onSuccess: () => { invalidate(); setCaseId(null); toast.success('Case deleted'); },
  });

  const saveDetails = useMutation({
    mutationFn: () => updateCRMTicket(tenantId, kase!.id, {
      subject: detForm!.subject, description: detForm!.description, contact_id: detForm!.contact_id,
      priority: detForm!.priority, origin: detForm!.origin, assigned_to: detForm!.assigned_to,
      due_date: detForm!.due_date || null,
    }),
    onSuccess: () => { invalidate(); setDetForm(null); toast.success('Case updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: () => {
      if (!comment.trim()) throw new Error('Write a comment first');
      return createCRMCaseComment(tenantId, { ticket_id: kase!.id, body: comment.trim(), author: ownerName || 'Me' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-case-comments'] }); setComment(''); toast.success('Comment shared'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addContract = useMutation({
    mutationFn: () => createCRMContract(tenantId, {
      contact_id: contractForm.contact_id, title: contractForm.title,
      start_date: contractForm.start_date || null, end_date: contractForm.end_date || null,
      value: Number(contractForm.value) || 0, notes: contractForm.notes,
    }),
    onSuccess: () => { invalidate(); setShowContractForm(false); setContractForm(emptyContract); toast.success('Entitlement added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Renew: old contract → expired, new contract starts where old one ended (+1 year)
  const renewContract = useMutation({
    mutationFn: async (ct: CRMContract) => {
      const oldEnd = ct.end_date ? new Date(ct.end_date) : new Date();
      const newEnd = new Date(oldEnd); newEnd.setFullYear(newEnd.getFullYear() + 1);
      await updateCRMContract(tenantId, ct.id, { status: 'expired' });
      await createCRMContract(tenantId, {
        contact_id: ct.contact_id, account_id: ct.account_id,
        title: ct.title, value: ct.value,
        start_date: oldEnd.toISOString().slice(0, 10), end_date: newEnd.toISOString().slice(0, 10),
        notes: `Renewed from previous contract${ct.notes ? `\n${ct.notes}` : ''}`,
      });
    },
    onSuccess: () => { invalidate(); setCelebrate(true); setTimeout(() => setCelebrate(false), 2000); toast.success('Entitlement renewed for 1 year'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeContract = useMutation({
    mutationFn: (id: string) => deleteCRMContract(tenantId, id),
    onSuccess: () => { invalidate(); toast.success('Entitlement deleted'); },
  });

  // ── Case path actions ───────────────────────────────────────────────────────
  const curStatus = kase ? normStatus(kase.status) : 'new';
  const isEscalated = curStatus === 'escalated';
  const isClosed = curStatus === 'closed';
  const pathCurrent = isEscalated ? 'working' : curStatus; // escalated cases sit at Working on the path
  const curIdx = CASE_STAGES.findIndex(s => s.key === pathCurrent);

  const pathAction = () => {
    if (!kase) return;
    if (pathSel && pathSel !== pathCurrent) { setStatus.mutate({ id: kase.id, status: pathSel }); return; }
    setStatus.mutate({ id: kase.id, status: CASE_STAGES[Math.min(curIdx + 1, CASE_STAGES.length - 1)].key });
  };
  const pathActionLabel = pathSel && pathSel !== pathCurrent
    ? 'Mark as Current Status'
    : curIdx >= CASE_STAGES.length - 2 ? 'Close Case' : 'Mark Status as Complete';

  return (
    <SFPage>
      {celebrate && <Confetti />}

      {/* ── Object header ── */}
      <SFObjectHeader
        icon={<Headset size={18} />} iconColor={SF_ICONS.case}
        objectLabel="Cases" title="Service Console"
        sub={`${counts.new + counts.working + counts.escalated} open cases · ${activeContracts.length} active entitlements`}
        actions={tab === 'cases'
          ? <SFBtn variant="brand" onClick={() => { setCaseForm(emptyCase); setShowCaseForm(true); }}><Plus size={14} /> New Case</SFBtn>
          : <SFBtn variant="brand" onClick={() => { setContractForm(emptyContract); setShowContractForm(true); }}><Plus size={14} /> New Entitlement</SFBtn>}
      />

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <SFStat label="New" value={counts.new} accent={SF.brand} />
        <SFStat label="Working" value={counts.working} accent={SF.amber} />
        <SFStat label="Escalated" value={counts.escalated} accent={SF.red} sub={counts.escalated > 0 ? 'needs attention' : 'all clear'} />
        <SFStat label="Closed Today" value={closedToday} accent={SF.green} />
        <SFStat label="Entitlements" value={activeContracts.length} accent={SF.teal} sub={`${expiringSoonCount} expiring ≤30d`} />
      </div>

      {/* ── Tabs ── */}
      <SFTabs style={{ marginBottom: '14px', background: SF.card, borderRadius: '8px 8px 0 0', border: `1px solid ${SF.border}`, borderBottom: `2px solid ${SF.border}`, paddingLeft: '8px' }}
        active={tab} onChange={k => setTab(k as typeof tab)}
        tabs={[
          { key: 'cases', label: 'Cases', count: tickets.length },
          { key: 'entitlements', label: 'Entitlements (AMC)', count: contracts.length },
        ]} />

      {tab === 'cases' ? (
        <>
          {/* Queue filters */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {FILTERS.map(f => {
              const on = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  style={{ padding: '5px 13px', borderRadius: '14px', border: `1px solid ${on ? SF.brand : SF.borderStrong}`, background: on ? SF.brandSoft : SF.card, color: on ? SF.brand : SF.muted, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* ── Split view: case queue left, record detail right ── */}
          <SFSplit list={
            <SFCard noPad>
              <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                {visible.length === 0 ? (
                  <SFEmpty title="No cases here" hint="Customer issues land here as cases. Work them New → Working → Closed."
                    action={<SFBtn variant="brand" onClick={() => { setCaseForm(emptyCase); setShowCaseForm(true); }}><Plus size={13} /> New Case</SFBtn>} />
                ) : visible.map(t => {
                  const s = normStatus(t.status);
                  const late = t.due_date && s !== 'closed' && (daysUntil(t.due_date) ?? 0) < 0;
                  return (
                    <SFListRow key={t.id} icon={<Headset size={13} />} iconColor={SF_ICONS.case}
                      title={<>{t.subject}{late && <AlertTriangle size={10} style={{ color: SF.red, marginLeft: '5px', verticalAlign: '-1px' }} />}</>}
                      sub={`${t.ticket_no} · ${contactName(t.contact_id)}`}
                      right={<SFBadge tone={STATUS_TONE[s]}>{statusLabel(t.status)}</SFBadge>}
                      selected={kase?.id === t.id}
                      onClick={() => { setCaseId(t.id); setPathSel(null); setCaseTab('feed'); setDetForm(null); }} />
                  );
                })}
              </div>
            </SFCard>
          }>
            {!kase ? (
              <SFCard><SFEmpty title="Select a case" hint="Pick a case from the queue on the left — its details open here." /></SFCard>
            ) : (
              <>
                {/* Record header + actions */}
                <SFCard noPad style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: SF_ICONS.case, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Headset size={16} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Case · {kase.ticket_no}</div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: SF.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kase.subject}</div>
                    </div>
                    <SFBtn variant="destructive" small onClick={() => { if (confirm('Delete this case?')) removeCase.mutate(kase.id); }}><Trash2 size={12} /> Delete</SFBtn>
                    {!isClosed && (isEscalated ? (
                      <SFBtn small onClick={() => setStatus.mutate({ id: kase.id, status: 'working' })}><ArrowDownRight size={12} /> De-escalate</SFBtn>
                    ) : (
                      <SFBtn small onClick={() => setStatus.mutate({ id: kase.id, status: 'escalated' })} style={{ color: SF.red }}><ArrowUpRight size={12} /> Escalate</SFBtn>
                    ))}
                    {!isClosed && <SFBtn variant="success" small onClick={() => setStatus.mutate({ id: kase.id, status: 'closed' })}><Check size={12} /> Close Case</SFBtn>}
                    {isClosed && <SFBtn small onClick={() => setStatus.mutate({ id: kase.id, status: 'working' })}>Reopen Case</SFBtn>}
                  </div>
                </SFCard>

                {isEscalated && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: SF.redSoft, border: `1px solid ${SF.red}44`, color: SF.red, borderRadius: '8px', padding: '9px 14px', fontSize: '12.5px', fontWeight: 700, marginBottom: '14px' }}>
                    <AlertTriangle size={14} /> Escalated {kase.escalated_at ? timeAgo(kase.escalated_at) : ''} — needs attention
                  </div>
                )}

                {/* Highlights */}
                <SFHighlights>
                  <SFHL label="Contact">{contactName(kase.contact_id)}</SFHL>
                  <SFHL label="Priority"><SFBadge tone={PRIORITY_TONE[kase.priority] ?? 'blue'}>{kase.priority}</SFBadge></SFHL>
                  <SFHL label="Origin">{originLabel(kase.origin)}</SFHL>
                  <SFHL label="Owner">{kase.assigned_to || '—'}</SFHL>
                  <SFHL label="Due">{fmtDate(kase.due_date)}</SFHL>
                  <SFHL label="Closed">{kase.resolved_at ? fmtDate(kase.resolved_at) : '—'}</SFHL>
                </SFHighlights>

                {/* Case Path */}
                <SFCard noPad style={{ marginBottom: '14px' }}>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 320px', minWidth: '280px' }}>
                      <SFPath stages={isClosed ? CASE_STAGES.slice(0, 2) : CASE_STAGES} current={pathCurrent} selected={pathSel}
                        onSelect={k => setPathSel(k === pathSel ? null : k)}
                        closedLabel={isClosed ? 'Closed' : undefined} closedTone="green" />
                    </div>
                    {!isClosed && (
                      <SFBtn variant="brand" small onClick={pathAction} disabled={setStatus.isPending}>
                        <Check size={12} /> {pathActionLabel}
                      </SFBtn>
                    )}
                  </div>
                </SFCard>

                {/* Record tabs */}
                <SFTabs style={{ marginBottom: '12px' }} active={caseTab} onChange={k => setCaseTab(k as typeof caseTab)}
                  tabs={[{ key: 'feed', label: 'Feed', count: comments.length }, { key: 'details', label: 'Details' }]} />

                {caseTab === 'feed' && (
                  <>
                    <SFCard style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input className="sf-inp" style={sfInp({ flex: 1 })} value={comment} onChange={e => setComment(e.target.value)}
                          placeholder="Write an update for this case…" onKeyDown={e => { if (e.key === 'Enter') addComment.mutate(); }} />
                        <SFBtn variant="brand" onClick={() => addComment.mutate()} disabled={addComment.isPending}><Send size={12} /> Share</SFBtn>
                      </div>
                    </SFCard>
                    <SFCard noPad>
                      {comments.length === 0 ? (
                        <div style={{ padding: '20px 16px', fontSize: '12.5px', color: SF.faint }}>No updates yet. Share progress so the whole team stays in the loop.</div>
                      ) : comments.map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${SF.border}` }}>
                          <Avatar name={c.author || 'Me'} size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', marginBottom: '2px' }}>
                              <b style={{ color: SF.heading }}>{c.author || 'Me'}</b>
                              <span style={{ color: SF.muted, marginLeft: '8px' }}>{timeAgo(c.created_at)}</span>
                            </div>
                            <div style={{ fontSize: '13px', color: SF.text, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                          </div>
                        </div>
                      ))}
                    </SFCard>
                  </>
                )}

                {caseTab === 'details' && (() => {
                  const f = detForm ?? {
                    contact_id: kase.contact_id, subject: kase.subject, description: kase.description,
                    priority: kase.priority, origin: kase.origin || 'phone', assigned_to: kase.assigned_to,
                    due_date: kase.due_date?.slice(0, 10) ?? '',
                  };
                  const set = (patch: Partial<typeof f>) => setDetForm({ ...f, ...patch });
                  return (
                    <SFCard title="Details" actions={detForm && <SFBtn variant="brand" small onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending}>Save</SFBtn>}>
                      <SFFormGrid>
                        <SFField label="Subject" span2><input className="sf-inp" style={sfInp()} value={f.subject} onChange={e => set({ subject: e.target.value })} /></SFField>
                        <SFField label="Contact">
                          <select className="sf-inp" style={sfInp()} value={f.contact_id} onChange={e => set({ contact_id: e.target.value })}>
                            <option value="">— select —</option>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </SFField>
                        <SFField label="Priority">
                          <select className="sf-inp" style={sfInp()} value={f.priority} onChange={e => set({ priority: e.target.value })}>
                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                          </select>
                        </SFField>
                        <SFField label="Origin">
                          <select className="sf-inp" style={sfInp()} value={f.origin} onChange={e => set({ origin: e.target.value })}>
                            {ORIGINS.map(o => <option key={o} value={o}>{originLabel(o)}</option>)}
                          </select>
                        </SFField>
                        <SFField label="Owner">
                          <select className="sf-inp" style={sfInp()} value={f.assigned_to} onChange={e => set({ assigned_to: e.target.value })}>
                            <option value="">— unassigned —</option>
                            {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                          </select>
                        </SFField>
                        <SFField label="Due Date"><input type="date" className="sf-inp" style={sfInp()} value={f.due_date} onChange={e => set({ due_date: e.target.value })} /></SFField>
                        <SFField label="Description" span2><textarea className="sf-inp" style={sfInp({ minHeight: '80px', resize: 'vertical' })} value={f.description} onChange={e => set({ description: e.target.value })} /></SFField>
                      </SFFormGrid>
                    </SFCard>
                  );
                })()}
              </>
            )}
          </SFSplit>
        </>
      ) : (
        /* ── Entitlements (AMC contracts) ── */
        <SFCard noPad>
          {contracts.length === 0 ? (
            <SFEmpty title="No entitlements" hint="Track AMCs and support contracts — renew before they expire."
              action={<SFBtn variant="brand" onClick={() => { setContractForm(emptyContract); setShowContractForm(true); }}><Plus size={13} /> New Entitlement</SFBtn>} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={sfTh}>Entitlement</th><th style={sfTh}>Contact</th><th style={sfTh}>Period</th><th style={sfTh}>Value</th><th style={sfTh}>Status</th><th style={sfTh}></th></tr></thead>
              <tbody>
                {contracts.map(ct => {
                  const d = daysUntil(ct.end_date);
                  const expSoon = ct.status === 'active' && d !== null && d <= 30;
                  return (
                    <tr key={ct.id} className="sf-row">
                      <td style={{ ...sfTd, fontWeight: 600 }}><span className="sf-link">{ct.title}</span></td>
                      <td style={sfTd}>{contactName(ct.contact_id)}</td>
                      <td style={{ ...sfTd, fontSize: '12px' }}>
                        {fmtDate(ct.start_date)} → {fmtDate(ct.end_date)}
                        {expSoon && <div style={{ color: SF.red, fontWeight: 700, fontSize: '11px' }}>{d! < 0 ? `expired ${-d!}d ago` : `${d}d left`}</div>}
                      </td>
                      <td style={{ ...sfTd, fontWeight: 700 }}>{fmtINR(ct.value)}</td>
                      <td style={sfTd}><SFBadge tone={ct.status === 'active' ? 'green' : 'gray'}>{ct.status}</SFBadge></td>
                      <td style={{ ...sfTd, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {ct.status === 'active' && (
                          <SFBtn variant={expSoon ? 'success' : 'neutral'} small onClick={() => renewContract.mutate(ct)} disabled={renewContract.isPending}>
                            <RefreshCcw size={11} /> Renew +1y
                          </SFBtn>
                        )}
                        <button onClick={e => { e.stopPropagation(); if (confirm('Delete this entitlement?')) removeContract.mutate(ct.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: SF.faint, padding: '6px', verticalAlign: 'middle' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SFCard>
      )}

      {/* ── New Case modal ── */}
      {showCaseForm && (
        <SFModal title="New Case" onClose={() => setShowCaseForm(false)} width={600}
          footer={<>
            <SFBtn onClick={() => setShowCaseForm(false)}>Cancel</SFBtn>
            <SFBtn variant="brand" disabled={addCase.isPending} onClick={() => {
              if (!caseForm.subject.trim()) return toast.error('Subject is required');
              addCase.mutate();
            }}>Save</SFBtn>
          </>}>
          <SFFormGrid>
            <SFField label="Subject" required span2><input className="sf-inp" style={sfInp()} value={caseForm.subject} onChange={e => setCaseForm(p => ({ ...p, subject: e.target.value }))} autoFocus placeholder="e.g. Printer not connecting" /></SFField>
            <SFField label="Contact">
              <select className="sf-inp" style={sfInp()} value={caseForm.contact_id} onChange={e => setCaseForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </SFField>
            <SFField label="Priority">
              <select className="sf-inp" style={sfInp()} value={caseForm.priority} onChange={e => setCaseForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </SFField>
            <SFField label="Case Origin">
              <select className="sf-inp" style={sfInp()} value={caseForm.origin} onChange={e => setCaseForm(p => ({ ...p, origin: e.target.value }))}>
                {ORIGINS.map(o => <option key={o} value={o}>{originLabel(o)}</option>)}
              </select>
            </SFField>
            <SFField label="Assign To">
              <select className="sf-inp" style={sfInp()} value={caseForm.assigned_to} onChange={e => setCaseForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">— unassigned —</option>
                {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </SFField>
            <SFField label="Due Date"><input type="date" className="sf-inp" style={sfInp()} value={caseForm.due_date} onChange={e => setCaseForm(p => ({ ...p, due_date: e.target.value }))} /></SFField>
            <SFField label="Description" span2><textarea className="sf-inp" style={sfInp({ minHeight: '80px', resize: 'vertical' })} value={caseForm.description} onChange={e => setCaseForm(p => ({ ...p, description: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}

      {/* ── New Entitlement modal ── */}
      {showContractForm && (
        <SFModal title="New Entitlement (AMC / Contract)" onClose={() => setShowContractForm(false)} width={560}
          footer={<>
            <SFBtn onClick={() => setShowContractForm(false)}>Cancel</SFBtn>
            <SFBtn variant="brand" disabled={addContract.isPending} onClick={() => {
              if (!contractForm.title.trim()) return toast.error('Title is required');
              addContract.mutate();
            }}>Save</SFBtn>
          </>}>
          <SFFormGrid>
            <SFField label="Title" required span2><input className="sf-inp" style={sfInp()} value={contractForm.title} onChange={e => setContractForm(p => ({ ...p, title: e.target.value }))} autoFocus placeholder="e.g. Annual Maintenance — Sharma Hardware" /></SFField>
            <SFField label="Contact">
              <select className="sf-inp" style={sfInp()} value={contractForm.contact_id} onChange={e => setContractForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </SFField>
            <SFField label="Value (₹/year)"><input type="number" className="sf-inp" style={sfInp()} value={contractForm.value} onChange={e => setContractForm(p => ({ ...p, value: e.target.value }))} /></SFField>
            <SFField label="Start Date"><input type="date" className="sf-inp" style={sfInp()} value={contractForm.start_date} onChange={e => setContractForm(p => ({ ...p, start_date: e.target.value }))} /></SFField>
            <SFField label="End Date"><input type="date" className="sf-inp" style={sfInp()} value={contractForm.end_date} onChange={e => setContractForm(p => ({ ...p, end_date: e.target.value }))} /></SFField>
            <SFField label="Notes" span2><textarea className="sf-inp" style={sfInp({ minHeight: '60px', resize: 'vertical' })} value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}

    </SFPage>
  );
}
