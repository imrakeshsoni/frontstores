// [restaurant] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getRestaurantSummary, getTopMenuItems, getDailyRevenue } from '@/lib/db/restaurant';

type Range = '7d' | '30d' | 'month' | 'custom';

function rangeFor(r: Range, custom: { from: string; to: string }) {
  const now = new Date();
  if (r === '7d') {
    const from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0);
    const to = new Date(now); to.setHours(23, 59, 59, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (r === '30d') {
    const from = new Date(now); from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0);
    const to = new Date(now); to.setHours(23, 59, 59, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (r === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return { from: custom.from ? new Date(custom.from).toISOString() : new Date().toISOString(), to: custom.to ? new Date(custom.to + 'T23:59:59').toISOString() : new Date().toISOString() };
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function RestaurantReportsPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [range, setRange] = useState<Range>('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const { from, to } = rangeFor(range, custom);

  const { data: summary } = useQuery({
    queryKey: ['restaurant-report-summary', tenantId, from, to],
    queryFn: () => getRestaurantSummary(tenantId, from, to),
    enabled: !!tenantId,
  });

  const { data: topItems = [] } = useQuery({
    queryKey: ['restaurant-report-items', tenantId, from, to],
    queryFn: () => getTopMenuItems(tenantId, from, to, 20),
    enabled: !!tenantId,
  });

  const { data: daily = [] } = useQuery({
    queryKey: ['restaurant-report-daily', tenantId, from, to],
    queryFn: () => getDailyRevenue(tenantId, from, to),
    enabled: !!tenantId,
  });

  const maxRevenue = daily.reduce((m, d) => Math.max(m, d.revenue), 0);
  const avgDaily = daily.length > 0 ? (summary?.total_revenue ?? 0) / daily.length : 0;

  const RANGES: { label: string; value: Range }[] = [
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'This Month', value: 'month' },
    { label: 'Custom', value: 'custom' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: range === r.value ? 'var(--accent)' : 'var(--surface-2)',
                color: range === r.value ? 'white' : 'var(--text-secondary)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex gap-3 items-center flex-wrap">
          <input type="date" className="input" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} />
          <span style={{ color: 'var(--text-tertiary)' }}>to</span>
          <input type="date" className="input" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(summary?.total_revenue ?? 0) },
          { label: 'Total Orders', value: String(summary?.total_orders ?? 0) },
          { label: 'Avg Daily Revenue', value: fmt(avgDaily) },
          { label: 'Avg Order Value', value: summary && summary.total_orders > 0 ? fmt(summary.total_revenue / summary.total_orders) : '—' },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Order type breakdown */}
      {(summary?.by_type?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Revenue by Order Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {summary!.by_type.map((t) => (
              <div key={t.order_type} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{t.order_type}</p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{fmt(t.revenue)}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.count} orders</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily revenue chart */}
      {daily.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Daily Revenue</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="text-left py-2 pr-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                  <th className="text-right py-2 pr-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Orders</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Revenue</th>
                  <th className="w-32 pl-4"></th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => (
                  <tr key={d.date} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                    </td>
                    <td className="text-right py-2 pr-4" style={{ color: 'var(--text-secondary)' }}>{d.orders}</td>
                    <td className="text-right py-2 font-semibold" style={{ color: 'var(--accent)' }}>{fmt(d.revenue)}</td>
                    <td className="pl-4 py-2">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                        <div className="h-full rounded-full" style={{ width: `${maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0}%`, background: 'var(--accent)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top selling items */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Top Selling Items</h2>
        {topItems.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data for this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="text-left py-2 pr-4 font-medium" style={{ color: 'var(--text-secondary)' }}>#</th>
                  <th className="text-left py-2 pr-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Item</th>
                  <th className="text-right py-2 pr-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Qty Sold</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, idx) => (
                  <tr key={item.item_name} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td className="py-2 pr-4 text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>#{idx + 1}</td>
                    <td className="py-2 pr-4 font-medium" style={{ color: 'var(--text-primary)' }}>{item.item_name}</td>
                    <td className="text-right py-2 pr-4" style={{ color: 'var(--text-secondary)' }}>{item.total_qty}</td>
                    <td className="text-right py-2 font-semibold" style={{ color: 'var(--accent)' }}>{fmt(item.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
