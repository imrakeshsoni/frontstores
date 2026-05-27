// [restaurant] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, UserCheck, UserX, Pencil } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listStaff, createStaff, updateStaff, deleteStaff, type Staff } from '@/lib/db/restaurant';

const ROLES = ['waiter', 'manager', 'chef', 'cashier', 'delivery'];

const blankForm = { name: '', role: 'waiter', phone: '' };

export function StaffPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(blankForm);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['restaurant-staff', tenantId],
    queryFn: () => listStaff(tenantId),
    enabled: !!tenantId,
  });

  function invalidate() { qc.invalidateQueries({ queryKey: ['restaurant-staff', tenantId] }); }

  function openAdd() { setEditing(null); setForm(blankForm); setShowForm(true); }
  function openEdit(s: Staff) { setEditing(s); setForm({ name: s.name, role: s.role, phone: s.phone ?? '' }); setShowForm(true); }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name is required');
      if (editing) {
        await updateStaff(tenantId, editing.id, { name: form.name.trim(), role: form.role, phone: form.phone.trim() || undefined });
      } else {
        await createStaff(tenantId, { name: form.name.trim(), role: form.role, phone: form.phone.trim() || undefined });
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Staff updated' : 'Staff added');
      invalidate();
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save'),
  });

  const toggleMutation = useMutation({
    mutationFn: (s: Staff) => updateStaff(tenantId, s.id, { is_active: s.is_active ? 0 : 1 }),
    onSuccess: () => { invalidate(); toast.success('Updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStaff(tenantId, id),
    onSuccess: () => { invalidate(); toast.success('Staff removed'); },
  });

  const active = staff.filter((s) => s.is_active);
  const inactive = staff.filter((s) => !s.is_active);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Staff</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{active.length} active staff members</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openAdd}>
          <Plus size={15} /> Add Staff
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      )}

      {!isLoading && staff.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4" style={{ color: 'var(--text-tertiary)' }}>
          <UserCheck size={48} className="opacity-20" />
          <p className="text-sm">No staff added yet</p>
          <button className="btn-primary" onClick={openAdd}><Plus size={14} /> Add First Staff Member</button>
        </div>
      )}

      {active.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Active</span>
          </div>
          {active.map((s) => (
            <StaffRow key={s.id} staff={s} onEdit={() => openEdit(s)} onToggle={() => toggleMutation.mutate(s)} onDelete={() => deleteMutation.mutate(s.id)} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Inactive</span>
          </div>
          {inactive.map((s) => (
            <StaffRow key={s.id} staff={s} onEdit={() => openEdit(s)} onToggle={() => toggleMutation.mutate(s)} onDelete={() => deleteMutation.mutate(s.id)} />
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Name *</label>
                <input autoFocus className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Staff name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Role</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setForm(f => ({ ...f, role: r }))}
                      className="px-3 py-1.5 rounded-lg text-sm capitalize transition-all"
                      style={{ background: form.role === r ? 'var(--accent)' : 'var(--surface-2)', color: form.role === r ? 'white' : 'var(--text-primary)' }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Phone</label>
                <input className="input w-full" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffRow({ staff: s, onEdit, onToggle, onDelete }: {
  staff: Staff; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
      <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: s.is_active ? '#dcfce7' : 'var(--surface-2)', color: s.is_active ? '#16a34a' : 'var(--text-tertiary)' }}>
        {s.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: s.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{s.name}</p>
        <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.role}{s.phone ? ` · ${s.phone}` : ''}</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Edit"><Pencil size={13} style={{ color: 'var(--text-secondary)' }} /></button>
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title={s.is_active ? 'Deactivate' : 'Activate'}>
          {s.is_active ? <UserX size={13} style={{ color: '#d97706' }} /> : <UserCheck size={13} style={{ color: '#16a34a' }} />}
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Remove"><X size={13} style={{ color: '#dc2626' }} /></button>
      </div>
    </div>
  );
}
