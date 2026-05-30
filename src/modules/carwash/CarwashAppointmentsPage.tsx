// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Calendar, Clock, Car, User, Trash2, CheckCircle, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment,
  listCarwashStaff, findVehicleByReg,
  type CarwashAppointment, type AppointmentStatus, type VehicleType,
} from '@/lib/db/carwash';

function todayISO() { return new Date().toISOString().slice(0, 10); }

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  scheduled:  { label: 'Scheduled',  color: '#d97706', bg: '#fef3c7' },
  confirmed:  { label: 'Confirmed',  color: '#2563eb', bg: '#dbeafe' },
  arrived:    { label: 'Arrived',    color: '#7c3aed', bg: '#ede9fe' },
  done:       { label: 'Done',       color: '#16a34a', bg: '#d1fae5' },
  cancelled:  { label: 'Cancelled',  color: '#6b7280', bg: '#f3f4f6' },
};

const TIME_SLOTS = Array.from({ length: 26 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? '00' : '30';
  const label = `${h > 12 ? h - 12 : h}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  return { value: `${String(h).padStart(2, '0')}:${m}`, label };
});

type ApptForm = {
  appointment_time: string;
  duration_minutes: string;
  reg_number: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  customer_name: string;
  customer_phone: string;
  staff_id: string;
  staff_name: string;
  services_note: string;
  notes: string;
};

const emptyForm: ApptForm = {
  appointment_time: '10:00', duration_minutes: '60', reg_number: '',
  vehicle_type: 'sedan', make: '', model: '', customer_name: '', customer_phone: '',
  staff_id: '', staff_name: '', services_note: '', notes: '',
};

export function CarwashAppointmentsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ApptForm>(emptyForm);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['carwash-appts', tenantId, date],
    queryFn: () => listAppointments(tenantId, date),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['carwash-staff', tenantId],
    queryFn: () => listCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['carwash-appts', tenantId, date] });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.customer_name.trim()) throw new Error('Customer name is required');
      if (!form.appointment_time) throw new Error('Select a time slot');
      return createAppointment(tenantId, {
        appointment_date: date,
        appointment_time: form.appointment_time,
        duration_minutes: Number(form.duration_minutes) || 60,
        reg_number: form.reg_number.toUpperCase() || undefined,
        vehicle_type: form.vehicle_type,
        make: form.make || undefined,
        model: form.model || undefined,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || undefined,
        staff_id: form.staff_id || undefined,
        staff_name: form.staff_name || undefined,
        services_note: form.services_note || undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Appointment booked!');
      setShowForm(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to book'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      updateAppointmentStatus(tenantId, id, status),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAppointment(tenantId, id),
    onSuccess: () => { toast.success('Cancelled'); invalidate(); },
  });

  const handleRegLookup = async (reg: string) => {
    if (!reg || reg.length < 4) return;
    const v = await findVehicleByReg(tenantId, reg);
    if (v) {
      setForm(f => ({
        ...f,
        vehicle_type: v.vehicle_type,
        make: v.make ?? f.make,
        model: v.model ?? f.model,
        customer_name: v.customer_name ?? f.customer_name,
        customer_phone: v.customer_phone ?? f.customer_phone,
      }));
      toast.success('Vehicle details filled from history');
    }
  };

  const handleCreateJob = (appt: CarwashAppointment) => {
    navigate(`/carwash/jobs/new?reg=${appt.reg_number ?? ''}&name=${encodeURIComponent(appt.customer_name ?? '')}&phone=${encodeURIComponent(appt.customer_phone ?? '')}`);
    statusMutation.mutate({ id: appt.id, status: 'arrived' });
  };

  const sendWhatsAppReminder = (appt: CarwashAppointment) => {
    const phone = (appt.customer_phone ?? '').replace(/\D/g, '');
    if (phone.length < 10) { toast.error('No valid phone number'); return; }
    const time = TIME_SLOTS.find(t => t.value === appt.appointment_time)?.label ?? appt.appointment_time;
    const msg = `Hi ${appt.customer_name ?? 'there'} 👋\n\nReminder: Your car wash appointment is scheduled for *${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}* at *${time}*.\n\n🚗 Vehicle: ${appt.reg_number ?? 'Your car'}\n${appt.services_note ? `📋 Services: ${appt.services_note}\n` : ''}\nSee you then! 😊`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const pending = appointments.filter(a => a.status !== 'done' && a.status !== 'cancelled');
  const done = appointments.filter(a => a.status === 'done' || a.status === 'cancelled');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Appointments</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Book Slot
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {pending.length} appointment{pending.length !== 1 ? 's' : ''} scheduled
        </span>
      </div>

      {/* Appointment slots */}
      {isLoading && Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
      ))}

      {!isLoading && appointments.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <Calendar className="h-10 w-10 opacity-30" />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No appointments for this day</p>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
            Book First Appointment
          </button>
        </div>
      )}

      <div className="space-y-3">
        {pending.map(appt => {
          const sc = STATUS_CONFIG[appt.status];
          const timeLabel = TIME_SLOTS.find(t => t.value === appt.appointment_time)?.label ?? appt.appointment_time;
          return (
            <div key={appt.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-xl px-3 py-2 flex-shrink-0 text-center" style={{ background: sc.bg, minWidth: '70px' }}>
                    <p className="text-sm font-bold" style={{ color: sc.color }}>{timeLabel}</p>
                    <p className="text-xs" style={{ color: sc.color }}>{appt.duration_minutes}min</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {appt.customer_name || 'Walk-in'}
                      {appt.reg_number && <span className="ml-2 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{appt.reg_number}</span>}
                    </p>
                    {appt.customer_phone && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>📞 {appt.customer_phone}</p>}
                    {appt.services_note && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>📋 {appt.services_note}</p>}
                    {appt.staff_name && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>👤 {appt.staff_name}</p>}
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>
                  {sc.label}
                </span>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {appt.status === 'scheduled' && (
                  <button onClick={() => statusMutation.mutate({ id: appt.id, status: 'confirmed' })}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: '#dbeafe', color: '#2563eb' }}>
                    ✓ Confirm
                  </button>
                )}
                {(appt.status === 'scheduled' || appt.status === 'confirmed') && appt.customer_phone && (
                  <button onClick={() => sendWhatsAppReminder(appt)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background: '#25d366' }}>
                    💬 Remind
                  </button>
                )}
                {appt.status !== 'arrived' && appt.status !== 'done' && (
                  <button onClick={() => statusMutation.mutate({ id: appt.id, status: 'arrived' })}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: '#ede9fe', color: '#7c3aed' }}>
                    🚗 Arrived
                  </button>
                )}
                <button onClick={() => handleCreateJob(appt)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                  style={{ background: 'var(--accent)' }}>
                  + Create Job Card
                </button>
                <button onClick={() => { if (confirm('Cancel this appointment?')) deleteMutation.mutate(appt.id); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Done/cancelled */}
      {done.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Completed / Cancelled</p>
          <div className="space-y-2">
            {done.map(appt => {
              const sc = STATUS_CONFIG[appt.status];
              const timeLabel = TIME_SLOTS.find(t => t.value === appt.appointment_time)?.label ?? appt.appointment_time;
              return (
                <div key={appt.id} className="rounded-xl p-3 flex items-center gap-3 opacity-60"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                  <p className="text-sm font-bold" style={{ color: sc.color }}>{timeLabel}</p>
                  <p className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>
                    {appt.customer_name || 'Walk-in'} {appt.reg_number ? `· ${appt.reg_number}` : ''}
                  </p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Book form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Book Appointment</h2>
                <button onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                  <X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" value={date} readOnly
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Time *</label>
                  <select value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                    {TIME_SLOTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Duration (min)</label>
                  <select value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                    {[30, 45, 60, 90, 120, 180].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Reg Number</label>
                  <input value={form.reg_number} onChange={e => setForm(f => ({ ...f, reg_number: e.target.value.toUpperCase() }))}
                    onBlur={() => handleRegLookup(form.reg_number)}
                    placeholder="MH12AB1234"
                    className="w-full rounded-xl border px-3 py-2 text-sm font-bold tracking-wider outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer Name *</label>
                  <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Name"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                  <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="Phone"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Assign Staff</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({
                  ...f, staff_id: e.target.value,
                  staff_name: staff.find(s => s.id === e.target.value)?.name ?? '',
                }))} className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                  <option value="">— Any staff —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Services Requested</label>
                <input value={form.services_note} onChange={e => setForm(f => ({ ...f, services_note: e.target.value }))}
                  placeholder="e.g. Foam Wash + Vacuum"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any special requests…"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setForm(emptyForm); }} className="flex-1 btn-secondary py-2.5 rounded-xl text-sm">
                  Cancel
                </button>
                <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}>
                  {createMutation.isPending ? 'Booking…' : '📅 Book Appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
