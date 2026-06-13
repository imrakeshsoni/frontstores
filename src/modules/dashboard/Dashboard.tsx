// [medical] [all tenants]
import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee, ShoppingCart, TrendingUp, AlertTriangle, AlertCircle,
  CalendarCheck, Clock, Package, Users, ChevronRight,
} from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';
import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { getSalesSummary, listOrders } from '@/lib/db/orders';
import { getLowStockAlerts, getExpiryAlerts } from '@/lib/db/inventory';
import { listKhataCustomers } from '@/lib/db/khata';
import { DailyClosingReport } from '@/modules/reports/DailyClosingReport';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

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

  const { data: khataCustomers } = useQuery({
    queryKey: ['khata-customers', tenantId],
    queryFn: () => listKhataCustomers(tenantId),
    enabled: !!tenantId,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders', tenantId],
    queryFn: () => listOrders(tenantId, { perPage: 6 }),
    enabled: !!tenantId,
  });

  const todayRevenue = todayOrders?.items.reduce((s, o) => s + Number(o.total), 0) ?? 0;
  const todayBillCount = todayOrders?.total ?? 0;
  const khataOutstanding = (khataCustomers ?? []).filter(k => Number(k.balance) > 0).reduce((s, k) => s + Number(k.balance), 0);

  const critical = (expiringBatches ?? []).filter(b => differenceInDays(new Date(b.expiry_date), new Date()) <= 30);
  const warning  = (expiringBatches ?? []).filter(b => { const d = differenceInDays(new Date(b.expiry_date), new Date()); return d > 30 && d <= 60; });
  const watch    = (expiringBatches ?? []).filter(b => differenceInDays(new Date(b.expiry_date), new Date()) > 60);

  const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}`;

  return (
    <div className="p-6 space-y-5">
      {showClosing && <DailyClosingReport onClose={() => setShowClosing(false)} />}

      {/* Header */}
      <div className="rounded-3xl p-6 text-white relative overflow-hidden flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(120deg, #0f766e 0%, #0d9488 45%, #06b6d4 100%)', boxShadow: '0 12px 32px -8px rgba(15,118,110,0.45)' }}>
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="absolute -right-2 bottom-[-3rem] h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="relative">
          <h1 className="text-2xl font-bold">{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
            {greeting} · {format(new Date(), 'dd MMMM yyyy')} · Medical Store
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <button onClick={() => setShowClosing(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
            <CalendarCheck size={14} /> Daily Closing
          </button>
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
            <Clock size={12} /> Live
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)', boxShadow: '0 10px 24px -8px rgba(99,102,241,0.38)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Today's Revenue</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.22)' }}><IndianRupee className="h-4 w-4 text-white" /></span>
          </div>
          <p className="text-2xl font-bold">{fmtCurrency(todayRevenue)}</p>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>Real-time</p>
        </div>

        <div className="p-4 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)', boxShadow: '0 10px 24px -8px rgba(34,197,94,0.38)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Today's Bills</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.22)' }}><ShoppingCart className="h-4 w-4 text-white" /></span>
          </div>
          <p className="text-2xl font-bold">{todayBillCount}</p>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>Bills today</p>
        </div>

        <div className="p-4 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #fb923c, #ea580c)', boxShadow: '0 10px 24px -8px rgba(251,146,60,0.38)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Monthly Revenue</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.22)' }}><TrendingUp className="h-4 w-4 text-white" /></span>
          </div>
          <p className="text-2xl font-bold">{fmtCurrency(summary?.total_revenue ?? 0)}</p>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>Last 30 days</p>
        </div>

        <div className="p-4 rounded-2xl text-white" style={{ background: khataOutstanding > 0 ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'linear-gradient(135deg, #64748b, #475569)', boxShadow: khataOutstanding > 0 ? '0 10px 24px -8px rgba(244,63,94,0.38)' : '0 10px 24px -8px rgba(100,116,139,0.22)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>Khata Outstanding</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.22)' }}><Users className="h-4 w-4 text-white" /></span>
          </div>
          <p className="text-2xl font-bold">{fmtCurrency(khataOutstanding)}</p>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {(khataCustomers ?? []).filter(k => Number(k.balance) > 0).length} customers owe
          </p>
        </div>
      </div>

      {/* Expiry Alerts */}
      {(expiringBatches?.length ?? 0) > 0 ? (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#fecaca', background: '#fff5f5' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #fecaca' }}>
            <AlertCircle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-800">Expiry Alerts</h2>
            <span className="ml-auto text-xs text-red-500 font-medium">{expiringBatches?.length} batches in next 90 days</span>
          </div>
          <div className="p-5 space-y-4">

            {/* Critical ≤30 days */}
            {critical.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>CRITICAL — expires within 30 days</span>
                  <span className="text-xs text-slate-400">{critical.length} batches</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {critical.slice(0, 6).map((b: any) => {
                    const d = differenceInDays(new Date(b.expiry_date), new Date());
                    return (
                      <div key={b.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 border" style={{ borderColor: '#fca5a5' }}>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{b.product_name}</p>
                          <p className="text-xs text-slate-400">Batch {b.batch_no || '—'} · {b.quantity} units</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>{d <= 0 ? 'EXPIRED' : `${d}d left`}</span>
                          <p className="text-xs text-slate-400 mt-0.5">{b.expiry_date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Warning 31–60 days */}
            {warning.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#ffedd5', color: '#ea580c' }}>WARNING — 31 to 60 days</span>
                  <span className="text-xs text-slate-400">{warning.length} batches</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {warning.slice(0, 6).map((b: any) => {
                    const d = differenceInDays(new Date(b.expiry_date), new Date());
                    return (
                      <div key={b.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 border" style={{ borderColor: '#fed7aa' }}>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{b.product_name}</p>
                          <p className="text-xs text-slate-400">Batch {b.batch_no || '—'} · {b.quantity} units</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#ffedd5', color: '#ea580c' }}>{d}d left</span>
                          <p className="text-xs text-slate-400 mt-0.5">{b.expiry_date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Watch 61–90 days */}
            {watch.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef9c3', color: '#ca8a04' }}>WATCH — 61 to 90 days</span>
                  <span className="text-xs text-slate-400">{watch.length} batches</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {watch.slice(0, 6).map((b: any) => {
                    const d = differenceInDays(new Date(b.expiry_date), new Date());
                    return (
                      <div key={b.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 border" style={{ borderColor: '#fde68a' }}>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{b.product_name}</p>
                          <p className="text-xs text-slate-400">Batch {b.batch_no || '—'} · {b.quantity} units</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef9c3', color: '#ca8a04' }}>{d}d left</span>
                          <p className="text-xs text-slate-400 mt-0.5">{b.expiry_date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex items-center gap-2">
          <span className="text-emerald-600 text-sm font-medium">✓ No medicines expiring in the next 90 days</span>
        </div>
      )}

      {/* Low Stock + Khata side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Low Stock Medicines */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #fde68a' }}>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-amber-800">Low Stock Medicines</h2>
            <span className="ml-auto text-xs text-amber-600 font-medium">
              {(lowStockItems?.length ?? 0) > 0 ? `${lowStockItems?.length} items` : 'All stocked'}
            </span>
          </div>
          <div className="p-4">
            {(lowStockItems?.length ?? 0) === 0 ? (
              <p className="text-sm text-emerald-700 text-center py-4 font-medium">✓ All medicines well stocked</p>
            ) : (
              <div className="space-y-2">
                {(lowStockItems ?? []).slice(0, 8).map((a: any) => (
                  <div key={a.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.sku || a.unit || '—'}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#d97706' }}>
                        {a.stock_qty} {a.unit}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">min: {a.min_stock_qty}</p>
                    </div>
                  </div>
                ))}
                {(lowStockItems?.length ?? 0) > 8 && (
                  <p className="text-xs text-amber-600 text-center pt-1">+{(lowStockItems?.length ?? 0) - 8} more — check Inventory</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Khata / Udhaar Outstanding */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <Users className="h-4 w-4 text-purple-500" />
            <h2 className="font-semibold text-slate-900">Khata / Udhaar</h2>
            <span className="ml-auto text-xs text-slate-400 font-medium">
              {fmtCurrency(khataOutstanding)} total
            </span>
          </div>
          <div className="p-4">
            {(khataCustomers ?? []).filter(k => Number(k.balance) > 0).length === 0 ? (
              <p className="text-sm text-emerald-700 text-center py-4 font-medium">✓ No outstanding balances</p>
            ) : (
              <div className="space-y-2">
                {(khataCustomers ?? []).filter(k => Number(k.balance) > 0).slice(0, 6).map((k: any) => (
                  <div key={k.customer_id} className="flex justify-between items-center text-sm rounded-xl px-3 py-2.5 border border-slate-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{k.customer_name}</p>
                      <p className="text-xs text-slate-400">{k.customer_phone || '—'}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-sm font-bold text-rose-600">{fmtCurrency(Number(k.balance))}</span>
                    </div>
                  </div>
                ))}
                {(khataCustomers ?? []).filter(k => Number(k.balance) > 0).length > 6 && (
                  <p className="text-xs text-slate-400 text-center pt-1">+{(khataCustomers ?? []).filter(k => Number(k.balance) > 0).length - 6} more — check Khata</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment breakdown + Recent Bills */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Payment breakdown */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold text-slate-900">Payment Mode <span className="text-xs font-normal text-slate-400">(30 days)</span></h2>
          </div>
          {(summary?.by_payment ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {(summary?.by_payment ?? []).map((p) => {
                const total = (summary?.by_payment ?? []).reduce((s, x) => s + Number(x.total), 0);
                const pct = total > 0 ? Math.round((Number(p.total) / total) * 100) : 0;
                return (
                  <div key={p.payment_method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 capitalize">{p.payment_method}</span>
                      <span className="font-semibold text-slate-900">{fmtCurrency(Number(p.total))}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #0ea5e9)' }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{p.count} bills · {pct}%</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Bills */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-green-500" />
            <h2 className="font-semibold text-slate-900">Recent Bills</h2>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ml-auto" />
          </div>
          {!recentOrders?.items?.length ? (
            <p className="text-sm text-slate-400 text-center py-6">No bills yet — create your first bill in POS</p>
          ) : (
            <div className="space-y-2.5">
              {(recentOrders?.items ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm rounded-xl px-3 py-2.5 bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{o.bill_number}</p>
                    <p className="text-xs text-slate-400 truncate">{o.customer_name ?? 'Walk-in customer'}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-slate-900">{fmtCurrency(o.total)}</p>
                    <p className="text-xs text-slate-400 capitalize">{o.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
