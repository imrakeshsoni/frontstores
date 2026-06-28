import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays } from 'date-fns';
import { useAppStore } from '@/app/store/app.store';
import { getSalesSummary, listOrders } from '@/lib/db/orders';
import { getLowStockAlerts, getExpiryAlerts, setBatchReturnSeen, addReturnSettlement, listReturnSettlements, deleteReturnSettlement } from '@/lib/db/inventory';
import { listProducts } from '@/lib/db/products';
import { PageIntro } from '@/components/ui/PageIntro';

type Tab = 'sales' | 'gst' | 'stock' | 'expiry' | 'returned' | 'settlement';
type ExpiryWindow = 30 | 60 | 90 | 180 | 365; // [medical] [all tenants] — added 180 days

export function ReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const isMedical = config?.shop_type === 'medical';
  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expiryWindow, setExpiryWindow] = useState<ExpiryWindow>(90);
  // [medical] [all tenants] — custom date range + already-expired return view
  const [expiryMode, setExpiryMode] = useState<'window' | 'custom'>('window');
  const [expiryFrom, setExpiryFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expiryTo, setExpiryTo] = useState(format(new Date(Date.now() + 90 * 86400000), 'yyyy-MM-dd'));

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
    enabled: !!tenantId && (tab === 'expiry' || tab === 'returned' || tab === 'settlement'),
  });

  // [medical] [all tenants] — toggle the "Seen" marker on an expired batch pulled for return
  const queryClient = useQueryClient();
  const seenMutation = useMutation({
    mutationFn: ({ id, seen }: { id: string; seen: boolean }) => setBatchReturnSeen(tenantId, id, seen),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expiry-alerts', tenantId] }),
  });

  // [medical] [all tenants] — supplier-level expired-return settlements
  const { data: settlementsData } = useQuery({
    queryKey: ['return-settlements', tenantId],
    queryFn: () => listReturnSettlements(tenantId),
    enabled: !!tenantId && tab === 'settlement',
  });
  // per-supplier settlement inputs, keyed by supplier id (so every supplier in the box shows at once)
  const [settleForm, setSettleForm] = useState<Record<string, { date: string; amount: string; note: string }>>({});
  const formFor = (id: string) => settleForm[id] ?? { date: format(new Date(), 'yyyy-MM-dd'), amount: '', note: '' };
  const setFormFor = (id: string, patch: Partial<{ date: string; amount: string; note: string }>) =>
    setSettleForm((prev) => ({ ...prev, [id]: { ...formFor(id), ...patch } }));
  const addSettlement = useMutation({
    mutationFn: (g: { id: string; name: string; batchIds: string[] }) => {
      const f = formFor(g.id);
      return addReturnSettlement(tenantId, {
        supplier_id: g.id || null,
        supplier_name: g.name === 'No supplier' ? null : g.name,
        settlement_date: f.date,
        amount: parseFloat(f.amount) || 0,
        batch_ids: g.batchIds,
        note: f.note.trim() || null,
      });
    },
    onSuccess: (_d, g) => {
      queryClient.invalidateQueries({ queryKey: ['return-settlements', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['expiry-alerts', tenantId] });
      setSettleForm((prev) => { const next = { ...prev }; delete next[g.id]; return next; });
    },
  });
  const delSettlement = useMutation({
    mutationFn: (id: string) => deleteReturnSettlement(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-settlements', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['expiry-alerts', tenantId] });
    },
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
    ...(isMedical ? [{ id: 'returned' as Tab, label: 'Return Expired' }] : []),
    ...(isMedical ? [{ id: 'settlement' as Tab, label: 'Return Settlement' }] : []),
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
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">GST Summary (GSTR-1)</p>
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                const items = ordersData?.items ?? [];
                const taxable = items.reduce((s, o) => s + o.subtotal, 0);
                const cgst = items.reduce((s, o) => s + o.tax_total / 2, 0);
                const sgst = cgst;
                const rows = [
                  ['Period', 'Orders', 'Taxable Value', 'CGST', 'SGST', 'Total GST'],
                  [`${from} to ${to}`, String(items.length), taxable.toFixed(2), cgst.toFixed(2), sgst.toFixed(2), (cgst + sgst).toFixed(2)],
                  [],
                  ['Bill No', 'Date', 'Customer', 'Subtotal', 'Tax', 'Total'],
                  ...items.map(o => [o.bill_number, o.order_date?.slice(0,10), o.customer_name||'', o.subtotal.toFixed(2), o.tax_total.toFixed(2), o.total.toFixed(2)]),
                ];
                const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                a.download = `GSTR1_${from}_${to}.csv`;
                a.click();
              }}
            >
              ↓ Export GSTR-1 CSV
            </button>
          </div>
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="section-label">Expiry Watch</p>
            <div className="flex gap-1 flex-wrap">
              {([30, 60, 90, 180, 365] as ExpiryWindow[]).map((w) => (
                <button
                  key={w}
                  onClick={() => { setExpiryMode('window'); setExpiryWindow(w); }}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: expiryMode === 'window' && expiryWindow === w ? '#7c3aed' : '#f1f5f9',
                    color: expiryMode === 'window' && expiryWindow === w ? 'white' : '#64748b',
                  }}
                >
                  {w === 365 ? '1 Year' : `${w} Days`}
                </button>
              ))}
              {/* [medical] [all tenants] — Custom date range, like the Sales report */}
              <button
                onClick={() => setExpiryMode('custom')}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: expiryMode === 'custom' ? '#7c3aed' : '#f1f5f9',
                  color: expiryMode === 'custom' ? 'white' : '#64748b',
                }}
              >
                Custom
              </button>
            </div>
          </div>
          {expiryMode === 'custom' && (
            <div className="mb-4 flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">From</label>
                <input type="date" className="input w-auto" value={expiryFrom} onChange={(e) => setExpiryFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">To</label>
                <input type="date" className="input w-auto" value={expiryTo} onChange={(e) => setExpiryTo(e.target.value)} />
              </div>
            </div>
          )}
          {(() => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
            let rows: any[];
            if (expiryMode === 'custom') {
              rows = (expiryData ?? [])
                .filter((a: any) => a.expiry_date >= expiryFrom && a.expiry_date <= expiryTo)
                .sort((a: any, b: any) => a.expiry_date.localeCompare(b.expiry_date));
            } else {
              const cutoff = format(new Date(Date.now() + expiryWindow * 86400000), 'yyyy-MM-dd');
              const filtered = (expiryData ?? []).filter((a: any) => a.expiry_date >= today && a.expiry_date <= cutoff);
              const expired = (expiryData ?? []).filter((a: any) => a.expiry_date < today);
              rows = [...expired, ...filtered.sort((a: any, b: any) => a.expiry_date.localeCompare(b.expiry_date))];
            }
            return (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Batch No</th>
                    <th>Supplier</th>
                    <th className="text-right">Quantity</th>
                    <th>Expiry Date</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-sm text-emerald-600 py-6">{expiryMode === 'custom' ? `No batches expiring between ${expiryFrom} and ${expiryTo}` : `No batches expiring in the next ${expiryWindow} days`}</td></tr>
                  )}
                  {rows.map((a: any) => {
                    const expiredRow = a.expiry_date < today;
                    const days = daysUntil(a.expiry_date);
                    return (
                      <tr key={a.id}>
                        <td className="font-semibold">{a.product_name}</td>
                        <td className="text-slate-500">{a.batch_no ?? '—'}</td>
                        <td className="text-slate-500">{a.supplier_name ?? '—'}</td>
                        <td className="text-right">{a.quantity}</td>
                        <td>{a.expiry_date}</td>
                        <td className="text-right">
                          {expiredRow
                            ? <span className="badge badge-red">Expired</span>
                            : <span className={`badge ${days <= 30 ? 'badge-red' : 'badge-yellow'}`}>{days} days left</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {/* [medical] [all tenants] — Return Expired tab: already-expired batches, tick Seen to put in the return box */}
      {tab === 'returned' && (
        <div className="card p-6">
          <p className="section-label mb-1">Return Expired</p>
          <p className="text-xs text-slate-500 mb-4">These medicines have already expired. Tick <b>Seen</b> as you pull each one off the shelf into the return box, then go to <b>Return Settlement</b> to settle them with the supplier.</p>
          {(() => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const rows = (expiryData ?? [])
              .filter((a: any) => a.expiry_date < today)
              .sort((a: any, b: any) => a.expiry_date.localeCompare(b.expiry_date));
            return (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Batch No</th>
                    <th>Supplier</th>
                    <th className="text-right">Quantity</th>
                    <th>Expiry Date</th>
                    <th className="text-right">Status</th>
                    <th className="text-center">Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-sm text-emerald-600 py-6">No expired batches to return — all clear</td></tr>
                  )}
                  {rows.map((a: any) => {
                    const seen = !!a.return_seen_at;
                    const settled = !!a.return_settled_at;
                    return (
                      <tr key={a.id} style={settled || seen ? { background: settled ? '#f0fdf4' : '#ecfdf5' } : undefined}>
                        <td className="font-semibold">{a.product_name}</td>
                        <td className="text-slate-500">{a.batch_no ?? '—'}</td>
                        <td className="text-slate-500">{a.supplier_name ?? '—'}</td>
                        <td className="text-right">{a.quantity}</td>
                        <td>{a.expiry_date}</td>
                        <td className="text-right">
                          {settled
                            ? <span className="badge badge-green">Settled</span>
                            : <span className="badge badge-red">Expired</span>}
                        </td>
                        <td className="text-center">
                          {settled ? (
                            <span className="text-emerald-600 text-sm font-semibold" title="Already settled with the supplier">✓</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={seen}
                              disabled={seenMutation.isPending}
                              onChange={(e) => seenMutation.mutate({ id: a.id, seen: e.target.checked })}
                              title="Tick once you've pulled this batch off the shelf and into the return box"
                              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#059669' }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {/* [medical] [all tenants] — Return Settlement tab: settle the "Seen" expired stock per supplier */}
      {tab === 'settlement' && (
        <div className="card p-6">
          {(() => {
            const today = format(new Date(), 'yyyy-MM-dd');
            // the return box = expired batches ticked Seen but not yet settled
            const box = (expiryData ?? []).filter(
              (a: any) => a.expiry_date < today && a.return_seen_at && !a.return_settled_at
            );
            // group the box by supplier so the user settles one supplier at a time
            const groups: Record<string, { id: string; name: string; items: any[] }> = {};
            for (const a of box) {
              const id = a.supplier_id ?? '';
              if (!groups[id]) groups[id] = { id, name: a.supplier_name ?? 'No supplier', items: [] };
              groups[id].items.push(a);
            }
            const supplierGroups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
            const settlements = settlementsData ?? [];
            const totalRefund = settlements.reduce((s: number, r: any) => s + (r.amount || 0), 0);
            return (
              <div>
                <p className="section-label mb-1">Supplier Return Settlement</p>
                <p className="text-xs text-slate-500 mb-4">Every supplier with stock you've marked <b>Seen</b> (in <b>Expiry → Return Expired</b>) appears below with all their products — enter the date and refund amount, then settle them together. Settled items drop off automatically, so nothing gets done twice.</p>

                {supplierGroups.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2 mb-2">No medicines marked <b>Seen</b> yet — go to <b>Expiry → Return Expired</b> and tick the ones you're returning.</p>
                ) : (
                  <div className="space-y-5 mb-8">
                    {supplierGroups.map((g) => {
                      const f = formFor(g.id);
                      const busy = addSettlement.isPending && addSettlement.variables?.id === g.id;
                      return (
                        <div key={g.id || 'none'} className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                            <span className="font-semibold text-slate-700">{g.name}</span>
                            <span className="text-xs text-slate-500">{g.items.length} product{g.items.length === 1 ? '' : 's'} to return</span>
                          </div>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Batch No</th>
                                <th className="text-right">Quantity</th>
                                <th>Expiry Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map((i: any) => (
                                <tr key={i.id}>
                                  <td className="font-semibold">{i.product_name}</td>
                                  <td className="text-slate-500">{i.batch_no ?? '—'}</td>
                                  <td className="text-right">{i.quantity}</td>
                                  <td>{i.expiry_date}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* inline per-supplier settlement row */}
                          <div className="px-4 py-3 bg-slate-50/60 grid gap-3 items-end" style={{ gridTemplateColumns: '170px 160px minmax(180px,1fr) auto' }}>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-slate-600">Settlement Date</label>
                              <input type="date" className="input" value={f.date} onChange={(e) => setFormFor(g.id, { date: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-slate-600">Refund Amount (₹)</label>
                              <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={f.amount} onChange={(e) => setFormFor(g.id, { amount: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-slate-600">Note (optional)</label>
                              <input type="text" className="input" placeholder="e.g. credit note no." value={f.note} onChange={(e) => setFormFor(g.id, { note: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-slate-600 invisible">Action</label>
                              <button
                                className="btn btn-primary whitespace-nowrap"
                                disabled={!f.amount || busy}
                                onClick={() => addSettlement.mutate({ id: g.id, name: g.name, batchIds: g.items.map((i: any) => i.id) })}
                              >
                                {busy ? 'Saving…' : `Settle ${g.items.length} item${g.items.length === 1 ? '' : 's'}`}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="section-label mb-2 mt-2">Settlement History</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Supplier</th>
                      <th className="text-right"># Items</th>
                      <th className="text-right">Refund (₹)</th>
                      <th>Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-sm text-slate-400 py-6">No settlements recorded yet</td></tr>
                    )}
                    {settlements.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.settlement_date}</td>
                        <td className="font-semibold">{r.supplier_name ?? '—'}</td>
                        <td className="text-right">{r.item_count ?? '—'}</td>
                        <td className="text-right font-semibold">₹{(r.amount || 0).toFixed(2)}</td>
                        <td className="text-slate-500">{r.note ?? '—'}</td>
                        <td className="text-right">
                          <button className="text-xs text-red-600 hover:underline" onClick={() => delSettlement.mutate(r.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {settlements.length > 0 && (
                      <tr className="font-semibold">
                        <td colSpan={3} className="text-right">Total refunded</td>
                        <td className="text-right">₹{totalRefund.toFixed(2)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
