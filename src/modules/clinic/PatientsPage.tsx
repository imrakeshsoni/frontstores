// [clinic] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import {
  searchPatients, createPatient, updatePatient, getPatientVisits,
  type ClinicPatient,
} from '@/lib/db/clinic';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Plus, ChevronRight } from 'lucide-react';

type PatientForm = {
  name: string; age: string; age_unit: string; gender: string;
  blood_group: string; phone: string; address: string;
  allergies: string; medical_history: string;
};

const emptyForm = (): PatientForm => ({
  name: '', age: '', age_unit: 'years', gender: '', blood_group: '',
  phone: '', address: '', allergies: '', medical_history: '',
});

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function PatientsPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | 'detail' | null>(null);
  const [selected, setSelected] = useState<ClinicPatient | null>(null);
  const [form, setForm] = useState<PatientForm>(emptyForm());

  const { data: patients = [], refetch } = useQuery({
    queryKey: ['clinic-patients', tid, search],
    queryFn: () => searchPatients(tid, search, 30),
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['clinic-patient-visits', tid, selected?.id],
    queryFn: () => selected ? getPatientVisits(tid, selected.id, 10) : Promise.resolve([]),
    enabled: !!selected && modal === 'detail',
  });

  const createMut = useMutation({
    mutationFn: () => createPatient(tid, {
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      age_unit: form.age_unit,
      gender: form.gender || null,
      blood_group: form.blood_group || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      allergies: form.allergies.trim() || null,
      medical_history: form.medical_history.trim() || null,
    }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['clinic-patients', tid] });
      toast.success(`Patient registered — ${p.patient_no}`);
      setModal(null);
      setForm(emptyForm());
    },
    onError: (e) => toast.error(String(e)),
  });

  const updateMut = useMutation({
    mutationFn: () => updatePatient(tid, selected!.id, {
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      age_unit: form.age_unit,
      gender: form.gender || null,
      blood_group: form.blood_group || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      allergies: form.allergies.trim() || null,
      medical_history: form.medical_history.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-patients', tid] });
      toast.success('Patient updated');
      setModal(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  function openDetail(p: ClinicPatient) {
    setSelected(p);
    setModal('detail');
  }

  function openEdit(p: ClinicPatient) {
    setSelected(p);
    setForm({
      name: p.name, age: p.age ? String(p.age) : '', age_unit: p.age_unit,
      gender: p.gender ?? '', blood_group: p.blood_group ?? '',
      phone: p.phone ?? '', address: p.address ?? '',
      allergies: p.allergies ?? '', medical_history: p.medical_history ?? '',
    });
    setModal('edit');
  }

  const inp = (field: keyof PatientForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
      />
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Patients</h1>
        <button
          onClick={() => { setForm(emptyForm()); setModal('add'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          <Plus className="h-4 w-4" /> Register Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        <input
          placeholder="Search by name, phone or Patient No…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
        {patients.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {search ? 'No patients found' : 'No patients registered yet'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Patient No', 'Name', 'Age', 'Gender', 'Blood Group', 'Phone', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer"
                  style={{ borderColor: 'var(--surface-border)' }}
                  onClick={() => openDetail(p)}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>{p.patient_no}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.age ? `${p.age} ${p.age_unit}` : '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.gender ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.blood_group ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {modal === 'add' ? 'Register New Patient' : 'Edit Patient'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">{inp('name', 'Full Name *', 'text', 'Patient full name')}</div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Age</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Age" value={form.age}
                    onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                    className="flex-1 rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                  <select value={form.age_unit} onChange={e => setForm(f => ({ ...f, age_unit: e.target.value }))}
                    className="rounded-xl px-2 py-2 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                    <option>years</option><option>months</option><option>days</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option value="">Select</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Blood Group</label>
                <select value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option value="">Unknown</option>
                  {BLOOD_GROUPS.map(bg => <option key={bg}>{bg}</option>)}
                </select>
              </div>
              {inp('phone', 'Phone', 'tel', '10-digit mobile')}
              <div className="col-span-2">{inp('address', 'Address', 'text', 'Full address')}</div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Allergies</label>
                <textarea value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                  placeholder="Known allergies (if any)" rows={2}
                  className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Medical History</label>
                <textarea value={form.medical_history} onChange={e => setForm(f => ({ ...f, medical_history: e.target.value }))}
                  placeholder="Previous conditions, surgeries, etc." rows={2}
                  className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button
                onClick={() => modal === 'add' ? createMut.mutate() : updateMut.mutate()}
                disabled={!form.name.trim() || createMut.isPending || updateMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {modal === 'add' ? 'Register' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Detail Modal */}
      {modal === 'detail' && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{selected.patient_no}</p>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {selected.age ? `${selected.age} ${selected.age_unit}` : '—'} · {selected.gender ?? '—'} · {selected.blood_group ?? '—'}
                </p>
                {selected.phone && <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>📞 {selected.phone}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate(`/clinic/visits/new?patient=${selected.id}`)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-white" style={{ background: 'var(--accent)' }}>
                  New Visit
                </button>
                <button onClick={() => openEdit(selected)}
                  className="px-3 py-1.5 rounded-xl text-xs border font-medium"
                  style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
                  Edit
                </button>
              </div>
            </div>

            {selected.allergies && (
              <div className="mb-3 px-3 py-2 rounded-xl" style={{ background: '#fee2e2' }}>
                <p className="text-xs font-semibold text-red-700">⚠ Allergies: {selected.allergies}</p>
              </div>
            )}

            {selected.medical_history && (
              <div className="mb-3 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>History: {selected.medical_history}</p>
              </div>
            )}

            <h3 className="text-xs font-semibold mt-4 mb-2" style={{ color: 'var(--text-tertiary)' }}>Recent Visits</h3>
            {visits.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No visits yet</p>
            ) : (
              <div className="space-y-2">
                {visits.map(v => (
                  <div key={v.id} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{v.visit_date}</p>
                      {v.doctor_name && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Dr. {v.doctor_name}</p>}
                    </div>
                    {v.chief_complaint && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>CC: {v.chief_complaint}</p>}
                    {v.diagnosis && <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-primary)' }}>Dx: {v.diagnosis}</p>}
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setModal(null)} className="mt-5 w-full py-2 rounded-xl text-sm border"
              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
