// [hardware] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Users, IndianRupee, Calendar, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllHwStaff, createHwStaff, updateHwStaff, deleteHwStaff,
  type HardwareStaff,
} from '@/lib/db/hardware';

const ROLES = ['salesman', 'cashier', 'helper', 'storekeeper', 'manager', 'delivery'];
const ACCENT = '#2563eb';

type StaffForm = {
  name: string; phone: string; role: string;
  monthly_salary: string; joining_date: string;
  deduct_half_day: boolean; deduct_full_day_leave: boolean;
};

const emptyForm: StaffForm = {
  name: '', phone: '', role: 'salesman',
  monthly_salary: '', joining_date: '',
  deduct_half_day: true, deduct_full_day_leave: false,
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function HardwareStaffPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HardwareStaff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['hw-staff-list', tenantId],
    queryFn: () => listAllHwStaff(tenantId),
    enabled: !!tenantId,
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };

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
        ? updateHwStaff(tenantId, editing.id, data)
        : createHwStaff(tenantId, data);
    },
    onSuccess: () => {
      toast.success(editing ? 'Staff updated' : 'Staff member added');
      setShowForm(false); setEditing(null); setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['hw-staff-list'] });
      qc.invalidateQueries({ queryKey: ['hw-staff'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHwStaff(tenantId, id),
    onSuccess: () => {
      toast.success('Staff removed');
      qc.invalidateQueries({ queryKey: ['hw-staff-list'] });
      qc.invalidateQueries({ queryKey: ['hw-staff'] });
    },
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Staff</h1>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: ACCENT }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading && <div className="p-6 animate-pulse text-sm text-slate-400">Loading…</div>}
        {!isLoading && staff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400">No staff added yet</p>
          </div>
        )}
        {staff.map(s => (
          <div key={s.id} className="flex items-center justify-between px-5 py-4 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => navigate(`/hardware/staff/${s.id}`)}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: s.is_active ? ACCENT : '#9ca3af' }}>
                {((s.name?.[0] ?? '?').toUpperCase())}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500 capitalize">
                  {s.role}{s.phone ? ` · ${s.phone}` : ''}
                  {!s.is_active ? ' · Inactive' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {s.monthly_salary > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Monthly Salary</p>
                  <p className="text-sm font-bold" style={{ color: ACCENT }}>{fmt(s.monthly_salary)}</p>
                </div>
              )}
              {s.joining_date && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Joined</p>
                  <p className="text-xs font-medium text-slate-500">
                    {new Date(s.joining_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => {
                  if (!confirm(`Remove ${s.name}? This cannot be undone.`)) return;
                  deleteMutation.mutate(s.id);
                }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-900">{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1.5">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ramesh"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400" />
            </div>

            {/* Phone + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none capitalize focus:border-blue-400">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Salary section */}
            <div className="rounded-xl p-4 space-y-3 bg-blue-50 border border-blue-100">
              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: ACCENT }}>
                <IndianRupee className="h-3.5 w-3.5" /> Salary Settings
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Monthly Salary (₹)</label>
                  <input type="number" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))}
                    placeholder="15000"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Joining Date
                  </label>
                  <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400" />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                If staff joins mid-month, salary is pro-rated from joining date.
              </p>

              {/* Deduction toggles */}
              <div className="space-y-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, deduct_half_day: !f.deduct_half_day }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-slate-200 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-left text-slate-900">Deduct half day?</p>
                    <p className="text-xs text-left text-slate-500">Deduct 0.5 day's salary on half day</p>
                  </div>
                  {form.deduct_half_day
                    ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: ACCENT }} />
                    : <ToggleLeft className="h-6 w-6 flex-shrink-0 text-slate-400" />}
                </button>

                <button type="button" onClick={() => setForm(f => ({ ...f, deduct_full_day_leave: !f.deduct_full_day_leave }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-slate-200 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-left text-slate-900">Deduct paid leave?</p>
                    <p className="text-xs text-left text-slate-500">When OFF, leave is paid (no deduction)</p>
                  </div>
                  {form.deduct_full_day_leave
                    ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: ACCENT }} />
                    : <ToggleLeft className="h-6 w-6 flex-shrink-0 text-slate-400" />}
                </button>
              </div>
            </div>

            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: ACCENT }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update Staff' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
