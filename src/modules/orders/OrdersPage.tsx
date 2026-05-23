import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Search, Eye, Ban, Printer, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listOrders, getOrderWithItems, voidOrder } from '@/lib/db/orders';
import { PageIntro } from '@/components/ui/PageIntro';

export function OrdersPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', tenantId, page, search, paymentMethod],
    queryFn: () => listOrders(tenantId, { search, page, perPage: 30, paymentMethod: paymentMethod || undefined }),
    enabled: !!tenantId,
  });

  const { data: selectedOrder, isFetching: isFetchingOrder } = useQuery({
    queryKey: ['order-detail', selectedOrderId, tenantId],
    queryFn: () => getOrderWithItems(tenantId, selectedOrderId!),
    enabled: !!selectedOrderId,
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId) throw new Error('Select an order to void');
      await voidOrder(tenantId, selectedOrderId);
    },
    onSuccess: () => {
      toast.success('Order voided and stock restored');
      setVoidReason('');
      setShowVoidConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail', selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['today-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-summary'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Unable to void order'),
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 30));

  const handlePrintOrder = (order: any) => {
    if (!order?.items) return;
    const settings = (config?.settings ?? {}) as any;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { toast.error('Unable to open print window'); return; }

    const itemRows = order.items.map((item: any, idx: number) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.product_name}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${item.unit_price.toFixed(2)}</td>
        <td style="text-align:right">${item.total.toFixed(2)}</td>
      </tr>`).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <style>
        body { font-family: Arial; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 14px; text-align: right; margin-top: 10px; }
      </style></head><body>
      <h2>${settings.invoiceStoreDisplayName || config?.shop_name || 'Store'}</h2>
      <p>Bill No: <strong>${order.bill_number}</strong></p>
      <p>Date: ${format(new Date(order.order_date), 'dd MMM yyyy HH:mm')}</p>
      ${order.customer_name ? `<p>Customer: ${order.customer_name}</p>` : ''}
      <table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody></table>
      <div class="total">Total: ₹${order.total.toFixed(2)}</div>
      <p>Payment: ${order.payment_method}</p>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Orders"
        title="Every bill, every transaction."
        description="Review your billing history, view invoice details, and void incorrect orders."
      />

      <div className="card p-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by bill number, customer…" className="input pl-11" />
          </div>
          <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">All payment types</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><div className="h-4 rounded bg-slate-200 animate-pulse" /></td>
                  ))}</tr>
                ))}
                {!isLoading && items.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-500">No orders found</td></tr>
                )}
                {items.map((o) => (
                  <tr key={o.id} className={selectedOrderId === o.id ? 'bg-blue-50' : ''}>
                    <td className="font-mono font-semibold text-blue-700">{o.bill_number}</td>
                    <td className="text-slate-700">{o.customer_name ?? 'Walk-in'}</td>
                    <td className="text-slate-500 whitespace-nowrap">{format(new Date(o.order_date), 'dd MMM, HH:mm')}</td>
                    <td className="text-right font-semibold">{formatCurrency(o.total)}</td>
                    <td><span className="chip capitalize">{o.payment_method}</span></td>
                    <td>
                      <span className={`badge ${o.payment_status === 'cancelled' ? 'badge-red' : o.payment_status === 'paid' ? 'badge-green' : 'badge-blue'}`}>
                        {o.payment_status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="rounded-full bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100"
                          onClick={() => setSelectedOrderId(selectedOrderId === o.id ? null : o.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {o.payment_status !== 'cancelled' && (
                          <button className="rounded-full bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                            onClick={() => { setSelectedOrderId(o.id); setShowVoidConfirm(true); }}>
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order detail panel */}
        {selectedOrder && (
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="section-label">Invoice</p>
                <p className="font-mono text-lg font-bold text-blue-700">{selectedOrder.bill_number}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" onClick={() => handlePrintOrder(selectedOrder)}>
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
                <button className="btn-secondary text-xs" onClick={() => setSelectedOrderId(null)}>✕</button>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{format(new Date(selectedOrder.order_date), 'dd MMM yyyy, HH:mm')}</span></div>
              {selectedOrder.customer_name && <div className="flex justify-between"><span className="text-slate-500">Customer</span><span>{selectedOrder.customer_name}</span></div>}
              {selectedOrder.patient_name && <div className="flex justify-between"><span className="text-slate-500">Patient</span><span>{selectedOrder.patient_name}</span></div>}
              {selectedOrder.doctor_name && <div className="flex justify-between"><span className="text-slate-500">Doctor</span><span>{selectedOrder.doctor_name}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Payment</span><span className="capitalize">{selectedOrder.payment_method}</span></div>
            </div>
            <div className="mt-4 space-y-1 border-t pt-4">
              {(selectedOrder.items ?? []).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    {item.batch_no && <p className="text-xs text-slate-400">Batch: {item.batch_no}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p>{item.quantity} × ₹{item.unit_price.toFixed(2)}</p>
                    <p className="font-semibold">₹{item.total.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t pt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span></div>
              {selectedOrder.discount > 0 && <div className="flex justify-between text-rose-600"><span>Discount</span><span>- {formatCurrency(selectedOrder.discount)}</span></div>}
              {selectedOrder.tax_total > 0 && <div className="flex justify-between"><span className="text-slate-500">Tax (GST)</span><span>{formatCurrency(selectedOrder.tax_total)}</span></div>}
              <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div>
            </div>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} orders · Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Void confirm modal */}
      {showVoidConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong w-full max-w-md rounded-[2rem] p-6">
            <h2 className="text-xl mb-2">Void Order?</h2>
            <p className="text-sm text-slate-500 mb-4">This will cancel the order and restore stock. This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowVoidConfirm(false)}>Cancel</button>
              <button className="btn-primary bg-rose-500 hover:bg-rose-600"
                onClick={() => voidMutation.mutate()} disabled={voidMutation.isPending}>
                {voidMutation.isPending ? 'Voiding…' : 'Void Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
