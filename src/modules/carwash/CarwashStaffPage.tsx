// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Edit2, IndianRupee, Calendar, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllCarwashStaff, createCarwashStaff, updateCarwashStaff, deleteCarwashStaff,
  type CarwashStaff,
} from '@/lib/db/carwash';

const ROLES = ['washer', 'polisher', 'manager', 'cashier', 'detailer'];

type StaffForm = {
  name: string; phone: string; role: string;
  monthly_salary: string; joining_date: string;
  deduct_half_day: boolean; deduct_full_day_leave: boolean;
};

const emptyForm: StaffForm = {
  name: '', phone: '', role: 'washer',
  monthly_salary: '', joining_date: '',
  deduct_half_day: true, deduct_full_day_leave: false,
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CarwashStaffPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarwashStaff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['carwash-staff-list', tenantId],
    queryFn: () => listAllCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s: CarwashStaff) => {
    setEditing(s);
    setForm({
      name: s.name, phone: s.phone ?? '', role: s.role,
      monthly_salary: s.monthly_salary > 0 ? String(s.monthly_salary) : '',
      joining_date: s.joining_date ?? '',
      deduct_half_day: s.deduct_half_day,
      deduct_full_day_leave: s.deduct_full_day_leave,
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Name required');
      const data = {
        name: form.name.trim(),
        phone: form.phone || undefined,
        role: form.role,
        monthly_salary: Number(form.monthly_salary) || 0,
        joining_date: form.joining_date || undefined,
        deduct_half_day: form.deduct_half_day,
        deduct_full_day_leave: form.deduct_full_day_leave,
      };
      return editing
        ? updateCarwashStaff(tenantId, editing.id, data)
        : createCarwashStaff(tenantId, data);
    },
    onSuccess: () => {
      toast.success(editing ? 'Staff updated' : 'Staff member added');
      setShowForm(false); setEditing(null); setForm(emptyForm);
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
        <button onClick={openAdd}
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
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: s.is_active ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                {s.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>
                  {s.role}{s.phone ? ` · ${s.phone}` : ''}
                  {!s.is_active ? ' · Inactive' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {s.monthly_salary > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Monthly Salary</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(s.monthly_salary)}</p>
                </div>
              )}
              {s.joining_date && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Joined</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(s.joining_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              <div className="flex gap-1">
                <button onClick={() => openEdit(s)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => {
                  if (!confirm(`Remove ${s.name}? This cannot be undone.`)) return;
                  deleteMutation.mutate(s.id);
                }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-sm">Cancel</button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ramesh"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>

            {/* Phone + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none capitalize"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Salary section */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                <IndianRupee className="h-3.5 w-3.5" /> Salary Settings
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Monthly Salary (₹)</label>
                  <input type="number" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))}
                    placeholder="15000"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <Calendar className="h-3 w-3" /> Joining Date
                  </label>
                  <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                If staff joins mid-month, salary is pro-rated from joining date.
              </p>

              {/* Deduction toggles */}
              <div className="space-y-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, deduct_half_day: !f.deduct_half_day }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                  <div>
                    <p className="text-sm font-medium text-left" style={{ color: 'var(--text-primary)' }}>Deduct half day?</p>
                    <p className="text-xs text-left" style={{ color: 'var(--text-tertiary)' }}>Deduct 0.5 day's salary on half day</p>
                  </div>
                  {form.deduct_half_day
                    ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />}
                </button>

                <button type="button" onClick={() => setForm(f => ({ ...f, deduct_full_day_leave: !f.deduct_full_day_leave }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                  <div>
                    <p className="text-sm font-medium text-left" style={{ color: 'var(--text-primary)' }}>Deduct paid leave?</p>
                    <p className="text-xs text-left" style={{ color: 'var(--text-tertiary)' }}>When OFF, leave is paid (no deduction)</p>
                  </div>
                  {form.deduct_full_day_leave
                    ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />}
                </button>
              </div>
            </div>

            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update Staff' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
