// [jewellery] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Package, ShoppingCart, Wrench, Star, IndianRupee } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getJewelleryStats, getLatestRate } from '@/lib/db/jewellery';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function JewelleryDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Jewellery Shop');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['jewellery-stats', tenantId],
    queryFn: () => getJewelleryStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  const cards = [
    { label: "Today's Sales", value: fmt(stats?.todaySales ?? 0), sub: `${stats?.todayBills ?? 0} bills`, icon: IndianRupee, color: '#16a34a', bg: '#dcfce7', path: '/jewellery/billing' },
    { label: 'Stock Value', value: fmt(stats?.stockValue ?? 0), sub: `${stats?.stockCount ?? 0} pieces`, icon: Package, color: '#2563eb', bg: '#dbeafe', path: '/jewellery/products' },
    { label: 'Custom Orders', value: stats?.pendingOrders ?? 0, sub: 'pending', icon: Star, color: '#d97706', bg: '#fef3c7', path: '/jewellery/custom-orders' },
    { label: 'Repair Jobs', value: stats?.pendingRepairs ?? 0, sub: 'in progress', icon: Wrench, color: '#7c3aed', bg: '#ede9fe', path: '/jewellery/repairs' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Jewellery Shop Dashboard</p>
      </div>

      {/* Gold Rate Banner */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #92400e, #d97706)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-amber-100 text-sm font-medium">Today's Gold Rate</p>
          <button onClick={() => navigate('/jewellery/gold-rate')} className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors">Update Rate</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold">{fmt(stats?.gold22k ?? 0)}</p>
            <p className="text-amber-200 text-xs">22K / gram</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{fmt(stats?.gold24k ?? 0)}</p>
            <p className="text-amber-200 text-xs">24K / gram</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{fmt(stats?.silver ?? 0)}</p>
            <p className="text-amber-200 text-xs">Silver / gram</p>
          </div>
        </div>
        {(stats?.gold22k === 0) && (
          <p className="text-amber-200 text-xs mt-2">⚠️ Rate not set today — please update before billing</p>
        )}
      </div>

      {/* Stats */}
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
            <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
          </button>
        ))}
      </div>

      {/* Month sales */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <h2 className="font-semibold text-slate-900">This Month</h2>
        </div>
        <p className="text-3xl font-bold text-green-600">{fmt(stats?.monthSales ?? 0)}</p>
        <p className="text-sm text-slate-400 mt-0.5">Total sales this month</p>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Bill', icon: '🧾', path: '/jewellery/billing' },
            { label: 'Add Item', icon: '💍', path: '/jewellery/products' },
            { label: 'Custom Order', icon: '✨', path: '/jewellery/custom-orders' },
            { label: 'Repair Job', icon: '🔧', path: '/jewellery/repairs' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-amber-50 transition-colors">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
