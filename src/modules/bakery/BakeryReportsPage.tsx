// [bakery] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, ShoppingBag } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listBkSales, getTopBakeryProducts, listBkBulkOrders } from '@/lib/db/bakery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function BakeryReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const dateRange = (): { from: string; to: string } => {
    const today = new Date();
    const f = (d: Date) => d.toISOString().slice(0, 10);
    if (period === 'today') return { from: f(today), to: f(today) };
    if (period === 'week') { const s = new Date(today); s.setDate(today.getDate() - 6); return { from: f(s), to: f(today) }; }
    return { from: f(today).slice(0, 7) + '-01', to: f(today) };
  };

  const { from, to } = dateRange();

  const { data: sales = [] } = useQuery({
    queryKey: ['bk-sales-report', tenantId, from, to],
    queryFn: () => listBkSales(tenantId, from, to),
    enabled: !!tenantId,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['bk-top-products', tenantId],
    queryFn: () => getTopBakeryProducts(tenantId, 10),
    enabled: !!tenantId,
  });

  const { data: bulkOrders = [] } = useQuery({
    queryKey: ['bk-bulk-all', tenantId],
    queryFn: () => listBkBulkOrders(tenantId),
    enabled: !!tenantId,
  });

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const bulkRevenue = bulkOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${period === p ? 'text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              style={period === p ? { background: '#d97706' } : {}}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Counter Revenue', value: fmt(totalRevenue), icon: TrendingUp, color: '#d97706', bg: '#fef3c7' },
          { label: 'Total Bills', value: sales.length, icon: ShoppingBag, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Bulk Revenue', value: fmt(bulkRevenue), icon: BarChart3, color: '#16a34a', bg: '#dcfce7' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.bg }}>
                <c.icon className="h-3.5 w-3.5" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Top Selling Items</h2>
          {topProducts.slice(0, 8).map((p, i) => (
            <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-700">{p.product_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{p.qty} units</span>
                <span className="text-xs font-semibold text-amber-600">{fmt(p.revenue)}</span>
              </div>
            </div>
          ))}
          {topProducts.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No data</p>}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Bulk Orders Summary</h2>
          {[
            { label: 'Confirmed', status: 'confirmed', color: '#1d4ed8' },
            { label: 'Preparing', status: 'preparing', color: '#92400e' },
            { label: 'Ready', status: 'ready', color: '#166534' },
            { label: 'Delivered', status: 'delivered', color: '#64748b' },
          ].map(s => {
            const count = bulkOrders.filter(o => o.status === s.status).length;
            const rev = bulkOrders.filter(o => o.status === s.status).reduce((t, o) => t + o.total_amount, 0);
            return (
              <div key={s.status} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-700">{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{count} orders</span>
                  <span className="text-xs font-semibold" style={{ color: s.color }}>{fmt(rev)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
