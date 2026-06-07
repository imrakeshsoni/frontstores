// [hardware] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShoppingCart, AlertTriangle, TrendingUp, BookOpen, FileText, Boxes } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getHardwareStats, listHwProducts, getHwRevenueTrend, getHwTopProducts } from '@/lib/db/hardware';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function HardwareDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Hardware Store');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['hw-stats', tenantId],
    queryFn: () => getHardwareStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['hw-low-stock', tenantId],
    queryFn: () => listHwProducts(tenantId, { lowStock: true }),
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  const { data: revenueTrend = [] } = useQuery({
    queryKey: ['hw-revenue-trend', tenantId],
    queryFn: () => getHwRevenueTrend(tenantId, 6),
    enabled: !!tenantId,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['hw-top-products-dash', tenantId],
    queryFn: () => getHwTopProducts(tenantId, { limit: 5 }),
    enabled: !!tenantId,
  });

  const cards = [
    { label: "Today's Sales", value: stats?.todaySales ?? 0, icon: ShoppingCart, color: '#2563eb', bg: '#dbeafe', path: '/hardware/pos' },
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/hardware/reports' },
    { label: 'Low Stock Items', value: stats?.lowStockCount ?? 0, icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', path: '/hardware/products' },
    { label: 'Credit Outstanding', value: fmt(stats?.creditOutstanding ?? 0), icon: BookOpen, color: '#dc2626', bg: '#fee2e2', path: '/hardware/credit' },
  ];

  const chartData = revenueTrend.map(r => ({ ...r, label: new Date(`${r.month}-01`).toLocaleDateString('en-IN', { month: 'short' }) }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Hardware & Paint Store</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)} className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-slate-500">Revenue Trend (6 months)</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{fmt(stats?.monthRevenue ?? 0)} <span className="text-xs font-normal text-slate-400">this month</span></p>
          </div>
          {chartData.length === 0 || chartData.every(c => c.revenue === 0) ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l, p) => p?.[0]?.payload ? `${p[0].payload.month} · ${p[0].payload.bills} bills` : l} />
                <Bar dataKey="revenue" fill="#d97706" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Top Selling Products</h2>
          {topProducts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => (
                <div key={p.product_id || i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-amber-600 w-5">{i + 1}.</span>
                    <p className="font-medium text-slate-800 truncate">{p.product_name}</p>
                  </div>
                  <p className="font-semibold text-slate-900 shrink-0">{fmt(p.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold text-orange-800">Low Stock Alerts ({lowStockItems.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lowStockItems.slice(0, 8).map(p => (
              <div key={p.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category} — {p.brand}</p>
                </div>
                <span className="text-xs font-semibold text-orange-600">
                  {p.stock} {p.unit} (min: {p.min_stock})
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/hardware/inventory')} className="mt-3 text-sm font-medium text-orange-700 hover:underline">Manage stock →</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'New Bill', icon: ShoppingCart, path: '/hardware/pos' },
            { label: 'Products', icon: Boxes, path: '/hardware/products' },
            { label: 'Inventory', icon: Boxes, path: '/hardware/inventory' },
            { label: 'Quotation', icon: FileText, path: '/hardware/quotations' },
            { label: 'Credit / Udhar', icon: BookOpen, path: '/hardware/credit' },
            { label: 'Reports', icon: TrendingUp, path: '/hardware/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <a.icon className="h-5 w-5 text-amber-600" />
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
