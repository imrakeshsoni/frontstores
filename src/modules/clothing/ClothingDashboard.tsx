// [clothing] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, TrendingUp, AlertTriangle, ArrowLeftRight, BarChart3, Package } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getClothingStats, getTopClothingProducts, getLowClStock } from '@/lib/db/clothing';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function ClothingDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Clothing Store');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['clothing-stats', tenantId],
    queryFn: () => getClothingStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['clothing-top-products', tenantId],
    queryFn: () => getTopClothingProducts(tenantId, 5),
    enabled: !!tenantId,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['clothing-low-stock', tenantId],
    queryFn: () => getLowClStock(tenantId, 3),
    enabled: !!tenantId,
  });

  const cards = [
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#db2777', bg: '#fce7f3', path: '/clothing/billing' },
    { label: "Today's Bills", value: stats?.todayBills ?? 0, icon: ShoppingBag, color: '#2563eb', bg: '#dbeafe', path: '/clothing/billing' },
    { label: 'Low Stock Variants', value: stats?.lowStockVariants ?? 0, icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', path: '/clothing/products' },
    { label: "Today's Exchanges", value: stats?.todayExchanges ?? 0, icon: ArrowLeftRight, color: '#7c3aed', bg: '#ede9fe', path: '/clothing/exchanges' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Clothing &amp; Footwear Store</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)}
            className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Selling Items */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-pink-600" />
            <h2 className="font-semibold text-slate-900">Top Selling Items</h2>
          </div>
          <div className="space-y-2">
            {topProducts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No sales yet</p>
            ) : topProducts.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="font-medium text-slate-800">{p.product_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{p.qty} sold</span>
                  <span className="text-xs font-semibold text-pink-600">{fmt(p.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Variants */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="font-semibold text-slate-900">Low Stock Variants</h2>
            {lowStock.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">{lowStock.length}</span>}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lowStock.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">All variants well-stocked</p>
            ) : lowStock.map(s => (
              <div key={s.id} className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium text-slate-800">{s.product_name}</p>
                  <p className="text-xs text-slate-400">{s.size} / {s.color}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.quantity === 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                  {s.quantity === 0 ? 'Out of stock' : `${s.quantity} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Bill', icon: '🛍️', path: '/clothing/billing' },
            { label: 'Add Product', icon: '👗', path: '/clothing/products' },
            { label: 'Log Exchange', icon: '🔄', path: '/clothing/exchanges' },
            { label: 'View Reports', icon: '📊', path: '/clothing/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
