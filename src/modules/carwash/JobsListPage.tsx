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
    const vehicleEmoji = j.vehicle_type === 'hatchback' ? '🚗' : j.vehicle_type === 'suv' ? '🚐' : j.vehicle_type === 'luxury' ? '🏎️' : '🚙';
    const services = (j.items ?? []) as { service_name: string }[];
    const carLabel = [j.make, j.model].filter(Boolean).join(' ') || j.vehicle_type || '';
    return (
      <div key={j.id} onClick={() => navigate(`/carwash/jobs/${j.id}`)}
        className="rounded-2xl cursor-pointer transition-shadow hover:shadow-lg"
        style={{ background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)', border: `1px solid ${sc.bg}` }}>

        {/* Top row — reg number + status + amount */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl flex-shrink-0">{vehicleEmoji}</span>
            <div className="min-w-0">
              <span className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '17px', letterSpacing: '-0.3px' }}>
                {j.reg_number}
              </span>
              <span className="ml-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{j.job_number}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(j.total)}</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: sc.bg, color: sc.color }}>
              {STATUS_LABELS[j.status]}
            </span>
          </div>
        </div>

        {/* Middle row — customer + car + staff */}
        <div className="flex items-center gap-4 px-4 pb-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>👤</span>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {j.customer_name || 'Walk-in'}
            </span>
          </div>
          {carLabel && (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>·</span>
          )}
          {carLabel && (
            <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{carLabel}</span>
          )}
          {j.staff_name && (
            <>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>·</span>
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>🔧 {j.staff_name}</span>
            </>
          )}
        </div>

        {/* Bottom row — services + time */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {services.slice(0, 3).map((svc, i) => (
              <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-md"
                style={{ background: sc.bg, color: sc.color }}>
                {svc.service_name}
              </span>
            ))}
            {services.length > 3 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: '#f2f2f7', color: '#6b6b6b' }}>
                +{services.length - 3} more
              </span>
            )}
            {services.length === 0 && (
              <span className="text-xs" style={{ color: '#aeaeb2' }}>No services</span>
            )}
          </div>
          <span className="text-xs flex-shrink-0 font-medium" style={{ color: '#6b6b6b' }}>{fmtDate(j.created_at)}</span>
        </div>
      </div>
    );
  };

  // [carwash] [all tenants] — tab config for the full-width status strip
  const STATUS_TABS = [
    { id: 'all',         label: 'All',         count: allCount,       color: '#0071e3', activeText: '#0071e3' },
    { id: 'waiting',     label: 'Waiting',     count: waitingCount,   color: '#d97706', activeText: '#d97706' },
    { id: 'in_progress', label: 'In Progress', count: progressCount,  color: '#2563eb', activeText: '#2563eb' },
    { id: 'ready',       label: 'Ready',       count: readyCount,     color: '#16a34a', activeText: '#16a34a' },
    { id: 'delivered',   label: 'Delivered',   count: deliveredCount, color: '#6b7280', activeText: '#6b7280' },
  ];

  return (
    <div className="flex flex-col" style={{ background: 'var(--bg)', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--surface-border)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Job Cards</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {allCount} total · sorted latest first
          </p>
        </div>
        <button onClick={() => navigate('/carwash/jobs/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: 'var(--accent)', color: '#ffffff', border: 'none', cursor: 'pointer' }}>
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      {/* [carwash] [all tenants] — Full-width Apple-style status tab strip */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', width: '100%' }}>
          {STATUS_TABS.map(({ id, label, count, color }, idx) => {
            const isActive = filter === id;
            const isLast = idx === STATUS_TABS.length - 1;
            return (
              <button
                key={id}
                onClick={() => handleFilterChange(id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  padding: '16px 4px',
                  background: isActive ? `${color}18` : 'transparent',
                  borderBottom: isActive ? `3px solid ${color}` : '3px solid transparent',
                  borderRight: isLast ? 'none' : '1px solid var(--surface-border)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  outline: 'none',
                }}>
                <span style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  lineHeight: 1,
                  color: isActive ? color : 'var(--text-primary)',
                  letterSpacing: '-0.5px',
                }}>
                  {count}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? color : 'var(--text-secondary)',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Date filter */}
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        {date
          ? <button onClick={() => handleDateChange('')} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>✕ Clear Date</button>
          : <button onClick={() => handleDateChange(todayISO())} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: 'var(--accent)', color: '#fff' }}>Today</button>
        }
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
                <p className="text-xs font-bold uppercase tracking-wider pt-1" style={{ color: 'var(--accent)' }}>
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
              <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <Car className="h-10 w-10 opacity-30" />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No job cards yet</p>
              </div>
            )}
          </>
        )}

        {/* Single status filter */}
        {!isLoading && filter !== 'all' && (
          <>
            {singleStatus.length === 0 ? (
              <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <Car className="h-10 w-10 opacity-30" />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No {STATUS_LABELS[filter]?.toLowerCase()} jobs</p>
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
