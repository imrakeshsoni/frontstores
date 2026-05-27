// [clinic] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listDoctors, createDoctor, updateDoctor, deleteDoctor, type ClinicDoctor } from '@/lib/db/clinic';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';

type DoctorForm = {
  name: string; specialization: string; qualification: string;
  registration_no: string; phone: string; consultation_fee: string; is_active: boolean;
};

const emptyForm = (): DoctorForm => ({
  name: '', specialization: '', qualification: '', registration_no: '',
  phone: '', consultation_fee: '500', is_active: true,
});

const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'ENT Specialist',
  'Gynecologist', 'Neurologist', 'Ophthalmologist', 'Orthopedic', 'Pediatrician',
  'Psychiatrist', 'Radiologist', 'Surgeon', 'Urologist', 'Dentist', 'Other',
];

export function DoctorsPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<ClinicDoctor | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm());

  const { data: doctors = [] } = useQuery({
    queryKey: ['clinic-doctors', tid],
    queryFn: () => listDoctors(tid),
  });

  const createMut = useMutation({
    mutationFn: () => createDoctor(tid, {
      name: form.name.trim(),
      specialization: form.specialization || null,
      qualification: form.qualification || null,
      registration_no: form.registration_no || null,
      phone: form.phone || null,
      consultation_fee: Number(form.consultation_fee),
      is_active: form.is_active,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-doctors', tid] });
      toast.success('Doctor added');
      setModal(null); setForm(emptyForm());
    },
    onError: (e) => toast.error(String(e)),
  });

  const updateMut = useMutation({
    mutationFn: () => updateDoctor(tid, selected!.id, {
      name: form.name.trim(),
      specialization: form.specialization || null,
      qualification: form.qualification || null,
      registration_no: form.registration_no || null,
      phone: form.phone || null,
      consultation_fee: Number(form.consultation_fee),
      is_active: form.is_active,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-doctors', tid] });
      toast.success('Doctor updated');
      setModal(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDoctor(tid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-doctors', tid] });
      toast.success('Doctor removed');
    },
  });

  function openEdit(d: ClinicDoctor) {
    setSelected(d);
    setForm({
      name: d.name, specialization: d.specialization ?? '', qualification: d.qualification ?? '',
      registration_no: d.registration_no ?? '', phone: d.phone ?? '',
      consultation_fee: String(d.consultation_fee), is_active: d.is_active,
    });
    setModal('edit');
  }

  const inp = (field: keyof DoctorForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type={type} placeholder={placeholder} value={form[field] as string}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Doctors</h1>
        <button onClick={() => { setForm(emptyForm()); setModal('add'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Doctor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {doctors.length === 0 && (
          <div className="col-span-2 rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No doctors added yet</p>
          </div>
        )}
        {doctors.map(d => (
          <div key={d.id} className="rounded-2xl p-5 flex items-start gap-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{ background: d.is_active ? 'var(--accent)' : '#94a3b8' }}>
              {d.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Dr. {d.name}</p>
                {!d.is_active && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>Inactive</span>}
              </div>
              {d.specialization && <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>{d.specialization}</p>}
              {d.qualification && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.qualification}</p>}
              <div className="flex gap-3 mt-1">
                {d.phone && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>📞 {d.phone}</p>}
                <p className="text-xs font-semibold" style={{ color: '#059669' }}>₹{d.consultation_fee} consult</p>
              </div>
              {d.registration_no && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Reg: {d.registration_no}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(d)} className="p-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button onClick={() => { if (confirm(`Remove Dr. ${d.name}?`)) deleteMut.mutate(d.id); }}
                className="p-2 rounded-xl" style={{ background: '#fee2e2' }}>
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {modal === 'add' ? 'Add Doctor' : 'Edit Doctor'}
            </h2>
            <div className="space-y-3">
              {inp('name', 'Full Name *', 'text', 'Doctor full name')}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Specialization</label>
                <select value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option value="">Select specialization</option>
                  {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {inp('qualification', 'Qualification', 'text', 'e.g. MBBS, MD')}
              {inp('registration_no', 'Medical Reg. No.', 'text', 'MCI registration number')}
              {inp('phone', 'Phone', 'tel', '10-digit mobile')}
              {inp('consultation_fee', 'Consultation Fee (₹)', 'number', '500')}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Active (available for appointments)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => modal === 'add' ? createMut.mutate() : updateMut.mutate()}
                disabled={!form.name.trim() || createMut.isPending || updateMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                {modal === 'add' ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
