import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingCart, AlertTriangle, IndianRupee, Activity, CalendarCheck, Clock, AlertCircle } from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';
import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { getSalesSummary, listOrders } from '@/lib/db/orders';
import { getLowStockAlerts, getExpiryAlerts } from '@/lib/db/inventory';
import { DailyClosingReport } from '@/modules/reports/DailyClosingReport';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const RANK_COLORS = [
  'linear-gradient(135deg, #fbbf24, #d97706)',
  'linear-gradient(135deg, #94a3b8, #475569)',
  'linear-gradient(135deg, #fb923c, #c2410c)',
  'linear-gradient(135deg, #818cf8, #4338ca)',
  'linear-gradient(135deg, #38bdf8, #0369a1)',
];

export function Dashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName = useAppStore((s) => s.config?.shop_name ?? 'Medical Store');
  const from30 = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [showClosing, setShowClosing] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['sales-summary', tenantId, from30, today],
    queryFn: () => getSalesSummary(tenantId, from30, today),
    enabled: !!tenantId,
  });

  const { data: todayOrders } = useQuery({
    queryKey: ['today-orders', tenantId, today],
    queryFn: () => listOrders(tenantId, { from: today, to: today, perPage: 200 }),
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ['low-stock', tenantId],
    queryFn: () => getLowStockAlerts(tenantId),
    enabled: !!tenantId,
  });

  const { data: expiringBatches } = useQuery({
    queryKey: ['expiring-batches', tenantId],
    queryFn: () => getExpiryAlerts(tenantId, 90),
    enabled: !!tenantId,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders', tenantId],
    queryFn: () => listOrders(tenantId, { perPage: 5 }),
    enabled: !!tenantId,
  });

  const todayRevenue = todayOrders?.items.reduce((s, o) => s + Number(o.total), 0) ?? 0;
  const todayOrderCount = todayOrders?.total ?? 0;

  const cards = [
    { label: "Today's Revenue", value: fmtCurrency(todayRevenue), icon: IndianRupee, gradient: 'linear-gradient(135deg, #6366f1, #4338ca)', glow: 'rgba(99,102,241,0.35)', meta: 'Real-time snapshot' },
    { label: "Today's Orders", value: String(todayOrderCount), icon: ShoppingCart, gradient: 'linear-gradient(135deg, #22c55e, #15803d)', glow: 'rgba(34,197,94,0.35)', meta: 'Counter activity' },
    { label: 'Monthly Revenue', value: fmtCurrency(summary?.total_revenue ?? 0), icon: TrendingUp, gradient: 'linear-gradient(135deg, #fb923c, #ea580c)', glow: 'rgba(251,146,60,0.35)', meta: 'Last 30 days' },
    { label: 'Low Stock Items', value: String(lowStockItems?.length ?? 0), icon: AlertTriangle, gradient: 'linear-gradient(135deg, #f43f5e, #be123c)', glow: 'rgba(244,63,94,0.35)', meta: 'Needs attention' },
  ];

  const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋`;

  return (
    <div className="p-6 space-y-6">
      {showClosing && <DailyClosingReport onClose={() => setShowClosing(false)} />}

      {/* Header banner */}
      <div className="rounded-3xl p-6 text-white relative overflow-hidden flex items-center justify-between gap-4 flex-wrap" style={{ background: 'linear-gradient(120deg, #4338ca 0%, #6366f1 45%, #0ea5e9 100%)', boxShadow: '0 12px 32px -8px rgba(67,56,202,0.45)' }}>
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="absolute -right-2 bottom-[-3rem] h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="relative">
          <h1 className="text-2xl font-bold" style={{ color: 'white' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{greeting} · {format(new Date(), 'dd MMMM yyyy')} · Medical Store Dashboard</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button onClick={() => setShowClosing(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5" style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
            <CalendarCheck size={14} /> Daily Closing
          </button>
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
            <Clock size={12} /> Live
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="text-left p-4 rounded-2xl text-white transition-all duration-200 hover:-translate-y-1" style={{ background: c.gradient, boxShadow: `0 10px 24px -8px ${c.glow}` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.22)' }}>
                <c.icon className="h-4 w-4 text-white" />
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'white' }}>{c.value}</p>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{c.meta}</p>
          </div>
        ))}
      </div>

      {/* 30-day performance + Payment breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-slate-500">30-day performance · Updated every minute</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>Total orders</p>
              <p className="mt-2 text-3xl font-bold">{summary?.total_orders ?? 0}</p>
            </div>
            <div className="rounded-2xl p-5 bg-slate-50 border border-slate-100">
              <p className="text-sm text-slate-500">Tax collected</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmtCurrency(summary?.total_tax ?? 0)}</p>
            </div>
            <div className="rounded-2xl p-5 bg-slate-50 border border-slate-100">
              <p className="text-sm text-slate-500">Avg order value</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary?.total_orders
                  ? fmtCurrency(Math.round((summary.total_revenue) / summary.total_orders))
                  : fmtCurrency(0)}
              </p>
            </div>
            <div className="rounded-2xl p-5 bg-slate-50 border border-slate-100">
              <p className="text-sm text-slate-500">Total discount</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmtCurrency(summary?.total_discount ?? 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Payment breakdown <span className="text-xs font-normal text-slate-400">(30 days)</span></h2>
          {(summary?.by_payment ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No sales data yet — create your first bill in POS</p>
          ) : (
            <div className="space-y-2.5">
              {(summary?.by_payment ?? []).map((p, i) => (
                <div key={p.payment_method} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: RANK_COLORS[i % RANK_COLORS.length] }}>
                      {i + 1}
                    </span>
                    <p className="font-medium text-slate-800 capitalize truncate">{p.payment_method}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-900">{fmtCurrency(Number(p.total))}</p>
                    <p className="text-xs text-slate-400">{p.count} orders</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alerts */}
      {(lowStockItems?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-amber-800">Items running low ({lowStockItems?.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(lowStockItems ?? []).slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.sku ?? a.unit}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-amber-600">{a.stock_qty} {a.unit}</span>
                  <p className="text-xs text-slate-400">min: {a.min_stock_qty}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(lowStockItems?.length ?? 0) === 0 && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
          <p className="text-sm font-medium text-green-700">✓ All items are well stocked</p>
        </div>
      )}

      {/* Expiry alerts */}
      {(expiringBatches?.length ?? 0) > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-rose-500" />
            <h2 className="font-semibold text-rose-800">Medicines expiring within 90 days ({expiringBatches?.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(expiringBatches ?? []).slice(0, 9).map((b: any) => {
              const daysLeft = differenceInDays(new Date(b.expiry_date), new Date());
              const badgeColor = daysLeft <= 30 ? '#dc2626' : daysLeft <= 60 ? '#ea580c' : '#ca8a04';
              const badgeBg = daysLeft <= 30 ? '#fee2e2' : daysLeft <= 60 ? '#ffedd5' : '#fef9c3';
              return (
                <div key={b.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{b.product_name}</p>
                    <p className="text-xs text-slate-400">Batch: {b.batch_no || '—'} · Qty: {b.quantity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: badgeBg, color: badgeColor }}>{daysLeft}d</span>
                    <p className="text-xs text-slate-400 mt-0.5">{b.expiry_date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent bills */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Latest orders</h2>
        {!recentOrders?.items?.length ? (
          <p className="text-sm text-slate-400 text-center py-8">No orders yet</p>
        ) : (
          <div className="space-y-2.5">
            {(recentOrders?.items ?? []).map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{o.bill_number}</p>
                  <p className="text-xs text-slate-400 truncate">{o.customer_name ?? 'Walk-in customer'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-slate-900">{fmtCurrency(o.total)}</p>
                  <p className="text-xs text-slate-400 capitalize">{o.payment_method}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
