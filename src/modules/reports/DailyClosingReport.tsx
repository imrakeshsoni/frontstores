import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, Printer } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listOrders } from '@/lib/db/orders';
import { getDb } from '@/lib/db/index';

async function getDailyStats(tenantId: string, date: string) {
  const db = await getDb();
  const orders = await listOrders(tenantId, { from: date, to: date, perPage: 999 });
  const items = orders.items;

  const totalRevenue = items.reduce((s, o) => s + Number(o.total), 0);
  const totalDiscount = items.reduce((s, o) => s + Number(o.discount), 0);
  const totalTax = items.reduce((s, o) => s + Number(o.tax_total), 0);
  const totalOrders = items.length;

  const byPayment: Record<string, number> = {};
  for (const o of items) {
    const m = o.payment_method ?? 'cash';
    byPayment[m] = (byPayment[m] ?? 0) + Number(o.total);
  }

  // Top selling medicines
  const topMeds = await db.select<{ name: string; qty: number; revenue: number }[]>(
    `SELECT oi.product_name as name, SUM(oi.quantity) as qty, SUM(oi.total) as revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.tenant_id = ? AND o.deleted_at IS NULL AND DATE(o.order_date) = ?
     GROUP BY oi.product_name ORDER BY qty DESC LIMIT 10`,
    [tenantId, date]
  );

  // Prescription count
  const [{ pCount }] = await db.select<{ pCount: number }[]>(
    `SELECT COUNT(*) as pCount FROM orders WHERE tenant_id = ? AND deleted_at IS NULL AND DATE(order_date) = ? AND patient_name IS NOT NULL AND patient_name != ''`,
    [tenantId, date]
  );

  return { totalRevenue, totalDiscount, totalTax, totalOrders, byPayment, topMeds, prescriptionCount: pCount };
}

interface Props { onClose: () => void }

export function DailyClosingReport({ onClose }: Props) {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const today = format(new Date(), 'yyyy-MM-dd');
  const displayDate = format(new Date(), 'dd MMMM yyyy');

  const { data, isLoading } = useQuery({
    queryKey: ['daily-closing', tenantId, today],
    queryFn: () => getDailyStats(tenantId, today),
    enabled: !!tenantId,
  });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  function handlePrint() {
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Daily Closing Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:13px}
      h1{font-size:18px;margin:0 0 4px}
      h2{font-size:14px;margin:16px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
      .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0}
      .row.total{font-weight:bold;font-size:15px;border-top:2px solid #333;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;font-size:12px}
      th{background:#f5f5f5;font-weight:600}
      .footer{margin-top:32px;text-align:center;font-size:11px;color:#888}
    </style></head><body>
    <h1>${config?.shop_name}</h1>
    <p style="color:#555;margin:0">Daily Closing Report — ${displayDate}</p>
    <h2>Sales Summary</h2>
    <div class="row"><span>Total Orders</span><span>${data?.totalOrders}</span></div>
    <div class="row"><span>Gross Revenue</span><span>${fmt(data?.totalRevenue ?? 0)}</span></div>
    <div class="row"><span>Total Discount</span><span>- ${fmt(data?.totalDiscount ?? 0)}</span></div>
    <div class="row"><span>Total Tax (GST)</span><span>${fmt(data?.totalTax ?? 0)}</span></div>
    <div class="row total"><span>Net Collection</span><span>${fmt((data?.totalRevenue ?? 0))}</span></div>
    <h2>Collection by Payment Method</h2>
    ${Object.entries(data?.byPayment ?? {}).map(([m, v]) => `<div class="row"><span style="text-transform:capitalize">${m}</span><span>${fmt(v)}</span></div>`).join('')}
    <h2>Top Selling Medicines</h2>
    <table><thead><tr><th>#</th><th>Medicine</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>
    ${(data?.topMeds ?? []).map((m, i) => `<tr><td>${i + 1}</td><td>${m.name}</td><td>${m.qty}</td><td>${fmt(m.revenue)}</td></tr>`).join('')}
    </tbody></table>
    <div class="footer">Generated at ${new Date().toLocaleTimeString('en-IN')} · FrontStores</div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white">Daily Closing Report</h3>
            <p className="text-xs text-slate-400">{displayDate}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5"><Printer size={14} /> Print</button>
            <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Orders', value: String(data?.totalOrders ?? 0) },
                { label: 'Prescriptions', value: String(data?.prescriptionCount ?? 0) },
                { label: 'Total Revenue', value: fmt(data?.totalRevenue ?? 0) },
                { label: 'Total Discount', value: fmt(data?.totalDiscount ?? 0) },
              ].map(card => (
                <div key={card.label} className="bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-400">{card.label}</p>
                  <p className="text-lg font-bold text-white mt-1">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Payment breakdown */}
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Collection by Method</p>
              <div className="space-y-1">
                {Object.entries(data?.byPayment ?? {}).map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-sm py-1.5 border-b border-slate-800">
                    <span className="text-slate-300 capitalize">{method}</span>
                    <span className="text-white font-medium">{fmt(amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 font-bold">
                  <span className="text-white">Net Total</span>
                  <span className="text-green-400 text-base">{fmt(data?.totalRevenue ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Top medicines */}
            {(data?.topMeds?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Top Medicines Today</p>
                <div className="space-y-1">
                  {data!.topMeds.slice(0, 8).map((m, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-800/50">
                      <span className="text-slate-300 truncate flex-1 mr-4">{i + 1}. {m.name}</span>
                      <span className="text-slate-400 text-xs mr-3">×{m.qty}</span>
                      <span className="text-white font-medium">{fmt(m.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
