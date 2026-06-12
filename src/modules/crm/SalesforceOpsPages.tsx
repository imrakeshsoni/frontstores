// [crm] [tenant: FrontStores.com] — Salesforce-style Communication Log, Commissions & Team:
// split views: record list on the left, record detail on the right (same pattern as the other objects)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Pencil, Phone, Mail, ArrowDownLeft, ArrowUpRight, Radio,
  CheckCircle2, IndianRupee, UserCog,
} from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMCommunications, createCRMCommunication, deleteCRMCommunication, listCRMContacts,
  listCRMCommissions, updateCRMCommissionStatus,
  listCRMTeamMembers, createCRMTeamMember, updateCRMTeamMember, deleteCRMTeamMember, type CRMTeamMember,
} from '@/lib/db/crm';
import { fmtINR, fmtDate, timeAgo } from './components/kit';
import {
  SF, SF_ICONS, SFPage, SFObjectHeader, SFCard, SFBtn, SFBadge, SFTabs, SFStat, SFIconTile,
  SFHighlights, SFHL, SFModal, SFField, SFFormGrid, SFEmpty, SFSplit, SFListRow, sfInp, type SFTone,
} from './components/lightning';

// ── Communication Log ─────────────────────────────────────────────────────────

const COMM_TYPES: Record<string, { icon: string; label: string }> = {
  call:     { icon: '📞', label: 'Call' },
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  email:    { icon: '✉️', label: 'Email' },
  meeting:  { icon: '🤝', label: 'Meeting' },
  sms:      { icon: '📱', label: 'SMS' },
  other:    { icon: '📌', label: 'Other' },
};
const emptyComm = { contact_id: '', type: 'call', direction: 'outgoing', summary: '' };

export function SalesforceCommLogPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyComm);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: comms = [] } = useQuery({ queryKey: ['crm-comms', tenantId], queryFn: () => listCRMCommunications(tenantId), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const contactName = (id: string) => contacts.find(c => c.id === id)?.name ?? '—';
  // Split view: when nothing is explicitly selected, the first entry is shown
  const view = comms.find(c => c.id === viewId) ?? comms[0] ?? null;

  const add = useMutation({
    mutationFn: () => createCRMCommunication(tenantId, { ...form, occurred_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-comms'] }); setShowForm(false); setForm(emptyComm); toast.success('Logged'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMCommunication(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-comms'] }); setViewId(null); toast.success('Deleted'); },
  });

  return (
    <SFPage>
      <SFObjectHeader
        icon={<Radio size={18} />} iconColor={SF_ICONS.call} objectLabel="Communication Log"
        title="All Interactions" sub={`${comms.length} item${comms.length === 1 ? '' : 's'} · newest first`}
        actions={<SFBtn variant="brand" onClick={() => { setForm(emptyComm); setShowForm(true); }}><Plus size={13} /> Log Interaction</SFBtn>}
      />

      {/* ── Split view: interaction list left, detail right ── */}
      <SFSplit list={
        <SFCard noPad>
          <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {comms.length === 0 ? (
              <SFEmpty title="No interactions logged"
                hint="Log calls, WhatsApp chats and meetings so the whole story stays in one place."
                action={<SFBtn variant="brand" onClick={() => { setForm(emptyComm); setShowForm(true); }}><Plus size={13} /> Log First Interaction</SFBtn>} />
            ) : comms.map(cm => {
              const tm = COMM_TYPES[cm.type] ?? COMM_TYPES.other;
              const incoming = cm.direction === 'incoming';
              return (
                <SFListRow key={cm.id}
                  icon={<span style={{ fontSize: '13px' }}>{tm.icon}</span>} iconColor={SF_ICONS.call}
                  title={contactName(cm.contact_id)} sub={`${tm.label} · ${timeAgo(cm.occurred_at)}`}
                  right={<SFBadge tone={incoming ? 'green' : 'blue'}>{incoming ? 'In' : 'Out'}</SFBadge>}
                  selected={view?.id === cm.id}
                  onClick={() => setViewId(cm.id)} />
              );
            })}
          </div>
        </SFCard>
      }>
        {!view ? (
          <SFCard><SFEmpty title="Select an interaction" hint="Pick an entry from the list on the left — its details open here." /></SFCard>
        ) : (
          <>
            <SFCard noPad style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                <SFIconTile color={SF_ICONS.call}><Radio size={16} /></SFIconTile>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Interaction</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: SF.heading }}>{contactName(view.contact_id)}</div>
                </div>
                <SFBadge tone={view.direction === 'incoming' ? 'green' : 'blue'}>
                  {view.direction === 'incoming' ? <ArrowDownLeft size={9} style={{ verticalAlign: '-1px' }} /> : <ArrowUpRight size={9} style={{ verticalAlign: '-1px' }} />} {view.direction}
                </SFBadge>
                <SFBtn small variant="destructive" onClick={() => { if (confirm('Delete this entry?')) remove.mutate(view.id); }}><Trash2 size={12} /> Delete</SFBtn>
              </div>
            </SFCard>
            <SFHighlights>
              <SFHL label="Type">{(COMM_TYPES[view.type] ?? COMM_TYPES.other).icon} {(COMM_TYPES[view.type] ?? COMM_TYPES.other).label}</SFHL>
              <SFHL label="When">{fmtDate(view.occurred_at)}</SFHL>
              <SFHL label="Logged">{timeAgo(view.occurred_at)}</SFHL>
            </SFHighlights>
            <SFCard title="Summary">
              <div style={{ fontSize: '13px', color: SF.text, whiteSpace: 'pre-wrap' }}>{view.summary || 'No summary recorded.'}</div>
            </SFCard>
          </>
        )}
      </SFSplit>


      {/* Log Interaction */}
      {showForm && (
        <SFModal title="Log Interaction" onClose={() => setShowForm(false)}
          footer={
            <>
              <SFBtn onClick={() => setShowForm(false)}>Cancel</SFBtn>
              <SFBtn variant="brand" disabled={add.isPending}
                onClick={() => form.contact_id ? add.mutate() : toast.error('Pick a contact')}>Save Log</SFBtn>
            </>
          }>
          <SFFormGrid>
            <SFField label="Name (Contact)" required>
              <select className="sf-inp" style={sfInp()} value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} autoFocus>
                <option value="">— select —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </SFField>
            <SFField label="Type">
              <select className="sf-inp" style={sfInp()} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {Object.entries(COMM_TYPES).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
              </select>
            </SFField>
            <SFField label="Direction">
              <select className="sf-inp" style={sfInp()} value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>
                <option value="outgoing">Outgoing</option><option value="incoming">Incoming</option>
              </select>
            </SFField>
            <SFField label="Summary" span2>
              <textarea className="sf-inp" rows={4} style={sfInp({ resize: 'vertical' })} value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="What was discussed?" />
            </SFField>
          </SFFormGrid>
        </SFModal>
      )}
    </SFPage>
  );
}

// ── Commissions ───────────────────────────────────────────────────────────────

export function SalesforceCommissionsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'paid' | 'all'>('pending');
  const [viewId, setViewId] = useState<string | null>(null);

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
  // Split view: when nothing is explicitly selected, the first visible record is shown
  const view = commissions.find(c => c.id === viewId) ?? visible[0] ?? null;

  return (
    <SFPage>
      <SFObjectHeader
        icon={<IndianRupee size={18} />} iconColor={SF_ICONS.invoice} objectLabel="Commissions"
        title="All Commissions" sub="Created automatically when an opportunity is Closed Won"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <SFStat label="Pending Payout" value={fmtINR(pendingTotal)} sub={`${pending.length} commissions`} accent={SF.amber} />
        <SFStat label="Paid Out" value={fmtINR(paidTotal)} sub={`${paid.length} commissions`} accent={SF.green} />
        <SFStat label="Total" value={fmtINR(pendingTotal + paidTotal)} accent={SF.brand} />
      </div>

      <SFCard noPad>
        <SFTabs style={{ paddingLeft: '8px' }} active={tab} onChange={k => setTab(k as typeof tab)}
          tabs={[
            { key: 'pending', label: 'Pending', count: pending.length },
            { key: 'paid', label: 'Paid', count: paid.length },
            { key: 'all', label: 'All', count: commissions.length },
          ]} />
      </SFCard>

      {/* ── Split view: commission list left, detail right ── */}
      <SFSplit list={
        <SFCard noPad>
          <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 330px)', overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <SFEmpty title={tab === 'pending' ? 'No pending commissions' : 'Nothing here yet'}
                hint="Win an opportunity and commissions appear here automatically." />
            ) : visible.map(c => (
              <SFListRow key={c.id}
                icon={<IndianRupee size={13} />} iconColor={SF_ICONS.invoice}
                title={c.person_name} sub={`${c.deal_title} · ${fmtINR(c.commission_amount)}`}
                right={<SFBadge tone={c.status === 'paid' ? 'green' : 'amber'}>{c.status === 'paid' ? 'Paid' : 'Pending'}</SFBadge>}
                selected={view?.id === c.id}
                onClick={() => setViewId(c.id)} />
            ))}
          </div>
        </SFCard>
      }>
        {!view ? (
          <SFCard><SFEmpty title="Select a commission" hint="Pick a record from the list on the left — its details open here." /></SFCard>
        ) : (
          <>
            <SFCard noPad style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                <SFIconTile color={SF_ICONS.invoice}><IndianRupee size={16} /></SFIconTile>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Commission</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: SF.heading }}>{view.person_name}</div>
                </div>
                <SFBadge tone={view.status === 'paid' ? 'green' : 'amber'}>{view.status === 'paid' ? 'Paid' : 'Pending'}</SFBadge>
                {view.status === 'pending'
                  ? <SFBtn small variant="success" onClick={() => setStatus.mutate({ id: view.id, status: 'paid' })}><CheckCircle2 size={12} /> Mark Paid</SFBtn>
                  : <SFBtn small onClick={() => setStatus.mutate({ id: view.id, status: 'pending' })}>Move to Pending</SFBtn>}
              </div>
            </SFCard>
            <SFHighlights>
              <SFHL label="Opportunity">{view.deal_title}</SFHL>
              <SFHL label="Deal Value">{fmtINR(view.deal_value)}</SFHL>
              <SFHL label="Share">{view.commission_pct}%</SFHL>
              <SFHL label="Commission">{fmtINR(view.commission_amount)}</SFHL>
              <SFHL label="Role">{view.person_type}</SFHL>
              <SFHL label="Updated">{timeAgo(view.updated_at)}</SFHL>
            </SFHighlights>
          </>
        )}
      </SFSplit>

    </SFPage>
  );
}

// ── Team ──────────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; tone: SFTone }> = {
  owner:    { label: 'Owner',       tone: 'amber' },
  manager:  { label: 'Manager',     tone: 'teal' },
  agent:    { label: 'Sales Agent', tone: 'blue' },
  support:  { label: 'Support',     tone: 'green' },
  referrer: { label: 'Referrer',    tone: 'gray' },
};
const emptyMember = { name: '', phone: '', email: '', role: 'agent', commission_pct: '50', notes: '' };

export function SalesforceTeamPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMember);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });
  const { data: commissions = [] } = useQuery({ queryKey: ['crm-commissions', tenantId], queryFn: () => listCRMCommissions(tenantId), enabled: !!tenantId });
  // Split view: when nothing is explicitly selected, the first member is shown
  const view = team.find(m => m.id === viewId) ?? team[0] ?? null;

  const save = useMutation({
    mutationFn: async () => {
      const data = { ...form, commission_pct: Number(form.commission_pct) || 0 };
      if (editId) await updateCRMTeamMember(tenantId, editId, data);
      else await createCRMTeamMember(tenantId, data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-team'] }); setShowForm(false); setEditId(null); setForm(emptyMember); toast.success(editId ? 'Member updated' : 'Member added'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMTeamMember(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-team'] }); setViewId(null); toast.success('Member removed'); },
  });

  const openEdit = (m: CRMTeamMember) => {
    setEditId(m.id);
    setForm({ name: m.name, phone: m.phone, email: m.email, role: m.role, commission_pct: String(m.commission_pct ?? 50), notes: m.notes });
    setViewId(null);
    setShowForm(true);
  };

  const earnings = (name: string) => commissions.filter(c => c.person_name === name).reduce((s, c) => s + (c.commission_amount || 0), 0);
  const pendingEarnings = (name: string) => commissions.filter(c => c.person_name === name && c.status === 'pending').reduce((s, c) => s + (c.commission_amount || 0), 0);

  return (
    <SFPage>
      <SFObjectHeader
        icon={<UserCog size={18} />} iconColor={SF_ICONS.account} objectLabel="Team"
        title="All Members" sub={`${team.length} member${team.length === 1 ? '' : 's'} · roles & commission rates`}
        actions={<SFBtn variant="brand" onClick={() => { setEditId(null); setForm(emptyMember); setShowForm(true); }}><Plus size={13} /> New Member</SFBtn>}
      />

      {/* ── Split view: member list left, detail right ── */}
      <SFSplit list={
        <SFCard noPad>
          <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {team.length === 0 ? (
              <SFEmpty title="No team members yet"
                hint="Add your sales agents and referrers — assign them leads, opportunities and cases."
                action={<SFBtn variant="brand" onClick={() => { setEditId(null); setForm(emptyMember); setShowForm(true); }}><Plus size={13} /> Add First Member</SFBtn>} />
            ) : team.map(m => {
              const role = ROLE_META[m.role] ?? ROLE_META.agent;
              return (
                <SFListRow key={m.id} icon={<UserCog size={13} />} iconColor={SF_ICONS.account}
                  title={m.name} sub={`${m.commission_pct}% · ${fmtINR(earnings(m.name))} earned`}
                  right={<SFBadge tone={role.tone}>{role.label}</SFBadge>}
                  selected={view?.id === m.id}
                  onClick={() => setViewId(m.id)} />
              );
            })}
          </div>
        </SFCard>
      }>
        {!view ? (
          <SFCard><SFEmpty title="Select a member" hint="Pick a member from the list on the left — their details open here." /></SFCard>
        ) : (
          <>
            <SFCard noPad style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                <SFIconTile color={SF_ICONS.account}><UserCog size={16} /></SFIconTile>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Team Member</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: SF.heading }}>{view.name}</div>
                </div>
                <SFBadge tone={(ROLE_META[view.role] ?? ROLE_META.agent).tone}>{(ROLE_META[view.role] ?? ROLE_META.agent).label}</SFBadge>
                <SFBtn small onClick={() => openEdit(view)}><Pencil size={12} /> Edit</SFBtn>
                <SFBtn small variant="destructive" onClick={() => { if (confirm(`Remove ${view.name}?`)) remove.mutate(view.id); }}><Trash2 size={12} /> Remove</SFBtn>
                {view.phone && <SFBtn small onClick={() => window.open(`tel:${view.phone}`)}><Phone size={12} /> Call</SFBtn>}
                {view.email && <SFBtn small onClick={() => window.open(`mailto:${view.email}`)}><Mail size={12} /> Email</SFBtn>}
              </div>
            </SFCard>
            <SFHighlights>
              <SFHL label="Phone">{view.phone || '—'}</SFHL>
              <SFHL label="Email">{view.email || '—'}</SFHL>
              <SFHL label="Commission %">{view.commission_pct}%</SFHL>
              <SFHL label="Earned">{fmtINR(earnings(view.name))}</SFHL>
              <SFHL label="Due">{fmtINR(pendingEarnings(view.name))}</SFHL>
            </SFHighlights>
            {view.notes && (
              <SFCard title="Notes">
                <div style={{ fontSize: '13px', color: SF.text, whiteSpace: 'pre-wrap' }}>{view.notes}</div>
              </SFCard>
            )}
          </>
        )}
      </SFSplit>


      {/* New / Edit Member */}
      {showForm && (
        <SFModal title={editId ? 'Edit Member' : 'New Team Member'} onClose={() => { setShowForm(false); setEditId(null); }}
          footer={
            <>
              <SFBtn onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</SFBtn>
              <SFBtn variant="brand" disabled={save.isPending}
                onClick={() => form.name.trim() ? save.mutate() : toast.error('Name is required')}>{editId ? 'Save' : 'Save Member'}</SFBtn>
            </>
          }>
          <SFFormGrid>
            <SFField label="Name" required><input className="sf-inp" style={sfInp()} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></SFField>
            <SFField label="Role">
              <select className="sf-inp" style={sfInp()} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {Object.entries(ROLE_META).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
            </SFField>
            <SFField label="Phone"><input className="sf-inp" style={sfInp()} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></SFField>
            <SFField label="Email"><input className="sf-inp" style={sfInp()} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></SFField>
            <SFField label="Commission %"><input className="sf-inp" type="number" style={sfInp()} value={form.commission_pct} onChange={e => setForm(p => ({ ...p, commission_pct: e.target.value }))} /></SFField>
            <SFField label="Notes"><input className="sf-inp" style={sfInp()} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}
    </SFPage>
  );
}
