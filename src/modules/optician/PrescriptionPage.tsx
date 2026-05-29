// [optician] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listOptPatients, listOptPrescriptions, createOptPrescription } from '@/lib/db/optician';

const RX_FIELDS = [
  { key: 'sph', label: 'SPH' },
  { key: 'cyl', label: 'CYL' },
  { key: 'axis', label: 'AXIS' },
  { key: 'add', label: 'ADD' },
  { key: 'va', label: 'VA' },
];

export function PrescriptionPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);
  const [filterPatient, setFilterPatient] = useState('');
  const [form, setForm] = useState({
    patient_id: '', doctor_name: '', exam_date: today,
    r_sph: '', r_cyl: '', r_axis: '', r_add: '', r_va: '',
    l_sph: '', l_cyl: '', l_add: '', l_axis: '', l_va: '',
    pd: '', notes: '',
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['opt-patients', tenantId, ''],
    queryFn: () => listOptPatients(tenantId),
    enabled: !!tenantId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['opt-prescriptions', tenantId, filterPatient],
    queryFn: () => listOptPrescriptions(tenantId, filterPatient || undefined),
    enabled: !!tenantId,
  });

  function resetForm() {
    setForm({ patient_id: '', doctor_name: '', exam_date: today, r_sph: '', r_cyl: '', r_axis: '', r_add: '', r_va: '', l_sph: '', l_cyl: '', l_add: '', l_axis: '', l_va: '', pd: '', notes: '' });
    setShowForm(false);
  }

  async function handleSave() {
    if (!form.patient_id) { toast.error('Select patient'); return; }
    try {
      await createOptPrescription(tenantId, form);
      toast.success('Prescription saved');
      qc.invalidateQueries({ queryKey: ['opt-prescriptions'] });
      qc.invalidateQueries({ queryKey: ['optician-stats'] });
      resetForm();
    } catch { toast.error('Failed'); }
  }

  function setRx(eye: 'r' | 'l', field: string, val: string) {
    setForm(f => ({ ...f, [`${eye}_${field}`]: val }));
  }

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name ?? id;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Prescriptions / Eye Exams</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#0891b2' }}>
          <Plus className="h-4 w-4" /> New Exam
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={filterPatient} onChange={e => setFilterPatient(e.target.value)}>
          <option value="">All Patients</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-xs text-slate-400">{prescriptions.length} records</span>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">New Eye Examination</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">Patient *</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}>
                <option value="">Select patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name} {p.phone && `· ${p.phone}`}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Exam Date</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.exam_date} onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))} />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-medium text-slate-500 block mb-1">Doctor Name</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.doctor_name} onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))} />
            </div>
          </div>

          {/* Rx Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-2 text-xs text-slate-500">Eye</th>
                  {RX_FIELDS.map(f => <th key={f.key} className="p-2 text-xs text-slate-500">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {(['r', 'l'] as const).map(eye => (
                  <tr key={eye} className="border-t border-slate-100">
                    <td className="p-2 font-semibold text-cyan-700">{eye === 'r' ? 'Right' : 'Left'}</td>
                    {RX_FIELDS.map(f => (
                      <td key={f.key} className="p-1">
                        <input
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center"
                          placeholder="—"
                          value={(form as any)[`${eye}_${f.key}`]}
                          onChange={e => setRx(eye, f.key, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">PD (Pupillary Distance)</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.pd} onChange={e => setForm(f => ({ ...f, pd: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Notes</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#0891b2' }}>Save</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {prescriptions.map(rx => (
          <div key={rx.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50">
                  <Eye className="h-4 w-4 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{getPatientName(rx.patient_id)}</h3>
                  <p className="text-xs text-slate-400">
                    {new Date(rx.exam_date).toLocaleDateString('en-IN')}
                    {rx.doctor_name && ` · Dr. ${rx.doctor_name}`}
                  </p>
                </div>
              </div>
              {rx.pd && <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">PD: {rx.pd}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 rounded-lg">
                    <th className="text-left p-2 text-slate-500">Eye</th>
                    {RX_FIELDS.map(f => <th key={f.key} className="p-2 text-slate-500">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-50">
                    <td className="p-2 font-semibold text-cyan-700">R</td>
                    {RX_FIELDS.map(f => <td key={f.key} className="p-2 text-center text-slate-600">{(rx as any)[`r_${f.key}`] || '—'}</td>)}
                  </tr>
                  <tr className="border-t border-slate-50">
                    <td className="p-2 font-semibold text-cyan-700">L</td>
                    {RX_FIELDS.map(f => <td key={f.key} className="p-2 text-center text-slate-600">{(rx as any)[`l_${f.key}`] || '—'}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            {rx.notes && <p className="text-xs text-slate-400 mt-2">{rx.notes}</p>}
          </div>
        ))}
        {prescriptions.length === 0 && <p className="text-center text-slate-400 py-12">No prescriptions found</p>}
      </div>
    </div>
  );
}
