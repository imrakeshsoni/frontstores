// [homeservice] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store/app.store';
import { listJobs, updateJob, type HsJob } from '@/lib/db/homeservice';

const STATUSES = ['all', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#2563eb', in_progress: '#d97706', completed: '#16a34a', cancelled: '#dc2626',
};

export function JobsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: jobs = [] } = useQuery({ queryKey: ['hs-jobs', tenantId], queryFn: () => listJobs(tenantId) });

  const updateMutation = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => updateJob(tenantId, id, { status: s }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hs-jobs'] }); toast.success('Status updated'); },
  });

  const filtered = (jobs as HsJob[]).filter((j: HsJob) =>
    (status === 'all' || j.status === status) &&
    (j.customer_name.toLowerCase().includes(search.toLowerCase()) || j.service_type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Jobs</h1>
        <button onClick={() => navigate('/homeservice/new-job')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
            style={status === s ? { background: 'var(--accent)', color: 'white' } : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {s}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or service…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
      </div>

      <div className="space-y-2">
        {filtered.map(j => (
          <div key={j.id} className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{j.customer_name}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: (STATUS_COLORS[j.status] ?? '#64748b') + '20', color: STATUS_COLORS[j.status] ?? '#64748b' }}>
                  {j.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{j.service_type} · {j.address}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{j.job_date} · ₹{j.total_amount.toLocaleString('en-IN')}</p>
            </div>
            <div className="flex gap-2">
              {j.status === 'scheduled' && (
                <button onClick={() => updateMutation.mutate({ id: j.id, s: 'in_progress' })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#d97706' }}>Start</button>
              )}
              {j.status === 'in_progress' && (
                <button onClick={() => updateMutation.mutate({ id: j.id, s: 'completed' })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#16a34a' }}>Done</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No jobs found</p>}
      </div>
    </div>
  );
}
