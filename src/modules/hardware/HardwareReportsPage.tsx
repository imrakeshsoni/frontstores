// [hardware] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, AlertTriangle, BookOpen, Receipt, Download } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listHwSales, listHwProducts, listHwCreditAccounts, getHardwareStats,
  getHwProfitAndGstSummary, getHwTopProducts, getHwCategoryMix,
} from '@/lib/db/hardware';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmt2(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonthISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type View = 'sales' | 'gst' | 'stock' | 'credit';

export function HardwareReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [view, setView] = useState<View>('sales');

  const { data: stats } = useQuery({
    queryKey: ['hw-stats', tenantId],
    queryFn: () => getHardwareStats(tenantId),
    enabled: !!tenantId,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['hw-sales-report', tenantId, from, to],
    queryFn: () => listHwSales(tenantId, { from, to }),
    enabled: !!tenantId,
  });

  const { data: profitSummary } = useQuery({
    queryKey: ['hw-profit-gst', tenantId, from, to],
    queryFn: () => getHwProfitAndGstSummary(tenantId, { from, to }),
    enabled: !!tenantId && (view === 'gst' || view === 'sales'),
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['hw-top-products-report', tenantId, from, to],
    queryFn: () => getHwTopProducts(tenantId, { from, to, limit: 8 }),
    enabled: !!tenantId && view === 'sales',
  });

  const { data: categoryMix = [] } = useQuery({
    queryKey: ['hw-category-mix-report', tenantId, from, to],
    queryFn: () => getHwCategoryMix(tenantId, { from, to, limit: 8 }),
    enabled: !!tenantId && view === 'sales',
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['hw-low-stock', tenantId],
    queryFn: () => listHwProducts(tenantId, { lowStock: true }),
    enabled: !!tenantId && view === 'stock',
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['hw-products-all', tenantId],
    queryFn: () => listHwProducts(tenantId, {}),
    enabled: !!tenantId && view === 'stock',
  });

  const { data: creditAccounts = [] } = useQuery({
    queryKey: ['hw-credit-accounts-report', tenantId],
    queryFn: () => listHwCreditAccounts(tenantId),
    enabled: !!tenantId && view === 'credit',
  });

  const totalSalesRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalPaid = sales.reduce((s, sale) => s + sale.paid, 0);
  const totalDue = totalSalesRevenue - totalPaid;
  const totalCreditOutstanding = creditAccounts.reduce((s, a) => s + a.balance, 0);
  const stockValuation = allProducts.reduce((s, p) => s + p.stock * p.purchase_price, 0);

  function exportSalesCSV() {
    const rows = [
      ['Bill No', 'Date', 'Customer', 'Subtotal', 'Discount', 'GST', 'Total', 'Paid', 'Balance', 'Payment Mode'],
      ...sales.map(s => [s.bill_no, s.sale_date, s.customer_name || 'Walk-in', s.subtotal.toFixed(2), s.discount.toFixed(2), s.tax_total.toFixed(2), s.total.toFixed(2), s.paid.toFixed(2), (s.total - s.paid).toFixed(2), s.payment_mode]),
    ];
    downloadCSV(`hardware-sales-${from}-to-${to}.csv`, rows);
  }

  function exportStockCSV() {
    const rows = [
      ['Name', 'Category', 'Brand', 'Variant', 'Stock', 'Unit', 'Min Stock', 'Purchase Price', 'Selling Price', 'Stock Value', 'GST Rate'],
      ...allProducts.map(p => [p.name, p.category, p.brand, p.variant, String(p.stock), p.unit, String(p.min_stock), p.purchase_price.toFixed(2), p.selling_price.toFixed(2), (p.stock * p.purchase_price).toFixed(2), String(p.gst_rate)]),
    ];
    downloadCSV('hardware-stock-valuation.csv', rows);
  }

  const TABS: { key: View; label: string; icon: typeof BarChart3 }[] = [
    { key: 'sales', label: 'Sales', icon: BarChart3 },
    { key: 'gst', label: 'GST & Profit', icon: Receipt },
    { key: 'stock', label: 'Stock', icon: AlertTriangle },
    { key: 'credit', label: 'Credit Accounts', icon: BookOpen },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Today's Sales", value: stats?.todaySales ?? 0, suffix: ' bills', color: '#2563eb', bg: '#dbeafe' },
          { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), color: '#16a34a', bg: '#dcfce7' },
          { label: 'Low Stock', value: stats?.lowStockCount ?? 0, suffix: ' items', color: '#2563eb', bg: '#dbeafe' },
          { label: 'Credit Due', value: fmt(stats?.creditOutstanding ?? 0), color: '#dc2626', bg: '#fee2e2' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: c.color }}>
              {c.value}{c.suffix ?? ''}
            </p>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={view === tab.key
              ? { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', boxShadow: '0 2px 8px -2px rgba(37,99,235,0.4)' }
              : { background: '#f1f5f9', color: '#64748b' }}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sales view */}
      {view === 'sales' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Sales — {from} to {to}</h2>
            <button onClick={exportSalesCSV} disabled={sales.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', value: fmt(totalSalesRevenue), color: '#16a34a' },
              { label: 'Collected', value: fmt(totalPaid), color: '#2563eb' },
              { label: 'Balance Due', value: fmt(totalDue), color: '#dc2626' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-slate-100 p-4">
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" /> Top Products</h3>
              {topProducts.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No sales in range</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={p.product_id || i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-slate-400 w-5">{i + 1}.</span>
                        <p className="font-medium text-slate-800 truncate">{p.product_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-slate-900">{fmt(p.revenue)}</p>
                        <p className="text-xs text-slate-400">{p.quantity} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Category Mix</h3>
              {categoryMix.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No sales in range</p>
              ) : (
                <div className="space-y-2">
                  {categoryMix.map(c => {
                    const pct = totalSalesRevenue > 0 ? (c.revenue / totalSalesRevenue) * 100 : 0;
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-800">{c.category}</span>
                          <span className="text-slate-500">{fmt(c.revenue)} · {pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Bills</h2>
            {sales.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No sales in this range</p>
            ) : (
              <div className="space-y-2">
                {sales.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-800">#{s.bill_no} — {s.customer_name || 'Walk-in'}</p>
                      <p className="text-xs text-slate-400">{s.sale_date} · {s.payment_mode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{fmt(s.total)}</p>
                      {s.paid < s.total && <p className="text-xs text-red-500">due: {fmt(s.total - s.paid)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GST & Profit view */}
      {view === 'gst' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
              <p className="text-xs text-slate-500">Revenue (incl. GST)</p>
              <p className="text-xl font-bold mt-1 text-slate-900">{fmt2(profitSummary?.revenue ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
              <p className="text-xs text-slate-500">Cost of Goods Sold</p>
              <p className="text-xl font-bold mt-1 text-slate-700">{fmt2(profitSummary?.cost ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
              <p className="text-xs text-slate-500">Gross Profit</p>
              <p className="text-xl font-bold mt-1" style={{ color: (profitSummary?.profit ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>{fmt2(profitSummary?.profit ?? 0)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">GST Collected — by Rate Slab</h2>
            {(!profitSummary || profitSummary.gstSlabs.length === 0) ? (
              <p className="text-slate-400 text-sm text-center py-4">No taxed sales in this range</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-slate-400 px-1">
                  <span>GST Rate</span><span className="text-right">Taxable Value</span><span className="text-right">Tax Collected</span>
                </div>
                {profitSummary.gstSlabs.map(slab => (
                  <div key={slab.gst_rate} className="grid grid-cols-3 gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-medium text-slate-800">{slab.gst_rate}%</span>
                    <span className="text-right text-slate-600">{fmt2(slab.taxable)}</span>
                    <span className="text-right font-semibold text-slate-900">{fmt2(slab.tax)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 text-sm px-3 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-right font-semibold text-slate-900">{fmt2(profitSummary.gstSlabs.reduce((s, x) => s + x.taxable, 0))}</span>
                  <span className="text-right font-semibold text-blue-700">{fmt2(profitSummary.gstSlabs.reduce((s, x) => s + x.tax, 0))}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-sm font-medium text-blue-900">Stock Valuation (at purchase price): {fmt2(profitSummary?.stockValuation ?? 0)}</p>
            <p className="text-xs text-blue-700 mt-1">Total value of inventory currently on your shelves — useful for GST audits and insurance estimates.</p>
          </div>
        </div>
      )}

      {/* Stock view */}
      {view === 'stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
              <p className="text-xs text-slate-500">Stock Valuation (purchase price × qty)</p>
              <p className="text-xl font-bold mt-1 text-slate-900">{fmt2(stockValuation)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Products tracked</p>
                <p className="text-xl font-bold mt-1 text-slate-900">{allProducts.length}</p>
              </div>
              <button onClick={exportStockCSV} disabled={allProducts.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Low Stock Items ({lowStockItems.length})</h2>
            {lowStockItems.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">All stock levels are healthy</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-amber-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.category} · {p.brand}</p>
                    </div>
                    <span className="text-amber-600 font-semibold">{p.stock} / {p.min_stock} {p.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit view */}
      {view === 'credit' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Credit Outstanding</h2>
            <span className="font-bold text-red-600">{fmt(totalCreditOutstanding)}</span>
          </div>
          {creditAccounts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No credit accounts</p>
          ) : (
            <div className="space-y-2">
              {creditAccounts.filter(a => a.balance !== 0).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{a.customer_name}</p>
                    <p className="text-xs text-slate-400">{a.phone}</p>
                  </div>
                  <span className={`font-semibold ${a.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmt(Math.abs(a.balance))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
