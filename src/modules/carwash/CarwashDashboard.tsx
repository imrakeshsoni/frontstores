// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listJobs, getDateStats, listAppointments,
  getStaffPerformance, getDailyRevenueLast30, getPopularServices,
} from '@/lib/db/carwash';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function yesterdayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const VEHICLE_ICONS: Record<string, string> = { hatchback: '🚗', sedan: '🚙', suv: '🚐', luxury: '🏎️', bike: '🏍️', truck: '🚚' };

const STATUS_CFG = {
  waiting:     { label: 'Waiting',     color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#0071e3', bg: '#eff6ff', dot: '#0071e3' },
  ready:       { label: 'Ready ✓',     color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
};

const raisedShadow = '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)';

type Tab = 'today' | 'queue' | 'appointments' | 'reports';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today',        label: 'Today' },
  { id: 'queue',        label: 'Queue' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'reports',      label: 'Reports' },
];

export function CarwashDashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName = useAppStore((s) => s.config?.shop_name ?? 'Car Wash');
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('today');

  const today     = todayISO();
  const yesterday = yesterdayISO();
  const e = !!tenantId;

  const { data: todayFull } = useQuery({ queryKey: ['cw-today', tenantId, today],     queryFn: () => getDateStats(tenantId, today),         enabled: e, refetchInterval: 15000 });
  const { data: ydayFull }  = useQuery({ queryKey: ['cw-yday',  tenantId, yesterday], queryFn: () => getDateStats(tenantId, yesterday),     enabled: e });
  const { data: jobs = [] } = useQuery({ queryKey: ['cw-jobs',  tenantId, today],     queryFn: () => listJobs(tenantId, { date: today }),   enabled: e, refetchInterval: 10000 });
  const { data: appts = [] }= useQuery({ queryKey: ['cw-appts', tenantId, today],     queryFn: () => listAppointments(tenantId, today),     enabled: e, refetchInterval: 30000 });
  const { data: staff = [] }= useQuery({ queryKey: ['cw-staff', tenantId, today],     queryFn: () => getStaffPerformance(tenantId, today),  enabled: e, refetchInterval: 60000 });
  const { data: daily30= []}= useQuery({ queryKey: ['cw-daily30', tenantId],          queryFn: () => getDailyRevenueLast30(tenantId),       enabled: e, refetchInterval: 120000 });
  const { data: popular= []}= useQuery({ queryKey: ['cw-popular', tenantId, today],   queryFn: () => getPopularServices(tenantId, today),   enabled: e, refetchInterval: 60000 });

  const waiting    = jobs.filter((j: any) => j.status === 'waiting');
  const inProgress = jobs.filter((j: any) => j.status === 'in_progress');
  const ready      = jobs.filter((j: any) => j.status === 'ready');
  const pending    = appts.filter((a: any) => a.status !== 'done' && a.status !== 'cancelled');

  const revenue  = todayFull?.revenue ?? 0;
  const ydayRev  = ydayFull?.revenue ?? 0;
  const revDelta = ydayRev > 0 ? ((revenue - ydayRev) / ydayRev) * 100 : null;
  const maxDaily = Math.max(...daily30.map((d: any) => d.revenue), 1);

  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col" style={{ background: '#f5f5f7', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div className="px-6 pt-4 pb-0 flex-shrink-0"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-widest" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
            <h1 className="text-xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>{shopName}</h1>
            <p className="text-xs" style={{ color: '#86868b' }}>{dateStr}</p>
          </div>
          <button onClick={() => navigate('/carwash/jobs/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5)' }}>
            <Plus className="h-4 w-4" /> New Job
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-5 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t.id ? '#0071e3' : '#86868b',
                borderBottom: tab === t.id ? '2px solid #0071e3' : '2px solid transparent',
              }}>
              {t.label}
              {t.id === 'queue' && (waiting.length + inProgress.length + ready.length) > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: '#0071e3', color: '#fff', fontSize: 10 }}>
                  {waiting.length + inProgress.length + ready.length}
                </span>
              )}
              {t.id === 'appointments' && pending.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: '#f59e0b', color: '#fff', fontSize: 10 }}>
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* ── TODAY ── */}
        {tab === 'today' && (
          <div className="space-y-4">

            {/* 3 key numbers */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#86868b' }}>Revenue</p>
                <p className="text-3xl font-bold" style={{ color: '#1d1d1f' }}>{fmt(revenue)}</p>
                {revDelta !== null && (
                  <p className="text-xs font-semibold mt-1" style={{ color: revDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                    {revDelta >= 0 ? '▲' : '▼'} {Math.abs(revDelta).toFixed(0)}% vs yesterday
                  </p>
                )}
              </div>

              <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#86868b' }}>Cars Done</p>
                <p className="text-3xl font-bold" style={{ color: '#1d1d1f' }}>{todayFull?.totalJobs ?? 0}</p>
                <p className="text-xs mt-1" style={{ color: '#86868b' }}>jobs completed</p>
              </div>

              <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#86868b' }}>In Queue</p>
                <p className="text-3xl font-bold" style={{ color: '#1d1d1f' }}>{waiting.length + inProgress.length}</p>
                <div className="flex items-center gap-3 mt-1">
                  {waiting.length > 0 && <span className="text-xs" style={{ color: '#f59e0b' }}>⏳ {waiting.length}</span>}
                  {inProgress.length > 0 && <span className="text-xs" style={{ color: '#0071e3' }}>🔧 {inProgress.length}</span>}
                  {ready.length > 0 && <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>✓ {ready.length} ready</span>}
                </div>
              </div>
            </div>

            {/* Staff summary */}
            {staff.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#86868b' }}>Staff Performance Today</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {staff.map((s: any, i: number) => (
                    <div key={s.staff_name} className="rounded-xl p-3" style={{ background: '#f9f9f9' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{['🥇','🥈','🥉','4.','5.'][i] ?? `${i+1}.`}</span>
                        <p className="text-sm font-semibold truncate" style={{ color: '#1d1d1f' }}>{s.staff_name}</p>
                      </div>
                      <p className="text-sm font-bold" style={{ color: '#0071e3' }}>{s.jobs} cars</p>
                      <p className="text-xs" style={{ color: '#86868b' }}>{fmt(s.revenue)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── QUEUE ── */}
        {tab === 'queue' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {([
                { key: 'waiting',     jobs: waiting,    ...STATUS_CFG.waiting },
                { key: 'in_progress', jobs: inProgress, ...STATUS_CFG.in_progress },
                { key: 'ready',       jobs: ready,      ...STATUS_CFG.ready },
              ] as const).map(col => (
                <div key={col.key} className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f2f2f7' }}>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: col.dot }} />
                      <span className="text-sm font-bold" style={{ color: '#1d1d1f' }}>{col.label}</span>
                    </div>
                    <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>
                      {col.jobs.length}
                    </span>
                  </div>
                  <div className="p-3 space-y-2" style={{ minHeight: 140 }}>
                    {col.jobs.length === 0 ? (
                      <p className="text-xs text-center pt-8" style={{ color: '#86868b' }}>Empty</p>
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

            {(waiting.length + inProgress.length + ready.length) === 0 && (
              <div className="rounded-2xl p-8 text-center" style={{ background: '#ffffff' }}>
                <p className="text-base font-semibold" style={{ color: '#1d1d1f' }}>Queue is empty</p>
                <p className="text-sm mt-1" style={{ color: '#86868b' }}>No active jobs right now</p>
                <button onClick={() => navigate('/carwash/jobs/new')}
                  className="mt-4 px-5 py-2 rounded-xl text-sm font-bold"
                  style={{ background: '#0071e3', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Start a new job
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── APPOINTMENTS ── */}
        {tab === 'appointments' && (
          <div className="space-y-3">
            {pending.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: '#ffffff' }}>
                <p className="text-base font-semibold" style={{ color: '#1d1d1f' }}>No appointments today</p>
                <button onClick={() => navigate('/carwash/appointments')}
                  className="mt-4 px-5 py-2 rounded-xl text-sm font-bold"
                  style={{ background: '#0071e3', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Book an appointment
                </button>
              </div>
            ) : pending.map((a: any) => {
              const [hh, mm] = a.appointment_time.split(':');
              const h = parseInt(hh);
              const timeLabel = `${h > 12 ? h - 12 : h}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
              return (
                <div key={a.id} onClick={() => navigate('/carwash/appointments')}
                  className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer"
                  style={{ background: '#ffffff', boxShadow: raisedShadow }}>
                  <div className="rounded-xl px-3 py-2 flex-shrink-0 text-center" style={{ background: '#eff6ff', minWidth: 60 }}>
                    <p className="text-base font-bold" style={{ color: '#0071e3' }}>{timeLabel.split(' ')[0]}</p>
                    <p className="text-xs font-semibold" style={{ color: '#0071e3' }}>{timeLabel.split(' ')[1]}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: '#1d1d1f' }}>{a.customer_name || 'Walk-in'}</p>
                    {a.reg_number && <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>{a.reg_number}</p>}
                    {a.notes && <p className="text-xs mt-0.5 truncate" style={{ color: '#86868b' }}>{a.notes}</p>}
                  </div>
                </div>
              );
            })}
            <button onClick={() => navigate('/carwash/appointments')}
              className="w-full py-3 rounded-2xl text-sm font-semibold"
              style={{ background: '#ffffff', color: '#1d1d1f', border: 'none', cursor: 'pointer' }}>
              Manage Appointments →
            </button>
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === 'reports' && (
          <div className="space-y-4">

            {/* 30-day revenue */}
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#86868b' }}>30-Day Revenue</p>
                <p className="text-sm font-bold" style={{ color: '#0071e3' }}>
                  {fmt(daily30.reduce((s: number, d: any) => s + d.revenue, 0))} total
                </p>
              </div>
              {daily30.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: '#86868b' }}>Not enough data yet</p>
              ) : (
                <>
                  <div className="flex items-end gap-0.5 h-24">
                    {daily30.map((d: any) => {
                      const pct = Math.max((d.revenue / maxDaily) * 100, d.revenue > 0 ? 3 : 0);
                      const isToday = d.date === today;
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${fmt(d.revenue)}`}>
                          <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, background: isToday ? '#0071e3' : '#bfdbfe', minHeight: d.revenue > 0 ? 2 : 0 }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2">
                    <p className="text-xs" style={{ color: '#86868b' }}>
                      {new Date(daily30[0]?.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs font-semibold" style={{ color: '#0071e3' }}>Today</p>
                  </div>
                </>
              )}
            </div>

            {/* Popular services */}
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', boxShadow: raisedShadow }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#86868b' }}>Popular Services This Month</p>
              {popular.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#86868b' }}>No data yet</p>
              ) : (
                <div className="space-y-3">
                  {popular.slice(0, 5).map((s: any, i: number) => {
                    const w = Math.max((s.count / (popular[0]?.count ?? 1)) * 100, 4);
                    return (
                      <div key={s.service_name}>
                        <div className="flex justify-between mb-1">
                          <p className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>
                            {['🥇','🥈','🥉','4.','5.'][i]} {s.service_name}
                          </p>
                          <p className="text-sm font-bold" style={{ color: '#0071e3' }}>{s.count}×</p>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: '#f2f2f7' }}>
                          <div className="h-2 rounded-full" style={{ width: `${w}%`, background: '#0071e3' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={() => navigate('/carwash/reports')}
              className="w-full py-3 rounded-2xl text-sm font-semibold"
              style={{ background: '#ffffff', color: '#1d1d1f', border: 'none', cursor: 'pointer' }}>
              Full Reports →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
