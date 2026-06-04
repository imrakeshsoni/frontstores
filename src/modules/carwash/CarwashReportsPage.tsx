// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, PhoneCall, Star } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { sendWhatsApp } from '@/lib/whatsapp';
import { getMonthlyRevenue, getPopularServices, getLapsedCustomers, getStaffPerformance, getStaffWeeklyPerformance, getTodayStats, listTopLoyaltyCustomers, getAttendanceSummaryForMonth } from '@/lib/db/carwash';
import { useNavigate } from 'react-router-dom';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function thisMonthISO() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CarwashReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const navigate = useNavigate();
  const today = todayISO();
  const now = new Date();
  const [staffView, setStaffView] = useState<'today' | 'week'>('today');

  const { data: monthlyRevenue = [] } = useQuery({
    queryKey: ['carwash-monthly', tenantId],
    queryFn: () => getMonthlyRevenue(tenantId, 6),
    enabled: !!tenantId,
  });

  const { data: popularServices = [] } = useQuery({
    queryKey: ['carwash-popular', tenantId, thisMonthISO()],
    queryFn: () => getPopularServices(tenantId, today),
    enabled: !!tenantId,
  });

  const { data: lapsedCustomers = [] } = useQuery({
    queryKey: ['carwash-lapsed', tenantId],
    queryFn: () => getLapsedCustomers(tenantId, 30),
    enabled: !!tenantId,
  });

  const { data: staffToday = [] } = useQuery({
    queryKey: ['carwash-staff-report', tenantId, today],
    queryFn: () => getStaffPerformance(tenantId, today),
    enabled: !!tenantId,
  });

  const { data: staffWeekly = [] } = useQuery({
    queryKey: ['carwash-staff-weekly', tenantId],
    queryFn: () => getStaffWeeklyPerformance(tenantId),
    enabled: !!tenantId,
  });

  const { data: todayStats } = useQuery({
    queryKey: ['carwash-stats-report', tenantId, today],
    queryFn: () => getTodayStats(tenantId),
    enabled: !!tenantId,
  });

  const { data: topLoyalty = [] } = useQuery({
    queryKey: ['carwash-loyalty-top', tenantId],
    queryFn: () => listTopLoyaltyCustomers(tenantId),
    enabled: !!tenantId,
  });

  const { data: salarySummaries = [] } = useQuery({
    queryKey: ['carwash-salary-report', tenantId, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getAttendanceSummaryForMonth(tenantId, now.getFullYear(), now.getMonth() + 1),
    enabled: !!tenantId,
  });

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

  // Aggregate weekly staff data
  const weeklyByStaff: Record<string, { jobs: number; revenue: number; days: number }> = {};
  for (const row of staffWeekly) {
    if (!weeklyByStaff[row.staff_name]) weeklyByStaff[row.staff_name] = { jobs: 0, revenue: 0, days: 0 };
    weeklyByStaff[row.staff_name].jobs += row.jobs;
    weeklyByStaff[row.staff_name].revenue += row.revenue;
    weeklyByStaff[row.staff_name].days++;
  }
  const staffWeeklyAgg = Object.entries(weeklyByStaff)
    .map(([name, d]) => ({ staff_name: name, ...d }))
    .sort((a, b) => b.jobs - a.jobs);

  const callWhatsApp = (phone: string, name: string) => {
    const msg = `Hi ${name} 👋\n\nWe miss your car! 🚗 It's been a while since your last wash.\n\nVisit ${config?.shop_name ?? 'us'} for a fresh clean today. Special offer for loyal customers!\n\nCall us or just drive in 😊`;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return;
    sendWhatsApp(cleaned, msg);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports & Analytics</h1>
      </div>

      {/* Today summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: fmt(todayStats?.revenue ?? 0), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Cars Today', value: String(todayStats?.totalJobs ?? 0), color: '#2563eb', bg: '#dbeafe' },
          { label: 'Avg Ticket', value: todayStats?.delivered ? fmt(todayStats.revenue / todayStats.delivered) : '—', color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Lapsed (30d)', value: String(lapsedCustomers.length), color: '#dc2626', bg: '#fee2e2' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly revenue chart */}
      {monthlyRevenue.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Monthly Revenue</h2>
          </div>
          <div className="space-y-3">
            {monthlyRevenue.map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(m.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                </span>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full flex items-center px-2"
                    style={{ width: `${(m.revenue / maxRevenue) * 100}%`, background: 'var(--accent)', minWidth: m.revenue > 0 ? '2rem' : 0 }}>
                    <span className="text-white text-xs font-bold truncate">{fmt(m.revenue)}</span>
                  </div>
                </div>
                <span className="text-xs w-16 text-right flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{m.jobs} cars</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular services */}
        {popularServices.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Popular Services (this month)</h2>
            <div className="space-y-2">
              {popularServices.map((s, i) => (
                <div key={s.service_name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold w-5" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.service_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{s.count}×</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmt(s.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff performance — today / week toggle */}
        {(staffToday.length > 0 || staffWeeklyAgg.length > 0) && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Staff Performance</h2>
              </div>
              <div className="flex gap-1">
                {(['today', 'week'] as const).map(v => (
                  <button key={v} onClick={() => setStaffView(v)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${staffView === v ? 'text-white' : 'btn-secondary'}`}
                    style={staffView === v ? { background: 'var(--accent)' } : {}}>
                    {v === 'today' ? 'Today' : 'This Week'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {(staffView === 'today' ? staffToday : staffWeeklyAgg).map(s => (
                <div key={s.staff_name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>👤 {s.staff_name}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{s.jobs} cars</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {fmt(s.revenue)}{staffView === 'week' && (s as any).days ? ` · ${(s as any).days}d` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {(staffView === 'today' ? staffToday : staffWeeklyAgg).length === 0 && (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No data</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Loyalty top customers */}
      {topLoyalty.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4" style={{ color: '#f59e0b' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Top Loyalty Customers</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
              1 pt = ₹1 (earn 1pt per ₹10)
            </span>
          </div>
          <div className="space-y-2">
            {topLoyalty.slice(0, 10).map((c, i) => (
              <div key={c.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold w-5" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.customer_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.reg_number ?? c.customer_phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: '#d97706' }}>⭐ {c.available_points} pts</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.total_points} earned total</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lapsed customers — win-back */}
      {lapsedCustomers.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <PhoneCall className="h-4 w-4 text-red-500" />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Win Back — {lapsedCustomers.length} customers (30+ days away)</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
            Send a WhatsApp message to bring them back. One tap per customer.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {lapsedCustomers.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-1" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.customer_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    🚗 {c.reg_number} · Last: {new Date(c.last_visit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {c.customer_phone && (
                  <button onClick={() => callWhatsApp(c.customer_phone, c.customer_name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0 ml-3"
                    style={{ background: '#25d366' }}>
                    💬 WhatsApp
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payroll Summary — current month */}
      {salarySummaries.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
              Payroll — {new Date(now.getFullYear(), now.getMonth()).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => navigate('/carwash/attendance')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg btn-secondary">
              Manage Attendance
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
            {salarySummaries.map(sm => (
              <div key={sm.staff.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'var(--accent)' }}>{sm.staff.name[0].toUpperCase()}</div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{sm.staff.name}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>
                      P:{sm.present} H:{sm.half_day} A:{sm.absent} L:{sm.leave}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {sm.staff.monthly_salary > 0 ? (
                    <>
                      <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmt(sm.net_salary)}</p>
                      {sm.deductions > 0 && <p className="text-xs" style={{ color: '#dc2626' }}>−{fmt(sm.deductions)} deducted</p>}
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Salary not set</p>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: 'var(--surface-2)' }}>
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Total Payroll</p>
              <p className="font-bold text-base" style={{ color: 'var(--accent)' }}>
                {fmt(salarySummaries.reduce((s, sm) => s + sm.net_salary, 0))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
