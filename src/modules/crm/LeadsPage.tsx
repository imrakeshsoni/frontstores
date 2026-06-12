// [crm] [all tenants] — Leads: capture → work → convert (Account + Contact + Deal)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Phone, MessageSquare, Sparkles, Trash2, Pencil } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMLeads, createCRMLead, updateCRMLead, deleteCRMLead, convertCRMLead,
  listCRMTeamMembers, type CRMLead,
} from '@/lib/db/crm';
import { sendWhatsApp } from '@/lib/whatsapp';
import {
  CRMPage, PageHead, Segments, SearchInput, Panel, EmptyState, Badge, Avatar, Btn, Modal, Drawer,
  Field, FormGrid, inp, Confetti, C, fmtINR, fmtDate, timeAgo, th, td,
} from './components/kit';
import { SF_TENANT_ID } from './components/lightning';
import { SalesforceLeadsPage } from './SalesforceLeadsPage';

// Built as a function — C tokens are swapped per theme/brand at render time, so reading
// them at module scope freezes the dark-theme colors and badges become unreadable in light
const statusMeta = (): Record<string, { label: string; bg: string; color: string }> => ({
  new:       { label: 'New',       bg: C.amberBg,  color: C.amber },
  working:   { label: 'Working',   bg: C.blueBg,   color: C.blue },
  converted: { label: 'Converted', bg: C.greenBg,  color: C.green },
  dead:      { label: 'Dead',      bg: C.slateBg,  color: C.slate },
});

const SOURCES = ['whatsapp', 'referral', 'website', 'walk-in', 'cold-call', 'social', 'other'];

const emptyForm = { name: '', company: '', email: '', phone: '', source: '', status: 'new', lead_value: '', notes: '', owner: '', referred_by: '' };

export function CRMLeadsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  // [crm] [tenant: FrontStores.com] — Salesforce-style Leads (table list + wide record popup)
  if (tenantId === SF_TENANT_ID) return <SalesforceLeadsPage />;
  return <AuroraLeadsPage tenantId={tenantId} />;
}

// [crm] [all tenants] — original Aurora leads UI
function AuroraLeadsPage({ tenantId }: { tenantId: string }) {
  const STATUS_META = statusMeta();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewLead, setViewLead] = useState<CRMLead | null>(null);
  const [convertLead, setConvertLead] = useState<CRMLead | null>(null);
  const [convertOpts, setConvertOpts] = useState({ createAccount: true, createContact: true, createDeal: true, dealValue: '', accountType: 'business' as 'business' | 'person' });
  const [celebrate, setCelebrate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: leads = [] } = useQuery({
    queryKey: ['crm-leads', tenantId, statusFilter, search],
    queryFn: () => listCRMLeads(tenantId, { status: statusFilter === 'all' ? undefined : statusFilter, search }),
    enabled: !!tenantId,
  });
  const { data: allLeads = [] } = useQuery({ queryKey: ['crm-leads', tenantId, 'all', ''], queryFn: () => listCRMLeads(tenantId, {}), enabled: !!tenantId });
  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-leads'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); };

  const save = useMutation({
    mutationFn: async () => {
      const data = { ...form, lead_value: Number(form.lead_value) || 0 };
      if (editId) await updateCRMLead(tenantId, editId, data);
      else await createCRMLead(tenantId, data);
    },
    onSuccess: () => { invalidate(); setShowForm(false); setEditId(null); setForm(emptyForm); toast.success(editId ? 'Lead updated' : 'Lead added 🎉'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMLead(tenantId, id, { status }),
    onSuccess: () => { invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMLead(tenantId, id),
    onSuccess: () => { invalidate(); setViewLead(null); toast.success('Lead deleted'); },
  });

  // [crm] [tenant: FrontStores.com] — Salesforce-style conversion: always create Account
  // (business name or Person Account), opportunity starts at Prospecting, customer gets a WhatsApp welcome
  const isSF = tenantId === SF_TENANT_ID;
  const shopName = useAppStore(s => s.config?.shop_name ?? '');

  const convert = useMutation({
    mutationFn: () => convertCRMLead(tenantId, convertLead!.id, {
      createAccount: isSF ? convertOpts.createAccount : (convertOpts.createAccount && !!convertLead!.company),
      createContact: convertOpts.createContact,
      createDeal: convertOpts.createDeal,
      dealValue: Number(convertOpts.dealValue) || undefined,
      accountMode: isSF ? (convertLead!.company ? convertOpts.accountType : 'person') : undefined,
      dealStage: isSF ? 'prospecting' : undefined,
    }),
    onSuccess: (res) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      if (isSF && convertLead?.phone) {
        sendWhatsApp(convertLead.phone,
          `Hi ${convertLead.name}! 👋 Thank you for your interest in ${shopName}. We've opened your file and will keep you updated at every step — from demo to final quote. Talk soon!`
        ).then(() => toast.success('Welcome message sent on WhatsApp ✓')).catch(() => {});
      }
      setConvertLead(null); setViewLead(null);
      setCelebrate(true); setTimeout(() => setCelebrate(false), 2200);
      toast.success(`Lead converted! ${res.dealId ? (isSF ? 'Opportunity created at Prospecting.' : 'Deal created in pipeline.') : ''}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (l: CRMLead) => {
    setEditId(l.id);
    setForm({ name: l.name, company: l.company, email: l.email, phone: l.phone, source: l.source, status: l.status, lead_value: String(l.lead_value || ''), notes: l.notes, owner: l.owner, referred_by: l.referred_by });
    setViewLead(null);
    setShowForm(true);
  };

  const counts = (s: string) => s === 'all' ? allLeads.length : allLeads.filter(l => l.status === s).length;

  return (
    <CRMPage>
      {celebrate && <Confetti />}
      <PageHead title="Leads" subtitle="Capture, qualify and convert prospects into customers."
        actions={<Btn onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={14} /> New Lead</Btn>} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Segments value={statusFilter} onChange={setStatusFilter}
          options={[{ key: 'all', label: 'All', count: counts('all') }, ...Object.entries(STATUS_META).map(([key, m]) => ({ key, label: m.label, count: counts(key) }))]} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, company, email…" />
      </div>

      <Panel>
        {leads.length === 0 ? (
          <EmptyState emoji="🧲" title="No leads here yet" hint="Add your first lead, or import enquiries from the WhatsApp Inbox."
            action={<Btn small onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> Add Lead</Btn>} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Lead</th><th style={th}>Source</th><th style={th}>Value</th><th style={th}>Owner</th><th style={th}>Status</th><th style={th}>Updated</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {leads.map(l => {
                const sm = STATUS_META[l.status] ?? STATUS_META.new;
                return (
                  <tr key={l.id} className="crm-row" style={{ cursor: 'pointer' }} onClick={() => setViewLead(l)}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={l.name} size={32} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{l.name}</div>
                          <div style={{ fontSize: '11px', color: C.muted }}>{l.company || l.phone || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>{l.source ? <Badge bg={C.surface2} color={C.muted}>{l.source}</Badge> : <span style={{ color: C.faint }}>—</span>}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{l.lead_value ? fmtINR(l.lead_value) : <span style={{ color: C.faint }}>—</span>}</td>
                    <td style={td}>{l.owner || <span style={{ color: C.faint }}>—</span>}</td>
                    <td style={td}><Badge bg={sm.bg} color={sm.color}>{sm.label}</Badge></td>
                    <td style={{ ...td, color: C.muted, fontSize: '12px' }}>{timeAgo(l.updated_at)}</td>
                    <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {l.status !== 'converted' && (
                        <Btn variant="subtle" small onClick={() => { setConvertLead(l); setConvertOpts({ createAccount: isSF || !!l.company, createContact: true, createDeal: true, dealValue: String(l.lead_value || ''), accountType: l.company ? 'business' : 'person' }); }}>
                          <Sparkles size={12} /> Convert
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Add / Edit modal */}
      {showForm && (
        <Modal title={editId ? 'Edit Lead' : 'New Lead'} onClose={() => { setShowForm(false); setEditId(null); }}
          footer={<>
            <Btn variant="ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Btn>
            <Btn onClick={() => form.name.trim() ? save.mutate() : toast.error('Name is required')} disabled={save.isPending}>{editId ? 'Save Changes' : 'Add Lead'}</Btn>
          </>}>
          <FormGrid>
            <Field label="Name *"><input style={inp()} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></Field>
            <Field label="Company"><input style={inp()} value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></Field>
            <Field label="Phone"><input style={inp()} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Field>
            <Field label="Email"><input style={inp()} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
            <Field label="Source">
              <select style={inp()} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                <option value="">— select —</option>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Estimated Value (₹)"><input type="number" style={inp()} value={form.lead_value} onChange={e => setForm(p => ({ ...p, lead_value: e.target.value }))} /></Field>
            <Field label="Owner">
              <select style={inp()} value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}>
                <option value="">— select —</option>
                {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Referred By"><input style={inp()} value={form.referred_by} onChange={e => setForm(p => ({ ...p, referred_by: e.target.value }))} /></Field>
            <Field label="Notes" span2><textarea style={inp({ minHeight: '70px', resize: 'vertical' })} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}

      {/* Lead detail drawer */}
      {viewLead && (
        <Drawer eyebrow="Lead" title={viewLead.name} onClose={() => setViewLead(null)}
          footer={<>
            <Btn variant="ghost" small onClick={() => openEdit(viewLead)}><Pencil size={12} /> Edit</Btn>
            <Btn variant="danger" small onClick={() => { if (confirm('Delete this lead?')) remove.mutate(viewLead.id); }}><Trash2 size={12} /> Delete</Btn>
            <div style={{ flex: 1 }} />
            {viewLead.status !== 'converted' && (
              <Btn variant="success" small onClick={() => { setConvertLead(viewLead); setConvertOpts({ createAccount: isSF || !!viewLead.company, createContact: true, createDeal: true, dealValue: String(viewLead.lead_value || ''), accountType: viewLead.company ? 'business' : 'person' }); }}>
                <Sparkles size={12} /> Convert
              </Btn>
            )}
          </>}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            {viewLead.phone && <>
              <Btn variant="subtle" small onClick={() => window.open(`tel:${viewLead.phone}`)}><Phone size={12} /> Call</Btn>
              <Btn variant="subtle" small onClick={() => sendWhatsApp(viewLead.phone, `Hi ${viewLead.name},`).catch(e => toast.error(e.message))}><MessageSquare size={12} /> WhatsApp</Btn>
            </>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              ['Company', viewLead.company], ['Phone', viewLead.phone], ['Email', viewLead.email], ['Source', viewLead.source],
              ['Value', viewLead.lead_value ? fmtINR(viewLead.lead_value) : ''], ['Owner', viewLead.owner],
              ['Referred By', viewLead.referred_by], ['Business Type', viewLead.business_type],
              ['Interest', viewLead.software_interest], ['Converted', viewLead.converted_at ? fmtDate(viewLead.converted_at) : ''],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string}>
                <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800, marginBottom: '3px' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{v}</div>
              </div>
            ))}
          </div>
          {viewLead.notes && (
            <div style={{ marginTop: '16px', background: C.surface2, borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: C.text, whiteSpace: 'pre-wrap' }}>{viewLead.notes}</div>
          )}
          {viewLead.status !== 'converted' && (
            <div style={{ marginTop: '18px' }}>
              <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 800, marginBottom: '6px' }}>Status</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['new', 'working', 'dead'] as const).map(s => (
                  <Btn key={s} small variant={viewLead.status === s ? 'primary' : 'ghost'}
                    onClick={() => { setStatus.mutate({ id: viewLead.id, status: s }); setViewLead({ ...viewLead, status: s }); }}>
                    {STATUS_META[s].label}
                  </Btn>
                ))}
              </div>
            </div>
          )}
        </Drawer>
      )}

      {/* Convert modal */}
      {convertLead && (
        <Modal title={`Convert "${convertLead.name}"`} onClose={() => setConvertLead(null)} width={460}
          footer={<>
            <Btn variant="ghost" onClick={() => setConvertLead(null)}>Cancel</Btn>
            <Btn variant="success" onClick={() => convert.mutate()} disabled={convert.isPending}><Sparkles size={13} /> Convert Lead</Btn>
          </>}>
          <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 14px' }}>Pick what gets created. The lead is then marked converted.</p>
          {/* [crm] [tenant: FrontStores.com] — Salesforce-style: account always created; business vs Person Account */}
          {isSF && convertOpts.createAccount && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              {([['business', `🏢 Business — ${convertLead.company || 'no company name'}`], ['person', `🙋 Person Account — ${convertLead.name}`]] as const).map(([k, label]) => {
                const disabled = k === 'business' && !convertLead.company;
                const active = (convertLead.company ? convertOpts.accountType : 'person') === k;
                return (
                  <label key={k} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: `1px solid ${active ? C.accent : C.border}`, borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, background: active ? C.accentSoft : C.surface, fontSize: '12px', fontWeight: 700, color: C.text }}>
                    <input type="radio" disabled={disabled} checked={active} onChange={() => setConvertOpts(p => ({ ...p, accountType: k }))} />
                    {label}
                  </label>
                );
              })}
            </div>
          )}
          {[
            { key: 'createAccount' as const, emoji: '🏢', label: 'Account', desc: isSF ? (convertLead.company && convertOpts.accountType === 'business' ? convertLead.company : `${convertLead.name} (Person Account)`) : (convertLead.company || 'No company on lead — skipped'), disabled: isSF ? false : !convertLead.company },
            { key: 'createContact' as const, emoji: '👤', label: 'Contact', desc: convertLead.name, disabled: false },
            { key: 'createDeal' as const, emoji: '💰', label: isSF ? 'Opportunity' : 'Deal in Pipeline', desc: `${convertLead.company || convertLead.name} — Opportunity${isSF ? ' · starts at Prospecting' : ''}`, disabled: false },
          ].map(o => (
            <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', marginBottom: '8px', cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.5 : 1, background: convertOpts[o.key] && !o.disabled ? C.surface2 : C.surface }}>
              <input type="checkbox" checked={convertOpts[o.key] && !o.disabled} disabled={o.disabled}
                onChange={e => setConvertOpts(p => ({ ...p, [o.key]: e.target.checked }))} />
              <span style={{ fontSize: '20px' }}>{o.emoji}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{o.label}</div>
                <div style={{ fontSize: '11px', color: C.muted }}>{o.desc}</div>
              </div>
            </label>
          ))}
          {convertOpts.createDeal && (
            <Field label="Deal Value (₹)">
              <input type="number" style={inp()} value={convertOpts.dealValue} onChange={e => setConvertOpts(p => ({ ...p, dealValue: e.target.value }))} />
            </Field>
          )}
        </Modal>
      )}
    </CRMPage>
  );
}
