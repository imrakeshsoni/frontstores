import { useState } from 'react';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { appCacheDir } from '@tauri-apps/api/path';
import { writeTextFile } from '@tauri-apps/plugin-fs';
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

  // [medical] [all tenants] — A5 invoice print, same format as POS invoice
  const handlePrintOrder = async (order: any) => {
    if (!order?.items) return;
    const s = (config?.settings ?? {}) as any;
    const storeName   = s.invoiceStoreDisplayName || config?.shop_name || 'Store';
    const address     = config?.address_line1 || '';
    const headerLeft  = s.invoiceHeaderLeft  || 'Chemist & Druggist';
    const headerRight = s.invoiceHeaderRight  || 'Cash/Credit Memo';
    const whatsapp    = s.invoiceWhatsappNumber || '';
    const footerNote  = s.invoiceFooterNote   || 'Thanks for your purchase';
    const sigLabel    = s.invoiceSignatureLabel || 'Authorised Signature';
    const dlNumbers   = config?.drug_license_no || '';
    const gstin       = config?.gstin || '';
    const fmtDate     = (d: string) => new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const dateStr     = fmtDate(order.order_date);
    const saleDateStr = order.sale_date ? fmtDate(order.sale_date) : '';

    const itemRows = order.items.map((item: any, idx: number) => {
      const mrp      = Number(item.mrp  || item.unit_price);
      const qty      = Number(item.quantity);
      const value    = mrp * qty;
      const disc     = Number(item.discount || 0);
      const gst      = Number(item.gst_rate || 0);
      const total    = Number(item.total);
      const hsn = item.hsn_code ? ` · HSN: ${item.hsn_code}` : '';
      return `<tr>
        <td class="td-center">${idx + 1}</td>
        <td class="td-name">${item.product_name}${item.batch_no || item.hsn_code ? `<br><span style="font-size:9px;color:#64748b">${item.batch_no ? `Batch: ${item.batch_no}` : ''}${hsn}</span>` : ''}</td>
        <td class="td-center">${qty}</td>
        <td class="td-amount">${mrp.toFixed(2)}</td>
        <td class="td-amount">${value.toFixed(2)}</td>
        <td class="td-center">${gst > 0 ? `${gst}%` : '-'}</td>
        <td class="td-amount">${disc > 0 ? disc.toFixed(2) : '-'}</td>
        <td class="td-amount">${total.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${order.bill_number}</title>
<style>
  @page { size: A5 portrait; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e3a8a; background: white; }
  .invoice { border: 2px solid #1e3a8a; width: 100%; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 14px; border-bottom: 2px solid #1e3a8a; font-weight: 600; font-size: 11px; }
  .hdr-right { text-align: right; }
  .banner { text-align: center; padding: 8px 14px; border-bottom: 2px solid #1e3a8a; }
  .store-name { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .store-addr { font-size: 10px; font-weight: 600; margin-top: 2px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; padding: 7px 14px; border-bottom: 2px solid #1e3a8a; font-size: 10px; }
  .meta span { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { padding: 6px 8px; border-bottom: 2px solid #1e3a8a; font-weight: 700; text-align: left; background: white; }
  th.th-amount { text-align: right; }
  td { padding: 5px 8px; border-bottom: 1px solid #bfdbfe; vertical-align: top; }
  td.td-center { text-align: center; border-left: 1px solid #bfdbfe; }
  td.td-amount { text-align: right; font-weight: 700; white-space: nowrap; border-left: 1px solid #bfdbfe; }
  td.td-name { border-right: none; }
  .total-row td { border-top: 2px solid #1e3a8a; border-bottom: none; font-weight: 700; padding: 6px 8px; }
  .total-label { text-align: right; }
  .total-value { text-align: right; font-size: 13px; font-weight: 900; white-space: nowrap; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; padding: 10px 14px 8px; }
  .footer-note { font-size: 10px; font-weight: 600; max-width: 55%; }
  .sig-block { text-align: right; font-size: 10px; font-weight: 600; min-width: 100px; }
  .sig-line { border-top: 1px solid #1e3a8a; margin-top: 28px; padding-top: 3px; }
</style>
</head><body>
<div class="invoice">
  <div class="hdr">
    <div>${headerLeft.replace(/\n/g, '<br>')}</div>
    <div class="hdr-right"><div>${headerRight}</div>${whatsapp ? `<div>${whatsapp}</div>` : ''}</div>
  </div>
  <div class="banner">
    <div class="store-name">${storeName}</div>
    ${address ? `<div class="store-addr">${address}</div>` : ''}
  </div>
  <div class="meta">
    <div><span>DL No.</span> ${dlNumbers || '-'}</div>
    ${gstin ? `<div><span>GSTIN.</span> ${gstin}</div>` : ''}
    <div><span>Invoice Date.</span> ${dateStr}</div>
    ${saleDateStr ? `<div><span>Sale Date.</span> ${saleDateStr}</div>` : ''}
    <div><span>Patient.</span> ${order.patient_name || order.customer_name || '-'}</div>
    <div><span>Doctor.</span> ${order.doctor_name || '-'}</div>
    <div><span>Bill No.</span> ${order.bill_number}</div>
    <div><span>Payment.</span> ${order.payment_method === 'credit' ? 'Credit' : (order.payment_method || 'Cash').toUpperCase()}</div>
  </div>
  <table>
    <thead><tr>
      <th style="width:5%;text-align:center">Sr.</th>
      <th style="width:27%">Product</th>
      <th style="width:10%;text-align:center;border-left:1px solid #bfdbfe">Qty</th>
      <th class="th-amount" style="width:12%;border-left:1px solid #bfdbfe">MRP</th>
      <th class="th-amount" style="width:12%;border-left:1px solid #bfdbfe">Value</th>
      <th style="width:8%;text-align:center;border-left:1px solid #bfdbfe">GST%</th>
      <th class="th-amount" style="width:10%;border-left:1px solid #bfdbfe">Disc</th>
      <th class="th-amount" style="width:12%;border-left:1px solid #bfdbfe">Amount</th>
    </tr></thead>
    <tbody>
      ${itemRows}
      ${Number(order.discount) > 0 ? `<tr><td colspan="6" rowspan="${Number(order.tax_total) > 0 ? 4 : 2}" style="vertical-align:bottom;border-right:none">${footerNote}</td><td class="total-label">Taxable</td><td class="td-amount">${(Number(order.subtotal) + Number(order.discount)).toFixed(2)}</td></tr>
      <tr><td class="total-label">Discount</td><td class="td-amount">- ${Number(order.discount).toFixed(2)}</td></tr>` : `<tr><td colspan="6" rowspan="${Number(order.tax_total) > 0 ? 3 : 1}" style="vertical-align:bottom;border-right:none">${footerNote}</td><td class="total-label">Taxable</td><td class="td-amount">${Number(order.subtotal).toFixed(2)}</td></tr>`}
      ${Number(order.tax_total) > 0 ? `<tr><td class="total-label">CGST</td><td class="td-amount">${(Number(order.tax_total) / 2).toFixed(2)}</td></tr>
      <tr><td class="total-label">SGST</td><td class="td-amount">${(Number(order.tax_total) / 2).toFixed(2)}</td></tr>` : ''}
      <tr class="total-row">
        <td class="total-label">Total ₹</td>
        <td class="total-value">${Number(order.total).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <div class="footer-note">* Goods once sold will not be taken back</div>
    <div class="sig-block"><div class="sig-line">${sigLabel}</div></div>
  </div>
</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});<\/script>
</body></html>`;

    try {
      const cacheDir = await appCacheDir();
      const sep = cacheDir.endsWith('/') ? '' : '/';
      const filePath = `${cacheDir}${sep}frontstores-print-${Date.now()}.html`;
      await writeTextFile(filePath, html);
      await shellOpen(filePath);
    } catch (err: any) {
      toast.error('Could not open print: ' + (err?.message ?? err));
    }
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
                        <button className="rounded-full bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"
                          title="Print invoice"
                          onClick={async () => {
                            const full = await getOrderWithItems(tenantId, o.id);
                            if (full) handlePrintOrder(full);
                          }}>
                          <Printer className="h-3.5 w-3.5" />
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
              <div className="flex justify-between"><span className="text-slate-500">Invoice Date</span><span>{format(new Date(selectedOrder.order_date), 'dd MMM yyyy, HH:mm')}</span></div>
              {selectedOrder.sale_date && <div className="flex justify-between"><span className="text-slate-500">Sale Date</span><span>{format(new Date(selectedOrder.sale_date), 'dd MMM yyyy, HH:mm')}</span></div>}
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
              {/* subtotal is stored net of discount, so show gross here to keep the breakdown reconciling to Total */}
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(selectedOrder.subtotal + selectedOrder.discount)}</span></div>
              {selectedOrder.discount > 0 && <div className="flex justify-between text-rose-600"><span>Discount</span><span>- {formatCurrency(selectedOrder.discount)}</span></div>}
              {selectedOrder.tax_total > 0 && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">CGST</span><span>{formatCurrency(selectedOrder.tax_total / 2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">SGST</span><span>{formatCurrency(selectedOrder.tax_total / 2)}</span></div>
                </>
              )}
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
