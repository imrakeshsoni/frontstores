// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Zap, CheckCircle2, ArrowRightCircle, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCRMLeads, createCRMLead, updateCRMLead, deleteCRMLead, convertCRMLead, listCRMTeamMembers, type CRMLead } from '@/lib/db/crm';
import { getCurrentStaffDisplayName } from '@/lib/db/staffUsers';
import { toast } from 'sonner';

const C = {
  bg: '#f0ece4', nav: '#0f1523', surface: '#ffffff', surface2: '#f8f5f0',
  border: '#e5dfd3', border2: '#ccc5b5', text: '#111520', muted: '#7c7869',
  accent: '#b8922a', accent2: '#d4aa44',
};

const STATUSES = ['new', 'working', 'converted', 'dead'] as const;
const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  new:       { label: 'New',       bg: '#ede9fe', color: '#6d28d9' },
  working:   { label: 'Working',   bg: '#fef3c7', color: '#92400e' },
  converted: { label: 'Converted', bg: '#dcfce7', color: '#15803d' },
  dead:      { label: 'Dead',      bg: '#f1f5f9', color: '#64748b' },
};
const SOURCES = ['Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Event', 'Other'];

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.surface2, border: `1px solid ${C.border}`, color: C.text,
  borderRadius: '4px', padding: '10px 14px', width: '100%', fontSize: '14px',
  fontFamily: "'Inter', -apple-system, sans-serif", outline: 'none',
  ...extra,
});

export function CRMLeadsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [convertLead, setConvertLead] = useState<CRMLead | null>(null);
  const [convertOpts, setConvertOpts] = useState({ createAccount: true, createContact: true, createDeal: true, dealValue: 0 });
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', source: '', status: 'new', lead_value: '', notes: '', owner: '', referred_by: '' });

  // Current logged-in user: null = tenant owner (sees all), string = staff (sees own leads only)
  const { data: currentStaff } = useQuery({
    queryKey: ['current-staff', tenantId],
    queryFn: () => getCurrentStaffDisplayName(tenantId),
    enabled: !!tenantId,
    staleTime: Infinity,
  });
  const isStaff = currentStaff !== null && currentStaff !== undefined;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['crm-leads', tenantId, search, filterStatus, currentStaff],
    queryFn: () => listCRMLeads(tenantId, { search, status: filterStatus, ownerFilter: currentStaff ?? null }),
    enabled: !!tenantId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['crm-team', tenantId],
    queryFn: () => listCRMTeamMembers(tenantId),
    enabled: !!tenantId,
  });
  const allOwners = [ownerName, ...teamMembers.map(m => m.name)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  const add = useMutation({
    mutationFn: () => createCRMLead(tenantId, {
      ...form,
      lead_value: parseFloat(form.lead_value) || 0,
      owner: form.owner || (isStaff ? currentStaff! : ownerName),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
      setShowAdd(false);
      setForm({ name: '', company: '', email: '', phone: '', source: '', status: 'new', lead_value: '', notes: '', owner: '', referred_by: '' });
      toast.success('Lead added');
    },
    onError: (e) => toast.error(String(e)),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCRMLead(tenantId, id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-leads'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCRMLead(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-leads'] }); qc.invalidateQueries({ queryKey: ['crm-stats'] }); toast.success('Lead deleted'); },
  });

  const doConvert = useMutation({
    mutationFn: () => convertCRMLead(tenantId, convertLead!.id, convertOpts),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
      const parts = [res.accountId && 'Account', res.contactId && 'Contact', res.dealId && 'Opportunity'].filter(Boolean);
      toast.success(`Lead converted → ${parts.join(', ')} created`);
      setConvertLead(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Page header */}
      <div style={{ padding: '28px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>Leads</h1>
          <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            {leads.length} lead{leads.length !== 1 ? 's' : ''} · Manage and convert
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'inherit' }}>
          + Add Lead
        </button>
      </div>

      <div style={{ padding: '24px 30px 30px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: C.muted }} />
            <input style={{ ...inp(), paddingLeft: '34px' }} placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', ...STATUSES] as string[]).map(s => {
              const isActive = filterStatus === s;
              return (
                <button key={s} onClick={() => setFilterStatus(s)}
                  style={{ background: isActive ? C.nav : C.surface, border: `1px solid ${isActive ? C.nav : C.border}`, color: isActive ? '#fff' : C.muted, padding: '8px 14px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                  {s === 'all' ? 'All' : STATUS_META[s]?.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Leads table */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>Loading…</div>
          ) : leads.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: C.muted, fontSize: '14px' }}>
              No leads found. <button onClick={() => setShowAdd(true)} style={{ background: 'none', border: 'none', color: C.accent, fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>Add your first lead →</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Company', 'Contact', 'Source', 'Owner / Ref', 'Value', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700, background: C.surface2 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => {
                  const sm = STATUS_META[lead.status] ?? STATUS_META.new;
                  return (
                    <tr key={lead.id} style={{ borderBottom: i < leads.length - 1 ? `1px solid ${C.border}` : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: '13.5px' }}>{lead.name}</div>
                        {lead.notes && <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.notes}</div>}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '13px', color: C.muted }}>{lead.company || '—'}</td>
                      <td style={{ padding: '13px 20px', fontSize: '12px', color: C.muted }}>
                        {lead.email && <div>{lead.email}</div>}
                        {lead.phone && <div>{lead.phone}</div>}
                        {!lead.email && !lead.phone && '—'}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '12px', color: C.muted }}>{lead.source || '—'}</td>
                      <td style={{ padding: '13px 20px', fontSize: '12px' }}>
                        {lead.owner && <div style={{ color: C.text, fontWeight: 600 }}>👤 {lead.owner}</div>}
                        {lead.referred_by && <div style={{ color: C.muted, marginTop: '2px' }}>🤝 {lead.referred_by}</div>}
                        {!lead.owner && !lead.referred_by && <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '13px', fontWeight: 600, color: lead.lead_value > 0 ? '#16a34a' : C.muted }}>
                        {lead.lead_value > 0 ? `₹${lead.lead_value.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ padding: '13px 20px' }}>
                        {lead.status === 'converted' ? (
                          <span style={{ background: sm.bg, color: sm.color, borderRadius: '2px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em' }}>{sm.label}</span>
                        ) : (
                          <select value={lead.status} onChange={e => setStatus.mutate({ id: lead.id, status: e.target.value })}
                            style={{ background: sm.bg, color: sm.color, border: 'none', borderRadius: '2px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
                            {STATUSES.filter(s => s !== 'converted').map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                          </select>
                        )}
                      </td>
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {lead.status !== 'converted' && (
                            <button onClick={() => { setConvertLead(lead); setConvertOpts({ createAccount: true, createContact: true, createDeal: true, dealValue: lead.lead_value ?? 0 }); }}
                              style={{ background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.03em', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <ArrowRightCircle style={{ width: '12px', height: '12px' }} /> Convert
                            </button>
                          )}
                          <button onClick={() => { if (confirm('Delete this lead?')) del.mutate(lead.id); }}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '6px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            <Trash2 style={{ width: '12px', height: '12px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '32px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: 'inherit' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em', color: C.text, margin: '0 0 24px' }}>New Lead</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {([['Full Name *', 'name', 'text'], ['Company', 'company', 'text'], ['Email', 'email', 'email'], ['Phone', 'phone', 'tel'], ['Lead Value (₹)', 'lead_value', 'number']] as [string, keyof typeof form, string][]).map(([label, key, type]) => (
                <div key={key} style={key === 'name' ? { gridColumn: '1 / -1' } : {}}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>{label}</label>
                  <input type={type} style={inp()} placeholder={label.replace(' *', '')} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Source</label>
                <select style={inp()} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  <option value="">— Select —</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Owner</label>
                <select style={inp()} value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                  <option value="">— Assign Owner —</option>
                  {allOwners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Referred By</label>
                <select style={inp()} value={form.referred_by} onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}>
                  <option value="">— None —</option>
                  {allOwners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Notes</label>
              <textarea style={{ ...inp(), resize: 'vertical', minHeight: '70px' }} placeholder="Notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: C.surface2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.name || add.isPending}
                style={{ flex: 2, background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', opacity: !form.name || add.isPending ? 0.6 : 1 }}>
                {add.isPending ? 'Saving…' : 'Save Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Lead Modal */}
      {convertLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: C.nav, borderRadius: '8px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap style={{ width: '18px', height: '18px', color: C.accent2 }} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.03em', color: C.text, margin: 0 }}>Convert Lead</h2>
                <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>{convertLead.name}{convertLead.company ? ` · ${convertLead.company}` : ''}</p>
              </div>
            </div>
            <p style={{ color: C.muted, fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>Auto-create records from this lead:</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'createAccount' as const, label: 'Account', desc: convertLead.company || '(no company — skip)', emoji: '🏢', disabled: !convertLead.company },
                { key: 'createContact' as const, label: 'Contact', desc: convertLead.name, emoji: '👤', disabled: false },
                { key: 'createDeal' as const, label: 'Opportunity', desc: `${convertLead.company || convertLead.name} — Opportunity`, emoji: '💰', disabled: false },
              ].map(item => (
                <label key={item.key}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', background: item.disabled ? C.surface2 : C.surface2, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '12px 14px', cursor: item.disabled ? 'not-allowed' : 'pointer', opacity: item.disabled ? 0.45 : 1 }}>
                  <input type="checkbox" checked={convertOpts[item.key] && !item.disabled} disabled={item.disabled}
                    onChange={e => setConvertOpts(o => ({ ...o, [item.key]: e.target.checked }))}
                    style={{ width: '15px', height: '15px', accentColor: C.nav, flexShrink: 0 }} />
                  <span style={{ fontSize: '18px' }}>{item.emoji}</span>
                  <div>
                    <p style={{ color: C.text, fontWeight: 700, fontSize: '13px', margin: 0 }}>{item.label}</p>
                    <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>{item.desc}</p>
                  </div>
                </label>
              ))}
              {convertOpts.createDeal && (
                <div style={{ marginTop: '4px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: '5px' }}>Deal Value (₹)</label>
                  <input type="number" style={inp()} placeholder="0" value={convertOpts.dealValue || ''}
                    onChange={e => setConvertOpts(o => ({ ...o, dealValue: parseFloat(e.target.value) || 0 }))} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setConvertLead(null)} style={{ flex: 1, background: C.surface2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => doConvert.mutate()} disabled={doConvert.isPending}
                style={{ flex: 2, background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', opacity: doConvert.isPending ? 0.6 : 1 }}>
                {doConvert.isPending ? 'Converting…' : 'Convert Lead →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
