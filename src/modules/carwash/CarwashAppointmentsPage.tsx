// [carwash] [all tenants]
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Calendar, Clock, Car, User, Trash2, CheckCircle, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { NumberPlateScanner } from '@/components/ui/NumberPlateScanner';
import { sendWhatsApp } from '@/lib/whatsapp';
import { listCustomers } from '@/lib/db/customers';
import {
  listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment,
  listCarwashStaff, findVehicleByReg, findVehiclesByPhone, listAllVehicleTypes, searchVehicles, listServices, validateRegNumber,
  type CarwashAppointment, type AppointmentStatus, type VehicleType, type CarwashVehicle,
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
  staff_ids: string[];
  staff_names: string[];
  selected_services: string[];   // service names
  services_note: string;
  notes: string;
};

const emptyForm: ApptForm = {
  appointment_time: '10:00', duration_minutes: '60', reg_number: '',
  vehicle_type: 'sedan', make: '', model: '', customer_name: '', customer_phone: '',
  staff_ids: [], staff_names: [], selected_services: [], services_note: '', notes: '',
};

export function CarwashAppointmentsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName = useAppStore((s) => s.config?.shop_name ?? 'Car Wash');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ApptForm>(emptyForm);
  const [vehiclePicker, setVehiclePicker] = useState<CarwashVehicle[]>([]);
  const [vehiclePickerIdx, setVehiclePickerIdx] = useState(-1);
  const vehiclePickerRef = useRef<HTMLDivElement>(null);
  const [phoneResults, setPhoneResults] = useState<any[]>([]);
  const [phoneActiveIdx, setPhoneActiveIdx] = useState(-1);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [regResults, setRegResults] = useState<CarwashVehicle[]>([]);
  const [regActiveIdx, setRegActiveIdx] = useState(-1);
  const regDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['carwash-vtypes', tenantId],
    queryFn: () => listAllVehicleTypes(tenantId),
    enabled: !!tenantId,
  });

  const { data: availableServices = [] } = useQuery({
    queryKey: ['carwash-services', tenantId],
    queryFn: () => listServices(tenantId),
    enabled: !!tenantId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['carwash-appts', tenantId, date] });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.customer_name.trim()) throw new Error('Customer name is required');
      if (!form.customer_phone.trim()) throw new Error('Phone number is required');
      if (form.customer_phone.replace(/\D/g, '').length !== 10) throw new Error('Phone number must be exactly 10 digits');
      if (form.reg_number.trim()) {
        const regVal = validateRegNumber(form.reg_number);
        if (!regVal.valid) throw new Error(regVal.error);
      }
      if (!form.appointment_time) throw new Error('Select a time slot');
      const dur = Number(form.duration_minutes) || 60;
      if (dur < 5 || dur > 480) throw new Error('Duration must be between 5 and 480 minutes');
      return createAppointment(tenantId, {
        appointment_date: date,
        appointment_time: form.appointment_time,
        duration_minutes: dur,
        reg_number: form.reg_number.toUpperCase() || undefined,
        vehicle_type: form.vehicle_type,
        make: form.make || undefined,
        model: form.model || undefined,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || undefined,
        staff_id: form.staff_ids[0] || undefined,
        staff_name: form.staff_names.join(', ') || undefined,
        services_note: form.selected_services.length > 0
          ? form.selected_services.join(', ')
          : form.services_note || undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Appointment booked!');
      // [carwash] [all tenants] — auto-send booking confirmation via WhatsApp
      const phone = form.customer_phone.replace(/\D/g, '');
      if (phone.length >= 10) {
        const time = TIME_SLOTS.find(t => t.value === form.appointment_time)?.label ?? form.appointment_time;
        const dateLabel = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
        const services = form.selected_services.length > 0 ? form.selected_services.join(', ') : form.services_note;
        const msg = `Hi ${form.customer_name} 👋\n\nYour car wash appointment has been *confirmed*! ✅\n\n📅 Date: *${dateLabel}*\n🕐 Time: *${time}*\n🚗 Vehicle: ${form.reg_number ? form.reg_number.toUpperCase() : 'Your car'}${services ? `\n📋 Services: ${services}` : ''}\n\nSee you then at *${shopName}*! 😊`;
        sendWhatsApp(phone, msg).catch(() => {});
      }
      setShowForm(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: any) => toast.error(String(e?.message ?? e ?? 'Failed to book appointment')),
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

  const populateFromVehicle = (v: CarwashVehicle) => {
    setForm(f => ({
      ...f,
      reg_number: v.reg_number ?? f.reg_number,
      vehicle_type: (v.vehicle_type as VehicleType) ?? f.vehicle_type,
      make: v.make ?? f.make,
      model: v.model ?? f.model,
      customer_name: v.customer_name ?? f.customer_name,
      customer_phone: v.customer_phone ?? f.customer_phone,
    }));
    setVehiclePicker([]);
  };

  const handleRegLookup = async (reg: string) => {
    if (!reg || reg.length < 4) return;
    const v = await findVehicleByReg(tenantId, reg);
    if (v) { populateFromVehicle(v); toast.success('Details filled from history'); }
  };

  const handlePhoneLookup = async (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return;
    const vehicles = await findVehiclesByPhone(tenantId, phone);
    if (vehicles.length === 1) {
      populateFromVehicle(vehicles[0]);
      toast.success('Customer details filled from history');
    } else if (vehicles.length > 1) {
      setVehiclePicker(vehicles);
    }
  };

  // Live phone search — fires after 300ms debounce
  const handlePhoneInput = useCallback((value: string) => {
    setForm(f => ({ ...f, customer_phone: value }));
    setVehiclePicker([]);
    setPhoneActiveIdx(-1);
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);
    if (value.length < 2) { setPhoneResults([]); return; }
    phoneDebounce.current = setTimeout(async () => {
      const { items } = await listCustomers(tenantId, { search: value, perPage: 8 });
      setPhoneResults(items);
    }, 300);
  }, [tenantId]);

  const selectCustomerFromSearch = async (customer: any) => {
    setForm(f => ({ ...f, customer_phone: customer.phone ?? f.customer_phone, customer_name: customer.name ?? f.customer_name }));
    setPhoneResults([]);
    setPhoneActiveIdx(-1);
    if (customer.phone) {
      const vehicles = await findVehiclesByPhone(tenantId, customer.phone);
      if (vehicles.length === 1) { populateFromVehicle(vehicles[0]); toast.success('Details filled'); }
      else if (vehicles.length > 1) { setVehiclePicker(vehicles); }
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent) => {
    if (!phoneResults.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setPhoneActiveIdx(i => Math.min(i + 1, phoneResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPhoneActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && phoneActiveIdx >= 0) { e.preventDefault(); selectCustomerFromSearch(phoneResults[phoneActiveIdx]); }
    else if (e.key === 'Escape') { setPhoneResults([]); setPhoneActiveIdx(-1); }
  };

  // Reg number live search
  const handleRegInput = useCallback((value: string) => {
    setForm(f => ({ ...f, reg_number: value.toUpperCase() }));
    setRegActiveIdx(-1);
    if (regDebounce.current) clearTimeout(regDebounce.current);
    if (value.length < 2) { setRegResults([]); return; }
    regDebounce.current = setTimeout(async () => {
      const results = await searchVehicles(tenantId, value);
      setRegResults(results);
    }, 300);
  }, [tenantId]);

  const selectVehicleFromReg = (v: CarwashVehicle) => {
    populateFromVehicle(v);
    setRegResults([]);
    setRegActiveIdx(-1);
    toast.success('Details filled from history');
  };

  const handleRegKeyDown = (e: React.KeyboardEvent) => {
    if (!regResults.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setRegActiveIdx(i => Math.min(i + 1, regResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setRegActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && regActiveIdx >= 0) { e.preventDefault(); selectVehicleFromReg(regResults[regActiveIdx]); }
    else if (e.key === 'Escape') { setRegResults([]); setRegActiveIdx(-1); }
  };

  // Vehicle picker keyboard nav — activated when picker is open
  useEffect(() => {
    if (!vehiclePicker.length) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setVehiclePickerIdx(i => Math.min(i + 1, vehiclePicker.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setVehiclePickerIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && vehiclePickerIdx >= 0) { populateFromVehicle(vehiclePicker[vehiclePickerIdx]); setVehiclePicker([]); setVehiclePickerIdx(-1); }
      else if (e.key === 'Escape') { setVehiclePicker([]); setVehiclePickerIdx(-1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [vehiclePicker, vehiclePickerIdx]);

  // Scroll highlighted vehicle into view
  useEffect(() => {
    if (vehiclePickerIdx >= 0 && vehiclePickerRef.current) {
      vehiclePickerRef.current.children[vehiclePickerIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [vehiclePickerIdx]);

  const handleCreateJob = (appt: CarwashAppointment) => {
    const params = new URLSearchParams();
    if (appt.reg_number)    params.set('reg',      appt.reg_number);
    if (appt.customer_name) params.set('name',     appt.customer_name);
    if (appt.customer_phone)params.set('phone',    appt.customer_phone);
    if (appt.vehicle_type)  params.set('vtype',    appt.vehicle_type);
    if (appt.make)          params.set('make',     appt.make);
    if (appt.model)         params.set('model',    appt.model);
    if (appt.staff_id)      params.set('staffId',  appt.staff_id);
    if (appt.staff_name)    params.set('staffName',appt.staff_name);
    if (appt.services_note) params.set('services', appt.services_note);
    params.set('apptId', appt.id);
    navigate(`/carwash/jobs/new?${params.toString()}`);
    statusMutation.mutate({ id: appt.id, status: 'arrived' });
  };

  const sendWhatsAppReminder = (appt: CarwashAppointment) => {
    const phone = (appt.customer_phone ?? '').replace(/\D/g, '');
    if (phone.length < 10) { toast.error('No valid phone number'); return; }
    const time = TIME_SLOTS.find(t => t.value === appt.appointment_time)?.label ?? appt.appointment_time;
    const msg = `Hi ${appt.customer_name ?? 'there'} 👋\n\nReminder: Your car wash appointment is scheduled for *${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}* at *${time}*.\n\n🚗 Vehicle: ${appt.reg_number ?? 'Your car'}\n${appt.services_note ? `📋 Services: ${appt.services_note}\n` : ''}\nSee you then! 😊`;
    sendWhatsApp(phone, msg);
  };

  const pending = appointments.filter(a => a.status !== 'done' && a.status !== 'cancelled');
  const done = appointments.filter(a => a.status === 'done' || a.status === 'cancelled');

  return (
    <div className="flex flex-col" style={{ background: '#f5f5f7', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating white plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#86868b' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: '#1d1d1f' }}>Appointments</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: '#0071e3' }}>
          <Plus className="h-4 w-4" /> Book Slot
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4" style={{ color: '#0071e3' }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#e5e5ea', background: '#ffffff', color: '#1d1d1f' }} />
        <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ background: '#f2f2f7', color: '#0071e3' }}>
          {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}
        </span>
        <span className="text-sm font-medium" style={{ color: '#86868b' }}>
          {pending.length} appointment{pending.length !== 1 ? 's' : ''} scheduled
        </span>
      </div>

      {/* Appointment slots */}
      {isLoading && Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#f2f2f7' }} />
      ))}

      {!isLoading && appointments.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Calendar className="h-10 w-10 opacity-30" />
          <p className="text-sm" style={{ color: '#86868b' }}>No appointments for this day</p>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#0071e3', color: '#111' }}>
            Book First Appointment
          </button>
        </div>
      )}

      <div className="space-y-3">
        {pending.map(appt => {
          const sc = STATUS_CONFIG[appt.status];
          const timeLabel = TIME_SLOTS.find(t => t.value === appt.appointment_time)?.label ?? appt.appointment_time;
          return (
            <div key={appt.id} className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-xl px-3 py-2 flex-shrink-0 text-center" style={{ background: sc.bg, minWidth: '70px' }}>
                    <p className="text-sm font-bold" style={{ color: sc.color }}>{timeLabel}</p>
                    <p className="text-xs" style={{ color: sc.color }}>{appt.duration_minutes}min</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: '#1d1d1f' }}>
                      {appt.customer_name || 'Walk-in'}
                      {appt.reg_number && <span className="ml-2 font-mono text-xs" style={{ color: '#86868b' }}>{appt.reg_number}</span>}
                    </p>
                    {appt.customer_phone && <p className="text-xs" style={{ color: '#86868b' }}>📞 {appt.customer_phone}</p>}
                    {appt.services_note && <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>📋 {appt.services_note}</p>}
                    {appt.staff_name && <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>👤 {appt.staff_name}</p>}
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
                  style={{ background: '#0071e3' }}>
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
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#86868b' }}>Completed / Cancelled</p>
          <div className="space-y-2">
            {done.map(appt => {
              const sc = STATUS_CONFIG[appt.status];
              const timeLabel = TIME_SLOTS.find(t => t.value === appt.appointment_time)?.label ?? appt.appointment_time;
              return (
                <div key={appt.id} className="rounded-xl p-3 flex items-center gap-3 opacity-60"
                  style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-sm font-bold" style={{ color: sc.color }}>{timeLabel}</p>
                  <p className="text-sm flex-1" style={{ color: '#86868b' }}>
                    {appt.customer_name || 'Walk-in'} {appt.reg_number ? `· ${appt.reg_number}` : ''}
                  </p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Book form modal — landscape wide layout */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setForm(emptyForm); setVehiclePicker([]); } }}>
          <div className="rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #e5e5ea' }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: '#0071e3' }}>
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-xl" style={{ color: '#1d1d1f' }}>Book Appointment</h2>
                  <p className="text-xs" style={{ color: '#86868b' }}>{new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); setForm(emptyForm); setVehiclePicker([]); }}
                className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors"
                style={{ background: '#f2f2f7' }}>
                <X className="h-4 w-4" style={{ color: '#86868b' }} />
              </button>
            </div>

            {/* Two-column body — left 40% customer/vehicle, right 60% scheduling/services */}
            <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '2fr 3fr' }}>
              {/* Left — Customer & Vehicle */}
              <div className="px-7 py-6 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid #e5e5ea' }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0071e3' }}>Customer & Vehicle</p>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Registration Number</label>
                  <div className="relative flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input value={form.reg_number}
                        onChange={e => handleRegInput(e.target.value)}
                        onKeyDown={handleRegKeyDown}
                        onBlur={e => {
                          setTimeout(() => setRegResults([]), 150);
                          const v = e.target.value.trim();
                          if (v && !validateRegNumber(v).valid) toast.error(validateRegNumber(v).error!);
                        }}
                        placeholder="e.g. MH12AB1234 or 22BH0001AA"
                        autoFocus
                        className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold tracking-wider outline-none"
                        style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />

                      {/* Reg search dropdown */}
                      {regResults.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
                          style={{ background: '#ffffff', border: '1px solid #0071e3' }}>
                          {regResults.map((v, i) => (
                            <button key={v.id} type="button"
                              onMouseDown={() => selectVehicleFromReg(v)}
                              className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                              style={{ background: i === regActiveIdx ? '#0071e3' : 'transparent',
                                       color: i === regActiveIdx ? '#111' : '#1d1d1f',
                                       borderBottom: '1px solid #e5e5ea' }}>
                              <span className="text-lg flex-shrink-0">🚗</span>
                              <div className="min-w-0">
                                <p className="text-sm font-bold tracking-wider">{v.reg_number}</p>
                                <p className="text-xs opacity-70">{v.customer_name ?? ''}{v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <NumberPlateScanner onDetected={plate => { handleRegInput(plate); handleRegLookup(plate); }} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Phone *</label>
                  <div className="relative">
                    <input value={form.customer_phone}
                      onChange={e => handlePhoneInput(e.target.value)}
                      onKeyDown={handlePhoneKeyDown}
                      onBlur={() => setTimeout(() => setPhoneResults([]), 150)}
                      placeholder="Type to search customer…"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />

                    {/* Live search dropdown */}
                    {phoneResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
                        style={{ background: '#ffffff', border: '1px solid #0071e3' }}>
                        {phoneResults.map((c, i) => (
                          <button key={c.id} type="button"
                            onMouseDown={() => selectCustomerFromSearch(c)}
                            className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                            style={{ background: i === phoneActiveIdx ? '#0071e3' : 'transparent',
                                     color: i === phoneActiveIdx ? '#111' : '#1d1d1f',
                                     borderBottom: '1px solid #e5e5ea' }}>
                            <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: i === phoneActiveIdx ? '#111' : '#0071e3', color: i === phoneActiveIdx ? '#0071e3' : '#111' }}>
                              {c.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{c.name}</p>
                              <p className="text-xs opacity-70">{c.phone ?? '—'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vehicle picker — keyboard nav with ↑↓ Enter, mouse click */}
                  {vehiclePicker.length > 0 && (
                    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid #0071e3', background: '#f2f2f7' }}>
                      <p className="px-3 py-2 text-xs font-bold flex items-center justify-between"
                        style={{ color: '#0071e3', borderBottom: '1px solid #e5e5ea' }}>
                        <span>🚗 {vehiclePicker.length} vehicles — ↑↓ navigate, Enter to select</span>
                        <button onClick={() => { setVehiclePicker([]); setVehiclePickerIdx(-1); }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </p>
                      <div ref={vehiclePickerRef} className="max-h-52 overflow-y-auto">
                        {vehiclePicker.map((v, i) => (
                          <button key={v.id} type="button"
                            onClick={() => { populateFromVehicle(v); setVehiclePicker([]); setVehiclePickerIdx(-1); }}
                            onMouseEnter={() => setVehiclePickerIdx(i)}
                            className="w-full text-left px-3 py-3 transition-colors flex items-center gap-3"
                            style={{
                              background: i === vehiclePickerIdx ? '#0071e3' : 'transparent',
                              borderBottom: '1px solid #e5e5ea',
                            }}>
                            <span className="text-xl flex-shrink-0">🚗</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold" style={{ color: i === vehiclePickerIdx ? '#111' : '#1d1d1f' }}>
                                {v.reg_number ?? 'No reg'}
                              </p>
                              <p className="text-xs" style={{ color: i === vehiclePickerIdx ? '#333' : '#86868b' }}>
                                {v.vehicle_type}{(v.make || v.model) ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
                              </p>
                            </div>
                            {i === vehiclePickerIdx && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#111', color: '#0071e3' }}>Enter ↵</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Customer Name *</label>
                  <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                    style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Make</label>
                    <input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                      placeholder="e.g. Maruti"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Model</label>
                    <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                      placeholder="e.g. Swift"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Vehicle Type</label>
                  <div className="flex flex-wrap gap-2">
                    {vehicleTypes.filter(vt => vt.is_active).map(vt => (
                      <button key={vt.id} onClick={() => setForm(f => ({ ...f, vehicle_type: vt.name as VehicleType }))}
                        className="py-1.5 px-3 rounded-xl text-xs font-semibold transition-all"
                        style={form.vehicle_type === vt.name
                          ? { background: '#0071e3', color: '#111' }
                          : { background: '#f2f2f7', color: '#86868b', border: '1px solid #e5e5ea' }}>
                        {vt.icon} {vt.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — Scheduling & Details */}
              <div className="px-7 py-6 space-y-4 overflow-y-auto">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0071e3' }}>Scheduling & Details</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Time *</label>
                    <select value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }}>
                      {TIME_SLOTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[30, 45, 60, 90, 120, 180].map(d => (
                      <button key={d} onClick={() => setForm(f => ({ ...f, duration_minutes: String(d) }))}
                        className="py-2 rounded-xl text-xs font-semibold transition-all"
                        style={form.duration_minutes === String(d)
                          ? { background: '#0071e3', color: '#fff' }
                          : { background: '#f2f2f7', color: '#86868b', border: '1px solid #e5e5ea' }}>
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Assign Staff ── */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: '#f2f2f7', border: '1px solid #e5e5ea' }}>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#0071e3' }} />
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0071e3' }}>Assign Staff</p>
                    <span className="text-xs" style={{ color: '#86868b' }}>(select multiple)</span>
                  </div>
                  {staff.length === 0
                    ? <p className="text-xs" style={{ color: '#86868b' }}>No staff added yet — go to Staff page to add.</p>
                    : <div className="flex flex-wrap gap-2">
                        {staff.map(s => {
                          const sel = form.staff_ids.includes(s.id);
                          return (
                            <button key={s.id} type="button"
                              onClick={() => setForm(f => {
                                const ids = sel ? f.staff_ids.filter(id => id !== s.id) : [...f.staff_ids, s.id];
                                const names = sel ? f.staff_names.filter(n => n !== s.name) : [...f.staff_names, s.name];
                                return { ...f, staff_ids: ids, staff_names: names };
                              })}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                              style={sel
                                ? { background: '#0071e3', color: '#111' }
                                : { background: '#ffffff', color: '#86868b', border: '1px solid #e5e5ea' }}>
                              {sel ? '✓ ' : ''}{s.name} <span style={{ opacity: 0.6 }}>({s.role})</span>
                            </button>
                          );
                        })}
                      </div>
                  }
                </div>

                {/* ── Services Requested ── */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: '#f2f2f7', border: '1px solid #e5e5ea' }}>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#0071e3' }} />
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0071e3' }}>Services Requested</p>
                    {form.selected_services.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5), 0 1px 2px rgba(0,0,0,0.15)' }}>
                        {form.selected_services.length} selected
                      </span>
                    )}
                  </div>
                  {availableServices.length === 0 ? (
                    <input value={form.services_note} onChange={e => setForm(f => ({ ...f, services_note: e.target.value }))}
                      placeholder="e.g. Foam Wash + Vacuum + Wax"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{ borderColor: '#e5e5ea', background: '#ffffff', color: '#1d1d1f' }} />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableServices.map(svc => {
                        const sel = form.selected_services.includes(svc.name);
                        return (
                          <button key={svc.id} type="button"
                            onClick={() => setForm(f => ({
                              ...f,
                              selected_services: sel
                                ? f.selected_services.filter(s => s !== svc.name)
                                : [...f.selected_services, svc.name],
                            }))}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={sel
                              ? { background: '#0071e3', color: '#111', border: '1px solid transparent' }
                              : { background: '#ffffff', color: '#86868b', border: '1px solid #e5e5ea' }}>
                            {sel && <span>✓</span>}
                            <span>{svc.name}</span>
                            <span style={{ opacity: 0.6 }}>{svc.duration_minutes}m</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any special requests or instructions…"
                    rows={3}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none resize-none"
                    style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-7 py-4" style={{ borderTop: '1px solid #e5e5ea', background: '#f2f2f7' }}>
              <button onClick={() => { setShowForm(false); setForm(emptyForm); setVehiclePicker([]); }}
                className="px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: '#ffffff', color: '#86868b', border: '1px solid #e5e5ea' }}>
                Cancel
              </button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="px-8 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60 transition-opacity"
                style={{ background: '#0071e3' }}>
                {createMutation.isPending ? 'Booking…' : '📅 Book Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}