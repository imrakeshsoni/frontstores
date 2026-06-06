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
const ACTIVE_STATUSES = ['waiting', 'in_progress', 'ready'];

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const PAGE_SIZE = 100;

export function JobsListPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const navigate  = useNavigate();
  const [date, setDate]     = useState(''); // default: all dates
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage]     = useState(0);

  // Main jobs query — no date filter by default so new jobs are always visible
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['carwash-jobs-list', tenantId, date, filter, page],
    queryFn: () => listJobs(tenantId, {
      date: date || undefined,
      status: (filter !== 'all' ? filter : undefined) as JobStatus | undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    enabled: !!tenantId,
    refetchInterval: 10000,
    staleTime: 0, // always refetch on mount so newly created jobs appear immediately
  });

  // Total count for pagination
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['carwash-jobs-count', tenantId, date, filter],
    queryFn: () => countJobs(tenantId, {
      date: date || undefined,
      status: (filter !== 'all' ? filter : undefined) as JobStatus | undefined,
    }),
    enabled: !!tenantId,
    staleTime: 0,
  });

  // Per-status counts (independent of current filter, so badges always show correct totals)
  const { data: waitingCount  = 0 } = useQuery({ queryKey: ['carwash-jobs-count', tenantId, date, 'waiting'],     queryFn: () => countJobs(tenantId, { date: date || undefined, status: 'waiting' }),     enabled: !!tenantId });
  const { data: progressCount = 0 } = useQuery({ queryKey: ['carwash-jobs-count', tenantId, date, 'in_progress'], queryFn: () => countJobs(tenantId, { date: date || undefined, status: 'in_progress' }), enabled: !!tenantId });
  const { data: readyCount    = 0 } = useQuery({ queryKey: ['carwash-jobs-count', tenantId, date, 'ready'],        queryFn: () => countJobs(tenantId, { date: date || undefined, status: 'ready' }),       enabled: !!tenantId });
  const { data: deliveredCount= 0 } = useQuery({ queryKey: ['carwash-jobs-count', tenantId, date, 'delivered'],    queryFn: () => countJobs(tenantId, { date: date || undefined, status: 'delivered' }),   enabled: !!tenantId });

  const STATUS_COUNTS: Record<string, number> = {
    waiting: waitingCount, in_progress: progressCount, ready: readyCount, delivered: deliveredCount,
  };
  const allCount = waitingCount + progressCount + readyCount + deliveredCount;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const handleFilterChange = (f: string) => { setFilter(f); setPage(0); };
  const handleDateChange   = (d: string) => { setDate(d);   setPage(0); };

  // Sort all results: latest first
  const sorted = [...jobs].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  // When "All" filter: group active jobs (waiting/in_progress/ready) at top, delivered at bottom
  const activeJobs    = filter === 'all' ? sorted.filter(j => ACTIVE_STATUSES.includes(j.status)) : [];
  const deliveredJobs = filter === 'all' ? sorted.filter(j => j.status === 'delivered') : [];
  const singleStatus  = filter !== 'all' ? sorted : [];

  const renderCard = (j: (typeof jobs)[0]) => {
    const sc = STATUS_COLORS[j.status] ?? STATUS_COLORS.delivered;
    return (
      <div key={j.id} onClick={() => navigate(`/carwash/jobs/${j.id}`)}
        className="rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between gap-4"
        style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: sc.bg }}>
            {j.vehicle_type === 'hatchback' ? '🚗' : j.vehicle_type === 'suv' ? '🚐' : j.vehicle_type === 'luxury' ? '🏎️' : '🚙'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm" style={{ color: '#1d1d1f' }}>
              {j.reg_number}
              <span className="ml-2 text-xs font-normal" style={{ color: '#86868b' }}>{j.job_number}</span>
            </p>
            <p className="text-xs" style={{ color: '#86868b' }}>
              {[j.make, j.model].filter(Boolean).join(' ') || j.vehicle_type} · {j.customer_name || 'Walk-in'}
              {j.staff_name ? ` · 👤 ${j.staff_name}` : ''}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>
              {(j.items ?? []).slice(0, 2).map((i: any) => i.service_name).join(', ')}
              {(j.items ?? []).length > 2 ? ` +${(j.items ?? []).length - 2}` : ''}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-sm" style={{ color: '#0071e3' }}>{fmt(j.total)}</p>
          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
            style={{ background: sc.bg, color: sc.color }}>
            {STATUS_LABELS[j.status]}
          </span>
          <p className="text-xs mt-1" style={{ color: '#86868b' }}>{fmtDate(j.created_at)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col" style={{ background: 'linear-gradient(160deg,#1c2133 0%,#111520 100%)', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating white plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>Job Cards</h1>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>
            {allCount} total · sorted latest first
          </p>
        </div>
        <button onClick={() => navigate('/carwash/jobs/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5), 0 1px 2px rgba(0,0,0,0.15)' }}>
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Date filter + status tabs */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e5e5ea', background: '#ffffff', color: '#1d1d1f' }} />
          {date
            ? <button onClick={() => handleDateChange('')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: '#f2f2f7', color: '#86868b', border: '1px solid #e5e5ea' }}>✕ Clear Date</button>
            : <button onClick={() => handleDateChange(todayISO())} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: '#0071e3', color: '#111' }}>Today</button>
          }
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'waiting', 'in_progress', 'ready', 'delivered'] as const).map(s => {
            const cnt = s === 'all' ? allCount : (STATUS_COUNTS[s] ?? 0);
            const sc = STATUS_COLORS[s] ?? { color: '#6b7280', bg: '#f3f4f6' };
            return (
              <button key={s} onClick={() => handleFilterChange(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={filter === s
                  ? { background: s === 'all' ? '#0071e3' : sc.color, color: '#fff' }
                  : { background: sc.bg, color: s === 'all' ? '#86868b' : sc.color }}>
                {s === 'all' ? 'All' : STATUS_LABELS[s]}{cnt > 0 ? ` (${cnt})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: '#f2f2f7' }} />
        ))}

        {/* All filter: active group first, then delivered */}
        {!isLoading && filter === 'all' && (
          <>
            {activeJobs.length > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider pt-1" style={{ color: '#0071e3' }}>
                  Active — {activeJobs.length} job{activeJobs.length !== 1 ? 's' : ''}
                </p>
                {activeJobs.map(renderCard)}
              </>
            )}
            {deliveredJobs.length > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider pt-3" style={{ color: '#86868b' }}>
                  Delivered — {deliveredJobs.length} job{deliveredJobs.length !== 1 ? 's' : ''}
                </p>
                {deliveredJobs.map(renderCard)}
              </>
            )}
            {activeJobs.length === 0 && deliveredJobs.length === 0 && (
              <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Car className="h-10 w-10 opacity-30" />
                <p className="text-sm" style={{ color: '#86868b' }}>No job cards yet</p>
              </div>
            )}
          </>
        )}

        {/* Single status filter */}
        {!isLoading && filter !== 'all' && (
          <>
            {singleStatus.length === 0 ? (
              <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Car className="h-10 w-10 opacity-30" />
                <p className="text-sm" style={{ color: '#86868b' }}>No {STATUS_LABELS[filter]?.toLowerCase()} jobs</p>
              </div>
            ) : singleStatus.map(renderCard)}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs" style={{ color: '#86868b' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold btn-secondary disabled:opacity-40">← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold btn-secondary disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
