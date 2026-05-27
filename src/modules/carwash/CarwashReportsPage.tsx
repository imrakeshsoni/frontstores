// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { TrendingUp, Users, PhoneCall } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getMonthlyRevenue, getPopularServices, getLapsedCustomers, getStaffPerformance, getTodayStats } from '@/lib/db/carwash';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function thisMonthISO() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function CarwashReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const today = todayISO();

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

  const { data: todayStats } = useQuery({
    queryKey: ['carwash-stats-report', tenantId, today],
    queryFn: () => getTodayStats(tenantId),
    enabled: !!tenantId,
  });

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

  const callWhatsApp = (phone: string, name: string) => {
    const msg = `Hi ${name} 👋\n\nWe miss your car! 🚗 It's been a while since your last wash.\n\nVisit ${config?.shop_name ?? 'us'} for a fresh clean today. Special offer for loyal customers!\n\nCall us or just drive in 😊`;
    const cleaned = phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${cleaned}?text=${encodeURIComponent(msg)}`, '_blank');
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
          { label: 'Avg Ticket', value: todayStats?.delivered ? fmt((todayStats.revenue / todayStats.delivered)) : '—', color: '#7c3aed', bg: '#ede9fe' },
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

        {/* Staff today */}
        {staffToday.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Staff Performance Today</h2>
            </div>
            <div className="space-y-2">
              {staffToday.map(s => (
                <div key={s.staff_name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>👤 {s.staff_name}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{s.jobs} cars</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmt(s.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lapsed customers — win-back */}
      {lapsedCustomers.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <PhoneCall className="h-4 w-4 text-red-500" />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Win Back — Customers (30+ days away)</h2>
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
                    🚗 {c.reg_number} · Last visit: {new Date(c.last_visit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
    </div>
  );
}
