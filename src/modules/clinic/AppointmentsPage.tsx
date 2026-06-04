// [clinic] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import {
  listAppointments, createAppointment, updateAppointmentStatus,
  searchPatients, listDoctors,
} from '@/lib/db/clinic';
import { toast } from 'sonner';
import { Plus, MessageCircle, CheckCircle } from 'lucide-react';
import { sendWhatsApp } from '@/lib/whatsapp';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  scheduled:  { bg: '#dbeafe', color: '#2563eb' },
  confirmed:  { bg: '#dcfce7', color: '#16a34a' },
  completed:  { bg: '#f1f5f9', color: '#64748b' },
  cancelled:  { bg: '#fee2e2', color: '#dc2626' },
  'no-show':  { bg: '#fef9c3', color: '#ca8a04' },
};

export function AppointmentsPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [modal, setModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [form, setForm] = useState({
    doctor_id: '', doctor_name: '', appointment_time: '', type: 'consultation', notes: '',
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['clinic-appointments', tid, date],
    queryFn: () => listAppointments(tid, date),
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ['clinic-doctors', tid],
    queryFn: () => listDoctors(tid),
  });
  const { data: patientResults = [] } = useQuery({
    queryKey: ['clinic-patients-search', tid, patientSearch],
    queryFn: () => searchPatients(tid, patientSearch, 6),
    enabled: patientSearch.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: () => {
      if (!selectedPatient) throw new Error('Select a patient');
      const doc = doctors.find(d => d.id === form.doctor_id);
      return createAppointment(tid, {
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.name,
        patient_phone: selectedPatient.phone ?? null,
        doctor_id: doc?.id ?? null,
        doctor_name: doc?.name ?? null,
        appointment_date: date,
        appointment_time: form.appointment_time || null,
        type: form.type,
        status: 'scheduled',
        notes: form.notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-appointments', tid, date] });
      toast.success('Appointment booked!');
      setModal(false);
      setSelectedPatient(null);
      setPatientSearch('');
      setForm({ doctor_id: '', doctor_name: '', appointment_time: '', type: 'consultation', notes: '' });
    },
    onError: (e) => toast.error(String(e)),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateAppointmentStatus(tid, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clinic-appointments', tid, date] }),
  });

  function sendApptReminder(a: any) {
    if (!a.patient_phone) { toast.error('No phone number'); return; }
    const text = `Hello ${a.patient_name ?? 'Patient'},\n\nThis is a reminder for your appointment at ${config?.shop_name ?? 'Clinic'} on ${a.appointment_date}${a.appointment_time ? ` at ${a.appointment_time}` : ''}.\n\nPlease carry your previous prescriptions and reports.\n\nThank you!`;
    sendWhatsApp(a.patient_phone, text);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Appointments</h1>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Book Appointment
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <button onClick={() => {
          const d = new Date(date); d.setDate(d.getDate() - 1);
          setDate(d.toISOString().slice(0, 10));
        }} className="px-3 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>←</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
        <button onClick={() => {
          const d = new Date(date); d.setDate(d.getDate() + 1);
          setDate(d.toISOString().slice(0, 10));
        }} className="px-3 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>→</button>
        <button onClick={() => setDate(today)} className="px-3 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--accent)' }}>Today</button>
        <span className="ml-auto text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{appointments.length} appointments</span>
      </div>

      {/* List */}
      <div className="space-y-3">
        {appointments.length === 0 && (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No appointments for this date</p>
          </div>
        )}
        {appointments.map(a => {
          const sc = STATUS_COLOR[a.status] ?? STATUS_COLOR.scheduled;
          return (
            <div key={a.id} className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {a.appointment_time && (
                <div className="text-center w-12 flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{a.appointment_time}</p>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{a.patient_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {a.doctor_name ? `Dr. ${a.doctor_name}` : 'No doctor assigned'} · {a.type}
                  {a.notes && ` · ${a.notes}`}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{a.status}</span>
              <div className="flex gap-2">
                {a.patient_phone && (
                  <button onClick={() => sendApptReminder(a)} title="Send WhatsApp reminder"
                    className="p-2 rounded-xl" style={{ background: '#dcfce7', color: '#16a34a' }}>
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                )}
                {a.status === 'scheduled' && (
                  <>
                    <button onClick={() => statusMut.mutate({ id: a.id, status: 'completed' })}
                      className="p-2 rounded-xl" style={{ background: '#dbeafe', color: '#2563eb' }} title="Mark completed">
                      <CheckCircle className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => statusMut.mutate({ id: a.id, status: 'cancelled' })}
                      className="px-2 py-1 rounded-xl text-xs" style={{ background: '#fee2e2', color: '#dc2626' }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Book Appointment</h2>
            <div className="space-y-3">
              {/* Patient */}
              {selectedPatient ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedPatient.name}</p>
                    <p className="text-xs" style={{ color: 'var(--accent)' }}>{selectedPatient.patient_no}</p>
                  </div>
                  <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input placeholder="Search patient…" value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                  {patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl overflow-hidden"
                      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                      {patientResults.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-b-0"
                          style={{ borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                          {p.name} <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.patient_no}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <option value="">Select Doctor (optional)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
              </select>
              <input type="time" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <option>consultation</option><option>follow-up</option><option>procedure</option><option>lab</option><option>emergency</option>
              </select>
              <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={!selectedPatient || createMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
