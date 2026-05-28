// [beauty] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, UserCheck } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listAllStaff, createStaff, updateStaff, deleteStaff, type BeautyStaff } from '@/lib/db/beauty';

const ROLES = ['stylist', 'beautician', 'nail_tech', 'makeup_artist', 'therapist', 'receptionist', 'manager'];
const ROLE_LABEL: Record<string, string> = {
  stylist: 'Stylist', beautician: 'Beautician', nail_tech: 'Nail Tech',
  makeup_artist: 'Makeup Artist', therapist: 'Therapist', receptionist: 'Receptionist', manager: 'Manager',
};

type Form = { name: string; phone: string; role: string; specialization: string; is_active: boolean };
const emptyForm: Form = { name: '', phone: '', role: 'stylist', specialization: '', is_active: true };

export function BeautyStaffPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BeautyStaff | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['beauty-staff-all', tenantId],
    queryFn:  () => listAllStaff(tenantId),
    enabled:  !!tenantId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['beauty-staff-all'] });
    qc.invalidateQueries({ queryKey: ['beauty-staff'] });
  };

  const openEdit = (s: BeautyStaff) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone ?? '', role: s.role, specialization: s.specialization ?? '', is_active: s.is_active });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Name required');
      const data = { name: form.name.trim(), phone: form.phone || null, role: form.role, specialization: form.specialization || null, is_active: form.is_active };
      return editing ? updateStaff(tenantId, editing.id, data) : createStaff(tenantId, data).then(() => {});
    },
    onSuccess: () => { toast.success(editing ? 'Staff updated' : 'Staff added'); setShowForm(false); setEditing(null); setForm(emptyForm); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStaff(tenantId, id),
    onSuccess: () => { toast.success('Staff removed'); invalidate(); },
  });

  const active   = staff.filter(s => s.is_active);
  const inactive = staff.filter(s => !s.is_active);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Beauty Parlor</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Staff</h1>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <UserCheck size={18} />
          </div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Active</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{active.length}</p></div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#f1f5f9', color: '#64748b' }}>
            <UserCheck size={18} />
          </div>
          <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total</p><p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{staff.length}</p></div>
        </div>
      </div>

      {/* Staff list */}
      {isLoading && Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
      ))}

      {!isLoading && staff.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-4xl">💇</p>
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No staff added yet</p>
          <button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
            className="mt-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
            Add First Staff Member
          </button>
        </div>
      )}

      {[{ label: 'Active Staff', list: active }, { label: 'Inactive', list: inactive }].map(({ label, list }) =>
        list.length > 0 && (
          <div key={label} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="px-4 py-2.5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label} ({list.length})</p>
            </div>
            {list.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3"
                style={{ borderBottom: idx < list.length - 1 ? '1px solid var(--surface-border)' : 'none', opacity: s.is_active ? 1 : 0.5 }}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'var(--accent)' }}>
                  {s.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {ROLE_LABEL[s.role] ?? s.role}
                    {s.specialization ? ` · ${s.specialization}` : ''}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Close</button>
            </div>

            {[
              { key: 'name', label: 'Name *', placeholder: 'Full name' },
              { key: 'phone', label: 'Phone', placeholder: 'Mobile number' },
              { key: 'specialization', label: 'Specialization', placeholder: 'e.g. Hair Color, Bridal Makeup' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(c => ({ ...c, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
              <select value={form.role} onChange={e => setForm(c => ({ ...c, role: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(c => ({ ...c, is_active: e.target.checked }))} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active</span>
            </label>

            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add Staff'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
