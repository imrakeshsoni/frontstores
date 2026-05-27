// [restaurant] [all tenants]
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { getKitchenItems, updateOrderItemKotStatus, type KitchenItem } from '@/lib/db/restaurant';
import { ChefHat } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: '#fef9c3', text: '#854d0e', label: 'Pending' },
  preparing: { bg: '#dbeafe', text: '#1e40af', label: 'Preparing' },
  served:    { bg: '#dcfce7', text: '#166534', label: 'Served' },
};

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso.replace(' ', 'T')).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  return `${mins} mins ago`;
}

function groupByOrder(items: KitchenItem[]): Map<string, KitchenItem[]> {
  const map = new Map<string, KitchenItem[]>();
  for (const item of items) {
    if (!map.has(item.order_id)) map.set(item.order_id, []);
    map.get(item.order_id)!.push(item);
  }
  return map;
}

export function KitchenPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const { data: kitchenItems = [], isLoading } = useQuery({
    queryKey: ['kitchen-items', tenantId],
    queryFn: () => getKitchenItems(tenantId),
    enabled: !!tenantId,
    refetchInterval: 10000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'preparing' | 'served' }) =>
      updateOrderItemKotStatus(tenantId, id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen-items', tenantId] });
      qc.invalidateQueries({ queryKey: ['restaurant-orders', tenantId] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const grouped = groupByOrder(kitchenItems);
  const orderIds = Array.from(grouped.keys());

  if (isLoading) {
    return (
      <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Kitchen Display</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Auto-refreshes every 10 seconds · {kitchenItems.length} item{kitchenItems.length !== 1 ? 's' : ''} pending
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: '#dcfce7', color: '#166534' }}
        >
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse inline-block" />
          Live
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {orderIds.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-64 gap-4"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <ChefHat className="h-16 w-16 opacity-20" />
            <p className="text-sm font-medium">All caught up! No pending items.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderIds.map((orderId) => {
            const items = grouped.get(orderId)!;
            const first = items[0];
            const allPreparing = items.every((i) => i.kot_status === 'preparing');
            const allPending = items.every((i) => i.kot_status === 'pending');

            return (
              <div
                key={orderId}
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--surface-border)', background: 'var(--surface)' }}
              >
                {/* Card header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    background: allPending ? '#fef9c3' : allPreparing ? '#dbeafe' : 'var(--surface-2)',
                    borderBottom: '1px solid var(--surface-border)',
                  }}
                >
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {first.table_name ?? 'Order'} · {first.order_number}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {timeSince(first.created_at)}
                    </p>
                  </div>
                  {/* Bulk action */}
                  {allPending && (
                    <button
                      onClick={() => items.forEach((i) => statusMutation.mutate({ id: i.id, status: 'preparing' }))}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                      style={{ background: '#1e40af', color: 'white' }}
                    >
                      Start All
                    </button>
                  )}
                  {allPreparing && (
                    <button
                      onClick={() => items.forEach((i) => statusMutation.mutate({ id: i.id, status: 'served' }))}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                      style={{ background: '#166534', color: 'white' }}
                    >
                      Serve All
                    </button>
                  )}
                </div>

                {/* Items */}
                <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
                  {items.map((item) => {
                    const sc = STATUS_COLOR[item.kot_status] ?? STATUS_COLOR.pending;
                    return (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {item.quantity}× {item.item_name}
                            {item.variant && (
                              <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>
                                ({item.variant})
                              </span>
                            )}
                          </p>
                          {item.notes && (
                            <p className="text-xs mt-0.5" style={{ color: '#d97706' }}>
                              Note: {item.notes}
                            </p>
                          )}
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {timeSince(item.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 ml-3 flex-shrink-0">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            {sc.label}
                          </span>
                          {item.kot_status === 'pending' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: item.id, status: 'preparing' })}
                              className="text-xs px-2 py-0.5 rounded-full font-medium transition-all"
                              style={{ background: '#dbeafe', color: '#1e40af' }}
                              disabled={statusMutation.isPending}
                            >
                              Start
                            </button>
                          )}
                          {item.kot_status === 'preparing' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: item.id, status: 'served' })}
                              className="text-xs px-2 py-0.5 rounded-full font-medium transition-all"
                              style={{ background: '#dcfce7', color: '#166534' }}
                              disabled={statusMutation.isPending}
                            >
                              Served
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
