// [homeservice] [all tenants]
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store/app.store';
import { createJob } from '@/lib/db/homeservice';

const SERVICE_TYPES = ['Electrical', 'Plumbing', 'AC Repair', 'Carpentry', 'Painting', 'Cleaning', 'Other'];

export function NewJobPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', address: '',
    service_type: '', description: '', technician: '',
    job_date: new Date().toISOString().split('T')[0],
    labour_charge: '', total_amount: '', payment_mode: 'cash', notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => createJob(tenantId, {
      job_no: '', ...form, labour_charge: Number(form.labour_charge) || 0,
      total_amount: Number(form.total_amount) || 0, paid_amount: 0,
      status: 'scheduled',
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hs-jobs'] }); toast.success('Job created'); navigate('/homeservice/jobs'); },
    onError: () => toast.error('Failed to create job'),
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Job</h1>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Customer</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *" value={form.customer_name} onChange={v => set('customer_name', v)} />
          <Field label="Phone" value={form.customer_phone} onChange={v => set('customer_phone', v)} />
        </div>
        <Field label="Address *" value={form.address} onChange={v => set('address', v)} />
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Job Details</p>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Service Type *</label>
          <select value={form.service_type} onChange={e => set('service_type', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
            <option value="">Select…</option>
            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Field label="Description" value={form.description} onChange={v => set('description', v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Technician" value={form.technician} onChange={v => set('technician', v)} />
          <Field label="Date *" type="date" value={form.job_date} onChange={v => set('job_date', v)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Labour Charge ₹" type="number" value={form.labour_charge} onChange={v => set('labour_charge', v)} />
          <Field label="Total Amount ₹" type="number" value={form.total_amount} onChange={v => set('total_amount', v)} />
        </div>
        <Field label="Notes" value={form.notes} onChange={v => set('notes', v)} />
      </div>

      <button onClick={() => mutation.mutate()} disabled={!form.customer_name || !form.address || !form.service_type || mutation.isPending}
        className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-40"
        style={{ background: 'var(--accent)' }}>
        {mutation.isPending ? 'Saving…' : 'Create Job'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
    </div>
  );
}
