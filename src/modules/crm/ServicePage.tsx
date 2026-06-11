// [crm] [all tenants] — Service: ticket board (drag between statuses) + AMC contracts with renewals
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, RefreshCcw, Wrench, FileCheck2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMTickets, createCRMTicket, updateCRMTicket, deleteCRMTicket,
  listCRMContracts, createCRMContract, updateCRMContract, deleteCRMContract,
  getCRMServiceStats, type CRMTicket, type CRMContract,
} from '@/lib/db/crmService';
import { listCRMContacts, listCRMTeamMembers } from '@/lib/db/crm';
import {
  CRMPage, PageHead, Segments, StatCard, Panel, EmptyState, Badge, Btn, Modal, Drawer, Avatar,
  Field, FormGrid, inp, Confetti, C, fmtINR, fmtDate, daysUntil, timeAgo, th, td,
} from './components/kit';

const TICKET_COLS = [
  { key: 'open',        label: 'Open',        color: C.red, bg: C.redBg },
  { key: 'in_progress', label: 'In Progress', color: C.amber, bg: C.amberBg },
  { key: 'resolved',    label: 'Resolved ✅', color: C.green, bg: C.greenBg },
];

const PRIORITY_META: Record<string, { bg: string; color: string; label: string }> = {
  low:    { bg: C.slateBg, color: C.slate,   label: 'Low' },
  medium: { bg: C.blueBg,  color: C.blue, label: 'Medium' },
  high:   { bg: C.amberBg, color: C.amber, label: 'High' },
  urgent: { bg: C.redBg,   color: C.red, label: 'Urgent' },
};

const emptyTicket = { contact_id: '', subject: '', description: '', priority: 'medium', assigned_to: '', due_date: '' };
const emptyContract = { contact_id: '', title: '', start_date: '', end_date: '', value: '', notes: '' };

export function CRMServicePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'tickets' | 'contracts'>('tickets');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [viewTicket, setViewTicket] = useState<CRMTicket | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const { data: tickets = [] } = useQuery({ queryKey: ['crm-tickets', tenantId], queryFn: () => listCRMTickets(tenantId), enabled: !!tenantId });
  const { data: contracts = [] } = useQuery({ queryKey: ['crm-contracts', tenantId, 'all'], queryFn: () => listCRMContracts(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });
  const { data: stats } = useQuery({ queryKey: ['crm-service-stats', tenantId], queryFn: () => getCRMServiceStats(tenantId), enabled: !!tenantId });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-tickets'] }); qc.invalidateQueries({ queryKey: ['crm-contracts'] }); qc.invalidateQueries({ queryKey: ['crm-service-stats'] }); };

  const addTicket = useMutation({
    mutationFn: () => createCRMTicket(tenantId, { ...ticketForm, due_date: ticketForm.due_date || null }),
    onSuccess: () => { invalidate(); setShowTicketForm(false); setTicketForm(emptyTicket); toast.success('Ticket created 🎫'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveTicket = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMTicket(tenantId, id, { status }),
    onSuccess: (_, { status }) => {
      invalidate();
      if (status === 'resolved') { setCelebrate(true); setTimeout(() => setCelebrate(false), 2000); toast.success('Ticket resolved! 🛠️✨'); }
    },
  });

  const removeTicket = useMutation({
    mutationFn: (id: string) => deleteCRMTicket(tenantId, id),
    onSuccess: () => { invalidate(); setViewTicket(null); toast.success('Ticket deleted'); },
  });

  const addContract = useMutation({
    mutationFn: () => createCRMContract(tenantId, {
      contact_id: contractForm.contact_id, title: contractForm.title,
      start_date: contractForm.start_date || null, end_date: contractForm.end_date || null,
      value: Number(contractForm.value) || 0, notes: contractForm.notes,
    }),
    onSuccess: () => { invalidate(); setShowContractForm(false); setContractForm(emptyContract); toast.success('Contract added 📋'); },
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
    onSuccess: () => { invalidate(); setCelebrate(true); setTimeout(() => setCelebrate(false), 2000); toast.success('Contract renewed for 1 year 🎉'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeContract = useMutation({
    mutationFn: (id: string) => deleteCRMContract(tenantId, id),
    onSuccess: () => { invalidate(); toast.success('Contract deleted'); },
  });

  const visibleTickets = tickets.filter(t => t.status !== 'closed');
  const activeContracts = contracts.filter(ct => ct.status === 'active');

  return (
    <CRMPage>
      {celebrate && <Confetti />}
      <PageHead title="Service" subtitle="Support tickets and AMC contracts — keep every customer running."
        actions={tab === 'tickets'
          ? <Btn onClick={() => { setTicketForm(emptyTicket); setShowTicketForm(true); }}><Plus size={14} /> New Ticket</Btn>
          : <Btn onClick={() => { setContractForm(emptyContract); setShowContractForm(true); }}><Plus size={14} /> New Contract</Btn>} />

      {/* Stats */}
      <div className="crm-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <StatCard label="Open" value={stats?.openTickets ?? 0} icon={<Wrench size={15} />} tint={C.red} tintBg={C.redBg} />
        <StatCard label="In Progress" value={stats?.inProgressTickets ?? 0} icon={<RefreshCcw size={15} />} tint={C.amber} tintBg={C.amberBg} />
        <StatCard label="Resolved Today" value={stats?.resolvedToday ?? 0} icon={<FileCheck2 size={15} />} tint={C.green} tintBg={C.greenBg} />
        <StatCard label="Active AMCs" value={stats?.activeContracts ?? 0} sub={`${stats?.expiringContracts ?? 0} expiring soon`} icon={<FileCheck2 size={15} />} tint={C.violet} tintBg={C.violetBg} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Segments value={tab} onChange={k => setTab(k as typeof tab)}
          options={[
            { key: 'tickets', label: 'Tickets', count: visibleTickets.length },
            { key: 'contracts', label: 'AMC / Contracts', count: contracts.length },
          ]} />
      </div>

      {tab === 'tickets' ? (
        /* ── Ticket board ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', alignItems: 'start' }}>
          {TICKET_COLS.map(col => {
            const colTickets = visibleTickets.filter(t => t.status === col.key);
            const isOver = overCol === col.key;
            return (
              <div key={col.key}
                onDragOver={e => { e.preventDefault(); setOverCol(col.key); }}
                onDragLeave={() => setOverCol(null)}
                onDrop={e => {
                  e.preventDefault(); setOverCol(null);
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  const t = tickets.find(x => x.id === id);
                  if (t && t.status !== col.key) moveTicket.mutate({ id: t.id, status: col.key });
                  setDragId(null);
                }}
                style={{
                  background: isOver ? col.bg : C.surface,
                  border: `2px dashed ${isOver ? col.color : 'transparent'}`,
                  borderRadius: '12px', padding: '10px', minHeight: '280px', transition: 'all 0.15s ease',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px 10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: C.text }}>{col.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: C.muted, background: C.surface, borderRadius: '999px', padding: '1px 7px', border: `1px solid ${C.border}` }}>{colTickets.length}</span>
                </div>
                {colTickets.map(t => {
                  const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
                  const late = t.due_date && col.key !== 'resolved' && (daysUntil(t.due_date) ?? 0) < 0;
                  return (
                    <div key={t.id} draggable
                      onDragStart={e => { setDragId(t.id); e.dataTransfer.setData('text/plain', t.id); }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setViewTicket(t)}
                      className="crm-hover-lift"
                      style={{ background: C.surface, border: `1px solid ${late ? 'rgba(248,113,113,0.4)' : C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '8px', cursor: 'pointer', boxShadow: C.shadow, opacity: dragId === t.id ? 0.4 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'monospace', color: C.muted }}>{t.ticket_no}</span>
                        <Badge bg={pm.bg} color={pm.color}>{pm.label}</Badge>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: '6px' }}>{t.subject}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: C.muted }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Avatar name={contactName(t.contact_id)} size={18} />{contactName(t.contact_id)}
                        </span>
                        {late ? <span style={{ color: C.red, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AlertTriangle size={10} /> late</span> : <span>{timeAgo(t.updated_at)}</span>}
                      </div>
                      {t.assigned_to && <div style={{ fontSize: '10px', color: C.faint, marginTop: '5px' }}>👤 {t.assigned_to}</div>}
                    </div>
                  );
                })}
                {colTickets.length === 0 && <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: '12px', color: C.faint }}>Drop tickets here</div>}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Contracts ── */
        <Panel>
          {contracts.length === 0 ? (
            <EmptyState emoji="📋" title="No service contracts" hint="Track AMCs and support contracts — get alerts before they expire."
              action={<Btn small onClick={() => { setContractForm(emptyContract); setShowContractForm(true); }}><Plus size={13} /> Add Contract</Btn>} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Contract</th><th style={th}>Contact</th><th style={th}>Period</th><th style={th}>Value</th><th style={th}>Status</th><th style={th}></th></tr></thead>
              <tbody>
                {contracts.map(ct => {
                  const d = daysUntil(ct.end_date);
                  const expiringSoon = ct.status === 'active' && d !== null && d <= 30;
                  return (
                    <tr key={ct.id} className="crm-row">
                      <td style={{ ...td, fontWeight: 700 }}>{ct.title}</td>
                      <td style={td}>{contactName(ct.contact_id)}</td>
                      <td style={{ ...td, fontSize: '12px' }}>
                        {fmtDate(ct.start_date)} → {fmtDate(ct.end_date)}
                        {expiringSoon && <div style={{ color: C.red, fontWeight: 700, fontSize: '11px' }}>{d! < 0 ? `expired ${-d!}d ago` : `${d}d left`}</div>}
                      </td>
                      <td style={{ ...td, fontWeight: 800 }}>{fmtINR(ct.value)}</td>
                      <td style={td}>
                        <Badge bg={ct.status === 'active' ? C.greenBg : C.slateBg} color={ct.status === 'active' ? C.green : C.slate}>{ct.status}</Badge>
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {ct.status === 'active' && (
                          <Btn variant={expiringSoon ? 'success' : 'subtle'} small onClick={() => renewContract.mutate(ct)} disabled={renewContract.isPending}>
                            <RefreshCcw size={11} /> Renew +1y
                          </Btn>
                        )}
                        <button onClick={() => { if (confirm('Delete this contract?')) removeContract.mutate(ct.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint, padding: '6px', verticalAlign: 'middle' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {/* New ticket modal */}
      {showTicketForm && (
        <Modal title="New Ticket" onClose={() => setShowTicketForm(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setShowTicketForm(false)}>Cancel</Btn>
            <Btn onClick={() => {
              if (!ticketForm.subject.trim()) return toast.error('Subject is required');
              addTicket.mutate();
            }} disabled={addTicket.isPending}>Create Ticket</Btn>
          </>}>
          <FormGrid>
            <Field label="Subject *" span2><input style={inp()} value={ticketForm.subject} onChange={e => setTicketForm(p => ({ ...p, subject: e.target.value }))} autoFocus placeholder="e.g. Printer not connecting" /></Field>
            <Field label="Contact">
              <select style={inp()} value={ticketForm.contact_id} onChange={e => setTicketForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select style={inp()} value={ticketForm.priority} onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value }))}>
                {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Assign To">
              <select style={inp()} value={ticketForm.assigned_to} onChange={e => setTicketForm(p => ({ ...p, assigned_to: e.target.value }))}>
                <option value="">— unassigned —</option>
                {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Due Date"><input type="date" style={inp()} value={ticketForm.due_date} onChange={e => setTicketForm(p => ({ ...p, due_date: e.target.value }))} /></Field>
            <Field label="Description" span2><textarea style={inp({ minHeight: '80px', resize: 'vertical' })} value={ticketForm.description} onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}

      {/* New contract modal */}
      {showContractForm && (
        <Modal title="New Service Contract" onClose={() => setShowContractForm(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setShowContractForm(false)}>Cancel</Btn>
            <Btn onClick={() => {
              if (!contractForm.title.trim()) return toast.error('Title is required');
              addContract.mutate();
            }} disabled={addContract.isPending}>Add Contract</Btn>
          </>}>
          <FormGrid>
            <Field label="Title *" span2><input style={inp()} value={contractForm.title} onChange={e => setContractForm(p => ({ ...p, title: e.target.value }))} autoFocus placeholder="e.g. Annual Maintenance — Sharma Hardware" /></Field>
            <Field label="Contact">
              <select style={inp()} value={contractForm.contact_id} onChange={e => setContractForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Value (₹/year)"><input type="number" style={inp()} value={contractForm.value} onChange={e => setContractForm(p => ({ ...p, value: e.target.value }))} /></Field>
            <Field label="Start Date"><input type="date" style={inp()} value={contractForm.start_date} onChange={e => setContractForm(p => ({ ...p, start_date: e.target.value }))} /></Field>
            <Field label="End Date"><input type="date" style={inp()} value={contractForm.end_date} onChange={e => setContractForm(p => ({ ...p, end_date: e.target.value }))} /></Field>
            <Field label="Notes" span2><textarea style={inp({ minHeight: '60px', resize: 'vertical' })} value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}

      {/* Ticket detail drawer */}
      {viewTicket && (
        <Drawer eyebrow={`Ticket · ${viewTicket.ticket_no}`} title={viewTicket.subject} onClose={() => setViewTicket(null)}
          footer={<>
            <Btn variant="danger" small onClick={() => { if (confirm('Delete this ticket?')) removeTicket.mutate(viewTicket.id); }}><Trash2 size={12} /> Delete</Btn>
            <div style={{ flex: 1 }} />
            {viewTicket.status !== 'resolved' && (
              <Btn variant="success" small onClick={() => { moveTicket.mutate({ id: viewTicket.id, status: 'resolved' }); setViewTicket(null); }}>
                ✅ Mark Resolved
              </Btn>
            )}
          </>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {[
              ['Contact', contactName(viewTicket.contact_id)],
              ['Priority', (PRIORITY_META[viewTicket.priority] ?? PRIORITY_META.medium).label],
              ['Status', viewTicket.status.replace('_', ' ')],
              ['Assigned To', viewTicket.assigned_to || '—'],
              ['Due', fmtDate(viewTicket.due_date)],
              ['Resolved', viewTicket.resolved_at ? fmtDate(viewTicket.resolved_at) : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800, marginBottom: '3px' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{v}</div>
              </div>
            ))}
          </div>
          {viewTicket.description && (
            <div style={{ background: C.surface2, borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: C.text, whiteSpace: 'pre-wrap', marginBottom: '14px' }}>{viewTicket.description}</div>
          )}
          <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800, marginBottom: '6px' }}>Move To</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {TICKET_COLS.map(col => (
              <Btn key={col.key} small variant={viewTicket.status === col.key ? 'primary' : 'ghost'}
                onClick={() => { moveTicket.mutate({ id: viewTicket.id, status: col.key }); setViewTicket({ ...viewTicket, status: col.key }); }}>
                {col.label}
              </Btn>
            ))}
          </div>
        </Drawer>
      )}
    </CRMPage>
  );
}
