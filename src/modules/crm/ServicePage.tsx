// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Wrench, Phone, Mail } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMTickets, createCRMTicket, updateCRMTicket, deleteCRMTicket,
  listCRMContracts, createCRMContract, updateCRMContract, deleteCRMContract,
  getCRMServiceStats,
  type CRMTicket,
} from '@/lib/db/crmService';
import { listCRMContacts, listCRMFollowUps, createCRMFollowUp, updateCRMFollowUp } from '@/lib/db/crm';
import { RC, StageBar, RecordHeader, RecordTabs, RecordBody, SidebarCard, Panel } from './components/RecordLayout';

const C = RC;

const TICKET_STAGES = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const PRIORITY_META: Record<string, { bg: string; color: string }> = {
  low: { bg: '#f1f5f9', color: '#64748b' },
  medium: { bg: '#fef3c7', color: '#92400e' },
  high: { bg: '#fee2e2', color: '#b91c1c' },
};

const CONTRACT_STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#dcfce7', color: '#15803d', label: 'Active' },
  expired: { bg: '#fee2e2', color: '#b91c1c', label: 'Expired' },
  cancelled: { bg: '#f1f5f9', color: '#64748b', label: 'Cancelled' },
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CRMServicePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [section, setSection] = useState<'tickets' | 'contracts'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: tickets = [] } = useQuery({
    queryKey: ['crm-tickets', tenantId, statusFilter],
    queryFn: () => listCRMTickets(tenantId, { status: statusFilter }),
    enabled: !!tenantId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['crm-contracts', tenantId],
    queryFn: () => listCRMContracts(tenantId),
    enabled: !!tenantId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts', tenantId, ''],
    queryFn: () => listCRMContacts(tenantId),
    enabled: !!tenantId,
  });

  const { data: stats } = useQuery({
    queryKey: ['crm-service-stats', tenantId],
    queryFn: () => getCRMServiceStats(tenantId),
    enabled: !!tenantId,
  });

  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';

  const delTicket = useMutation({
    mutationFn: (id: string) => deleteCRMTicket(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-tickets'] }); toast.success('Removed'); },
  });

  const delContract = useMutation({
    mutationFn: (id: string) => deleteCRMContract(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contracts'] }); toast.success('Removed'); },
  });

  if (viewId) {
    const ticket = tickets.find(t => t.id === viewId);
    if (ticket) {
      return <TicketDetail ticket={ticket} contact={contacts.find(c => c.id === ticket.contact_id)} onBack={() => setViewId(null)} />;
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ padding: '28px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>Service</h1>
          <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            Tickets &amp; AMC contracts
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={15} /> New {section === 'tickets' ? 'Ticket' : 'Contract'}
        </button>
      </div>

      <div style={{ padding: '24px 30px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Open Tickets', value: stats?.openTickets ?? 0, color: '#d97706' },
            { label: 'In Progress', value: stats?.inProgressTickets ?? 0, color: '#2563eb' },
            { label: 'Resolved Today', value: stats?.resolvedToday ?? 0, color: '#16a34a' },
            { label: 'Active Contracts', value: stats?.activeContracts ?? 0, color: C.nav },
            { label: 'Expiring (30d)', value: stats?.expiringContracts ?? 0, color: '#b91c1c' },
          ].map(card => (
            <div key={card.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', borderTop: `3px solid ${card.color}`, padding: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, marginBottom: '8px' }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['tickets', 'contracts'] as const).map(s => (
            <button key={s} onClick={() => setSection(s)}
              style={{ padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${section === s ? C.nav : C.border}`,
                background: section === s ? C.nav : C.surface, color: section === s ? '#fff' : C.muted, textTransform: 'capitalize' }}>
              {s === 'tickets' ? 'Tickets' : 'AMC Contracts'}
            </button>
          ))}
        </div>

        {section === 'tickets' ? (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  style={{ padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${statusFilter === f ? C.accent : C.border}`,
                    background: statusFilter === f ? '#fef3c7' : C.surface, color: statusFilter === f ? '#92400e' : C.muted, textTransform: 'capitalize' }}>
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              {tickets.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted }}>
                  <p style={{ fontSize: '14px', fontWeight: 600 }}>No tickets found</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Ticket #', 'Subject', 'Contact', 'Priority', 'Status', 'Assigned', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t, i) => {
                      const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
                      const stage = TICKET_STAGES.find(s => s.key === t.status);
                      return (
                        <tr key={t.id} onClick={() => setViewId(t.id)} style={{ borderBottom: i < tickets.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: C.accent }}>{t.ticket_no}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: C.text }}>{t.subject}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{contactName(t.contact_id)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: pm.bg, color: pm.color, borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>{t.priority}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{stage?.label ?? t.status}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{t.assigned_to || '—'}</td>
                          <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => { if (confirm('Remove?')) delTicket.mutate(t.id); }} style={{ padding: '5px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {contracts.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted }}>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>No contracts yet</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Title', 'Contact', 'Start', 'End', 'Value', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c, i) => {
                    const cm = CONTRACT_STATUS_META[c.status] ?? CONTRACT_STATUS_META.active;
                    return (
                      <tr key={c.id} style={{ borderBottom: i < contracts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: C.text }}>{c.title}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{contactName(c.contact_id)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{c.start_date ? new Date(c.start_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: C.muted }}>{c.end_date ? new Date(c.end_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: '13px', color: C.text }}>{fmt(c.value)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <select value={c.status} onChange={e => updateCRMContract(tenantId, c.id, { status: e.target.value }).then(() => qc.invalidateQueries({ queryKey: ['crm-contracts'] }))}
                            style={{ background: cm.bg, color: cm.color, borderRadius: '2px', padding: '3px 6px', fontSize: '11px', fontWeight: 600, border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                            {Object.entries(CONTRACT_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => { if (confirm('Remove?')) delContract.mutate(c.id); }} style={{ padding: '5px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        section === 'tickets'
          ? <NewTicketModal tenantId={tenantId} contacts={contacts} onClose={() => setShowAdd(false)} />
          : <NewContractModal tenantId={tenantId} contacts={contacts} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

// ── New ticket modal ──────────────────────────────────────────────────────────

function NewTicketModal({ tenantId, contacts, onClose }: { tenantId: string; contacts: { id: string; name: string; company: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ contact_id: '', subject: '', description: '', priority: 'medium', assigned_to: '', due_date: '' });

  const add = useMutation({
    mutationFn: () => createCRMTicket(tenantId, { ...form, due_date: form.due_date || null, status: 'open' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-tickets'] }); qc.invalidateQueries({ queryKey: ['crm-service-stats'] }); onClose(); toast.success('Ticket created'); },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '6px', width: '100%', maxWidth: '480px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>New Service Ticket</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Contact</label>
            <select value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }}>
              <option value="">Select contact…</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Subject *</label>
            <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. AC not cooling"
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Assigned To</label>
              <input value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="Name"
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Due</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => add.mutate()} disabled={!form.subject.trim() || add.isPending}
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: 'none', background: C.nav, fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: (!form.subject.trim() || add.isPending) ? 0.5 : 1 }}>
            {add.isPending ? 'Saving…' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New contract modal ────────────────────────────────────────────────────────

function NewContractModal({ tenantId, contacts, onClose }: { tenantId: string; contacts: { id: string; name: string; company: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ contact_id: '', title: '', start_date: '', end_date: '', value: '0' });

  const add = useMutation({
    mutationFn: () => createCRMContract(tenantId, { contact_id: form.contact_id, title: form.title, start_date: form.start_date || null, end_date: form.end_date || null, value: Number(form.value) || 0, status: 'active' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contracts'] }); qc.invalidateQueries({ queryKey: ['crm-service-stats'] }); onClose(); toast.success('Contract created'); },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '6px', width: '100%', maxWidth: '440px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>New AMC Contract</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Contact</label>
            <select value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }}>
              <option value="">Select contact…</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Title *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Annual AMC — AC Servicing"
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>Contract Value</label>
            <input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => add.mutate()} disabled={!form.title.trim() || add.isPending}
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: 'none', background: C.nav, fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: (!form.title.trim() || add.isPending) ? 0.5 : 1 }}>
            {add.isPending ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail (record) view ──────────────────────────────────────────────────────

function TicketDetail({ ticket, contact, onBack }: {
  ticket: CRMTicket;
  contact?: { id: string; name: string; phone: string; email: string; company: string };
  onBack: () => void;
}) {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('Activity');
  const [taskTitle, setTaskTitle] = useState('');

  const { data: followUps = [] } = useQuery({
    queryKey: ['crm-followups-contact', tenantId, ticket.contact_id],
    queryFn: () => listCRMFollowUps(tenantId, { contactId: ticket.contact_id }),
    enabled: !!tenantId && !!ticket.contact_id,
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => updateCRMTicket(tenantId, ticket.id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-tickets'] }); qc.invalidateQueries({ queryKey: ['crm-service-stats'] }); },
  });

  const addTask = useMutation({
    mutationFn: () => createCRMFollowUp(tenantId, { contact_id: ticket.contact_id, deal_id: '', title: taskTitle, type: 'task', due_at: null, status: 'pending', notes: `Re: ${ticket.ticket_no}` }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-followups-contact'] }); setTaskTitle(''); },
  });

  const toggleTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMFollowUp(tenantId, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-followups-contact'] }),
  });

  const pm = PRIORITY_META[ticket.priority] ?? PRIORITY_META.medium;

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif", padding: '24px 30px' }}>
      <RecordHeader
        icon={<Wrench size={20} color="#b45309" />}
        eyebrow={`SERVICE TICKET · ${ticket.ticket_no}`}
        title={ticket.subject}
        fields={[
          { label: 'Contact', value: contact?.name ?? '—' },
          { label: 'Priority', value: <span style={{ background: pm.bg, color: pm.color, borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>{ticket.priority}</span> },
          { label: 'Assigned To', value: ticket.assigned_to || '—' },
          { label: 'Due Date', value: ticket.due_date ? new Date(ticket.due_date).toLocaleDateString('en-IN') : '—' },
        ]}
        onBack={onBack}
      />

      <StageBar stages={TICKET_STAGES} current={ticket.status} onSelect={(k) => setStatus.mutate(k)} />

      <RecordBody
        main={
          <div>
            <RecordTabs tabs={['Activity', 'Details']} active={activeTab} onChange={setActiveTab} />
            {activeTab === 'Activity' ? (
              <Panel>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="New task / note…"
                    style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
                  <button onClick={() => taskTitle.trim() && addTask.mutate()} disabled={!taskTitle.trim()}
                    style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: C.nav, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: taskTitle.trim() ? 1 : 0.5 }}>Add</button>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Next Steps</div>
                {followUps.length === 0 ? (
                  <p style={{ fontSize: '13px', color: C.muted }}>No activity yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {followUps.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                        <input type="checkbox" checked={f.status === 'done'} onChange={() => toggleTask.mutate({ id: f.id, status: f.status === 'done' ? 'pending' : 'done' })} />
                        <span style={{ fontSize: '13px', textDecoration: f.status === 'done' ? 'line-through' : 'none', color: f.status === 'done' ? C.muted : C.text }}>{f.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ) : (
              <Panel>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Description</div>
                <p style={{ fontSize: '13px', color: C.text, marginBottom: '14px' }}>{ticket.description || '—'}</p>
                {ticket.notes && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Notes</div>
                    <p style={{ fontSize: '13px', color: C.text }}>{ticket.notes}</p>
                  </>
                )}
                {ticket.resolved_at && (
                  <div style={{ marginTop: '14px', fontSize: '12px', color: C.muted }}>Resolved at: {new Date(ticket.resolved_at).toLocaleString('en-IN')}</div>
                )}
              </Panel>
            )}
          </div>
        }
        sidebar={
          <SidebarCard title="Contact">
            {contact ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>{contact.name}</div>
                {contact.company && <div style={{ fontSize: '12px', color: C.muted, marginBottom: '6px' }}>{contact.company}</div>}
                {contact.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.muted, marginBottom: '4px' }}><Phone size={12} /> {contact.phone}</div>}
                {contact.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.muted }}><Mail size={12} /> {contact.email}</div>}
              </>
            ) : <p style={{ fontSize: '12px', color: C.muted }}>No contact linked</p>}
          </SidebarCard>
        }
      />
    </div>
  );
}
