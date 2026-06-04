// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Car } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listJobs, countJobs, type JobStatus } from '@/lib/db/carwash';

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting', in_progress: 'In Progress', ready: 'Ready', delivered: 'Delivered',
};
const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  waiting:     { color: '#d97706', bg: '#fef3c7' },
  in_progress: { color: '#2563eb', bg: '#eff6ff' },
  ready:       { color: '#16a34a', bg: '#d1fae5' },
  delivered:   { color: '#6b7280', bg: '#f3f4f6' },
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function JobsListPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const navigate  = useNavigate();
  const [date, setDate]     = useState(todayISO());
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage]     = useState(0);
  const PAGE_SIZE = 50;

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['carwash-jobs-list', tenantId, date, filter, page],
    queryFn: () => listJobs(tenantId, {
      date: date || undefined,
      status: (filter !== 'all' ? filter : undefined) as JobStatus | undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['carwash-jobs-count', tenantId, date, filter],
    queryFn: () => countJobs(tenantId, {
      date: date || undefined,
      status: (filter !== 'all' ? filter : undefined) as JobStatus | undefined,
    }),
    enabled: !!tenantId,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const filtered = [...jobs].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  const counts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  const handleFilterChange = (f: string) => { setFilter(f); setPage(0); };
  const handleDateChange = (d: string) => { setDate(d); setPage(0); };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Job Cards</h1>
        </div>
        <button onClick={() => navigate('/carwash/jobs/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      {/* Date picker + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        {date && <button onClick={() => handleDateChange('')} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>All Dates</button>}
        {!date && <button onClick={() => handleDateChange(todayISO())} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'var(--accent)', color: '#111' }}>Today</button>}
        {(['all', 'waiting', 'in_progress', 'ready', 'delivered'] as const).map(s => {
          const cnt = s === 'all' ? jobs.length : (counts[s] ?? 0);
          const sc = STATUS_COLORS[s] ?? { color: '#6b7280', bg: '#f3f4f6' };
          return (
            <button key={s} onClick={() => handleFilterChange(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${filter === s ? 'text-white' : ''}`}
              style={filter === s ? { background: sc.color } : { background: sc.bg, color: sc.color }}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]} {cnt > 0 && `(${cnt})`}
            </button>
          );
        })}
      </div>

      {/* Jobs */}
      <div className="space-y-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <Car className="h-10 w-10 opacity-30" />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No jobs for this filter</p>
          </div>
        )}
        {filtered.map(j => {
          const sc = STATUS_COLORS[j.status] ?? STATUS_COLORS.delivered;
          return (
            <div key={j.id} onClick={() => navigate(`/carwash/jobs/${j.id}`)}
              className="rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: sc.bg }}>
                  {j.vehicle_type === 'hatchback' ? '🚗' : j.vehicle_type === 'suv' ? '🚐' : j.vehicle_type === 'luxury' ? '🏎️' : '🚙'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{j.reg_number}
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>{j.job_number}</span>
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {[j.make, j.model].filter(Boolean).join(' ') || j.vehicle_type} · {j.customer_name || 'Walk-in'}
                    {j.staff_name ? ` · 👤 ${j.staff_name}` : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {(j.items ?? []).slice(0, 2).map(i => i.service_name).join(', ')}
                    {(j.items ?? []).length > 2 ? ` +${(j.items ?? []).length - 2}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmt(j.total)}</p>
                <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
                  style={{ background: sc.bg, color: sc.color }}>
                  {STATUS_LABELS[j.status]}
                </span>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(j.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold btn-secondary disabled:opacity-40">
              ← Prev
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold btn-secondary disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
