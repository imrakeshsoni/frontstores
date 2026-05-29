// [repair] [all tenants]
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { saveRepairJob } from '@/lib/db/repair';

const DEVICE_TYPES = ['mobile', 'tablet', 'laptop', 'TV', 'other'];

interface FormData {
  customer_name: string; customer_phone: string;
  device_type: string; device_brand: string;
  device_model: string; imei: string;
  issue: string; diagnosis: string;
  technician: string; estimated_cost: string;
  advance_paid: string; promised_date: string;
  warranty_days: string; notes: string;
}

const EMPTY: FormData = {
  customer_name: '', customer_phone: '', device_type: 'mobile',
  device_brand: '', device_model: '', imei: '', issue: '',
  diagnosis: '', technician: '', estimated_cost: '', advance_paid: '',
  promised_date: '', warranty_days: '0', notes: '',
};

export function NewJobPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(EMPTY);

  const up = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => saveRepairJob(tenantId, {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone,
      device_type: form.device_type,
      device_brand: form.device_brand,
      device_model: form.device_model,
      imei: form.imei,
      issue: form.issue.trim(),
      diagnosis: form.diagnosis,
      technician: form.technician,
      estimated_cost: parseFloat(form.estimated_cost) || 0,
      advance_paid: parseFloat(form.advance_paid) || 0,
      promised_date: form.promised_date || null,
      warranty_days: parseInt(form.warranty_days) || 0,
      notes: form.notes,
    }),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['repair-jobs'] });
      qc.invalidateQueries({ queryKey: ['repair-stats'] });
      toast.success('Repair job created');
      navigate(`/repair/jobs/${id}`);
    },
    onError: (e) => toast.error(String(e)),
  });

  const canSubmit = form.customer_name.trim() && form.issue.trim();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/repair/jobs')} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>← Jobs</button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Repair Job</h1>
      </div>

      <div className="rounded-2xl border p-6 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {/* Customer */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Customer Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer Name *</label>
              <input className="input w-full" value={form.customer_name} onChange={e => up('customer_name', e.target.value)} autoFocus />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
              <input className="input w-full" value={form.customer_phone} onChange={e => up('customer_phone', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Device */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Device Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Device Type</label>
              <select className="input w-full" value={form.device_type} onChange={e => up('device_type', e.target.value)}>
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Brand</label>
              <input className="input w-full" value={form.device_brand} onChange={e => up('device_brand', e.target.value)} placeholder="e.g. Samsung, Apple" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Model</label>
              <input className="input w-full" value={form.device_model} onChange={e => up('device_model', e.target.value)} placeholder="e.g. Galaxy S21" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>IMEI / Serial No.</label>
              <input className="input w-full" value={form.imei} onChange={e => up('imei', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Issue */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Issue & Cost</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Issue Description *</label>
              <textarea className="input w-full" rows={2} value={form.issue} onChange={e => up('issue', e.target.value)} placeholder="Describe the problem…" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Initial Diagnosis</label>
              <input className="input w-full" value={form.diagnosis} onChange={e => up('diagnosis', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Estimated Cost (₹)</label>
                <input type="number" className="input w-full" value={form.estimated_cost} onChange={e => up('estimated_cost', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Advance Paid (₹)</label>
                <input type="number" className="input w-full" value={form.advance_paid} onChange={e => up('advance_paid', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Schedule</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Promised Date</label>
              <input type="date" className="input w-full" value={form.promised_date} onChange={e => up('promised_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Technician</label>
              <input className="input w-full" value={form.technician} onChange={e => up('technician', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Warranty Days</label>
              <input type="number" className="input w-full" value={form.warranty_days} onChange={e => up('warranty_days', e.target.value)} min="0" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
          <textarea className="input w-full" rows={2} value={form.notes} onChange={e => up('notes', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => navigate('/repair/jobs')} className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-colors" style={{ background: '#dc2626' }}>
            {save.isPending ? 'Creating…' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
