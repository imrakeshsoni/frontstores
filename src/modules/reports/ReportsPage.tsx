import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays } from 'date-fns';
import { useAppStore } from '@/app/store/app.store';
import { getSalesSummary, listOrders } from '@/lib/db/orders';
import { getLowStockAlerts, getExpiryAlerts } from '@/lib/db/inventory';
import { listProducts } from '@/lib/db/products';
import { PageIntro } from '@/components/ui/PageIntro';

type Tab = 'sales' | 'gst' | 'stock' | 'expiry';

export function ReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const isMedical = config?.shop_type === 'medical';
  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: salesData } = useQuery({
    queryKey: ['report-sales', tenantId, from, to],
    queryFn: () => getSalesSummary(tenantId, from, to),
    enabled: !!tenantId && tab === 'sales',
  });

  const { data: ordersData } = useQuery({
    queryKey: ['report-orders', tenantId, from, to],
    queryFn: () => listOrders(tenantId, { from, to, perPage: 500 }),
    enabled: !!tenantId && (tab === 'sales' || tab === 'gst'),
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock', tenantId],
    queryFn: () => getLowStockAlerts(tenantId),
    enabled: !!tenantId && tab === 'stock',
  });

  const { data: expiryData } = useQuery({
    queryKey: ['expiry-alerts', tenantId],
    queryFn: () => getExpiryAlerts(tenantId, 365),
    enabled: !!tenantId && tab === 'expiry',
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  // Build daily revenue chart from orders
  const dailyRevenue: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    dailyRevenue[format(subDays(new Date(to), i), 'yyyy-MM-dd')] = 0;
  }
  for (const order of ordersData?.items ?? []) {
    const day = order.order_date.slice(0, 10);
    if (day in dailyRevenue) dailyRevenue[day] = (dailyRevenue[day] ?? 0) + order.total;
  }
  const chartData = Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue }));

  // GST grouping
  const gstGroups: Record<number, { taxable: number; tax: number; count: number }> = {};
  for (const order of ordersData?.items ?? []) {
    const rate = 12; // simplified - would need item-level data for exact breakdown
    if (!gstGroups[rate]) gstGroups[rate] = { taxable: 0, tax: 0, count: 0 };
    gstGroups[rate].taxable += order.subtotal;
    gstGroups[rate].tax += order.tax_total;
    gstGroups[rate].count++;
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'sales', label: 'Sales' },
    { id: 'gst', label: 'GST Report' },
    { id: 'stock', label: 'Low Stock' },
    ...(isMedical ? [{ id: 'expiry' as Tab, label: 'Expiry' }] : []),
  ];

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Reports"
        title="Insights at a glance."
        description="Sales performance, GST summary, and stock alerts."
      />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${tab === id ? 'text-white' : 'text-slate-600 bg-white border border-black/[0.06]'}`}
            style={tab === id ? { background: 'var(--accent)' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* Date range */}
      {(tab === 'sales' || tab === 'gst') && (
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">From</label>
            <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">To</label>
            <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Total Revenue', value: formatCurrency(salesData?.total_revenue ?? 0) },
              { label: 'Total Orders', value: String(salesData?.total_orders ?? 0) },
              { label: 'Tax Collected', value: formatCurrency(salesData?.total_tax ?? 0) },
              { label: 'Total Discount', value: formatCurrency(salesData?.total_discount ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="stat-tile">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <p className="section-label mb-4">Daily Revenue</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'd MMM')} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l) => format(new Date(l), 'dd MMM yyyy')} />
                <Bar dataKey="revenue" fill="#0071E3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <p className="section-label mb-4">Payment Breakdown</p>
            <div className="space-y-2">
              {(salesData?.by_payment ?? []).map((p) => (
                <div key={p.payment_method} className="card-strong flex items-center justify-between p-4">
                  <p className="font-medium capitalize">{p.payment_method}</p>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(p.total)}</p>
                    <p className="text-xs text-slate-400">{p.count} orders</p>
                  </div>
                </div>
              ))}
              {!salesData?.by_payment?.length && <p className="text-sm text-slate-500">No sales in selected period</p>}
            </div>
          </div>
        </>
      )}

      {tab === 'gst' && (
        <div className="card p-6">
          <p className="section-label mb-4">GST Summary</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Taxable Value</th>
                <th className="text-right">CGST</th>
                <th className="text-right">SGST</th>
                <th className="text-right">Total GST</th>
              </tr>
            </thead>
            <tbody>
              {ordersData?.items && ordersData.items.length > 0 ? (
                <tr>
                  <td>{format(new Date(from), 'dd MMM')} – {format(new Date(to), 'dd MMM yyyy')}</td>
                  <td className="text-right">{ordersData.total}</td>
                  <td className="text-right">{formatCurrency(ordersData.items.reduce((s, o) => s + o.subtotal, 0))}</td>
                  <td className="text-right">{formatCurrency(ordersData.items.reduce((s, o) => s + o.tax_total / 2, 0))}</td>
                  <td className="text-right">{formatCurrency(ordersData.items.reduce((s, o) => s + o.tax_total / 2, 0))}</td>
                  <td className="text-right font-semibold">{formatCurrency(ordersData.items.reduce((s, o) => s + o.tax_total, 0))}</td>
                </tr>
              ) : (
                <tr><td colSpan={6} className="text-center text-sm text-slate-500 py-6">No orders in selected period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'stock' && (
        <div className="card p-6">
          <p className="section-label mb-4">Low Stock Items</p>
          <div className="space-y-2">
            {(lowStockData ?? []).length === 0 && <p className="text-sm text-emerald-600">All items are well stocked</p>}
            {(lowStockData ?? []).map((p: any) => (
              <div key={p.id} className="card-strong flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.unit}</p>
                </div>
                <div className="text-right">
                  <span className="badge badge-red">{p.stock_qty} remaining</span>
                  <p className="text-xs text-slate-400 mt-1">Min: {p.min_stock_qty}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'expiry' && (
        <div className="card p-6">
          <p className="section-label mb-4">Expiry Watch (next 12 months)</p>
          <div className="space-y-2">
            {(expiryData ?? []).length === 0 && <p className="text-sm text-emerald-600">No batches expiring in the next year</p>}
            {(expiryData ?? []).map((a: any) => (
              <div key={a.id} className="card-strong flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{a.product_name}</p>
                  <p className="text-xs text-slate-400">Batch: {a.batch_no ?? '—'}</p>
                </div>
                <div className="text-right">
                  <span className="badge badge-red">{a.expiry_date}</span>
                  <p className="text-xs text-slate-400 mt-1">{a.quantity} units</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
