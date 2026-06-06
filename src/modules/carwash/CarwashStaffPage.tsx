// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Users, IndianRupee, Calendar, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
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
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarwashStaff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['carwash-staff-list', tenantId],
    queryFn: () => listAllCarwashStaff(tenantId),
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
    <div className="flex flex-col" style={{ background: 'linear-gradient(160deg,#1c2133 0%,#111520 100%)', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating white plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>Staff</h1>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5), 0 1px 2px rgba(0,0,0,0.15)' }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {isLoading && <div className="p-6 animate-pulse text-sm" style={{ color: '#86868b' }}>Loading…</div>}
        {!isLoading && staff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm" style={{ color: '#86868b' }}>No staff added yet</p>
          </div>
        )}
        {staff.map(s => (
          <div key={s.id} className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid #e5e5ea', cursor: 'pointer' }}
            onClick={() => navigate(`/carwash/staff/${s.id}`)}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: s.is_active ? '#0071e3' : '#9ca3af' }}>
                {s.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold" style={{ color: '#1d1d1f' }}>{s.name}</p>
                <p className="text-xs capitalize" style={{ color: '#86868b' }}>
                  {s.role}{s.phone ? ` · ${s.phone}` : ''}
                  {!s.is_active ? ' · Inactive' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {s.monthly_salary > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs" style={{ color: '#86868b' }}>Monthly Salary</p>
                  <p className="text-sm font-bold" style={{ color: '#0071e3' }}>{fmt(s.monthly_salary)}</p>
                </div>
              )}
              {s.joining_date && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs" style={{ color: '#86868b' }}>Joined</p>
                  <p className="text-xs font-medium" style={{ color: '#86868b' }}>
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
              <ChevronRight className="h-4 w-4 opacity-30 flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: '#1d1d1f' }}>{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-sm">Cancel</button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ramesh"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
            </div>

            {/* Phone + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none capitalize"
                  style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Salary section */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#f2f2f7', border: '1px solid #e5e5ea' }}>
              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#0071e3' }}>
                <IndianRupee className="h-3.5 w-3.5" /> Salary Settings
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#86868b' }}>Monthly Salary (₹)</label>
                  <input type="number" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))}
                    placeholder="15000"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e5e5ea', background: '#ffffff', color: '#1d1d1f' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: '#86868b' }}>
                    <Calendar className="h-3 w-3" /> Joining Date
                  </label>
                  <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e5e5ea', background: '#ffffff', color: '#1d1d1f' }} />
                </div>
              </div>

              <p className="text-xs" style={{ color: '#86868b' }}>
                If staff joins mid-month, salary is pro-rated from joining date.
              </p>

              {/* Deduction toggles */}
              <div className="space-y-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, deduct_half_day: !f.deduct_half_day }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <p className="text-sm font-medium text-left" style={{ color: '#1d1d1f' }}>Deduct half day?</p>
                    <p className="text-xs text-left" style={{ color: '#86868b' }}>Deduct 0.5 day's salary on half day</p>
                  </div>
                  {form.deduct_half_day
                    ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: '#0071e3' }} />
                    : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: '#86868b' }} />}
                </button>

                <button type="button" onClick={() => setForm(f => ({ ...f, deduct_full_day_leave: !f.deduct_full_day_leave }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <p className="text-sm font-medium text-left" style={{ color: '#1d1d1f' }}>Deduct paid leave?</p>
                    <p className="text-xs text-left" style={{ color: '#86868b' }}>When OFF, leave is paid (no deduction)</p>
                  </div>
                  {form.deduct_full_day_leave
                    ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: '#0071e3' }} />
                    : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: '#86868b' }} />}
                </button>
              </div>
            </div>

            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: '#0071e3' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update Staff' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>{/* end scrollable */}
  );
}