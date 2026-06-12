// [crm] [all tenants] — Team: members, roles & commission rates
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Phone, Mail } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { toast } from 'sonner';
import { listCRMTeamMembers, createCRMTeamMember, updateCRMTeamMember, deleteCRMTeamMember, listCRMCommissions, type CRMTeamMember } from '@/lib/db/crm';
import { CRMPage, PageHead, Panel, EmptyState, Badge, Btn, Modal, Field, FormGrid, inp, Avatar, C, fmtINR } from './components/kit';
import { SF_TENANT_ID } from './components/lightning';
import { SalesforceTeamPage } from './SalesforceOpsPages';

const ROLES = [
  { key: 'owner', label: 'Owner', bg: C.amberBg, color: C.amber },
  { key: 'manager', label: 'Manager', bg: C.violetBg, color: C.violet },
  { key: 'agent', label: 'Sales Agent', bg: C.blueBg, color: C.blue },
  { key: 'support', label: 'Support', bg: C.greenBg, color: C.green },
  { key: 'referrer', label: 'Referrer', bg: C.pinkBg, color: C.pink },
];

const emptyForm = { name: '', phone: '', email: '', role: 'agent', commission_pct: '50', notes: '' };

export function TeamPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  // [crm] [tenant: FrontStores.com] — Salesforce-style team (table + wide record popup)
  if (tenantId === SF_TENANT_ID) return <SalesforceTeamPage />;
  return <AuroraTeamPage tenantId={tenantId} />;
}

// [crm] [all tenants] — original Aurora team UI
function AuroraTeamPage({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: team = [] } = useQuery({ queryKey: ['crm-team', tenantId], queryFn: () => listCRMTeamMembers(tenantId), enabled: !!tenantId });
  const { data: commissions = [] } = useQuery({ queryKey: ['crm-commissions', tenantId], queryFn: () => listCRMCommissions(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: async () => {
      const data = { ...form, commission_pct: Number(form.commission_pct) || 0 };
      if (editId) await updateCRMTeamMember(tenantId, editId, data);
      else await createCRMTeamMember(tenantId, data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-team'] }); setShowForm(false); setEditId(null); setForm(emptyForm); toast.success(editId ? 'Member updated' : 'Member added 👋'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCRMTeamMember(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-team'] }); toast.success('Member removed'); },
  });

  const openEdit = (m: CRMTeamMember) => {
    setEditId(m.id);
    setForm({ name: m.name, phone: m.phone, email: m.email, role: m.role, commission_pct: String(m.commission_pct ?? 50), notes: m.notes });
    setShowForm(true);
  };

  const earnings = (name: string) => commissions.filter(c => c.person_name === name).reduce((s, c) => s + (c.commission_amount || 0), 0);
  const pendingEarnings = (name: string) => commissions.filter(c => c.person_name === name && c.status === 'pending').reduce((s, c) => s + (c.commission_amount || 0), 0);

  return (
    <CRMPage>
      <PageHead title="Team" subtitle="Who sells, who supports, who refers — and what they earn."
        actions={<Btn onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={14} /> Add Member</Btn>} />

      {team.length === 0 ? (
        <Panel>
          <EmptyState emoji="🧑‍🤝‍🧑" title="No team members yet" hint="Add your sales agents and referrers — assign them leads, deals and tickets."
            action={<Btn small onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}><Plus size={13} /> Add First Member</Btn>} />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {team.map(m => {
            const role = ROLES.find(r => r.key === m.role) ?? ROLES[2];
            const total = earnings(m.name);
            const due = pendingEarnings(m.name);
            return (
              <div key={m.id} className="crm-hover-lift" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px', boxShadow: C.shadow }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar name={m.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: C.text }}>{m.name}</div>
                    <Badge bg={role.bg} color={role.color}>{role.label}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => openEdit(m)} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '7px', padding: '6px', cursor: 'pointer', color: C.muted, display: 'flex' }}><Pencil size={12} /></button>
                    <button onClick={() => { if (confirm(`Remove ${m.name}?`)) remove.mutate(m.id); }} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '7px', padding: '6px', cursor: 'pointer', color: C.red, display: 'flex' }}><Trash2 size={12} /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                  {m.phone && <div style={{ fontSize: '12px', color: C.muted, display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={11} /> {m.phone}</div>}
                  {m.email && <div style={{ fontSize: '12px', color: C.muted, display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={11} /> {m.email}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: `1px solid ${C.border}`, paddingTop: '12px' }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comm. %</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>{m.commission_pct}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Earned</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: C.green }}>{fmtINR(total)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Due</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: due > 0 ? C.amber : C.muted }}>{fmtINR(due)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editId ? 'Edit Member' : 'Add Team Member'} onClose={() => { setShowForm(false); setEditId(null); }}
          footer={<>
            <Btn variant="ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Btn>
            <Btn onClick={() => form.name.trim() ? save.mutate() : toast.error('Name is required')} disabled={save.isPending}>{editId ? 'Save Changes' : 'Add Member'}</Btn>
          </>}>
          <FormGrid>
            <Field label="Name *"><input style={inp()} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></Field>
            <Field label="Role">
              <select style={inp()} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Phone"><input style={inp()} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Field>
            <Field label="Email"><input style={inp()} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
            <Field label="Commission %"><input type="number" style={inp()} value={form.commission_pct} onChange={e => setForm(p => ({ ...p, commission_pct: e.target.value }))} /></Field>
            <Field label="Notes"><input style={inp()} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
          </FormGrid>
        </Modal>
      )}
    </CRMPage>
  );
}
