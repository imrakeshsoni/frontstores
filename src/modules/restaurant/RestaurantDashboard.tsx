// [restaurant] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getRestaurantSummary, getTopMenuItems, listTables } from '@/lib/db/restaurant';
import { TrendingUp, ShoppingBag, Users, Star } from 'lucide-react';

function todayRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
  return { start, end };
}

function monthRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { start, end };
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function RestaurantDashboard() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName = useAppStore((s) => s.config?.shop_name ?? 'Restaurant');
  const { start: todayStart, end: todayEnd } = todayRange();
  const { start: monthStart, end: monthEnd } = monthRange();

  const { data: todaySummary } = useQuery({
    queryKey: ['restaurant-summary-today', tenantId],
    queryFn: () => getRestaurantSummary(tenantId, todayStart, todayEnd),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: monthSummary } = useQuery({
    queryKey: ['restaurant-summary-month', tenantId],
    queryFn: () => getRestaurantSummary(tenantId, monthStart, monthEnd),
    enabled: !!tenantId,
  });

  const { data: topItems = [] } = useQuery({
    queryKey: ['restaurant-top-items', tenantId],
    queryFn: () => getTopMenuItems(tenantId, monthStart, monthEnd, 8),
    enabled: !!tenantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['restaurant-tables', tenantId],
    queryFn: () => listTables(tenantId),
    enabled: !!tenantId,
    refetchInterval: 10000,
  });

  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const avgOrderValue = todaySummary && todaySummary.total_orders > 0
    ? todaySummary.total_revenue / todaySummary.total_orders
    : 0;

  const byType = todaySummary?.by_type ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{shopName}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp size={20} />}
          iconBg="#dcfce7" iconColor="#16a34a"
          label="Today's Revenue"
          value={fmt(todaySummary?.total_revenue ?? 0)}
        />
        <StatCard
          icon={<ShoppingBag size={20} />}
          iconBg="#dbeafe" iconColor="#2563eb"
          label="Orders Today"
          value={String(todaySummary?.total_orders ?? 0)}
        />
        <StatCard
          icon={<Star size={20} />}
          iconBg="#ffedd5" iconColor="#ea580c"
          label="Avg Order Value"
          value={fmt(avgOrderValue)}
        />
        <StatCard
          icon={<Users size={20} />}
          iconBg="#f3e8ff" iconColor="#9333ea"
          label="Tables Occupied"
          value={`${occupiedCount} / ${tables.length}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today breakdown by type */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Today by Order Type</h2>
          {byType.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No settled orders today yet</p>
          ) : (
            <div className="space-y-3">
              {byType.map((t) => (
                <div key={t.order_type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.order_type}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{t.count} orders</span>
                  </div>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>{fmt(t.revenue)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>This Month</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(monthSummary?.total_revenue ?? 0)} · {monthSummary?.total_orders ?? 0} orders</span>
            </div>
          </div>
        </div>

        {/* Top items this month */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Top Items This Month</h2>
          {topItems.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>
          ) : (
            <div className="space-y-2">
              {topItems.map((item, idx) => (
                <div key={item.item_name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--text-tertiary)' }}>#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.item_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.total_qty} sold · {fmt(item.total_revenue)}</p>
                  </div>
                  {/* Mini bar */}
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((item.total_qty / (topItems[0]?.total_qty || 1)) * 100)}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live tables */}
      {tables.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Live Tables</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {tables.map((table) => (
              <div
                key={table.id}
                className="rounded-xl p-3 text-center"
                style={{
                  background: table.status === 'occupied' ? '#fef3c7' : 'var(--surface-2)',
                  border: `1px solid ${table.status === 'occupied' ? '#f59e0b' : 'var(--surface-border)'}`,
                }}
              >
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{table.name}</p>
                <p className="text-xs mt-0.5" style={{ color: table.status === 'occupied' ? '#d97706' : 'var(--text-tertiary)' }}>
                  {table.status === 'occupied' ? `₹${table.open_total.toFixed(0)}` : 'Free'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
    </div>
  );
}
