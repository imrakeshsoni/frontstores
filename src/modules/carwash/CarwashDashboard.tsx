// [carwash] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listJobs, getDateStats, listAppointments, getStaffPerformance } from '@/lib/db/carwash';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function yesterdayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const VEHICLE_ICONS: Record<string, string> = { hatchback: '🚗', sedan: '🚙', suv: '🚐', luxury: '🏎️', bike: '🏍️', truck: '🚚' };

const raisedShadow = '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.07), 0 12px 28px rgba(0,0,0,0.06)';

export function CarwashDashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName = useAppStore((s) => s.config?.shop_name ?? 'Car Wash');
  const navigate = useNavigate();
  const today     = todayISO();
  const yesterday = yesterdayISO();
  const e = !!tenantId;

  const { data: todayFull } = useQuery({ queryKey: ['cw-today', tenantId, today],     queryFn: () => getDateStats(tenantId, today),         enabled: e, refetchInterval: 15000 });
  const { data: ydayFull }  = useQuery({ queryKey: ['cw-yday',  tenantId, yesterday], queryFn: () => getDateStats(tenantId, yesterday),     enabled: e });
  const { data: jobs = [] } = useQuery({ queryKey: ['cw-jobs',  tenantId, today],     queryFn: () => listJobs(tenantId, { date: today }),   enabled: e, refetchInterval: 10000 });
  const { data: appts = [] }= useQuery({ queryKey: ['cw-appts', tenantId, today],     queryFn: () => listAppointments(tenantId, today),     enabled: e, refetchInterval: 30000 });
  const { data: staff = [] }= useQuery({ queryKey: ['cw-staff', tenantId, today],     queryFn: () => getStaffPerformance(tenantId, today),  enabled: e, refetchInterval: 60000 });

  const waiting    = jobs.filter((j: any) => j.status === 'waiting');
  const inProgress = jobs.filter((j: any) => j.status === 'in_progress');
  const ready      = jobs.filter((j: any) => j.status === 'ready');
  const pending    = appts.filter((a: any) => a.status !== 'done' && a.status !== 'cancelled');

  const revenue  = todayFull?.revenue ?? 0;
  const ydayRev  = ydayFull?.revenue ?? 0;
  const revDelta = ydayRev > 0 ? ((revenue - ydayRev) / ydayRev) * 100 : null;

  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col" style={{ background: '#f5f5f7', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: '#ffffff', boxShadow: '0 1px 0 #e5e5ea', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>{shopName}</h1>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>{dateStr}</p>
        </div>
        <button onClick={() => navigate('/carwash/jobs/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.4)' }}>
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Revenue + Jobs ── */}
        <div className="grid grid-cols-3 gap-4">

          <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#86868b' }}>Today's Revenue</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#1d1d1f' }}>{fmt(revenue)}</p>
            {revDelta !== null && (
              <p className="text-xs font-semibold mt-1.5" style={{ color: revDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                {revDelta >= 0 ? '▲' : '▼'} {Math.abs(revDelta).toFixed(0)}% vs yesterday
              </p>
            )}
          </div>

          <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#86868b' }}>Cars Done</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#1d1d1f' }}>{todayFull?.totalJobs ?? 0}</p>
            <p className="text-xs mt-1.5" style={{ color: '#86868b' }}>
              avg {fmt(todayFull?.avgJobValue ?? 0)} / job
            </p>
          </div>

          <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#86868b' }}>In Queue</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#1d1d1f' }}>{waiting.length + inProgress.length}</p>
            <div className="flex items-center gap-3 mt-1.5">
              {waiting.length > 0    && <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>⏳ {waiting.length} waiting</span>}
              {inProgress.length > 0 && <span className="text-xs font-medium" style={{ color: '#0071e3' }}>🔧 {inProgress.length} active</span>}
              {ready.length > 0      && <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>✓ {ready.length} ready</span>}
            </div>
          </div>
        </div>

        {/* ── Live queue ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#86868b' }}>Live Queue</p>
          <div className="grid grid-cols-3 gap-4">
            {([
              { key: 'waiting',     label: 'Waiting',      jobs: waiting,    color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
              { key: 'in_progress', label: 'In Progress',  jobs: inProgress, color: '#0071e3', bg: '#eff6ff', dot: '#0071e3' },
              { key: 'ready',       label: 'Ready ✓',      jobs: ready,      color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
            ] as const).map(col => (
              <div key={col.key} className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f2f2f7' }}>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: col.dot }} />
                    <span className="text-sm font-bold" style={{ color: '#1d1d1f' }}>{col.label}</span>
                  </div>
                  <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>
                    {col.jobs.length}
                  </span>
                </div>
                <div className="p-3 space-y-2" style={{ minHeight: 100 }}>
                  {col.jobs.length === 0 ? (
                    <p className="text-xs text-center pt-6" style={{ color: '#c7c7cc' }}>Empty</p>
                  ) : col.jobs.map((j: any) => (
                    <div key={j.id} onClick={() => navigate(`/carwash/jobs/${j.id}`)}
                      className="rounded-xl p-3 cursor-pointer hover:opacity-80"
                      style={{ background: col.bg, border: `1px solid ${col.color}25` }}>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm" style={{ color: '#1d1d1f' }}>
                          {VEHICLE_ICONS[j.vehicle_type] ?? '🚗'} {j.reg_number}
                        </p>
                        <p className="text-sm font-bold" style={{ color: col.color }}>{fmt(j.total)}</p>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#86868b' }}>
                        {j.customer_name || 'Walk-in'}{j.staff_name ? ` · ${j.staff_name}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Appointments + Staff side by side ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Appointments */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f2f2f7' }}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" style={{ color: '#0071e3' }} />
                <span className="text-sm font-bold" style={{ color: '#1d1d1f' }}>Appointments Today</span>
              </div>
              {pending.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#0071e3' }}>
                  {pending.length}
                </span>
              )}
            </div>
            <div className="p-3">
              {pending.length === 0 ? (
                <div className="text-center py-5">
                  <p className="text-xs" style={{ color: '#c7c7cc' }}>No appointments today</p>
                  <button onClick={() => navigate('/carwash/appointments')}
                    className="mt-2 text-xs font-semibold" style={{ color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Book one →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.slice(0, 5).map((a: any) => {
                    const h = parseInt(a.appointment_time.split(':')[0]);
                    const m = a.appointment_time.split(':')[1];
                    const lbl = `${h > 12 ? h - 12 : h}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
                    return (
                      <div key={a.id} onClick={() => navigate('/carwash/appointments')}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:opacity-80"
                        style={{ background: '#f5f5f7' }}>
                        <p className="text-xs font-bold w-14 flex-shrink-0" style={{ color: '#0071e3' }}>{lbl}</p>
                        <p className="text-xs font-semibold truncate" style={{ color: '#1d1d1f' }}>{a.customer_name || 'Walk-in'}</p>
                        {a.reg_number && <p className="text-xs ml-auto flex-shrink-0" style={{ color: '#86868b' }}>{a.reg_number}</p>}
                      </div>
                    );
                  })}
                  {pending.length > 5 && (
                    <button onClick={() => navigate('/carwash/appointments')}
                      className="w-full text-xs font-semibold py-1.5" style={{ color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer' }}>
                      +{pending.length - 5} more →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Staff today */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #f2f2f7' }}>
              <span className="text-sm font-bold" style={{ color: '#1d1d1f' }}>Staff Today</span>
            </div>
            <div className="p-3">
              {staff.length === 0 ? (
                <p className="text-xs text-center py-5" style={{ color: '#c7c7cc' }}>No jobs assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {staff.slice(0, 5).map((s: any, i: number) => (
                    <div key={s.staff_name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{['🥇','🥈','🥉','4.','5.'][i]}</span>
                        <p className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>{s.staff_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: '#0071e3' }}>{s.jobs} cars</p>
                        <p className="text-xs" style={{ color: '#86868b' }}>{fmt(s.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
