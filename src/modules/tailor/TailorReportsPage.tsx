// [tailor] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listTailorOrders, listTailorExpenses, type TailorOrder } from '@/lib/db/tailor';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

function getMonthOptions() {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

export function TailorReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: orders = [] } = useQuery({
    queryKey: ['tailor-orders-report', tenantId],
    queryFn: () => listTailorOrders(tenantId),
    enabled: !!tenantId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['tailor-expenses-report', tenantId, month],
    queryFn: () => listTailorExpenses(tenantId, { month }),
    enabled: !!tenantId,
  });

  // monthly revenue from orders delivered that month
  const monthOrders = orders.filter(o => {
    const ref = o.delivered_at || o.updated_at || '';
    return ref.startsWith(month) || o.delivery_date?.startsWith(month);
  });
  const monthRevenue = monthOrders.reduce((s, o) => s + o.total_amount, 0);
  const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // by item type
  const itemTypeCounts: Record<string, { count: number; revenue: number }> = {};
  orders.forEach(o => {
    if (!itemTypeCounts[o.item_type]) itemTypeCounts[o.item_type] = { count: 0, revenue: 0 };
    itemTypeCounts[o.item_type].count++;
    itemTypeCounts[o.item_type].revenue += o.total_amount;
  });
  const itemTypeSorted = Object.entries(itemTypeCounts).sort((a, b) => b[1].count - a[1].count);

  // status summary
  const statusMap: Record<string, number> = {};
  orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] ?? 0) + 1; });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
        >
          {getMonthOptions().map(m => (
            <option key={m} value={m}>
              {new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </option>
          ))}
        </select>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Revenue', value: fmt(monthRevenue), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Expenses', value: fmt(monthExpenses), color: '#dc2626', bg: '#fee2e2' },
          { label: 'Net Profit', value: fmt(monthRevenue - monthExpenses), color: '#7c3aed', bg: '#ede9fe' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Orders by item type */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          <h2 className="font-semibold text-slate-900">Orders by Item Type</h2>
        </div>
        {itemTypeSorted.length === 0 ? (
          <p className="text-slate-400 text-sm">No data yet</p>
        ) : (
          <div className="space-y-3">
            {itemTypeSorted.map(([type, data]) => {
              const maxCount = itemTypeSorted[0][1].count;
              const pct = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-800">{type}</span>
                    <span className="text-slate-500">{data.count} orders · {fmt(data.revenue)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#7c3aed' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order status breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-purple-600" />
          <h2 className="font-semibold text-slate-900">Current Status Breakdown</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['received', 'cutting', 'stitching', 'ready', 'delivered'] as const).map(s => (
            <div key={s} className="text-center p-3 rounded-xl bg-slate-50">
              <p className="text-2xl font-bold text-slate-900">{statusMap[s] ?? 0}</p>
              <p className="text-xs text-slate-500 capitalize mt-0.5">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expenses list */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Expenses — {month}</h2>
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800">{e.description}</p>
                  <p className="text-xs text-slate-400">{e.category} · {e.date}</p>
                </div>
                <span className="font-semibold text-red-600">{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
