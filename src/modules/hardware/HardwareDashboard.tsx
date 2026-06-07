// [hardware] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShoppingCart, AlertTriangle, TrendingUp, BookOpen, FileText, Boxes } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getHardwareStats, listHwProducts, getHwRevenueTrend, getHwTopProducts } from '@/lib/db/hardware';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const RANK_COLORS = [
  'linear-gradient(135deg, #fbbf24, #d97706)',
  'linear-gradient(135deg, #94a3b8, #475569)',
  'linear-gradient(135deg, #fb923c, #c2410c)',
  'linear-gradient(135deg, #818cf8, #4338ca)',
  'linear-gradient(135deg, #38bdf8, #0369a1)',
];

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
    { label: "Today's Sales", value: stats?.todaySales ?? 0, icon: ShoppingCart, gradient: 'linear-gradient(135deg, #6366f1, #4338ca)', glow: 'rgba(99,102,241,0.35)', path: '/hardware/pos' },
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, gradient: 'linear-gradient(135deg, #22c55e, #15803d)', glow: 'rgba(34,197,94,0.35)', path: '/hardware/reports' },
    { label: 'Low Stock Items', value: stats?.lowStockCount ?? 0, icon: AlertTriangle, gradient: 'linear-gradient(135deg, #fb923c, #ea580c)', glow: 'rgba(251,146,60,0.35)', path: '/hardware/products' },
    { label: 'Credit Outstanding', value: fmt(stats?.creditOutstanding ?? 0), icon: BookOpen, gradient: 'linear-gradient(135deg, #f43f5e, #be123c)', glow: 'rgba(244,63,94,0.35)', path: '/hardware/credit' },
  ];

  const chartData = revenueTrend.map(r => ({ ...r, label: new Date(`${r.month}-01`).toLocaleDateString('en-IN', { month: 'short' }) }));

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-3xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(120deg, #4338ca 0%, #6366f1 45%, #0ea5e9 100%)', boxShadow: '0 12px 32px -8px rgba(67,56,202,0.45)' }}>
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="absolute -right-2 bottom-[-3rem] h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="relative">
          <h1 className="text-2xl font-bold" style={{ color: 'white' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>Hardware & Paint Store · Dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button
            key={c.label}
            onClick={() => navigate(c.path)}
            className="text-left p-4 rounded-2xl text-white transition-all duration-200 hover:-translate-y-1"
            style={{ background: c.gradient, boxShadow: `0 10px 24px -8px ${c.glow}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-white/80">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.22)' }}>
                <c.icon className="h-4 w-4 text-white" />
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'white' }}>{c.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
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
                <defs>
                  <linearGradient id="hwRevenueBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4338ca" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l, p) => p?.[0]?.payload ? `${p[0].payload.month} · ${p[0].payload.bills} bills` : l} />
                <Bar dataKey="revenue" fill="url(#hwRevenueBar)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Top Selling Products</h2>
          {topProducts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => {
                return (
                  <div key={p.product_id || i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: RANK_COLORS[i % RANK_COLORS.length] }}
                      >
                        {i + 1}
                      </span>
                      <p className="font-medium text-slate-800 truncate">{p.product_name}</p>
                    </div>
                    <p className="font-semibold text-slate-900 shrink-0">{fmt(p.revenue)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-amber-800">Low Stock Alerts ({lowStockItems.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lowStockItems.slice(0, 8).map(p => (
              <div key={p.id} className="flex justify-between items-center text-sm bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category} — {p.brand}</p>
                </div>
                <span className="text-xs font-semibold text-amber-600">
                  {p.stock} {p.unit} (min: {p.min_stock})
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/hardware/inventory')} className="mt-3 text-sm font-medium text-amber-700 hover:underline">Manage stock →</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'New Bill', icon: ShoppingCart, path: '/hardware/pos', color: '#4338ca', bg: '#e0e7ff' },
            { label: 'Products', icon: Boxes, path: '/hardware/products', color: '#0369a1', bg: '#e0f2fe' },
            { label: 'Inventory', icon: Boxes, path: '/hardware/inventory', color: '#0d9488', bg: '#ccfbf1' },
            { label: 'Quotation', icon: FileText, path: '/hardware/quotations', color: '#7c3aed', bg: '#ede9fe' },
            { label: 'Credit / Udhar', icon: BookOpen, path: '/hardware/credit', color: '#be123c', bg: '#ffe4e6' },
            { label: 'Reports', icon: TrendingUp, path: '/hardware/reports', color: '#15803d', bg: '#dcfce7' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: a.bg }}>
                <a.icon className="h-5 w-5" style={{ color: a.color }} />
              </span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
