// [crm] [tenant: FrontStores.com] — Salesforce-style Leads object:
// split view: record list on the left, full record detail on the right
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Phone, MessageSquare, Sparkles, Trash2, Pencil, Search, UserPlus } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMLeads, createCRMLead, updateCRMLead, deleteCRMLead, convertCRMLead,
  listCRMTeamMembers, type CRMLead,
} from '@/lib/db/crm';
import { sendWhatsApp } from '@/lib/whatsapp';
import { Confetti, fmtINR, fmtDate, timeAgo } from './components/kit';
import {
  SF, SF_ICONS, SFPage, SFObjectHeader, SFCard, SFBtn, SFBadge, SFTabs, SFPath, SFStat,
  SFHighlights, SFHL, SFModal, SFField, SFFormGrid, SFEmpty, SFIconTile, SFSplit, SFListRow, sfInp, type SFTone,
} from './components/lightning';

const STATUS_TONE: Record<string, SFTone> = { new: 'amber', working: 'blue', converted: 'green', dead: 'gray' };
const STATUS_LABEL: Record<string, string> = { new: 'New', working: 'Working', converted: 'Converted', dead: 'Dead' };
const LEAD_PATH = [{ key: 'new', label: 'New' }, { key: 'working', label: 'Working' }];

const SOURCES = ['whatsapp', 'referral', 'website', 'walk-in', 'cold-call', 'social', 'other'];
const emptyForm = { name: '', company: '', email: '', phone: '', source: '', status: 'new', lead_value: '', notes: '', owner: '', referred_by: '' };

export function SalesforceLeadsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? '');
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewId, setViewId] = useState<string | null>(null);
  const [convertLead, setConvertLead] = useState<CRMLead | null>(null);
  const [convertOpts, setConvertOpts] = useState({ createContact: true, createDeal: true, dealValue: '', accountType: 'business' as 'business' | 'person' });
  const [celebrate, setCelebrate] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ['crm-leads', tenantId, statusFilter, search],
    queryFn: () => listCRMLeads(tenantId, { status: statusFilter === 'all' ? undefined : statusFilter, search }),
    enabled: !!tenantId,
  });
  const { data: allLeads = [] } = useQuery({ queryKey: ['crm-leads', tenantId, 'all', ''], queryFn: () => listCRMLeads(tenantId, {}), enabled: !!tenantId });
  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });

  // Split view: when nothing is explicitly selected, the first lead in the list is shown
  const viewLead = allLeads.find(l => l.id === viewId) ?? leads.find(l => l.id === viewId) ?? leads[0] ?? null;
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['crm-leads'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); };

  const save = useMutation({
    mutationFn: async () => {
      const data = { ...form, lead_value: Number(form.lead_value) || 0 };
      if (editId) await updateCRMLead(tenantId, editId, data);
      else await createCRMLead(tenantId, data);
    },
    onSuccess: () => { invalidate(); setShowForm(false); setEditId(null); setForm(emptyForm); toast.success(editId ? 'Lead updated' : 'Lead created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMLead(tenantId, id, { status }),
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMLead(tenantId, id),
    onSuccess: () => { invalidate(); setViewId(null); toast.success('Lead deleted'); },
  });

  // Salesforce-style conversion: Account always created (business or Person Account),
  // opportunity starts at Prospecting, customer gets a WhatsApp welcome
  const convert = useMutation({
    mutationFn: () => convertCRMLead(tenantId, convertLead!.id, {
      createAccount: true,
      createContact: convertOpts.createContact,
      createDeal: convertOpts.createDeal,
      dealValue: Number(convertOpts.dealValue) || undefined,
      accountMode: convertLead!.company ? convertOpts.accountType : 'person',
      dealStage: 'prospecting',
    }),
    onSuccess: (res) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-accounts'] });
      if (convertLead?.phone) {
        sendWhatsApp(convertLead.phone,
          `Hi ${convertLead.name}! 👋 Thank you for your interest in ${shopName}. We've opened your file and will keep you updated at every step — from demo to final quote. Talk soon!`
        ).then(() => toast.success('Welcome message sent on WhatsApp ✓')).catch(() => {});
      }
      setConvertLead(null); setViewId(null);
      setCelebrate(true); setTimeout(() => setCelebrate(false), 2200);
      toast.success(`Lead converted!${res.dealId ? ' Opportunity created at Prospecting.' : ''}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (l: CRMLead) => {
    setEditId(l.id);
    setForm({ name: l.name, company: l.company, email: l.email, phone: l.phone, source: l.source, status: l.status, lead_value: String(l.lead_value || ''), notes: l.notes, owner: l.owner, referred_by: l.referred_by });
    setViewId(null);
    setShowForm(true);
  };

  const startConvert = (l: CRMLead) => {
    setConvertLead(l);
    setConvertOpts({ createContact: true, createDeal: true, dealValue: String(l.lead_value || ''), accountType: l.company ? 'business' : 'person' });
  };

  const counts = (s: string) => s === 'all' ? allLeads.length : allLeads.filter(l => l.status === s).length;
  const openValue = allLeads.filter(l => l.status === 'new' || l.status === 'working').reduce((s, l) => s + (l.lead_value || 0), 0);

  return (
    <SFPage>
      {celebrate && <Confetti />}
      <SFObjectHeader
        icon={<UserPlus size={18} />} iconColor={SF_ICONS.lead} objectLabel="Leads"
        title="All Leads" sub={`${leads.length} item${leads.length === 1 ? '' : 's'} · updated ${timeAgo(allLeads[0]?.updated_at) || 'just now'}`}
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
        <SFStat label="Open Leads" value={counts('new') + counts('working')} accent={SF_ICONS.lead} />
        <SFStat label="Open Lead Value" value={fmtINR(openValue)} accent={SF.brand} />
        <SFStat label="Converted" value={counts('converted')} accent={SF.green} />
      </div>

      <SFTabs style={{ marginBottom: '10px' }} active={statusFilter} onChange={setStatusFilter}
        tabs={[
          { key: 'all', label: 'All', count: counts('all') },
          ...Object.keys(STATUS_LABEL).map(key => ({ key, label: STATUS_LABEL[key], count: counts(key) })),
        ]} />

      {/* ── Split view: lead list left, record detail right ── */}
      <SFSplit list={
        <SFCard noPad>
          <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 330px)', overflowY: 'auto' }}>
            {leads.length === 0 ? (
              <SFEmpty title={search ? 'No leads match your search' : 'No leads here yet'}
                hint={search ? 'Try a different name, company or email.' : 'Create your first lead, or import enquiries from the WhatsApp tab.'}
                action={!search && <SFBtn variant="brand" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> New Lead</SFBtn>} />
            ) : leads.map(l => (
              <SFListRow key={l.id} icon={<UserPlus size={13} />} iconColor={SF_ICONS.lead}
                title={l.name} sub={`${l.company || l.phone || '—'}${l.lead_value ? ` · ${fmtINR(l.lead_value)}` : ''}`}
                right={<SFBadge tone={STATUS_TONE[l.status] ?? 'gray'}>{STATUS_LABEL[l.status] ?? l.status}</SFBadge>}
                selected={viewLead?.id === l.id}
                onClick={() => setViewId(l.id)} />
            ))}
          </div>
        </SFCard>
      }>
        {!viewLead ? (
          <SFCard><SFEmpty title="Select a lead" hint="Pick a record from the list on the left — its details open here." /></SFCard>
        ) : (
          <>
            {/* Record header + actions */}
            <SFCard noPad style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                <SFIconTile color={SF_ICONS.lead}><UserPlus size={16} /></SFIconTile>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Lead</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: SF.heading, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewLead.name}</div>
                </div>
                <SFBadge tone={STATUS_TONE[viewLead.status] ?? 'gray'}>{STATUS_LABEL[viewLead.status] ?? viewLead.status}</SFBadge>
                <SFBtn small onClick={() => openEdit(viewLead)}><Pencil size={12} /> Edit</SFBtn>
                <SFBtn small variant="destructive" onClick={() => { if (confirm(`Delete lead "${viewLead.name}"?`)) remove.mutate(viewLead.id); }}><Trash2 size={12} /> Delete</SFBtn>
                {viewLead.phone && (
                  <>
                    <SFBtn small onClick={() => window.open(`tel:${viewLead.phone}`)}><Phone size={12} /> Call</SFBtn>
                    <SFBtn small onClick={() => sendWhatsApp(viewLead.phone, `Hi ${viewLead.name},`).catch(e => toast.error(e.message))}>
                      <MessageSquare size={12} /> WhatsApp
                    </SFBtn>
                  </>
                )}
                {viewLead.status !== 'converted' && (
                  <SFBtn small variant="brand" onClick={() => startConvert(viewLead)}><Sparkles size={12} /> Convert</SFBtn>
                )}
              </div>
            </SFCard>

            {/* Lead status path — click a stage to move the lead */}
            <div style={{ marginBottom: '14px' }}>
              <SFPath
                stages={LEAD_PATH}
                current={viewLead.status}
                onSelect={viewLead.status === 'converted' ? undefined : (k) => setStatus.mutate({ id: viewLead.id, status: k })}
                closedLabel={viewLead.status === 'converted' ? 'Converted' : viewLead.status === 'dead' ? 'Dead' : undefined}
                closedTone={viewLead.status === 'dead' ? 'red' : 'green'}
              />
            </div>

            <SFHighlights>
              <SFHL label="Company">{viewLead.company || '—'}</SFHL>
              <SFHL label="Phone">{viewLead.phone || '—'}</SFHL>
              <SFHL label="Email">{viewLead.email || '—'}</SFHL>
              <SFHL label="Lead Value">{viewLead.lead_value ? fmtINR(viewLead.lead_value) : '—'}</SFHL>
              <SFHL label="Owner">{viewLead.owner || '—'}</SFHL>
            </SFHighlights>

            <SFCard title="Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 24px' }}>
                {[
                  ['Source', viewLead.source], ['Referred By', viewLead.referred_by],
                  ['Business Type', viewLead.business_type], ['Interest', viewLead.software_interest],
                  ['Created / Updated', timeAgo(viewLead.updated_at)],
                  ['Converted On', viewLead.converted_at ? fmtDate(viewLead.converted_at) : ''],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string}>
                    <div style={{ fontSize: '11px', color: SF.muted, marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: SF.text, wordBreak: 'break-word' }}>{v}</div>
                  </div>
                ))}
              </div>
              {viewLead.notes && (
                <div style={{ marginTop: '14px', background: SF.cardHead, border: `1px solid ${SF.border}`, borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: SF.text, whiteSpace: 'pre-wrap' }}>
                  {viewLead.notes}
                </div>
              )}
            </SFCard>

            {viewLead.status !== 'converted' && viewLead.status !== 'dead' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Mark as:</span>
                <SFBtn small variant="destructive" onClick={() => setStatus.mutate({ id: viewLead.id, status: 'dead' })}>Dead</SFBtn>
              </div>
            )}
          </>
        )}
      </SFSplit>


      {/* New / Edit Lead */}
      {showForm && (
        <SFModal title={editId ? 'Edit Lead' : 'New Lead'} onClose={() => { setShowForm(false); setEditId(null); }}
          footer={
            <>
              <SFBtn onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</SFBtn>
              <SFBtn variant="brand" disabled={save.isPending}
                onClick={() => form.name.trim() ? save.mutate() : toast.error('Name is required')}>
                {editId ? 'Save' : 'Save Lead'}
              </SFBtn>
            </>
          }>
          <SFFormGrid>
            <SFField label="Name" required><input className="sf-inp" style={sfInp()} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></SFField>
            <SFField label="Company"><input className="sf-inp" style={sfInp()} value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></SFField>
            <SFField label="Phone"><input className="sf-inp" style={sfInp()} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></SFField>
            <SFField label="Email"><input className="sf-inp" style={sfInp()} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></SFField>
            <SFField label="Lead Source">
              <select className="sf-inp" style={sfInp()} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                <option value="">— None —</option>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </SFField>
            <SFField label="Lead Value (₹)"><input className="sf-inp" style={sfInp()} type="number" value={form.lead_value} onChange={e => setForm(p => ({ ...p, lead_value: e.target.value }))} /></SFField>
            <SFField label="Lead Owner">
              <select className="sf-inp" style={sfInp()} value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}>
                <option value="">— None —</option>
                {team.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </SFField>
            <SFField label="Referred By"><input className="sf-inp" style={sfInp()} value={form.referred_by} onChange={e => setForm(p => ({ ...p, referred_by: e.target.value }))} /></SFField>
            <SFField label="Description" span2><textarea className="sf-inp" rows={3} style={sfInp({ resize: 'vertical' })} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></SFField>
          </SFFormGrid>
        </SFModal>
      )}

      {/* Convert Lead */}
      {convertLead && (
        <SFModal title={`Convert ${convertLead.name}`} onClose={() => setConvertLead(null)} width={520}
          footer={
            <>
              <SFBtn onClick={() => setConvertLead(null)}>Cancel</SFBtn>
              <SFBtn variant="brand" disabled={convert.isPending} onClick={() => convert.mutate()}><Sparkles size={13} /> Convert</SFBtn>
            </>
          }>
          <p style={{ fontSize: '12.5px', color: SF.muted, margin: '0 0 14px' }}>
            An Account is always created. Pick the rest — the lead is then marked Converted.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {([['business', `🏢 Business — ${convertLead.company || 'no company name'}`], ['person', `🙋 Person Account — ${convertLead.name}`]] as const).map(([k, label]) => {
              const disabled = k === 'business' && !convertLead.company;
              const active = (convertLead.company ? convertOpts.accountType : 'person') === k;
              return (
                <label key={k} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: `1px solid ${active ? SF.brand : SF.border}`, borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, background: active ? SF.brandSoft : SF.card, fontSize: '12px', fontWeight: 700, color: SF.text }}>
                  <input type="radio" disabled={disabled} checked={active} onChange={() => setConvertOpts(p => ({ ...p, accountType: k }))} />
                  {label}
                </label>
              );
            })}
          </div>
          {[
            { key: 'createContact' as const, emoji: '👤', label: 'Contact', desc: convertLead.name },
            { key: 'createDeal' as const, emoji: '💰', label: 'Opportunity', desc: `${convertLead.company || convertLead.name} — starts at Prospecting` },
          ].map(o => (
            <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: `1px solid ${SF.border}`, borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', background: convertOpts[o.key] ? SF.brandSoft : SF.card }}>
              <input type="checkbox" checked={convertOpts[o.key]} onChange={e => setConvertOpts(p => ({ ...p, [o.key]: e.target.checked }))} />
              <span style={{ fontSize: '20px' }}>{o.emoji}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: SF.heading }}>{o.label}</div>
                <div style={{ fontSize: '11px', color: SF.muted }}>{o.desc}</div>
              </div>
            </label>
          ))}
          {convertOpts.createDeal && (
            <SFField label="Opportunity Amount (₹)">
              <input className="sf-inp" style={sfInp()} type="number" value={convertOpts.dealValue} onChange={e => setConvertOpts(p => ({ ...p, dealValue: e.target.value }))} />
            </SFField>
          )}
        </SFModal>
      )}
    </SFPage>
  );
}
