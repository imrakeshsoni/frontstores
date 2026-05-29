// [pestcontrol] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listPCJobs, updatePCJob, deletePCJob } from '@/lib/db/pestcontrol';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUSES = [
  { value: 'all',          label: 'All' },
  { value: 'scheduled',    label: 'Scheduled' },
  { value: 'in-progress',  label: 'In Progress' },
  { value: 'completed',    label: 'Completed' },
  { value: 'cancelled',    label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled:    { bg: '#dbeafe', text: '#2563eb' },
  'in-progress':{ bg: '#fef3c7', text: '#d97706' },
  completed:    { bg: '#dcfce7', text: '#16a34a' },
  cancelled:    { bg: '#fee2e2', text: '#dc2626' },
};

export function PCJobsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['pc-jobs', tenantId, status],
    queryFn: () => listPCJobs(tenantId, status),
    enabled: !!tenantId,
  });

  const filtered = search
    ? jobs.filter(j => j.customer_name?.toLowerCase().includes(search.toLowerCase()) || j.job_no.toLowerCase().includes(search.toLowerCase()) || j.service_type.toLowerCase().includes(search.toLowerCase()))
    : jobs;

  async function markCompleted(j: ReturnType<typeof jobs[0] extends infer T ? () => T : never> extends never ? (typeof jobs)[0] : (typeof jobs)[0]) {
    await updatePCJob(tenantId, j.id, { ...j, status: 'completed' });
    qc.invalidateQueries({ queryKey: ['pc-jobs'] });
    qc.invalidateQueries({ queryKey: ['pc-stats'] });
    toast.success('Job marked as completed');
  }

  async function del(id: string) {
    if (!confirm('Delete this job?')) return;
    await deletePCJob(tenantId, id);
    qc.invalidateQueries({ queryKey: ['pc-jobs'] });
    qc.invalidateQueries({ queryKey: ['pc-stats'] });
    toast.success('Job deleted');
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Jobs</h1>
        <button onClick={() => navigate('/pestcontrol/jobs/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          New Job
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s.value} onClick={() => setStatus(s.value)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={status === s.value
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {s.label}
          </button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, job no or service type…"
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />

      {isLoading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No jobs found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(j => {
            const colors = STATUS_COLORS[j.status] ?? { bg: '#f1f5f9', text: '#64748b' };
            return (
              <div key={j.id} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{j.customer_name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: colors.bg, color: colors.text }}>
                        {j.status.charAt(0).toUpperCase() + j.status.slice(1)}
                      </span>
                      {j.amc === 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#ede9fe', color: '#7c3aed' }}>AMC</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {j.job_no} · {j.service_type} · {j.pest_type}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(j.job_date).toLocaleDateString('en-IN')} · {j.technician}
                    </p>
                    {j.next_service_date && (
                      <p className="text-xs" style={{ color: '#d97706' }}>
                        Next: {new Date(j.next_service_date).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(j.amount)}</p>
                    <p className="text-xs" style={{ color: j.paid_amount >= j.amount ? '#16a34a' : '#d97706' }}>
                      Paid: {fmt(j.paid_amount)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{j.payment_mode}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {j.status === 'scheduled' && (
                    <button onClick={() => markCompleted(j)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white"
                      style={{ background: '#16a34a' }}>
                      Mark Completed
                    </button>
                  )}
                  <button onClick={() => del(j.id)} className="p-1.5 rounded-xl" style={{ color: '#ef4444' }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
