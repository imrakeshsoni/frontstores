// [crm] [tenant: FrontStores.com] — Salesforce-style Contacts object:
// split view: contact list on the left, 360° detail with related lists on the right
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Phone, MessageSquare, Mail, Trash2, Pencil, Search, User, Target, FileText, CheckSquare, Radio } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMContacts, createCRMContact, updateCRMContact, deleteCRMContact,
  listCRMDeals, listCRMFollowUps, listCRMCommunications, listCRMAccounts, type CRMContact,
} from '@/lib/db/crm';
import { listCRMSales } from '@/lib/db/crmSales';
import { sendWhatsApp } from '@/lib/whatsapp';
import { fmtINR, fmtDate, timeAgo } from './components/kit';
import {
  SF, SF_ICONS, SFPage, SFObjectHeader, SFCard, SFBtn, SFBadge, SFStat, SFIconTile,
  SFHighlights, SFHL, SFModal, SFField, SFFormGrid, SFEmpty, SFSplit, SFListRow, sfInp, type SFTone,
} from './components/lightning';

const STAGE_TONE: Record<string, SFTone> = { lead: 'amber', qualified: 'blue', customer: 'green' };
const emptyForm = { name: '', phone: '', email: '', company: '', source: '', stage: 'lead', tags: '', notes: '', account_id: '' };

export function SalesforceContactsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, search], queryFn: () => listCRMContacts(tenantId, search), enabled: !!tenantId });
  const { data: accounts = [] } = useQuery({ queryKey: ['crm-accounts', tenantId, ''], queryFn: () => listCRMAccounts(tenantId), enabled: !!tenantId });
  // Split view: when nothing is explicitly selected, the first contact is shown
  const view = contacts.find(c => c.id === viewId) ?? contacts[0] ?? null;
  // Real Salesforce-style link: resolve the account by id, fall back to the legacy company text
  const accountNameOf = (c: { account_id?: string; company: string }) =>
    accounts.find(a => a.id === c.account_id)?.name || c.company;

  // 360° related lists for the selected contact
  const { data: deals = [] } = useQuery({ queryKey: ['crm-deals', tenantId, view?.id], queryFn: () => listCRMDeals(tenantId, { contactId: view!.id }), enabled: !!tenantId && !!view });
  const { data: sales = [] } = useQuery({ queryKey: ['crm-sales', tenantId, view?.id], queryFn: () => listCRMSales(tenantId, { contactId: view!.id }), enabled: !!tenantId && !!view });
  const { data: followups = [] } = useQuery({ queryKey: ['crm-followups', tenantId, view?.id], queryFn: () => listCRMFollowUps(tenantId, { contactId: view!.id }), enabled: !!tenantId && !!view });
  const { data: comms = [] } = useQuery({ queryKey: ['crm-comms', tenantId, view?.id], queryFn: () => listCRMCommunications(tenantId, view!.id), enabled: !!tenantId && !!view });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) await updateCRMContact(tenantId, editId, form);
      else await createCRMContact(tenantId, form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contacts'] }); setShowForm(false); setEditId(null); setForm(emptyForm); toast.success(editId ? 'Contact updated' : 'Contact created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMContact(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contacts'] }); setViewId(null); toast.success('Contact deleted'); },
  });

  const openEdit = (c: CRMContact) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone, email: c.email, company: c.company, source: c.source, stage: c.stage, tags: c.tags, notes: c.notes, account_id: c.account_id ?? '' });
    setViewId(null);
    setShowForm(true);
  };

  const openDealsValue = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + (d.value || 0), 0);
  const invoiced = sales.filter(s => s.doc_type === 'invoice').reduce((s2, s) => s2 + (s.total || 0), 0);
  const customers = contacts.filter(c => c.stage === 'customer').length;

  const relatedCard = (title: string, icon: React.ReactNode, color: string, rows: { id: string; title: string; sub?: string; right?: React.ReactNode }[], emptyHint: string) => (
    <SFCard title={`${title} (${rows.length})`} icon={icon} iconColor={color} noPad style={{ marginBottom: '12px' }}>
      {rows.length === 0 ? (
        <div style={{ padding: '14px 16px', fontSize: '12px', color: SF.faint }}>{emptyHint}</div>
      ) : rows.map(r => (
        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', padding: '10px 16px', borderBottom: `1px solid ${SF.border}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: SF.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
            {r.sub && <div style={{ fontSize: '11px', color: SF.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>}
          </div>
          {r.right && <div style={{ fontSize: '12px', fontWeight: 700, color: SF.muted, flexShrink: 0 }}>{r.right}</div>}
        </div>
      ))}
    </SFCard>
  );

  return (
    <SFPage>
      <SFObjectHeader
        icon={<User size={18} />} iconColor={SF_ICONS.contact} objectLabel="Contacts"
        title="All Contacts" sub={`${contacts.length} item${contacts.length === 1 ? '' : 's'} · sorted by Name`}
        actions={
          <>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: SF.faint }} />
              <input className="sf-inp" placeholder="Search this list..." value={search} onChange={e => setSearch(e.target.value)}
                style={sfInp({ width: '210px', paddingLeft: '30px' })} />
            </div>
            <SFBtn variant="brand" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> New</SFBtn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <SFStat label="All Contacts" value={contacts.length} accent={SF_ICONS.contact} />
        <SFStat label="Customers" value={customers} accent={SF.green} />
        <SFStat label="In Qualification" value={contacts.filter(c => c.stage !== 'customer').length} accent={SF.brand} />
      </div>

      {/* ── Split view: contact list left, 360° detail right ── */}
      <SFSplit list={
        <SFCard noPad>
          <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {contacts.length === 0 ? (
              <SFEmpty title={search ? 'No contacts match your search' : 'No contacts yet'}
                hint={search ? 'Try a different name, phone or company.' : 'Contacts are created automatically when you convert a lead, or add one manually.'}
                action={!search && <SFBtn variant="brand" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> New Contact</SFBtn>} />
            ) : contacts.map(c => (
              <SFListRow key={c.id} icon={<User size={13} />} iconColor={SF_ICONS.contact}
                title={c.name} sub={accountNameOf(c) || c.phone || c.email || '—'}
                right={<SFBadge tone={STAGE_TONE[c.stage] ?? 'gray'}>{c.stage}</SFBadge>}
                selected={view?.id === c.id}
                onClick={() => setViewId(c.id)} />
            ))}
          </div>
        </SFCard>
      }>
        {!view ? (
          <SFCard><SFEmpty title="Select a contact" hint="Pick a record from the list on the left — its details open here." /></SFCard>
        ) : (
          <>
          {/* Record header + actions */}
          <SFCard noPad style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
              <SFIconTile color={SF_ICONS.contact}><User size={16} /></SFIconTile>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Contact</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: SF.heading, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{view.name}</div>
              </div>
              <SFBadge tone={STAGE_TONE[view.stage] ?? 'gray'}>{view.stage}</SFBadge>
              <SFBtn small onClick={() => openEdit(view)}><Pencil size={12} /> Edit</SFBtn>
              <SFBtn small variant="destructive" onClick={() => { if (confirm(`Delete contact "${view.name}"?`)) remove.mutate(view.id); }}><Trash2 size={12} /> Delete</SFBtn>
              {view.phone && (
                <>
                  <SFBtn small onClick={() => window.open(`tel:${view.phone}`)}><Phone size={12} /> Call</SFBtn>
                  <SFBtn small onClick={() => sendWhatsApp(view.phone, `Hi ${view.name},`).catch(e => toast.error(e.message))}><MessageSquare size={12} /> WhatsApp</SFBtn>
                </>
              )}
              {view.email && <SFBtn small onClick={() => window.open(`mailto:${view.email}`)}><Mail size={12} /> Email</SFBtn>}
            </div>
          </SFCard>

          <SFHighlights>
            <SFHL label="Account Name">{accountNameOf(view) || '—'}</SFHL>
            <SFHL label="Phone">{view.phone || '—'}</SFHL>
            <SFHL label="Email">{view.email || '—'}</SFHL>
            <SFHL label="Open Pipeline">{fmtINR(openDealsValue)}</SFHL>
            <SFHL label="Invoiced">{fmtINR(invoiced)}</SFHL>
          </SFHighlights>

          <SFCard title="Details" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 24px' }}>
              {[['Source', view.source], ['Tags', view.tags], ['Last Updated', timeAgo(view.updated_at)]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ fontSize: '11px', color: SF.muted, marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: SF.text, wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>
            {view.notes && (
              <div style={{ marginTop: '12px', background: SF.cardHead, border: `1px solid ${SF.border}`, borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: SF.text, whiteSpace: 'pre-wrap' }}>{view.notes}</div>
            )}
          </SFCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              {relatedCard('Opportunities', <Target size={12} />, SF_ICONS.opportunity,
                deals.map(d => ({ id: d.id, title: d.title, sub: `Stage: ${d.stage}${d.expected_close_date ? ` · closes ${fmtDate(d.expected_close_date)}` : ''}`, right: fmtINR(d.value) })),
                'No opportunities yet.')}
              {relatedCard('Sales Documents', <FileText size={12} />, SF_ICONS.quote,
                sales.map(s => ({ id: s.id, title: `${s.doc_no} · ${s.doc_type}`, sub: `Status: ${s.status}${s.due_date ? ` · due ${fmtDate(s.due_date)}` : ''}`, right: fmtINR(s.total) })),
                'No quotes, orders or invoices yet.')}
            </div>
            <div>
              {relatedCard('Tasks', <CheckSquare size={12} />, SF_ICONS.task,
                followups.slice(0, 6).map(f => ({ id: f.id, title: f.title, sub: f.due_at ? `Due ${fmtDate(f.due_at)}` : '', right: f.status })),
                'No tasks.')}
              {relatedCard('Recent Activity', <Radio size={12} />, SF_ICONS.call,
                comms.slice(0, 6).map(cm => ({ id: cm.id, title: `${cm.type} · ${cm.direction}`, sub: cm.summary, right: timeAgo(cm.occurred_at) })),
                'No logged communication.')}
            </div>
          </div>
          </>
        )}
      </SFSplit>

      {/* New / Edit Contact */}
      {showForm && (
        <SFModal title={editId ? 'Edit Contact' : 'New Contact'} onClose={() => { setShowForm(false); setEditId(null); }}
          footer={
            <>
              <SFBtn onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</SFBtn>
              <SFBtn variant="brand" disabled={save.isPending}
                onClick={() => form.name.trim() ? save.mutate() : toast.error('Name is required')}>{editId ? 'Save' : 'Save Contact'}</SFBtn>
            </>
          }>
          <SFFormGrid>
            <SFField label="Name" required><input className="sf-inp" style={sfInp()} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></SFField>
            <SFField label="Account Name">
              {/* Real account lookup — picking one also syncs the legacy company text */}
              <select className="sf-inp" style={sfInp()} value={form.account_id}
                onChange={e => {
                  const a = accounts.find(x => x.id === e.target.value);
                  setForm(p => ({ ...p, account_id: e.target.value, company: a ? (a.is_person ? p.company : a.name) : p.company }));
                }}>
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.is_person ? ' (Person)' : ''}</option>)}
              </select>
            </SFField>
            <SFField label="Phone"><input className="sf-inp" style={sfInp()} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></SFField>
            <SFField label="Email"><input className="sf-inp" style={sfInp()} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></SFField>
            <SFField label="Stage">
              <select className="sf-inp" style={sfInp()} value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
                <option value="lead">Lead</option><option value="qualified">Qualified</option><option value="customer">Customer</option>
              </select>
            </SFField>
            <SFField label="Tags (comma separated)"><input className="sf-inp" style={sfInp()} value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} /></SFField>
            <SFField label="Description" span2><textarea className="sf-inp" rows={3} style={sfInp({ resize: 'vertical' })} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}
    </SFPage>
  );
}
