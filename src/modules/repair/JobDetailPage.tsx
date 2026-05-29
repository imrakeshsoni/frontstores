// [repair] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { getRepairJob, saveRepairJob, listJobParts, addJobPart, removeJobPart, listRepairParts } from '@/lib/db/repair';

const STATUSES = ['received', 'diagnosing', 'repairing', 'ready', 'delivered'] as const;
const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  received:   { color: '#2563eb', bg: '#dbeafe' },
  diagnosing: { color: '#d97706', bg: '#fef3c7' },
  repairing:  { color: '#7c3aed', bg: '#ede9fe' },
  ready:      { color: '#16a34a', bg: '#dcfce7' },
  delivered:  { color: '#64748b', bg: '#f1f5f9' },
};

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [selPartId, setSelPartId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [warrantyDays, setWarrantyDays] = useState('');
  const [notes, setNotes] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState('');

  const { data: job, isLoading } = useQuery({
    queryKey: ['repair-job', id, tenantId],
    queryFn: () => getRepairJob(tenantId, id!),
    enabled: !!id && !!tenantId,
  });

  const { data: jobParts = [] } = useQuery({
    queryKey: ['repair-job-parts', id, tenantId],
    queryFn: () => listJobParts(tenantId, id!),
    enabled: !!id && !!tenantId,
  });

  const { data: allParts = [] } = useQuery({
    queryKey: ['repair-parts', tenantId],
    queryFn: () => listRepairParts(tenantId),
    enabled: !!tenantId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['repair-job', id] });
    qc.invalidateQueries({ queryKey: ['repair-jobs'] });
    qc.invalidateQueries({ queryKey: ['repair-stats'] });
  };

  const updateStatus = useMutation({
    mutationFn: (status: string) => saveRepairJob(tenantId, {
      ...job!,
      status,
      completed_at: status === 'ready' ? new Date().toISOString().slice(0,19).replace('T',' ') : job!.completed_at,
      delivered_at: status === 'delivered' ? new Date().toISOString().slice(0,19).replace('T',' ') : job!.delivered_at,
    }),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
  });

  const updateField = useMutation({
    mutationFn: (data: Record<string,unknown>) => saveRepairJob(tenantId, { ...job!, ...data }),
    onSuccess: () => { invalidate(); setEditingField(null); setEditDiagnosis(false); toast.success('Saved'); },
  });

  const addPart = useMutation({
    mutationFn: () => {
      const part = allParts.find(p => p.id === selPartId)!;
      return addJobPart(tenantId, id!, { part_id: selPartId, part_name: part.name, quantity: parseInt(partQty)||1, rate: part.selling_price });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair-job-parts', id] });
      qc.invalidateQueries({ queryKey: ['repair-parts'] });
      setAddPartOpen(false); setSelPartId(''); setPartQty('1');
      toast.success('Part added');
    },
  });

  const removePart = useMutation({
    mutationFn: ({ pid, partId, qty }: { pid: string; partId: string; qty: number }) => removeJobPart(tenantId, pid, partId, qty),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair-job-parts', id] });
      qc.invalidateQueries({ queryKey: ['repair-parts'] });
    },
  });

  if (isLoading) return <div className="p-6 text-center" style={{ color: 'var(--text-secondary)' }}>Loading…</div>;
  if (!job) return <div className="p-6 text-center text-red-500">Job not found</div>;

  const sc = STATUS_COLOR[job.status] ?? STATUS_COLOR['received'];
  const filteredParts = allParts.filter(p => !partSearch || p.name.toLowerCase().includes(partSearch.toLowerCase()));
  const partsTotal = jobParts.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/repair/jobs')} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>← Jobs</button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{job.job_no}</h1>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ color: sc.color, background: sc.bg }}>{job.status}</span>
      </div>

      {/* Job info */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Customer</p><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{job.customer_name}</p><p style={{ color: 'var(--text-secondary)' }}>{job.customer_phone}</p></div>
          <div><p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Device</p><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{job.device_brand} {job.device_model}</p><p className="capitalize" style={{ color: 'var(--text-secondary)' }}>{job.device_type}{job.imei ? ` · IMEI: ${job.imei}` : ''}</p></div>
          <div><p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Issue</p><p style={{ color: 'var(--text-primary)' }}>{job.issue}</p></div>
          <div><p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Technician</p><p style={{ color: 'var(--text-primary)' }}>{job.technician || '—'}</p></div>
          <div><p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Received</p><p style={{ color: 'var(--text-primary)' }}>{job.received_at?.slice(0,10)}</p></div>
          <div><p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Promised</p><p style={{ color: 'var(--text-primary)' }}>{job.promised_date || '—'}</p></div>
        </div>

        {/* Diagnosis */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Diagnosis</p>
            <button onClick={() => { setDiagnosisText(job.diagnosis); setEditDiagnosis(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
          </div>
          {editDiagnosis ? (
            <div className="space-y-2">
              <textarea className="input w-full text-sm" rows={2} value={diagnosisText} onChange={e => setDiagnosisText(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button onClick={() => updateField.mutate({ diagnosis: diagnosisText })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#dc2626' }}>Save</button>
                <button onClick={() => setEditDiagnosis(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              </div>
            </div>
          ) : <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{job.diagnosis || '—'}</p>}
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Notes</p>
            <button onClick={() => { setNotes(job.notes); setEditingField('notes'); }} className="text-xs text-blue-600 hover:underline">Edit</button>
          </div>
          {editingField === 'notes' ? (
            <div className="space-y-2">
              <textarea className="input w-full text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button onClick={() => updateField.mutate({ notes })} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#dc2626' }}>Save</button>
                <button onClick={() => setEditingField(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              </div>
            </div>
          ) : <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{job.notes || '—'}</p>}
        </div>
      </div>

      {/* Status update */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Update Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => {
            const c = STATUS_COLOR[s];
            const isActive = job.status === s;
            return (
              <button key={s} onClick={() => updateStatus.mutate(s)} disabled={isActive || updateStatus.isPending} className="px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all disabled:opacity-60" style={{ color: isActive ? c.color : 'var(--text-secondary)', background: isActive ? c.bg : 'var(--surface-2)', border: isActive ? `2px solid ${c.color}` : '2px solid transparent' }}>
                {isActive ? '✓ ' : ''}{s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Parts */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Parts Used</h2>
          <button onClick={() => setAddPartOpen(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#dc2626' }}>
            <Plus className="h-3.5 w-3.5" /> Add Part
          </button>
        </div>

        {addPartOpen && (
          <div className="mb-4 p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)' }}>
            <input value={partSearch} onChange={e => setPartSearch(e.target.value)} placeholder="Search parts…" className="input w-full text-sm" />
            <select className="input w-full text-sm" value={selPartId} onChange={e => setSelPartId(e.target.value)}>
              <option value="">Select part</option>
              {filteredParts.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock}) — ₹{p.selling_price}</option>)}
            </select>
            <div className="flex gap-2 items-end">
              <div className="flex-1"><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Qty</label><input type="number" className="input w-full text-sm" value={partQty} onChange={e => setPartQty(e.target.value)} min="1" /></div>
              <button onClick={() => addPart.mutate()} disabled={!selPartId || addPart.isPending} className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#dc2626' }}>Add</button>
              <button onClick={() => setAddPartOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        )}

        {jobParts.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No parts added yet</p>
        ) : (
          <div className="space-y-2">
            {jobParts.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                <div><p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.part_name}</p><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Qty: {p.quantity} × ₹{p.rate}</p></div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>₹{p.amount}</span>
                  <button onClick={() => removePart.mutate({ pid: p.id, partId: p.part_id, qty: p.quantity })} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
              <span>Parts Total</span><span>₹{partsTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Final billing */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Final Billing</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Estimated</p><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>₹{job.estimated_cost}</p></div>
          <div><p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Advance Paid</p><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>₹{job.advance_paid}</p></div>
          <div><p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Final Amount</p><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>₹{job.final_amount || '—'}</p></div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Set Final Amount (₹)</label>
            <input type="number" className="input w-full" value={finalAmount} onChange={e => setFinalAmount(e.target.value)} placeholder={String(job.estimated_cost + partsTotal)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Warranty (days)</label>
            <input type="number" className="input w-full" value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} placeholder={String(job.warranty_days)} />
          </div>
        </div>
        <button
          onClick={() => updateField.mutate({ final_amount: parseFloat(finalAmount)||job.final_amount, warranty_days: parseInt(warrantyDays)||job.warranty_days })}
          disabled={(!finalAmount && !warrantyDays) || updateField.isPending}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors"
          style={{ background: '#dc2626' }}
        >
          Update Billing
        </button>
        {job.status !== 'delivered' && (
          <button
            onClick={() => updateStatus.mutate('delivered')}
            disabled={updateStatus.isPending}
            className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}
          >
            <CheckCircle className="h-4 w-4" /> Mark as Delivered
          </button>
        )}
      </div>
    </div>
  );
}
