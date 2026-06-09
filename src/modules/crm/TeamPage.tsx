// [crm] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listCRMTeamMembers, createCRMTeamMember, updateCRMTeamMember, deleteCRMTeamMember, type CRMTeamMember } from '@/lib/db/crm';

const C = {
  bg: '#f0ece4', nav: '#0f1523', surface: '#ffffff', border: '#e5dfd3',
  border2: '#ccc5b5', text: '#111520', muted: '#7c7869', accent: '#b8922a',
};

const ROLES = ['owner', 'agent', 'manager', 'partner'];

const EMPTY: Partial<CRMTeamMember> = { name: '', phone: '', email: '', role: 'agent', commission_pct: 50, notes: '' };

export function TeamPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<CRMTeamMember>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ['crm-team', tenantId],
    queryFn: () => listCRMTeamMembers(tenantId),
    enabled: !!tenantId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm-team', tenantId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) throw new Error('Name required');
      if (editId) await updateCRMTeamMember(tenantId, editId, form);
      else await createCRMTeamMember(tenantId, form);
    },
    onSuccess: () => { invalidate(); setModal(null); setForm(EMPTY); setEditId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCRMTeamMember(tenantId, id),
    onSuccess: invalidate,
  });

  const openAdd = () => { setForm(EMPTY); setEditId(null); setModal('add'); };
  const openEdit = (m: CRMTeamMember) => { setForm(m); setEditId(m.id); setModal('edit'); };

  const inp = (k: keyof CRMTeamMember) => ({
    value: (form[k] ?? '') as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: k === 'commission_pct' ? parseFloat(e.target.value) || 0 : e.target.value })),
    style: { width: '100%', padding: '9px 12px', border: `1px solid ${C.border2}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' as const },
  });

  const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
    owner:   { bg: '#ede9fe', color: '#6d28d9' },
    manager: { bg: '#fef3c7', color: '#92400e' },
    agent:   { bg: '#dbeafe', color: '#1d4ed8' },
    partner: { bg: '#dcfce7', color: '#15803d' },
  };

  return (
    <div style={{ background: C.bg, minHeight: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ padding: '28px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: C.text, margin: 0 }}>Team Members</h1>
          <p style={{ fontSize: '11px', color: C.muted, marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
            Manage your sales team & commission splits
          </p>
        </div>
        <button onClick={openAdd}
          style={{ background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'inherit' }}>
          + Add Member
        </button>
      </div>

      <div style={{ padding: '24px 30px' }}>
        {/* Info banner */}
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: '#78350f', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0 }}>💡</span>
          <div>
            <strong>Commission Model:</strong> When a deal is won, <strong>50% always goes to the deal owner</strong> (the person working the deal) and <strong>50% goes to the referred-by person</strong> (who brought in the lead). If the same person is both, they get 100%.
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {members.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
              <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No team members yet</p>
              <p style={{ fontSize: '13px' }}>Add your sales agents and partners to track commissions.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f5f0' }}>
                  {['Name', 'Phone', 'Email', 'Role', 'Commission %', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => {
                  const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.agent;
                  return (
                    <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: '13px', color: C.text }}>{m.name}</td>
                      <td style={{ padding: '13px 16px', fontSize: '13px', color: C.muted }}>{m.phone || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: '13px', color: C.muted }}>{m.email || '—'}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ background: rc.bg, color: rc.color, borderRadius: '2px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>{m.role}</span>
                      </td>
                      <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: '13px', color: C.accent }}>{m.commission_pct}%</td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openEdit(m)}
                            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', color: C.text }}>
                            Edit
                          </button>
                          <button onClick={() => { if (confirm(`Remove ${m.name}?`)) deleteMutation.mutate(m.id); }}
                            style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '3px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', color: '#dc2626' }}>
                            Remove
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

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,21,35,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '22px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: C.text }}>{modal === 'edit' ? 'Edit Member' : 'Add Team Member'}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: C.muted, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' }}>Name *</label>
                <input {...inp('name')} placeholder="Full name" />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' }}>Phone</label>
                <input {...inp('phone')} placeholder="Mobile number" />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' }}>Email</label>
                <input {...inp('email')} placeholder="Email address" />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' }}>Role</label>
                <select {...inp('role')} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border2}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', background: '#fff' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' }}>Commission %</label>
                <input {...inp('commission_pct')} type="number" min="0" max="100" placeholder="50" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' }}>Notes</label>
                <textarea {...inp('notes')} rows={2} placeholder="Any notes..." style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border2}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)}
                style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: '4px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.text }}>
                Cancel
              </button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                style={{ background: C.nav, color: '#fff', border: 'none', borderRadius: '4px', padding: '9px 22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saveMutation.isPending ? 0.7 : 1 }}>
                {saveMutation.isPending ? 'Saving...' : modal === 'edit' ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
