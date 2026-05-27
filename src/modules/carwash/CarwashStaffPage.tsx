// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Users } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCarwashStaff, createCarwashStaff, deleteCarwashStaff } from '@/lib/db/carwash';

const ROLES = ['washer', 'polisher', 'manager', 'cashier', 'detailer'];

export function CarwashStaffPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('washer');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['carwash-staff-list', tenantId],
    queryFn: () => listCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Name required');
      return createCarwashStaff(tenantId, { name: name.trim(), phone: phone || undefined, role });
    },
    onSuccess: () => {
      toast.success('Staff member added');
      setName(''); setPhone(''); setRole('washer'); setShowForm(false);
      qc.invalidateQueries({ queryKey: ['carwash-staff-list'] });
      qc.invalidateQueries({ queryKey: ['carwash-staff'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCarwashStaff(tenantId, id),
    onSuccess: () => {
      toast.success('Staff removed');
      qc.invalidateQueries({ queryKey: ['carwash-staff-list'] });
      qc.invalidateQueries({ queryKey: ['carwash-staff'] });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Staff</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {isLoading && <div className="p-6 animate-pulse text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!isLoading && staff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No staff added yet</p>
          </div>
        )}
        {staff.map(s => (
          <div key={s.id} className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'var(--accent)' }}>
                {s.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.role}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
            </div>
            <button onClick={() => deleteMutation.mutate(s.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Staff</h2>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramesh"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none capitalize"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {addMutation.isPending ? 'Adding…' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
