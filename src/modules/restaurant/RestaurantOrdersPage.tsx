// [restaurant] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { listRestaurantOrders, getOrderWithItems, type RestaurantOrder, type RestaurantOrderItem } from '@/lib/db/restaurant';
import { Receipt, ChevronDown, ChevronUp } from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month';

function getDateRange(filter: DateFilter): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;
  const today = fmt(now);
  const tomorrow = fmt(new Date(now.getTime() + 86400000));

  if (filter === 'today') return { from: today, to: tomorrow };
  if (filter === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return { from: fmt(weekAgo), to: tomorrow };
  }
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return { from: fmt(monthAgo), to: tomorrow };
}

const PAYMENT_BADGE: Record<string, { bg: string; text: string }> = {
  cash: { bg: '#dcfce7', text: '#166534' },
  upi:  { bg: '#dbeafe', text: '#1e40af' },
  card: { bg: '#ede9fe', text: '#5b21b6' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  settled:   { bg: '#dcfce7', text: '#166534' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
  open:      { bg: '#fef9c3', text: '#854d0e' },
};

export function RestaurantOrdersPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [filter, setFilter] = useState<DateFilter>('today');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, RestaurantOrderItem[]>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-orders', tenantId, filter, page],
    queryFn: () => listRestaurantOrders(tenantId, { page, perPage: 30 }),
    enabled: !!tenantId,
  });

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 30));

  // Filter client-side by date range since we don't want to add extra DB complexity
  const { from } = getDateRange(filter);
  const filtered = orders.filter((o) => o.created_at >= from);

  async function toggleExpand(order: RestaurantOrder) {
    if (expandedId === order.id) {
      setExpandedId(null);
      return;
    }
    if (!expandedData[order.id]) {
      const { items } = await getOrderWithItems(tenantId, order.id);
      setExpandedData((d) => ({ ...d, [order.id]: items }));
    }
    setExpandedId(order.id);
  }

  const fmt = (n: number) => `₹${n.toFixed(2)}`;

  const totalRevenue = filtered.filter((o) => o.status === 'settled').reduce((s, o) => s + o.total, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between flex-wrap gap-4"
        style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Order History</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {filtered.length} orders · Revenue: <strong style={{ color: 'var(--accent)' }}>{fmt(totalRevenue)}</strong>
          </p>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
          {(['today', 'week', 'month'] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                background: filter === f ? 'var(--accent)' : 'transparent',
                color: filter === f ? 'white' : 'var(--text-secondary)',
              }}
            >
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-64 gap-4"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Receipt className="h-16 w-16 opacity-20" />
            <p className="text-sm">No orders for this period</p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((order) => {
            const sc = STATUS_BADGE[order.status] ?? STATUS_BADGE.open;
            const pm = order.payment_method ? (PAYMENT_BADGE[order.payment_method] ?? PAYMENT_BADGE.cash) : null;
            const isExpanded = expandedId === order.id;
            const items = expandedData[order.id] ?? [];

            return (
              <div
                key={order.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--surface-border)', background: 'var(--surface)' }}
              >
                <button
                  onClick={() => toggleExpand(order)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {order.order_number}
                        </p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {order.status}
                        </span>
                        {order.payment_method && pm && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium uppercase"
                            style={{ background: pm.bg, color: pm.text }}
                          >
                            {order.payment_method}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {order.table_name ?? order.order_type}
                        {order.customer_name && ` · ${order.customer_name}`}
                        {' · '}
                        {new Date(order.created_at.replace(' ', 'T')).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="font-bold text-base" style={{ color: 'var(--accent)' }}>
                      {fmt(order.total)}
                    </p>
                    {isExpanded
                      ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} />
                      : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />
                    }
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--surface-border)' }}>
                    {/* Financials */}
                    <div
                      className="grid grid-cols-3 gap-4 px-4 py-3 text-xs"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div>
                        <p style={{ color: 'var(--text-tertiary)' }}>Subtotal</p>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(order.subtotal)}</p>
                      </div>
                      <div>
                        <p style={{ color: 'var(--text-tertiary)' }}>Tax</p>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(order.tax_total)}</p>
                      </div>
                      {order.discount > 0 && (
                        <div>
                          <p style={{ color: 'var(--text-tertiary)' }}>Discount</p>
                          <p className="font-semibold" style={{ color: '#dc2626' }}>−{fmt(order.discount)}</p>
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    <div className="px-4 py-2">
                      {items.length === 0 && (
                        <p className="text-xs text-center py-2" style={{ color: 'var(--text-tertiary)' }}>
                          Loading items…
                        </p>
                      )}
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-1.5"
                          style={{ borderBottom: '1px solid var(--surface-border)' }}
                        >
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {item.quantity}× {item.item_name}
                            {item.variant && (
                              <span className="text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>
                                ({item.variant})
                              </span>
                            )}
                          </p>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {fmt(item.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {total > 30 && (
          <div className="flex items-center justify-between mt-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
