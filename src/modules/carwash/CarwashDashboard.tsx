// [carwash] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Car, Calendar, Users, TrendingUp, Clock, BarChart2, CreditCard, Star } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listJobs, getTodayStats, getStaffPerformance,
  getDateStats, getHourlyStats, getNewVsReturning,
  getPaymentBreakdown, getDailyRevenueLast30, getPopularServices, listAppointments,
} from '@/lib/db/carwash';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function yesterdayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function delta(a: number, b: number): { label: string; color: string } | null {
  if (b === 0) return a > 0 ? { label: `+${a} new`, color: '#10b981' } : null;
  const d = ((a - b) / b) * 100;
  return { label: (d >= 0 ? '▲' : '▼') + ' ' + Math.abs(d).toFixed(0) + '% vs yesterday', color: d >= 0 ? '#10b981' : '#f87171' };
}

const STATUS_CFG = {
  waiting:     { label: 'Waiting',     color: '#0071e3', textOnColor: '#111', bg: '#fef3c7' },
  in_progress: { label: 'In Progress', color: '#3b82f6',        textOnColor: '#fff',                  bg: '#eff6ff' },
  ready:       { label: 'Ready 🔔',    color: '#10b981',        textOnColor: '#fff',                  bg: '#d1fae5' },
  delivered:   { label: 'Delivered',   color: '#6b7280',        textOnColor: '#fff',                  bg: '#f3f4f6' },
};
const VEHICLE_ICONS: Record<string, string> = { hatchback: '🚗', sedan: '🚙', suv: '🚐', luxury: '🏎️' };
const PAY_ICON: Record<string, string> = { cash: '💵', card: '💳', upi: '📱', membership: '⭐', online: '🌐' };

export function CarwashDashboard() {
  const tenantId  = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName  = useAppStore((s) => s.config?.shop_name ?? 'Car Wash');
  const navigate  = useNavigate();
  const today     = todayISO();
  const yesterday = yesterdayISO();

  const e = !!tenantId;
  const { data: stats }        = useQuery({ queryKey: ['cw-stats',   tenantId, today],     queryFn: () => getTodayStats(tenantId),               enabled: e, refetchInterval: 15000 });
  const { data: todayFull }    = useQuery({ queryKey: ['cw-today',   tenantId, today],     queryFn: () => getDateStats(tenantId, today),          enabled: e, refetchInterval: 30000 });
  const { data: ydayFull }     = useQuery({ queryKey: ['cw-yday',    tenantId, yesterday], queryFn: () => getDateStats(tenantId, yesterday),      enabled: e });
  const { data: jobs = [] }    = useQuery({ queryKey: ['cw-jobs',    tenantId, today],     queryFn: () => listJobs(tenantId, { date: today }),    enabled: e, refetchInterval: 10000 });
  const { data: staff = [] }   = useQuery({ queryKey: ['cw-staff',   tenantId, today],     queryFn: () => getStaffPerformance(tenantId, today),  enabled: e, refetchInterval: 30000 });
  const { data: hourly = [] }  = useQuery({ queryKey: ['cw-hourly',  tenantId, today],     queryFn: () => getHourlyStats(tenantId, today),       enabled: e, refetchInterval: 30000 });
  const { data: nvr }          = useQuery({ queryKey: ['cw-nvr',     tenantId, today],     queryFn: () => getNewVsReturning(tenantId, today),    enabled: e, refetchInterval: 60000 });
  const { data: payments = [] }= useQuery({ queryKey: ['cw-pay',     tenantId, today],     queryFn: () => getPaymentBreakdown(tenantId, today),  enabled: e, refetchInterval: 30000 });
  const { data: daily30 = [] } = useQuery({ queryKey: ['cw-daily30', tenantId],            queryFn: () => getDailyRevenueLast30(tenantId),       enabled: e, refetchInterval: 120000 });
  const { data: popular = [] } = useQuery({ queryKey: ['cw-popular', tenantId, today],     queryFn: () => getPopularServices(tenantId, today),   enabled: e, refetchInterval: 60000 });
  const { data: appts = [] }   = useQuery({ queryKey: ['cw-appts',   tenantId, today],     queryFn: () => listAppointments(tenantId, today),     enabled: e, refetchInterval: 60000 });

  const waiting    = jobs.filter((j: any) => j.status === 'waiting');
  const inProgress = jobs.filter((j: any) => j.status === 'in_progress');
  const ready      = jobs.filter((j: any) => j.status === 'ready');
  const pending    = appts.filter((a: any) => a.status !== 'done' && a.status !== 'cancelled');

  const maxHour  = Math.max(...hourly.map((h: any) => h.jobs), 1);
  const maxDaily = Math.max(...daily30.map((d: any) => d.revenue), 1);
  const hours    = Array.from({ length: 13 }, (_, i) => i + 8);

  const raisedShadow = '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)';

  return (
    <div className="flex flex-col" style={{ background: 'linear-gradient(160deg,#3d4f6b 0%,#2b3a54 100%)', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating white plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>{shopName}</h1>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={() => navigate('/carwash/jobs/new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5), 0 1px 2px rgba(0,0,0,0.15)' }}>
          <Car className="h-4 w-4" /> New Job Card
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 gap-3">
        <Stat icon={<TrendingUp size={16}/>} bg="#dcfce7" clr="#16a34a" label="Revenue Today"
          value={fmt(todayFull?.revenue ?? 0)} trend={delta(todayFull?.revenue??0, ydayFull?.revenue??0)} />
        <Stat icon={<Car size={16}/>} bg="#dbeafe" clr="#2563eb" label="Jobs Today"
          value={String(todayFull?.totalJobs ?? 0)} trend={delta(todayFull?.totalJobs??0, ydayFull?.totalJobs??0)} />
        <Stat icon={<Clock size={16}/>} bg="#fef3c7" clr="#d97706" label="In Queue"
          value={String((stats?.pending??0)+(stats?.inProgress??0))}
          sub={`${stats?.ready??0} ready for pickup`} />
        <Stat icon={<Star size={16}/>} bg="#ede9fe" clr="#7c3aed" label="Avg Job Value"
          value={fmt(todayFull?.avgJobValue ?? 0)} trend={delta(todayFull?.avgJobValue??0, ydayFull?.avgJobValue??0)} />
      </div>

      {/* ── Row 2: Live Queue + Sidebar ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 280px' }}>

        {/* Kanban */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>Live Queue</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { jobs: waiting,    ...STATUS_CFG.waiting },
              { jobs: inProgress, ...STATUS_CFG.in_progress },
              { jobs: ready,      ...STATUS_CFG.ready },
            ].map(col => (
              <div key={col.label} className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ background: col.bg }}>
                  <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: col.color, color: col.textOnColor }}>{col.jobs.length}</span>
                </div>
                <div className="p-2 space-y-1.5 min-h-[90px]" style={{ background: '#ffffff' }}>
                  {col.jobs.length === 0
                    ? <p className="text-xs text-center py-4" style={{ color: '#86868b' }}>Empty</p>
                    : col.jobs.map((j: any) => (
                      <div key={j.id} onClick={() => navigate(`/carwash/jobs/${j.id}`)}
                        className="rounded-xl p-2 cursor-pointer hover:opacity-80"
                        style={{ background: col.bg, border: `1px solid ${col.color}30` }}>
                        <div className="flex justify-between gap-1">
                          <p className="font-bold text-xs" style={{ color: '#1d1d1f' }}>
                            {VEHICLE_ICONS[j.vehicle_type]??'🚗'} {j.reg_number}
                          </p>
                          <p className="text-xs font-bold" style={{ color: col.color }}>₹{j.total}</p>
                        </div>
                        <p className="text-xs truncate" style={{ color: '#86868b' }}>
                          {j.customer_name||'Walk-in'}{j.staff_name ? ` · ${j.staff_name}` : ''}
                        </p>
                      </div>
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Appointments sidebar */}
        <div className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" style={{ color: '#0071e3' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>Appointments</p>
            </div>
            {pending.length > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#0071e3', color: '#111' }}>
                {pending.length}
              </span>
            )}
          </div>
          {pending.length === 0
            ? <div className="text-center py-5">
                <p className="text-xs" style={{ color: '#86868b' }}>No appointments today</p>
                <button onClick={() => navigate('/carwash/appointments')} className="mt-1 text-xs font-semibold" style={{ color: '#0071e3' }}>Book one →</button>
              </div>
            : <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {pending.map(a => {
                  const h = parseInt(a.appointment_time.split(':')[0]);
                  const m = a.appointment_time.split(':')[1];
                  const lbl = `${h>12?h-12:h}:${m} ${h>=12?'PM':'AM'}`;
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:opacity-80"
                      style={{ background: '#f2f2f7' }} onClick={() => navigate('/carwash/appointments')}>
                      <p className="text-xs font-bold w-12 flex-shrink-0" style={{ color: '#0071e3' }}>{lbl}</p>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: '#1d1d1f' }}>{a.customer_name||'Walk-in'}</p>
                        {a.reg_number && <p className="text-xs" style={{ color: '#86868b' }}>{a.reg_number}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>

      {/* ── Row 3: Analytics ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Hourly bar chart */}
        <div className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-3.5 w-3.5" style={{ color: '#0071e3' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>Busiest Hours Today</p>
          </div>
          {hourly.length === 0
            ? <p className="text-xs text-center py-6" style={{ color: '#86868b' }}>No jobs yet</p>
            : <div className="flex items-end gap-0.5 h-20">
                {hours.map(h => {
                  const d = hourly.find(x => x.hour === h);
                  const jobs = d?.jobs ?? 0;
                  const pct = jobs > 0 ? Math.max((jobs / maxHour) * 100, 6) : 0;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h}:00 — ${jobs} jobs`}>
                      <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, background: jobs > 0 ? '#0071e3' : '#f2f2f7', minHeight: jobs > 0 ? 3 : 0 }} />
                      <p style={{ fontSize: 8, color: '#86868b' }}>{h > 12 ? `${h-12}p` : `${h}a`}</p>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Popular services */}
        <div className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-3.5 w-3.5" style={{ color: '#0071e3' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>Top Services (Month)</p>
          </div>
          {popular.length === 0
            ? <p className="text-xs text-center py-6" style={{ color: '#86868b' }}>No data yet</p>
            : <div className="space-y-2">
                {popular.slice(0,5).map((s,i) => {
                  const w = Math.max((s.count/(popular[0]?.count??1))*100, 4);
                  return (
                    <div key={s.service_name}>
                      <div className="flex justify-between mb-0.5">
                        <p className="text-xs font-semibold" style={{ color: '#1d1d1f' }}>
                          {['🥇','🥈','🥉','4.','5.'][i]} {s.service_name}
                        </p>
                        <p className="text-xs" style={{ color: '#86868b' }}>{s.count}×</p>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: '#f2f2f7' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${w}%`, background: '#0071e3' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* New vs returning + Payment split */}
        <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5" style={{ color: '#0071e3' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>Customers Today</p>
            </div>
            {nvr ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-2 text-center" style={{ background: '#dbeafe' }}>
                  <p className="text-xl font-bold" style={{ color: '#2563eb' }}>{nvr.newCustomers}</p>
                  <p className="text-xs" style={{ color: '#2563eb' }}>New</p>
                </div>
                <div className="rounded-xl p-2 text-center" style={{ background: '#d1fae5' }}>
                  <p className="text-xl font-bold" style={{ color: '#059669' }}>{nvr.returning}</p>
                  <p className="text-xs" style={{ color: '#059669' }}>Returning</p>
                </div>
              </div>
            ) : <p className="text-xs text-center py-2" style={{ color: '#86868b' }}>No data</p>}
          </div>

          <div className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <CreditCard className="h-3.5 w-3.5" style={{ color: '#0071e3' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>Payments</p>
            </div>
            {payments.length === 0
              ? <p className="text-xs text-center py-2" style={{ color: '#86868b' }}>No settled jobs</p>
              : <div className="space-y-1">
                  {payments.map(p => (
                    <div key={p.method} className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{PAY_ICON[p.method]??'💰'}</span>
                        <p className="text-xs capitalize" style={{ color: '#1d1d1f' }}>{p.method}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold" style={{ color: '#0071e3' }}>{fmt(p.revenue)}</p>
                        <p className="text-xs" style={{ color: '#86868b' }}>{p.count} jobs</p>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>

      {/* ── Row 4: 30-day trend + Staff ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* 30-day sparkline */}
        <div className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: '#0071e3' }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>30-Day Revenue</p>
            </div>
            <p className="text-sm font-bold" style={{ color: '#0071e3' }}>
              {fmt(daily30.reduce((s,d)=>s+d.revenue,0))} total
            </p>
          </div>
          {daily30.length === 0
            ? <p className="text-xs text-center py-6" style={{ color: '#86868b' }}>Not enough data</p>
            : <>
                <div className="flex items-end gap-0.5 h-16">
                  {daily30.map(d => {
                    const pct = Math.max((d.revenue/maxDaily)*100, d.revenue>0?3:0);
                    const isToday = d.date === today;
                    return (
                      <div key={d.date} className="flex-1" title={`${d.date}: ${fmt(d.revenue)}`}>
                        <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, background: isToday ? '#0071e3' : 'rgba(245,158,11,0.3)', minHeight: d.revenue>0?2:0 }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-xs" style={{ color: '#86868b' }}>
                    {new Date(daily30[0]?.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: '#0071e3' }}>Today</p>
                </div>
              </>
          }
        </div>

        {/* Staff leaderboard */}
        <div className="rounded-2xl p-4" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5" style={{ color: '#0071e3' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86868b' }}>Staff Today</p>
          </div>
          {staff.length === 0
            ? <p className="text-xs text-center py-6" style={{ color: '#86868b' }}>No jobs assigned yet</p>
            : <div className="space-y-3">
                {staff.map((s,i) => {
                  const w = Math.max((s.jobs/(staff[0]?.jobs??1))*100,4);
                  return (
                    <div key={s.staff_name}>
                      <div className="flex justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span>{['🥇','🥈','🥉','4.','5.'][i]}</span>
                          <p className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>{s.staff_name}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold" style={{ color: '#0071e3' }}>{s.jobs} cars</span>
                          <span className="text-xs ml-1.5" style={{ color: '#86868b' }}>{fmt(s.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: '#f2f2f7' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${w}%`, background: '#0071e3' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>

      </div>{/* end scrollable content */}
    </div>
  );
}

function Stat({ icon, bg, clr, label, value, sub, trend }: {
  icon: React.ReactNode; bg: string; clr: string; label: string; value: string;
  sub?: string; trend?: { label: string; color: string } | null;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg, color: clr }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: '#86868b' }}>{label}</p>
        <p className="text-xl font-bold" style={{ color: '#1d1d1f' }}>{value}</p>
        {sub && <p className="text-xs" style={{ color: '#86868b' }}>{sub}</p>}
        {trend && <p className="text-xs font-semibold" style={{ color: trend.color }}>{trend.label}</p>}
      </div>
    </div>
  );
}
