// [drivingschool] [all tenants]
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { saveDSStudent } from '@/lib/db/drivingschool';

interface FormData {
  name: string; phone: string; address: string; dob: string;
  id_proof_type: string; id_proof_no: string; license_type: string;
  fees_total: string;
}

const EMPTY: FormData = {
  name: '', phone: '', address: '', dob: '',
  id_proof_type: 'Aadhaar', id_proof_no: '', license_type: 'LMV',
  fees_total: '',
};

const LICENSE_TYPES = ['LMV', 'MCWG', 'HMV', 'LMV+MCWG'];
const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Voter ID', 'Passport', 'Driving License'];

export function NewStudentPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(EMPTY);

  const up = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => saveDSStudent(tenantId, {
      name: form.name.trim(),
      phone: form.phone,
      address: form.address,
      dob: form.dob,
      id_proof_type: form.id_proof_type,
      id_proof_no: form.id_proof_no,
      license_type: form.license_type,
      fees_total: parseFloat(form.fees_total) || 0,
    }),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['ds-students'] });
      qc.invalidateQueries({ queryKey: ['ds-stats'] });
      toast.success('Student enrolled!');
      navigate(`/drivingschool/students/${id}`);
    },
    onError: (e) => toast.error(String(e)),
  });

  const canSubmit = form.name.trim().length > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/drivingschool/students')} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>← Students</button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Enroll New Student</h1>
      </div>

      <div className="rounded-2xl border p-6 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {/* Personal */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Personal Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Full Name *</label>
              <input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
              <input className="input w-full" value={form.phone} onChange={e => up('phone', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date of Birth</label>
              <input type="date" className="input w-full" value={form.dob} onChange={e => up('dob', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Address</label>
              <input className="input w-full" value={form.address} onChange={e => up('address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ID Proof */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>ID Proof</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>ID Proof Type</label>
              <select className="input w-full" value={form.id_proof_type} onChange={e => up('id_proof_type', e.target.value)}>
                {ID_PROOF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>ID Proof Number</label>
              <input className="input w-full" value={form.id_proof_no} onChange={e => up('id_proof_no', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Course */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Course & Fees</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>License Type</label>
              <select className="input w-full" value={form.license_type} onChange={e => up('license_type', e.target.value)}>
                {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Fees (₹)</label>
              <input type="number" className="input w-full" value={form.fees_total} onChange={e => up('fees_total', e.target.value)} placeholder="0" min="0" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => navigate('/drivingschool/students')} className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: '#2563eb' }}>
            {save.isPending ? 'Enrolling…' : 'Enroll Student'}
          </button>
        </div>
      </div>
    </div>
  );
}
