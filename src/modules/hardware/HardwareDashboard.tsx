// [hardware] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, AlertTriangle, TrendingUp, BookOpen, Package } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getHardwareStats, listHwProducts } from '@/lib/db/hardware';

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

  const cards = [
    { label: "Today's Sales", value: stats?.todaySales ?? 0, icon: ShoppingCart, color: '#2563eb', bg: '#dbeafe', path: '/hardware/pos' },
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#16a34a', bg: '#dcfce7', path: '/hardware/reports' },
    { label: 'Low Stock Items', value: stats?.lowStockCount ?? 0, icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', path: '/hardware/products' },
    { label: 'Credit Outstanding', value: fmt(stats?.creditOutstanding ?? 0), icon: BookOpen, color: '#dc2626', bg: '#fee2e2', path: '/hardware/credit' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Hardware Store</p>
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

      {/* Monthly revenue */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-slate-500">Monthly Revenue</span>
        </div>
        <p className="text-3xl font-bold text-slate-900">{fmt(stats?.monthRevenue ?? 0)}</p>
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
          <button onClick={() => navigate('/hardware/products')} className="mt-3 text-sm font-medium text-orange-700 hover:underline">Manage stock →</button>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Bill', icon: '🧾', path: '/hardware/pos' },
            { label: 'Products', icon: '📦', path: '/hardware/products' },
            { label: 'Credit / Udhar', icon: '📒', path: '/hardware/credit' },
            { label: 'Reports', icon: '📊', path: '/hardware/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
