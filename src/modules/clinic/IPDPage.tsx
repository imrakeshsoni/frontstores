// [clinic] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import {
  listBeds, createBed, listAdmissions, admitPatient, dischargePatient,
  searchPatients, listDoctors, type ClinicBed, type ClinicAdmission,
} from '@/lib/db/clinic';
import { toast } from 'sonner';
import { Plus, BedDouble, LogOut } from 'lucide-react';

const BED_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  available: { bg: '#dcfce7', color: '#16a34a', label: 'Available' },
  occupied:  { bg: '#fee2e2', color: '#dc2626', label: 'Occupied' },
  reserved:  { bg: '#fef9c3', color: '#ca8a04', label: 'Reserved' },
  cleaning:  { bg: '#e0f2fe', color: '#0891b2', label: 'Cleaning' },
};

export function IPDPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'beds' | 'admissions'>('beds');
  const [bedModal, setBedModal] = useState(false);
  const [admitModal, setAdmitModal] = useState<ClinicBed | null>(null);
  const [bedForm, setBedForm] = useState({ ward: '', room_no: '', bed_no: '', bed_type: 'general', charges_per_day: '0' });
  const [admitForm, setAdmitForm] = useState({ doctor_id: '', diagnosis: '', notes: '' });
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const { data: beds = [] } = useQuery({
    queryKey: ['clinic-beds', tid],
    queryFn: () => listBeds(tid),
  });
  const { data: admissions = [] } = useQuery({
    queryKey: ['clinic-admissions', tid],
    queryFn: () => listAdmissions(tid, 'admitted'),
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ['clinic-doctors', tid],
    queryFn: () => listDoctors(tid),
  });
  const { data: patientResults = [] } = useQuery({
    queryKey: ['clinic-patients-search', tid, patientSearch],
    queryFn: () => searchPatients(tid, patientSearch, 5),
    enabled: patientSearch.length >= 2,
  });

  const createBedMut = useMutation({
    mutationFn: () => createBed(tid, {
      ward: bedForm.ward.trim(), room_no: bedForm.room_no || null,
      bed_no: bedForm.bed_no.trim(), bed_type: bedForm.bed_type,
      charges_per_day: Number(bedForm.charges_per_day), status: 'available',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-beds', tid] });
      toast.success('Bed added');
      setBedModal(false);
      setBedForm({ ward: '', room_no: '', bed_no: '', bed_type: 'general', charges_per_day: '0' });
    },
    onError: (e) => toast.error(String(e)),
  });

  const admitMut = useMutation({
    mutationFn: () => {
      if (!selectedPatient || !admitModal) throw new Error('Select patient');
      const doc = doctors.find(d => d.id === admitForm.doctor_id);
      return admitPatient(tid, {
        patient_id: selectedPatient.id, patient_name: selectedPatient.name,
        bed_id: admitModal.id, bed_no: admitModal.bed_no, ward: admitModal.ward,
        doctor_id: doc?.id, doctor_name: doc?.name,
        diagnosis: admitForm.diagnosis || undefined, notes: admitForm.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-beds', tid] });
      qc.invalidateQueries({ queryKey: ['clinic-admissions', tid] });
      toast.success('Patient admitted');
      setAdmitModal(null); setSelectedPatient(null); setPatientSearch('');
      setAdmitForm({ doctor_id: '', diagnosis: '', notes: '' });
    },
    onError: (e) => toast.error(String(e)),
  });

  const dischargeMut = useMutation({
    mutationFn: (a: ClinicAdmission) => dischargePatient(tid, a.id, a.bed_id ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-beds', tid] });
      qc.invalidateQueries({ queryKey: ['clinic-admissions', tid] });
      toast.success('Patient discharged');
    },
    onError: (e) => toast.error(String(e)),
  });

  // Group beds by ward
  const wards = Array.from(new Set(beds.map(b => b.ward)));
  const available = beds.filter(b => b.status === 'available').length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>IPD / Beds</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {available} of {beds.length} beds available · {admissions.length} admitted
          </p>
        </div>
        <button onClick={() => setBedModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Bed
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['beds', 'admissions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={activeTab === tab
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {tab === 'beds' ? 'Bed Map' : 'Current Admissions'}
          </button>
        ))}
      </div>

      {/* Bed Map */}
      {activeTab === 'beds' && (
        <div className="space-y-5">
          {beds.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <BedDouble className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No beds added yet. Click "Add Bed" to start.</p>
            </div>
          )}
          {wards.map(ward => (
            <div key={ward}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>{ward}</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {beds.filter(b => b.ward === ward).map(b => {
                  const sc = BED_STATUS_STYLE[b.status] ?? BED_STATUS_STYLE.available;
                  return (
                    <div key={b.id} className="rounded-2xl p-4 flex flex-col gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
                      style={{ background: sc.bg, border: `2px solid ${sc.color}20` }}
                      onClick={() => b.status === 'available' && setAdmitModal(b)}>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold" style={{ color: sc.color }}>Bed {b.bed_no}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'white', color: sc.color }}>{sc.label}</span>
                      </div>
                      {b.room_no && <p className="text-xs" style={{ color: sc.color, opacity: 0.7 }}>Room {b.room_no}</p>}
                      <p className="text-xs" style={{ color: sc.color, opacity: 0.7 }}>{b.bed_type} · ₹{b.charges_per_day}/day</p>
                      {b.status === 'available' && (
                        <p className="text-xs font-medium" style={{ color: sc.color }}>Tap to admit →</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admissions */}
      {activeTab === 'admissions' && (
        <div className="space-y-3">
          {admissions.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No current admissions</p>
            </div>
          )}
          {admissions.map(a => {
            const days = Math.ceil((Date.now() - new Date(a.admission_date).getTime()) / 86400000);
            const bed = beds.find(b => b.id === a.bed_id);
            return (
              <div key={a.id} className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fee2e2' }}>
                  <BedDouble className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{a.patient_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {a.ward} · Bed {a.bed_no} · Since {a.admission_date} ({days} day{days !== 1 ? 's' : ''})
                  </p>
                  {a.diagnosis && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Dx: {a.diagnosis}</p>}
                  {a.doctor_name && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Dr. {a.doctor_name}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: '#059669' }}>
                    ₹{((bed?.charges_per_day ?? 0) * days).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>room charges</p>
                </div>
                <button onClick={() => { if (confirm(`Discharge ${a.patient_name}?`)) dischargeMut.mutate(a); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-white ml-2"
                  style={{ background: '#16a34a' }}>
                  <LogOut className="h-3 w-3" /> Discharge
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Bed Modal */}
      {bedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Add Bed</h2>
            <div className="space-y-3">
              {[['ward', 'Ward Name', 'General Ward'], ['room_no', 'Room No.', '101 (optional)'], ['bed_no', 'Bed No. *', 'A1']].map(([f, l, p]) => (
                <div key={f}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</label>
                  <input placeholder={p} value={(bedForm as any)[f]} onChange={e => setBedForm(ff => ({ ...ff, [f]: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Bed Type</label>
                <select value={bedForm.bed_type} onChange={e => setBedForm(f => ({ ...f, bed_type: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option>general</option><option>semi-private</option><option>private</option><option>icu</option><option>nicu</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Charges per Day (₹)</label>
                <input type="number" placeholder="500" value={bedForm.charges_per_day}
                  onChange={e => setBedForm(f => ({ ...f, charges_per_day: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setBedModal(false)} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => createBedMut.mutate()} disabled={!bedForm.ward || !bedForm.bed_no || createBedMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                Add Bed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admit Patient Modal */}
      {admitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Admit Patient</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--accent)' }}>
              {admitModal.ward} · Bed {admitModal.bed_no} · ₹{admitModal.charges_per_day}/day
            </p>
            <div className="space-y-3">
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
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-lg overflow-hidden"
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
              <select value={admitForm.doctor_id} onChange={e => setAdmitForm(f => ({ ...f, doctor_id: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <option value="">Assign Doctor (optional)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
              </select>
              <input placeholder="Diagnosis / Reason for admission" value={admitForm.diagnosis}
                onChange={e => setAdmitForm(f => ({ ...f, diagnosis: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              <input placeholder="Notes" value={admitForm.notes}
                onChange={e => setAdmitForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setAdmitModal(null); setSelectedPatient(null); setPatientSearch(''); }}
                className="flex-1 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={() => admitMut.mutate()} disabled={!selectedPatient || admitMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                Admit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
