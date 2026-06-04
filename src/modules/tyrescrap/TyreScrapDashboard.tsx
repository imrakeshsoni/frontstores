// [tyrescrap] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Scale, TrendingUp, TrendingDown, Package, ShoppingCart, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getTyreScrapStats } from '@/lib/db/tyrescrap';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtKg(n: number) { return `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg`; }

function StatCard({ icon, label, value, sub, bg, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; bg: string; color: string;
}) {
  return (
    <div className="rounded-2xl p-5 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg, color }}>{icon}</div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}

export function TyreScrapDashboard() {
  const tenantId  = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName  = useAppStore((s) => s.config?.shop_name ?? 'TyreMate');
  const navigate  = useNavigate();
  const today     = new Date().toISOString().slice(0, 10);

  const { data: stats } = useQuery({
    queryKey: ['tyrescrap-stats', tenantId, today],
    queryFn:  () => getTyreScrapStats(tenantId),
    enabled:  !!tenantId,
    refetchInterval: 30000,
  });

  const monthProfit = (stats?.monthSaleAmt ?? 0) - (stats?.monthPurchaseAmt ?? 0) - (stats?.monthExpenses ?? 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/tyrescrap/purchase')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white shadow"
            style={{ background: '#16a34a' }}
          >
            <ShoppingCart className="h-4 w-4" /> Buy Tyres
          </button>
          <button
            onClick={() => navigate('/tyrescrap/sales')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white shadow"
            style={{ background: '#2563eb' }}
          >
            <TrendingUp className="h-4 w-4" /> Sell Tyres
          </button>
        </div>
      </div>

      {/* Today stats */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>TODAY</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<TrendingDown size={18} />} bg="#dcfce7" color="#16a34a"
            label="Purchases" value={fmt(stats?.todayPurchaseAmt ?? 0)}
            sub={fmtKg(stats?.todayPurchaseKg ?? 0)} />
          <StatCard icon={<TrendingUp size={18} />} bg="#dbeafe" color="#2563eb"
            label="Sales" value={fmt(stats?.todaySaleAmt ?? 0)}
            sub={fmtKg(stats?.todaySaleKg ?? 0)} />
          <StatCard icon={<Scale size={18} />} bg="#f3e8ff" color="#9333ea"
            label="Stock on Hand" value={fmtKg(stats?.totalStockKg ?? 0)}
            sub="total remaining" />
          <StatCard icon={<BarChart3 size={18} />} bg={monthProfit >= 0 ? '#dcfce7' : '#fee2e2'}
            color={monthProfit >= 0 ? '#16a34a' : '#dc2626'}
            label="Month Profit" value={fmt(monthProfit)}
            sub="sales − purchases − expenses" />
        </div>
      </div>

      {/* This month */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>THIS MONTH</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard icon={<TrendingDown size={18} />} bg="#fef9c3" color="#ca8a04"
            label="Total Purchases" value={fmt(stats?.monthPurchaseAmt ?? 0)} />
          <StatCard icon={<TrendingUp size={18} />} bg="#dbeafe" color="#2563eb"
            label="Total Sales" value={fmt(stats?.monthSaleAmt ?? 0)} />
          <StatCard icon={<Package size={18} />} bg="#fee2e2" color="#dc2626"
            label="Total Expenses" value={fmt(stats?.monthExpenses ?? 0)} />
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>QUICK LINKS</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Stock View', path: '/tyrescrap/stock', bg: '#f3e8ff', color: '#9333ea' },
            { label: 'Vendors', path: '/tyrescrap/vendors', bg: '#fef9c3', color: '#ca8a04' },
            { label: 'Buyers', path: '/tyrescrap/buyers', bg: '#dbeafe', color: '#2563eb' },
            { label: 'Reports', path: '/tyrescrap/reports', bg: '#e0f2fe', color: '#0284c7' },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="rounded-xl p-4 text-left font-semibold text-sm shadow-sm border transition-opacity hover:opacity-80"
              style={{ background: item.bg, color: item.color, borderColor: 'transparent' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
