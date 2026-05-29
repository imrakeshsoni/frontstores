// [hardware] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, AlertTriangle, BookOpen } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listHwSales, listHwProducts, listHwCreditAccounts, getHardwareStats } from '@/lib/db/hardware';

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

export function HardwareReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<'sales' | 'stock' | 'credit'>('sales');

  const { data: stats } = useQuery({
    queryKey: ['hw-stats', tenantId],
    queryFn: () => getHardwareStats(tenantId),
    enabled: !!tenantId,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['hw-sales-report', tenantId, month],
    queryFn: () => listHwSales(tenantId, { month }),
    enabled: !!tenantId && view === 'sales',
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['hw-low-stock', tenantId],
    queryFn: () => listHwProducts(tenantId, { lowStock: true }),
    enabled: !!tenantId && view === 'stock',
  });

  const { data: creditAccounts = [] } = useQuery({
    queryKey: ['hw-credit-accounts-report', tenantId],
    queryFn: () => listHwCreditAccounts(tenantId),
    enabled: !!tenantId && view === 'credit',
  });

  const totalSalesRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalPaid = sales.reduce((s, sale) => s + sale.paid, 0);
  const totalDue = totalSalesRevenue - totalPaid;
  const totalCreditOutstanding = creditAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        {view === 'sales' && (
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
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Today's Sales", value: stats?.todaySales ?? 0, suffix: ' bills', color: '#2563eb', bg: '#dbeafe' },
          { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Low Stock', value: stats?.lowStockCount ?? 0, suffix: ' items', color: '#d97706', bg: '#fef3c7' },
          { label: 'Credit Due', value: fmt(stats?.creditOutstanding ?? 0), color: '#dc2626', bg: '#fee2e2' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: c.color }}>
              {c.value}{c.suffix ?? ''}
            </p>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-2">
        {([
          { key: 'sales', label: 'Sales', icon: BarChart3 },
          { key: 'stock', label: 'Low Stock', icon: AlertTriangle },
          { key: 'credit', label: 'Credit Accounts', icon: BookOpen },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={view === tab.key
              ? { background: '#d97706', color: 'white' }
              : { background: '#f1f5f9', color: '#64748b' }}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sales view */}
      {view === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', value: fmt(totalSalesRevenue), color: '#16a34a' },
              { label: 'Collected', value: fmt(totalPaid), color: '#2563eb' },
              { label: 'Balance Due', value: fmt(totalDue), color: '#dc2626' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Sales — {month}</h2>
            {sales.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No sales this month</p>
            ) : (
              <div className="space-y-2">
                {sales.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-800">#{s.bill_no} — {s.customer_name || 'Walk-in'}</p>
                      <p className="text-xs text-slate-400">{s.sale_date} · {s.payment_mode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{fmt(s.total)}</p>
                      {s.paid < s.total && <p className="text-xs text-red-500">due: {fmt(s.total - s.paid)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Low stock view */}
      {view === 'stock' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Low Stock Items ({lowStockItems.length})</h2>
          {lowStockItems.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">All stock levels are healthy</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm bg-orange-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category} · {p.brand}</p>
                  </div>
                  <span className="text-orange-600 font-semibold">{p.stock} / {p.min_stock} {p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credit view */}
      {view === 'credit' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Credit Outstanding</h2>
            <span className="font-bold text-red-600">{fmt(totalCreditOutstanding)}</span>
          </div>
          {creditAccounts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No credit accounts</p>
          ) : (
            <div className="space-y-2">
              {creditAccounts.filter(a => a.balance !== 0).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{a.customer_name}</p>
                    <p className="text-xs text-slate-400">{a.phone}</p>
                  </div>
                  <span className={`font-semibold ${a.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmt(Math.abs(a.balance))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
