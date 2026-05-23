import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, ShoppingCart, AlertTriangle, IndianRupee, Activity, CalendarCheck, Clock } from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';
import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { getSalesSummary, listOrders } from '@/lib/db/orders';
import { getLowStockAlerts, getExpiryAlerts } from '@/lib/db/inventory';
import { PageIntro } from '@/components/ui/PageIntro';
import { DailyClosingReport } from '@/modules/reports/DailyClosingReport';

function StatCard({ label, value, icon: Icon, iconBg, meta }: {
  label: string; value: string; icon: React.ElementType; iconBg: string; meta: string;
}) {
  return (
    <div className="stat-tile">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</p>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{meta}</p>
        </div>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: iconBg }}>
          <Icon className="h-4.5 w-4.5 text-white" style={{ width: '1.125rem', height: '1.125rem' }} />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
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

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  // Build a simple daily timeline from the 30-day orders
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    dailyMap[format(subDays(new Date(), i), 'yyyy-MM-dd')] = 0;
  }

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Overview"
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋`}
        description={`${format(new Date(), 'dd MMMM yyyy')} · Medical Store Dashboard`}
        actions={
          <>
            <button onClick={() => setShowClosing(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
              <CalendarCheck size={14} /> Daily Closing
            </button>
            <span className="chip"><Clock size={12} className="mr-1" />Live</span>
          </>
        }
      />
      {showClosing && <DailyClosingReport onClose={() => setShowClosing(false)} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Revenue"
          value={formatCurrency(todayRevenue)}
          icon={IndianRupee}
          iconBg="#0071E3"
          meta="Real-time snapshot"
        />
        <StatCard
          label="Today's Orders"
          value={String(todayOrderCount)}
          icon={ShoppingCart}
          iconBg="#34C759"
          meta="Counter activity"
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(summary?.total_revenue ?? 0)}
          icon={TrendingUp}
          iconBg="#1D1D1F"
          meta="Last 30 days"
        />
        <StatCard
          label="Low Stock Items"
          value={String(lowStockItems?.length ?? 0)}
          icon={AlertTriangle}
          iconBg="#FF9500"
          meta="Needs attention"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="card p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="section-label">Summary</p>
              <h2 className="mt-2">30-day performance</h2>
            </div>
            <div className="chip">
              <Activity className="mr-2 h-3.5 w-3.5" />
              Updated every minute
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5 text-white" style={{ background: 'var(--text-primary)' }}>
              <p className="text-sm text-white/60">Total orders</p>
              <p className="mt-2 text-3xl font-semibold">{summary?.total_orders ?? 0}</p>
            </div>
            <div className="card-strong p-5">
              <p className="text-sm text-slate-500">Tax collected</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(summary?.total_tax ?? 0)}</p>
            </div>
            <div className="card-strong p-5">
              <p className="text-sm text-slate-500">Avg order value</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {summary?.total_orders
                  ? formatCurrency(Math.round((summary.total_revenue) / summary.total_orders))
                  : formatCurrency(0)}
              </p>
            </div>
            <div className="card-strong p-5">
              <p className="text-sm text-slate-500">Total discount</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(summary?.total_discount ?? 0)}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <p className="section-label">Payment breakdown</p>
          <h2 className="mt-2">By method (30 days)</h2>
          <div className="mt-6 space-y-3">
            {(summary?.by_payment ?? []).map((p) => (
              <div key={p.payment_method} className="card-strong flex items-center justify-between gap-4 p-4">
                <p className="font-medium text-slate-950 capitalize">{p.payment_method}</p>
                <div className="text-right">
                  <p className="font-semibold text-slate-950">{formatCurrency(Number(p.total))}</p>
                  <p className="text-xs text-slate-500">{p.count} orders</p>
                </div>
              </div>
            ))}
            {!summary?.by_payment?.length && (
              <p className="text-sm text-slate-500">No sales data yet — create your first bill in POS</p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="section-label">Low Stock Alerts</p>
            <h2 className="mt-2">
              Items running low
              {(lowStockItems?.length ?? 0) > 0 && (
                <span className="ml-2 badge badge-red">{lowStockItems?.length}</span>
              )}
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(lowStockItems ?? []).slice(0, 6).map((a: any) => (
            <div key={a.id} className="card-strong flex items-center justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium text-slate-950">{a.name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{a.sku ?? a.unit}</p>
              </div>
              <div className="text-right">
                <span className="badge badge-red">{a.stock_qty} {a.unit}</span>
                <p className="mt-1 text-xs text-slate-400">min: {a.min_stock_qty}</p>
              </div>
            </div>
          ))}
          {!lowStockItems?.length && (
            <p className="text-sm text-emerald-600 col-span-3">All items are well stocked</p>
          )}
        </div>
      </div>

      {/* Expiry Alerts */}
      {(expiringBatches?.length ?? 0) > 0 && (
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="section-label">Expiry Alerts</p>
              <h2 className="mt-2">
                Medicines expiring within 90 days
                <span className="ml-2 badge badge-red">{expiringBatches?.length}</span>
              </h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(expiringBatches ?? []).slice(0, 9).map((b: any) => {
              const daysLeft = differenceInDays(new Date(b.expiry_date), new Date());
              const color = daysLeft <= 30 ? 'badge-red' : daysLeft <= 60 ? 'bg-orange-950 text-orange-300' : 'bg-yellow-950 text-yellow-300';
              return (
                <div key={b.id} className="card-strong flex items-center justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-medium text-slate-950">{b.product_name}</p>
                    <p className="text-xs text-slate-500">Batch: {b.batch_no || '—'} · Qty: {b.quantity}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${color}`}>{daysLeft}d</span>
                    <p className="mt-1 text-xs text-slate-400">{b.expiry_date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card p-6">
        <p className="section-label">Recent Bills</p>
        <h2 className="mt-2 mb-4">Latest orders</h2>
        <div className="space-y-2">
          {(recentOrders?.items ?? []).map((o) => (
            <div key={o.id} className="card-strong flex items-center justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-semibold text-slate-950">{o.bill_number}</p>
                <p className="text-xs text-slate-400">{o.customer_name ?? 'Walk-in customer'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(o.total)}</p>
                <p className="text-xs text-slate-400 capitalize">{o.payment_method}</p>
              </div>
            </div>
          ))}
          {!recentOrders?.items?.length && (
            <p className="text-sm text-slate-500">No orders yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
