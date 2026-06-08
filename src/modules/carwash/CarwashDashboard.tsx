// [carwash] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, IndianRupee, Car, Clock3 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listJobs, getDateStats, listAppointments, getStaffPerformance } from '@/lib/db/carwash';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function yesterdayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const VEHICLE_ICONS: Record<string, string> = { hatchback: '🚗', sedan: '🚙', suv: '🚐', luxury: '🏎️', bike: '🏍️', truck: '🚚' };

const RANK_COLORS = [
  'linear-gradient(135deg, #fbbf24, #d97706)',
  'linear-gradient(135deg, #94a3b8, #475569)',
  'linear-gradient(135deg, #fb923c, #c2410c)',
  'linear-gradient(135deg, #818cf8, #4338ca)',
  'linear-gradient(135deg, #38bdf8, #0369a1)',
];

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

  const cards = [
    {
      label: "Today's Revenue", icon: IndianRupee, gradient: 'linear-gradient(135deg, #6366f1, #4338ca)', glow: 'rgba(99,102,241,0.35)',
      value: fmt(revenue),
      meta: revDelta !== null ? `${revDelta >= 0 ? '▲' : '▼'} ${Math.abs(revDelta).toFixed(0)}% vs yesterday` : null,
    },
    {
      label: 'Cars Done', icon: Car, gradient: 'linear-gradient(135deg, #22c55e, #15803d)', glow: 'rgba(34,197,94,0.35)',
      value: String(todayFull?.totalJobs ?? 0),
      meta: `avg ${fmt(todayFull?.avgJobValue ?? 0)} / job`,
    },
    {
      label: 'In Queue', icon: Clock3, gradient: 'linear-gradient(135deg, #fb923c, #ea580c)', glow: 'rgba(251,146,60,0.35)',
      value: String(waiting.length + inProgress.length),
      meta: [
        waiting.length > 0 ? `⏳ ${waiting.length} waiting` : null,
        inProgress.length > 0 ? `🔧 ${inProgress.length} active` : null,
        ready.length > 0 ? `✓ ${ready.length} ready` : null,
      ].filter(Boolean).join('  ·  ') || null,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header banner */}
      <div className="rounded-3xl p-6 text-white relative overflow-hidden flex items-center justify-between gap-4 flex-wrap" style={{ background: 'linear-gradient(120deg, #4338ca 0%, #6366f1 45%, #0ea5e9 100%)', boxShadow: '0 12px 32px -8px rgba(67,56,202,0.45)' }}>
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="absolute -right-2 bottom-[-3rem] h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="relative">
          <h1 className="text-2xl font-bold" style={{ color: 'white' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{dateStr} · Car Wash Dashboard</p>
        </div>
        <button onClick={() => navigate('/carwash/jobs/new')}
          className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
          <Plus className="h-4 w-4" /> New Job
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="text-left p-4 rounded-2xl text-white transition-all duration-200 hover:-translate-y-1" style={{ background: c.gradient, boxShadow: `0 10px 24px -8px ${c.glow}` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.22)' }}>
                <c.icon className="h-4 w-4 text-white" />
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: 'white' }}>{c.value}</p>
            {c.meta && <p className="text-xs mt-1.5 font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{c.meta}</p>}
          </div>
        ))}
      </div>

      {/* Live queue */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Live Queue</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { key: 'waiting',     label: 'Waiting',      jobs: waiting,    color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
            { key: 'in_progress', label: 'In Progress',  jobs: inProgress, color: '#2563eb', bg: '#dbeafe', dot: '#3b82f6' },
            { key: 'ready',       label: 'Ready ✓',      jobs: ready,      color: '#15803d', bg: '#dcfce7', dot: '#22c55e' },
          ] as const).map(col => (
            <div key={col.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: col.dot }} />
                  <span className="text-sm font-bold text-slate-900">{col.label}</span>
                </div>
                <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>
                  {col.jobs.length}
                </span>
              </div>
              <div className="p-3 space-y-2" style={{ minHeight: 100 }}>
                {col.jobs.length === 0 ? (
                  <p className="text-xs text-center pt-6 text-slate-300">Empty</p>
                ) : col.jobs.map((j: any) => (
                  <div key={j.id} onClick={() => navigate(`/carwash/jobs/${j.id}`)}
                    className="rounded-xl p-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: col.bg, border: `1px solid ${col.color}25` }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-slate-900">
                        {VEHICLE_ICONS[j.vehicle_type] ?? '🚗'} {j.reg_number}
                      </p>
                      <p className="text-sm font-bold" style={{ color: col.color }}>{fmt(j.total)}</p>
                    </div>
                    <p className="text-xs mt-0.5 truncate text-slate-500">
                      {j.customer_name || 'Walk-in'}{j.staff_name ? ` · ${j.staff_name}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Appointments + Staff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Appointments */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#dbeafe' }}>
                <Calendar className="h-3.5 w-3.5" style={{ color: '#2563eb' }} />
              </span>
              <span className="text-sm font-bold text-slate-900">Appointments Today</span>
            </div>
            {pending.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#2563eb' }}>
                {pending.length}
              </span>
            )}
          </div>
          <div className="p-3">
            {pending.length === 0 ? (
              <div className="text-center py-5">
                <p className="text-xs text-slate-300">No appointments today</p>
                <button onClick={() => navigate('/carwash/appointments')}
                  className="mt-2 text-xs font-semibold" style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
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
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5"
                      style={{ background: '#f8fafc' }}>
                      <p className="text-xs font-bold w-14 flex-shrink-0" style={{ color: '#2563eb' }}>{lbl}</p>
                      <p className="text-xs font-semibold truncate text-slate-900">{a.customer_name || 'Walk-in'}</p>
                      {a.reg_number && <p className="text-xs ml-auto flex-shrink-0 text-slate-400">{a.reg_number}</p>}
                    </div>
                  );
                })}
                {pending.length > 5 && (
                  <button onClick={() => navigate('/carwash/appointments')}
                    className="w-full text-xs font-semibold py-1.5" style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                    +{pending.length - 5} more →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Staff today */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">Staff Today</span>
          </div>
          <div className="p-3">
            {staff.length === 0 ? (
              <p className="text-xs text-center py-5 text-slate-300">No jobs assigned yet</p>
            ) : (
              <div className="space-y-3">
                {staff.slice(0, 5).map((s: any, i: number) => (
                  <div key={s.staff_name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: RANK_COLORS[i % RANK_COLORS.length] }}>
                        {i + 1}
                      </span>
                      <p className="font-semibold text-slate-900 truncate">{s.staff_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#2563eb' }}>{s.jobs} cars</p>
                      <p className="text-xs text-slate-400">{fmt(s.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
