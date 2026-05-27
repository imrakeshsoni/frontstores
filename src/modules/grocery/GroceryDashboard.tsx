// [grocery] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getSalesSummary, listOrders } from '@/lib/db/orders';
import { getLowStockAlerts } from '@/lib/db/inventory';
import { listKhataCustomers } from '@/lib/db/khata';
import { TrendingUp, ShoppingCart, AlertTriangle, Wallet } from 'lucide-react';

function todayISO() { return new Date().toISOString().slice(0, 10); }

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function GroceryDashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName = useAppStore((s) => s.config?.shop_name ?? 'Grocery Store');
  const today = todayISO();

  const { data: todaySales } = useQuery({
    queryKey: ['grocery-sales-today', tenantId, today],
    queryFn: () => getSalesSummary(tenantId, today, today),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: monthSales } = useQuery({
    queryKey: ['grocery-sales-month', tenantId],
    queryFn: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      return getSalesSummary(tenantId, from, to);
    },
    enabled: !!tenantId,
  });

  const { data: recentOrders = [] } = useQuery({
    queryKey: ['grocery-recent-orders', tenantId],
    queryFn: async () => {
      const r = await listOrders(tenantId, { perPage: 8 });
      return r.items;
    },
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['grocery-low-stock', tenantId],
    queryFn: () => getLowStockAlerts(tenantId),
    enabled: !!tenantId,
  });

  const { data: khataCustomers = [] } = useQuery({
    queryKey: ['grocery-khata', tenantId],
    queryFn: () => listKhataCustomers(tenantId),
    enabled: !!tenantId,
  });

  const totalKhataOutstanding = khataCustomers.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const khataCustomersWithBalance = khataCustomers.filter((c) => c.balance > 0);

  const cashToday = todaySales?.by_payment?.find((p) => p.payment_method === 'cash')?.total ?? 0;
  const upiToday = todaySales?.by_payment?.find((p) => p.payment_method === 'upi')?.total ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={20} />} iconBg="#dcfce7" iconColor="#16a34a"
          label="Today's Sales" value={fmt(todaySales?.total_revenue ?? 0)}
          sub={`${todaySales?.total_orders ?? 0} bills`} />
        <StatCard icon={<ShoppingCart size={20} />} iconBg="#dbeafe" iconColor="#2563eb"
          label="This Month" value={fmt(monthSales?.total_revenue ?? 0)}
          sub={`${monthSales?.total_orders ?? 0} orders`} />
        <StatCard icon={<Wallet size={20} />} iconBg="#f3e8ff" iconColor="#9333ea"
          label="Credit Outstanding" value={fmt(totalKhataOutstanding)}
          sub={`${khataCustomersWithBalance.length} customers`} />
        <StatCard icon={<AlertTriangle size={20} />} iconBg="#fee2e2" iconColor="#dc2626"
          label="Low Stock Items" value={String(lowStock.length)}
          sub={lowStock.length === 0 ? 'All stocked' : 'Need restocking'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's payment breakdown */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Today's Collections</h2>
          {(todaySales?.by_payment?.length ?? 0) === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No bills today yet</p>
          ) : (
            <div className="space-y-3">
              {(todaySales?.by_payment ?? []).map((p) => (
                <div key={p.payment_method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {p.payment_method === 'cash' ? '💵' : p.payment_method === 'upi' ? '📱' : p.payment_method === 'credit' ? '📒' : '💳'}
                    </span>
                    <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{p.payment_method}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{p.count} bills</span>
                  </div>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>{fmt(p.total)}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 flex justify-between font-bold" style={{ borderTop: '1px solid var(--surface-border)' }}>
                <span style={{ color: 'var(--text-primary)' }}>Total</span>
                <span style={{ color: 'var(--accent)' }}>{fmt(todaySales?.total_revenue ?? 0)}</span>
              </div>
            </div>
          )}

          {/* Cash vs UPI bar */}
          {(cashToday > 0 || upiToday > 0) && (
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                <span>💵 Cash {fmt(cashToday)}</span>
                <span>📱 UPI {fmt(upiToday)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full bg-green-500 rounded-l-full transition-all" style={{ width: `${(cashToday / ((cashToday + upiToday) || 1)) * 100}%` }} />
                <div className="h-full bg-blue-500 rounded-r-full transition-all" style={{ width: `${(upiToday / ((cashToday + upiToday) || 1)) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Khata / Credit customers */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Khata — Credit Customers</h2>
          {khataCustomersWithBalance.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No outstanding credit</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {khataCustomersWithBalance.slice(0, 8).map((c) => (
                <div key={c.customer_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#fee2e2', color: '#dc2626' }}>
                      {c.customer_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.customer_name}</span>
                  </div>
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: '#dc2626' }}>{fmt(c.balance)}</span>
                </div>
              ))}
              {khataCustomersWithBalance.length > 8 && (
                <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>+{khataCustomersWithBalance.length - 8} more</p>
              )}
            </div>
          )}
          <div className="mt-4 pt-3 flex justify-between text-sm font-semibold" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total Outstanding</span>
            <span style={{ color: '#dc2626' }}>{fmt(totalKhataOutstanding)}</span>
          </div>
        </div>
      </div>

      {/* Recent bills + low stock side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent bills */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Bills</h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No bills yet today</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{o.bill_number}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {o.customer_name || 'Walk-in'} · {new Date(o.order_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(o.total)}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{o.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Low Stock Alerts</h2>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2" style={{ color: 'var(--text-tertiary)' }}>
              <span className="text-2xl">✅</span>
              <p className="text-sm">All items well stocked</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lowStock.slice(0, 10).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Min: {p.min_stock_qty} {p.unit}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2" style={{ background: '#fee2e2', color: '#dc2626' }}>
                    {p.stock_qty} {p.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, sub }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      </div>
    </div>
  );
}
