// [repair] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listRepairJobs, deleteRepairJob, type RepairJob } from '@/lib/db/repair';

const STATUSES = ['all', 'received', 'diagnosing', 'repairing', 'ready', 'delivered'] as const;

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  received:   { color: '#2563eb', bg: '#dbeafe' },
  diagnosing: { color: '#d97706', bg: '#fef3c7' },
  repairing:  { color: '#7c3aed', bg: '#ede9fe' },
  ready:      { color: '#16a34a', bg: '#dcfce7' },
  delivered:  { color: '#64748b', bg: '#f1f5f9' },
};

function isOverdue(job: RepairJob): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return !!job.promised_date && job.promised_date < today && job.status !== 'delivered';
}

export function JobsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['repair-jobs', tenantId, statusFilter],
    queryFn: () => listRepairJobs(tenantId, { status: statusFilter }),
    enabled: !!tenantId,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRepairJob(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repair-jobs'] }); qc.invalidateQueries({ queryKey: ['repair-stats'] }); toast.success('Job deleted'); },
  });

  const filtered = jobs.filter(j => {
    if (!search) return true;
    const q = search.toLowerCase();
    return j.customer_name.toLowerCase().includes(q) || j.job_no.toLowerCase().includes(q) || j.device_brand.toLowerCase().includes(q) || j.device_model.toLowerCase().includes(q) || j.customer_phone.includes(q);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Repair Jobs</h1>
        <button onClick={() => navigate('/repair/jobs/new')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors" style={{ background: '#dc2626' }}>
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, customer, device…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 capitalize transition-colors ${statusFilter === s ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} style={statusFilter === s ? { background: '#dc2626' } : {}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {isLoading ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-4xl mb-2">🔧</p>
            <p className="font-medium">No jobs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)' }}>
                  {['Job No', 'Customer', 'Device', 'Issue', 'Status', 'Promised', 'Amount', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => {
                  const sc = STATUS_COLOR[j.status] ?? STATUS_COLOR['received'];
                  const overdue = isOverdue(j);
                  return (
                    <tr key={j.id} className={`border-b hover:bg-slate-50 transition-colors ${overdue ? 'bg-red-50/50' : ''}`} style={{ borderColor: 'var(--surface-border)' }}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{j.job_no}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{j.customer_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{j.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{j.device_brand} {j.device_model}</p>
                        <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{j.device_type}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="truncate" style={{ color: 'var(--text-secondary)' }}>{j.issue}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ color: sc.color, background: sc.bg }}>{j.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {j.promised_date ? (
                          <span className={`text-xs font-medium ${overdue ? 'text-red-600 font-semibold' : ''}`} style={!overdue ? { color: 'var(--text-secondary)' } : {}}>
                            {overdue ? '⚠ ' : ''}{j.promised_date}
                          </span>
                        ) : <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>
                        ₹{(j.final_amount || j.estimated_cost).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => navigate(`/repair/jobs/${j.id}`)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => { if (confirm(`Delete job ${j.job_no}?`)) del.mutate(j.id); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
