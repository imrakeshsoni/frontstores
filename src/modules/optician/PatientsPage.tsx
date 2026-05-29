// [optician] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listOptPatients, createOptPatient, updateOptPatient, deleteOptPatient, listOptPrescriptions } from '@/lib/db/optician';

export function PatientsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', dob: '', address: '' });

  const { data: patients = [] } = useQuery({
    queryKey: ['opt-patients', tenantId, search],
    queryFn: () => listOptPatients(tenantId, search),
    enabled: !!tenantId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['opt-prescriptions-patient', tenantId, expandedId],
    queryFn: () => listOptPrescriptions(tenantId, expandedId!),
    enabled: !!expandedId,
  });

  function resetForm() { setForm({ name: '', phone: '', dob: '', address: '' }); setEditId(null); setShowForm(false); }

  async function handleSave() {
    if (!form.name) { toast.error('Name required'); return; }
    try {
      if (editId) { await updateOptPatient(tenantId, editId, form); toast.success('Updated'); }
      else { await createOptPatient(tenantId, form); toast.success('Patient added'); }
      qc.invalidateQueries({ queryKey: ['opt-patients'] });
      resetForm();
    } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete patient?')) return;
    await deleteOptPatient(tenantId, id);
    qc.invalidateQueries({ queryKey: ['opt-patients'] });
    toast.success('Deleted');
  }

  function startEdit(p: any) {
    setForm({ name: p.name, phone: p.phone, dob: p.dob, address: p.address });
    setEditId(p.id); setShowForm(true);
  }

  const lastPrescription = (patientId: string) => {
    if (expandedId !== patientId || prescriptions.length === 0) return null;
    return prescriptions[0];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patients</h1>
          <p className="text-slate-500 text-sm">{patients.length} total</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#0891b2' }}>
          <Plus className="h-4 w-4" /> New Patient
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">{editId ? 'Edit Patient' : 'New Patient'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Name *</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Phone</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Date of Birth</label>
              <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Address</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#0891b2' }}>Save</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {patients.map(p => {
          const rx = lastPrescription(p.id);
          return (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
                    <User className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.phone || '—'}</p>
                    {p.dob && <p className="text-xs text-slate-400">DOB: {p.dob}</p>}
                    {p.address && <p className="text-xs text-slate-400 truncate max-w-xs">{p.address}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50">
                    {expandedId === p.id ? 'Hide Rx' : 'View Rx'}
                  </button>
                  <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500">
                    ✕
                  </button>
                </div>
              </div>

              {expandedId === p.id && (
                <div className="mt-4 pt-4 border-t border-slate-50">
                  {prescriptions.length === 0 ? (
                    <p className="text-slate-400 text-sm">No prescriptions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {prescriptions.slice(0, 3).map(rx => (
                        <div key={rx.id} className="bg-cyan-50 rounded-xl p-3 text-xs">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-cyan-800">{new Date(rx.exam_date).toLocaleDateString('en-IN')}</span>
                            <span className="text-cyan-600">{rx.doctor_name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-600">
                            <div>R: {rx.r_sph && `SPH ${rx.r_sph}`} {rx.r_cyl && `CYL ${rx.r_cyl}`} {rx.r_axis && `AXIS ${rx.r_axis}`}</div>
                            <div>L: {rx.l_sph && `SPH ${rx.l_sph}`} {rx.l_cyl && `CYL ${rx.l_cyl}`} {rx.l_axis && `AXIS ${rx.l_axis}`}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {patients.length === 0 && <p className="text-center text-slate-400 py-12">No patients found</p>}
      </div>
    </div>
  );
}
