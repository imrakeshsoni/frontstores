// [crm] [all tenants] — Contacts: customer 360° view with deals, sales docs & activity
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Phone, MessageSquare, Trash2, Pencil, Mail } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMContacts, createCRMContact, updateCRMContact, deleteCRMContact,
  listCRMDeals, listCRMFollowUps, listCRMCommunications, type CRMContact,
} from '@/lib/db/crm';
import { listCRMSales } from '@/lib/db/crmSales';
import { sendWhatsApp } from '@/lib/whatsapp';
import {
  CRMPage, PageHead, SearchInput, Panel, EmptyState, Badge, Avatar, Btn, Modal, Drawer,
  Field, FormGrid, inp, C, fmtINR, fmtDate, timeAgo, th, td,
} from './components/kit';
import { SF_TENANT_ID } from './components/lightning';
import { SalesforceContactsPage } from './SalesforceContactsPage';

const STAGE_BADGE: Record<string, { bg: string; color: string }> = {
  lead:      { bg: C.amberBg, color: C.amber },
  qualified: { bg: C.blueBg,  color: C.blue },
  customer:  { bg: C.greenBg, color: C.green },
};

const emptyForm = { name: '', phone: '', email: '', company: '', source: '', stage: 'lead', tags: '', notes: '' };

export function CRMContactsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  // [crm] [tenant: FrontStores.com] — Salesforce-style Contacts (table + wide record popup)
  if (tenantId === SF_TENANT_ID) return <SalesforceContactsPage />;
  return <AuroraContactsPage tenantId={tenantId} />;
}

// [crm] [all tenants] — original Aurora contacts UI
function AuroraContactsPage({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [view, setView] = useState<CRMContact | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts', tenantId, search],
    queryFn: () => listCRMContacts(tenantId, search),
    enabled: !!tenantId,
  });

  // 360° data for the open contact
  const { data: deals = [] } = useQuery({ queryKey: ['crm-deals', tenantId, view?.id], queryFn: () => listCRMDeals(tenantId, { contactId: view!.id }), enabled: !!tenantId && !!view });
  const { data: sales = [] } = useQuery({ queryKey: ['crm-sales', tenantId, view?.id], queryFn: () => listCRMSales(tenantId, { contactId: view!.id }), enabled: !!tenantId && !!view });
  const { data: followups = [] } = useQuery({ queryKey: ['crm-followups', tenantId, view?.id], queryFn: () => listCRMFollowUps(tenantId, { contactId: view!.id }), enabled: !!tenantId && !!view });
  const { data: comms = [] } = useQuery({ queryKey: ['crm-comms', tenantId, view?.id], queryFn: () => listCRMCommunications(tenantId, view!.id), enabled: !!tenantId && !!view });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) await updateCRMContact(tenantId, editId, form);
      else await createCRMContact(tenantId, form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contacts'] }); setShowForm(false); setEditId(null); setForm(emptyForm); toast.success(editId ? 'Contact updated' : 'Contact added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMContact(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contacts'] }); setView(null); toast.success('Contact deleted'); },
  });

  const openEdit = (c: CRMContact) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone, email: c.email, company: c.company, source: c.source, stage: c.stage, tags: c.tags, notes: c.notes });
    setView(null);
    setShowForm(true);
  };

  const openDealsValue = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + (d.value || 0), 0);
  const invoiced = sales.filter(s => s.doc_type === 'invoice').reduce((s2, s) => s2 + (s.total || 0), 0);

  return (
    <CRMPage>
      <PageHead title="Contacts" subtitle="Your people — every deal, document and conversation in one place."
        actions={<Btn onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={14} /> New Contact</Btn>} />

      <div style={{ marginBottom: '16px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, company…" />
      </div>

      <Panel>
        {contacts.length === 0 ? (
          <EmptyState emoji="👥" title="No contacts yet" hint="Contacts are created automatically when you convert a lead, or add one manually."
            action={<Btn small onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> Add Contact</Btn>} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Contact</th><th style={th}>Phone</th><th style={th}>Email</th><th style={th}>Stage</th><th style={th}>Tags</th></tr></thead>
            <tbody>
              {contacts.map(c => {
                const sb = STAGE_BADGE[c.stage] ?? STAGE_BADGE.lead;
                return (
                  <tr key={c.id} className="crm-row" style={{ cursor: 'pointer' }} onClick={() => setView(c)}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={c.name} size={32} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: C.muted }}>{c.company || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>{c.phone || <span style={{ color: C.faint }}>—</span>}</td>
                    <td style={td}>{c.email || <span style={{ color: C.faint }}>—</span>}</td>
                    <td style={td}><Badge bg={sb.bg} color={sb.color}>{c.stage}</Badge></td>
                    <td style={{ ...td, fontSize: '12px', color: C.muted }}>{c.tags || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Add / Edit modal */}
      {showForm && (
        <Modal title={editId ? 'Edit Contact' : 'New Contact'} onClose={() => { setShowForm(false); setEditId(null); }}
          footer={<>
            <Btn variant="ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Btn>
            <Btn onClick={() => form.name.trim() ? save.mutate() : toast.error('Name is required')} disabled={save.isPending}>{editId ? 'Save Changes' : 'Add Contact'}</Btn>
          </>}>
          <FormGrid>
            <Field label="Name *"><input style={inp()} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></Field>
            <Field label="Company"><input style={inp()} value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></Field>
            <Field label="Phone"><input style={inp()} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Field>
            <Field label="Email"><input style={inp()} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
            <Field label="Stage">
              <select style={inp()} value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
                <option value="lead">Lead</option><option value="qualified">Qualified</option><option value="customer">Customer</option>
              </select>
            </Field>
            <Field label="Tags (comma separated)"><input style={inp()} value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} /></Field>
            <Field label="Notes" span2><textarea style={inp({ minHeight: '70px', resize: 'vertical' })} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}

      {/* Contact 360° drawer */}
      {view && (
        <Drawer eyebrow="Contact" title={view.name} onClose={() => setView(null)} width={520}
          footer={<>
            <Btn variant="ghost" small onClick={() => openEdit(view)}><Pencil size={12} /> Edit</Btn>
            <Btn variant="danger" small onClick={() => { if (confirm('Delete this contact?')) remove.mutate(view.id); }}><Trash2 size={12} /> Delete</Btn>
          </>}>
          {/* Quick actions */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {view.phone && <>
              <Btn variant="subtle" small onClick={() => window.open(`tel:${view.phone}`)}><Phone size={12} /> Call</Btn>
              <Btn variant="subtle" small onClick={() => sendWhatsApp(view.phone, `Hi ${view.name},`).catch(e => toast.error(e.message))}><MessageSquare size={12} /> WhatsApp</Btn>
            </>}
            {view.email && <Btn variant="subtle" small onClick={() => window.open(`mailto:${view.email}`)}><Mail size={12} /> Email</Btn>}
          </div>

          {/* Mini KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            <div style={{ background: C.violetBg, borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: C.violet, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Pipeline</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: C.text }}>{fmtINR(openDealsValue)}</div>
            </div>
            <div style={{ background: C.greenBg, borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invoiced</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: C.text }}>{fmtINR(invoiced)}</div>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            {[['Company', view.company], ['Phone', view.phone], ['Email', view.email], ['Source', view.source], ['Tags', view.tags]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string}>
                <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800, marginBottom: '3px' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Deals */}
          <SectionTitle>💰 Deals ({deals.length})</SectionTitle>
          {deals.length === 0 ? <Hint>No deals yet.</Hint> : deals.map(d => (
            <MiniRow key={d.id} title={d.title} right={fmtINR(d.value)} sub={`Stage: ${d.stage}${d.expected_close_date ? ` · closes ${fmtDate(d.expected_close_date)}` : ''}`} />
          ))}

          {/* Sales docs */}
          <SectionTitle>🧾 Sales Documents ({sales.length})</SectionTitle>
          {sales.length === 0 ? <Hint>No quotes, orders or invoices yet.</Hint> : sales.map(s => (
            <MiniRow key={s.id} title={`${s.doc_no} · ${s.doc_type}`} right={fmtINR(s.total)} sub={`Status: ${s.status}${s.due_date ? ` · due ${fmtDate(s.due_date)}` : ''}`} />
          ))}

          {/* Follow-ups */}
          <SectionTitle>⏰ Follow-ups ({followups.length})</SectionTitle>
          {followups.length === 0 ? <Hint>No follow-ups.</Hint> : followups.slice(0, 5).map(f => (
            <MiniRow key={f.id} title={f.title} right={f.status} sub={f.due_at ? `Due ${fmtDate(f.due_at)}` : ''} />
          ))}

          {/* Recent communications */}
          <SectionTitle>📞 Recent Activity ({comms.length})</SectionTitle>
          {comms.length === 0 ? <Hint>No logged communication.</Hint> : comms.slice(0, 6).map(cm => (
            <MiniRow key={cm.id} title={`${cm.type} · ${cm.direction}`} right={timeAgo(cm.occurred_at)} sub={cm.summary} />
          ))}
        </Drawer>
      )}
    </CRMPage>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '11px', fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '18px 0 8px' }}>{children}</div>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '12px', color: C.faint, marginBottom: '6px' }}>{children}</div>;
}
function MiniRow({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', background: C.surface2, borderRadius: '8px', marginBottom: '6px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      {right && <div style={{ fontSize: '12px', fontWeight: 700, color: C.muted, flexShrink: 0 }}>{right}</div>}
    </div>
  );
}
