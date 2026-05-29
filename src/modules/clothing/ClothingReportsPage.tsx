// [clothing] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, ShoppingBag } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listClSales, getClSaleItems, getTopClothingProducts } from '@/lib/db/clothing';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function ClothingReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const dateRange = (): { from: string; to: string } => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (period === 'today') return { from: fmt(today), to: fmt(today) };
    if (period === 'week') {
      const start = new Date(today); start.setDate(today.getDate() - 6);
      return { from: fmt(start), to: fmt(today) };
    }
    return { from: fmt(today).slice(0, 7) + '-01', to: fmt(today) };
  };

  const { from, to } = dateRange();

  const { data: sales = [] } = useQuery({
    queryKey: ['cl-sales-report', tenantId, from, to],
    queryFn: () => listClSales(tenantId, from, to),
    enabled: !!tenantId,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['clothing-top-products', tenantId],
    queryFn: () => getTopClothingProducts(tenantId, 10),
    enabled: !!tenantId,
  });

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalBills = sales.length;
  const avgBill = totalBills ? totalRevenue / totalBills : 0;

  const cashSales = sales.filter(s => s.payment_mode === 'cash').reduce((t, s) => t + s.total, 0);
  const upiSales = sales.filter(s => s.payment_mode === 'upi').reduce((t, s) => t + s.total, 0);
  const cardSales = sales.filter(s => s.payment_mode === 'card').reduce((t, s) => t + s.total, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${period === p ? 'text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              style={period === p ? { background: '#db2777' } : {}}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Revenue', value: fmt(totalRevenue), icon: TrendingUp, color: '#db2777', bg: '#fce7f3' },
          { label: 'Bills', value: totalBills, icon: ShoppingBag, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Avg Bill', value: fmt(avgBill), icon: BarChart3, color: '#16a34a', bg: '#dcfce7' },
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
        {/* Payment breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Payment Breakdown</h2>
          <div className="space-y-3">
            {[
              { mode: 'Cash', amount: cashSales, color: '#16a34a' },
              { mode: 'UPI', amount: upiSales, color: '#2563eb' },
              { mode: 'Card', amount: cardSales, color: '#7c3aed' },
            ].map(p => (
              <div key={p.mode} className="flex items-center gap-3">
                <div className="w-12 text-xs font-medium text-slate-500">{p.mode}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ background: p.color, width: totalRevenue ? `${(p.amount / totalRevenue) * 100}%` : '0%' }} />
                </div>
                <div className="w-20 text-right text-xs font-semibold text-slate-700">{fmt(p.amount)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Top Products</h2>
          <div className="space-y-2">
            {topProducts.slice(0, 7).map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-slate-50 last:border-0">
                <span className="text-slate-700">{p.product_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{p.qty} pcs</span>
                  <span className="text-xs font-semibold text-pink-600">{fmt(p.revenue)}</span>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No sales data</p>}
          </div>
        </div>
      </div>

      {/* Recent sales */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Recent Bills</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-slate-500 border-b border-slate-100">
                <th className="text-left pb-2">Bill No</th>
                <th className="text-left pb-2">Customer</th>
                <th className="text-left pb-2">Date</th>
                <th className="text-left pb-2">Payment</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 20).map(s => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-600">{s.bill_no}</td>
                  <td className="py-2 text-slate-800">{s.customer_name || '—'}</td>
                  <td className="py-2 text-slate-400">{new Date(s.sale_date).toLocaleDateString('en-IN')}</td>
                  <td className="py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{s.payment_mode}</span></td>
                  <td className="py-2 text-right font-semibold text-pink-600">{fmt(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && <p className="text-center text-slate-400 py-8">No sales in this period</p>}
        </div>
      </div>
    </div>
  );
}
