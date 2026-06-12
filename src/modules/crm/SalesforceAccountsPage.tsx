// [crm] [tenant: FrontStores.com] — Salesforce-style Accounts object:
// split view: account list left, account detail + related contacts right
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Building2, User, Phone, Mail, Globe, MapPin, Pencil, Search } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import {
  listCRMAccounts, createCRMAccount, updateCRMAccount, deleteCRMAccount,
  listCRMContacts, listCRMDeals, type CRMAccount,
} from '@/lib/db/crm';
import { fmtINR } from './components/kit';
import {
  SF, SF_ICONS, SFPage, SFObjectHeader, SFCard, SFBtn, SFBadge, SFStat, SFIconTile,
  SFHighlights, SFHL, SFModal, SFField, SFFormGrid, SFEmpty, SFSplit, SFListRow, sfInp,
} from './components/lightning';

const INDUSTRIES = ['', 'Retail', 'Manufacturing', 'Services', 'Technology', 'Healthcare', 'Education', 'Real Estate', 'Finance', 'Hospitality', 'Other'];

const emptyAccount = { name: '', type: 'business' as 'business' | 'person', industry: '', phone: '', email: '', website: '', address: '', owner_name: '', notes: '' };

export function SalesforceAccountsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const ownerName = useAppStore(s => s.config?.owner_name ?? '');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAccount);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery({ queryKey: ['crm-accounts', tenantId, search], queryFn: () => listCRMAccounts(tenantId, search), enabled: !!tenantId });
  const { data: contacts = [] } = useQuery({ queryKey: ['crm-contacts', tenantId, ''], queryFn: () => listCRMContacts(tenantId), enabled: !!tenantId });
  const { data: deals = [] } = useQuery({ queryKey: ['crm-deals', tenantId], queryFn: () => listCRMDeals(tenantId), enabled: !!tenantId });

  // Split view: when nothing is explicitly selected, the first account is shown
  const account = accounts.find(a => a.id === openId) ?? accounts[0] ?? null;
  // Real Salesforce-style link via account_id; the name match is kept only as a
  // fallback for rows created before migration 0074 on a not-yet-updated device
  const relatedContacts = useMemo(() => {
    if (!account) return [];
    const nameMatch = (c: { name: string; company: string }) => account.is_person
      ? c.name.trim().toLowerCase() === account.name.trim().toLowerCase()
      : c.company.trim().toLowerCase() === account.name.trim().toLowerCase();
    return contacts.filter(c => c.account_id === account.id || (!c.account_id && nameMatch(c)));
  }, [account, contacts]);
  const relatedOpps = useMemo(() => {
    if (!account) return [];
    return deals.filter(d => d.account_id === account.id || (!d.account_id && relatedContacts.some(c => c.id === d.contact_id)));
  }, [account, deals, relatedContacts]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm-accounts'] });

  const saveAccount = useMutation({
    mutationFn: async () => {
      if (editId) {
        await updateCRMAccount(tenantId, editId, {
          name: form.name.trim(), industry: form.industry, phone: form.phone.trim(), email: form.email.trim(),
          website: form.website.trim(), address: form.address.trim(), owner_name: form.owner_name.trim(), notes: form.notes.trim(),
        });
        return editId;
      }
      return createCRMAccount(tenantId, {
        name: form.name.trim(), industry: form.industry, phone: form.phone.trim(), email: form.email.trim(),
        website: form.website.trim(), address: form.address.trim(),
        owner_name: form.owner_name.trim() || ownerName, notes: form.notes.trim(),
        is_person: form.type === 'person' ? 1 : 0,
      });
    },
    onSuccess: () => { invalidate(); setShowForm(false); setEditId(null); setForm(emptyAccount); toast.success(editId ? 'Account updated' : 'Account created'); },
  });

  const removeAccount = useMutation({
    mutationFn: (id: string) => deleteCRMAccount(tenantId, id),
    onSuccess: () => { invalidate(); setOpenId(null); toast.success('Account deleted'); },
  });

  const startEdit = (a: CRMAccount) => {
    setForm({ name: a.name, type: a.is_person ? 'person' : 'business', industry: a.industry, phone: a.phone, email: a.email, website: a.website, address: a.address, owner_name: a.owner_name, notes: a.notes });
    setEditId(a.id);
    setShowForm(true);
  };

  const personCount = accounts.filter(a => a.is_person).length;

  return (
    <SFPage>
      <SFObjectHeader
        icon={<Building2 size={18} />} iconColor={SF_ICONS.account} objectLabel="Accounts"
        title="All Accounts" sub={`${accounts.length} item${accounts.length === 1 ? '' : 's'} · sorted by Account Name`}
        actions={
          <>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: SF.faint }} />
              <input className="sf-inp" placeholder="Search this list..." value={search} onChange={e => setSearch(e.target.value)}
                style={sfInp({ width: '210px', paddingLeft: '30px' })} />
            </div>
            <SFBtn variant="brand" onClick={() => { setForm(emptyAccount); setEditId(null); setShowForm(true); }}><Plus size={13} /> New</SFBtn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <SFStat label="All Accounts" value={accounts.length} accent={SF_ICONS.account} />
        <SFStat label="Business Accounts" value={accounts.length - personCount} accent={SF.brand} />
        <SFStat label="Person Accounts" value={personCount} accent={SF_ICONS.contact} />
      </div>

      {/* ── Split view: account list left, record detail right ── */}
      <SFSplit list={
        <SFCard noPad>
          <div className="sf-scroll" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {accounts.length === 0 ? (
              <SFEmpty title={search ? 'No accounts match your search' : 'No accounts yet'}
                hint={search ? 'Try a different name, phone or email.' : 'Create an account for each business or person you sell to. Converting a lead also creates one automatically.'}
                action={!search && <SFBtn variant="brand" onClick={() => { setForm(emptyAccount); setEditId(null); setShowForm(true); }}><Plus size={13} /> New Account</SFBtn>} />
            ) : accounts.map(a => (
              <SFListRow key={a.id}
                icon={a.is_person ? <User size={13} /> : <Building2 size={13} />}
                iconColor={a.is_person ? SF_ICONS.contact : SF_ICONS.account}
                title={a.name || '—'} sub={a.industry || a.phone || a.email || '—'}
                right={<SFBadge tone={a.is_person ? 'teal' : 'blue'}>{a.is_person ? 'Person' : 'Business'}</SFBadge>}
                selected={account?.id === a.id}
                onClick={() => setOpenId(a.id)} />
            ))}
          </div>
        </SFCard>
      }>
        {!account ? (
          <SFCard><SFEmpty title="Select an account" hint="Pick a record from the list on the left — its details open here." /></SFCard>
        ) : (
          <>
            {/* Record header + actions */}
            <SFCard noPad style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', flexWrap: 'wrap' }}>
                <SFIconTile color={account.is_person ? SF_ICONS.contact : SF_ICONS.account}>
                  {account.is_person ? <User size={16} /> : <Building2 size={16} />}
                </SFIconTile>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 600 }}>Account</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: SF.heading, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.name}</div>
                </div>
                <SFBadge tone={account.is_person ? 'teal' : 'blue'}>{account.is_person ? 'Person Account' : 'Business Account'}</SFBadge>
                <SFBtn small onClick={() => startEdit(account)}><Pencil size={12} /> Edit</SFBtn>
                <SFBtn small variant="destructive" disabled={removeAccount.isPending}
                  onClick={() => { if (confirm(`Delete account "${account.name}"?`)) removeAccount.mutate(account.id); }}>
                  <Trash2 size={12} /> Delete
                </SFBtn>
              </div>
            </SFCard>

            <SFHighlights>
              <SFHL label="Type">{account.is_person ? 'Person Account' : 'Business Account'}</SFHL>
              <SFHL label="Industry">{account.industry || '—'}</SFHL>
              <SFHL label="Phone">{account.phone || '—'}</SFHL>
              <SFHL label="Account Owner">{account.owner_name || '—'}</SFHL>
            </SFHighlights>

            <SFCard title="Details" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', fontSize: '13px', color: SF.text }}>
                {[
                  { icon: <Phone size={13} />, label: 'Phone', value: account.phone },
                  { icon: <Mail size={13} />, label: 'Email', value: account.email },
                  { icon: <Globe size={13} />, label: 'Website', value: account.website },
                  { icon: <MapPin size={13} />, label: 'Billing Address', value: account.address },
                ].map(d => (
                  <div key={d.label}>
                    <div style={{ fontSize: '11px', color: SF.muted, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>{d.icon} {d.label}</div>
                    <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{d.value || '—'}</div>
                  </div>
                ))}
                {account.notes && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '11px', color: SF.muted, marginBottom: '2px' }}>Description</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{account.notes}</div>
                  </div>
                )}
              </div>
            </SFCard>

            <SFCard title={`Opportunities (${relatedOpps.length})`} icon={<Building2 size={12} />} iconColor={SF_ICONS.opportunity} noPad style={{ marginBottom: '14px' }}>
              {relatedOpps.length === 0 ? (
                <SFEmpty title="No opportunities" hint="Opportunities for this account appear here automatically." />
              ) : relatedOpps.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: `1px solid ${SF.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: SF.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
                    <div style={{ fontSize: '11.5px', color: SF.muted }}>Stage: {d.stage}</div>
                  </div>
                  <SFBadge tone={d.stage === 'won' ? 'green' : d.stage === 'lost' ? 'red' : 'blue'}>{d.stage}</SFBadge>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: SF.text }}>{fmtINR(d.value)}</span>
                </div>
              ))}
            </SFCard>

            <SFCard title={`Contacts (${relatedContacts.length})`} icon={<User size={12} />} iconColor={SF_ICONS.contact} noPad>
              {relatedContacts.length === 0 ? (
                <SFEmpty title="No related contacts" hint={account.is_person ? 'No contact record matches this person yet.' : `Contacts whose company is "${account.name}" appear here.`} />
              ) : (
                relatedContacts.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: `1px solid ${SF.border}` }}>
                    <SFIconTile color={SF_ICONS.contact} size={24}><User size={12} /></SFIconTile>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: SF.heading }}>{c.name}</div>
                      <div style={{ fontSize: '11.5px', color: SF.muted }}>{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    {c.stage && <SFBadge tone="gray">{c.stage}</SFBadge>}
                  </div>
                ))
              )}
            </SFCard>
          </>
        )}
      </SFSplit>

      {/* New / Edit Account */}
      {showForm && (
        <SFModal title={editId ? 'Edit Account' : 'New Account'} onClose={() => { setShowForm(false); setEditId(null); }}
          footer={
            <>
              <SFBtn onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</SFBtn>
              <SFBtn variant="brand" disabled={!form.name.trim() || saveAccount.isPending} onClick={() => saveAccount.mutate()}>Save</SFBtn>
            </>
          }>
          <SFFormGrid>
            <SFField label="Account Type" required>
              <select className="sf-inp" value={form.type} disabled={!!editId}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'business' | 'person' }))} style={sfInp()}>
                <option value="business">Business Account</option>
                <option value="person">Person Account</option>
              </select>
            </SFField>
            <SFField label="Account Name" required>
              <input className="sf-inp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={form.type === 'person' ? 'Full name' : 'Company name'} style={sfInp()} autoFocus />
            </SFField>
            <SFField label="Industry">
              <select className="sf-inp" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} style={sfInp()}>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i || '— None —'}</option>)}
              </select>
            </SFField>
            <SFField label="Account Owner">
              <input className="sf-inp" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} placeholder={ownerName} style={sfInp()} />
            </SFField>
            <SFField label="Phone">
              <input className="sf-inp" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={sfInp()} />
            </SFField>
            <SFField label="Email">
              <input className="sf-inp" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={sfInp()} />
            </SFField>
            <SFField label="Website">
              <input className="sf-inp" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" style={sfInp()} />
            </SFField>
            <SFField label="Billing Address">
              <input className="sf-inp" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={sfInp()} />
            </SFField>
            <SFField label="Description" span2>
              <textarea className="sf-inp" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={sfInp({ resize: 'vertical' })} />
            </SFField>
          </SFFormGrid>
        </SFModal>
      )}

    </SFPage>
  );
}
