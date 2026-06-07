// [hardware] [all tenants]
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Printer, CheckCircle2, ArrowLeft, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { useAppStore } from '@/app/store/app.store';
import {
  listHwProducts, listHwQuotations, saveHwQuotation, deleteHwQuotation, getHwQuotationItems,
  convertHwQuotationToSale, type HwProduct, type HwQuotation,
} from '@/lib/db/hardware';

const ACCENT = '#2563eb';

interface QuoteLine {
  key: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  rate: number;
  discount: number; // percent
  gst_rate: number; // percent
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

function lineAmount(l: QuoteLine) {
  const gross = l.quantity * l.rate;
  const discountAmt = gross * (l.discount / 100);
  const taxable = gross - discountAmt;
  const tax = taxable * (l.gst_rate / 100);
  return { gross, discountAmt, taxable, tax, total: taxable + tax };
}

const STATUS_META: Record<HwQuotation['status'], { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#64748b', bg: '#f1f5f9' },
  sent: { label: 'Sent', color: '#0369a1', bg: '#e0f2fe' },
  accepted: { label: 'Accepted', color: '#15803d', bg: '#dcfce7' },
  expired: { label: 'Expired', color: '#b91c1c', bg: '#fee2e2' },
  converted: { label: 'Converted', color: '#7c3aed', bg: '#ede9fe' },
};

export function HardwareQuotationPage() {
  const config = useAppStore(s => s.config);
  const tenantId = config?.tenant_id ?? '';
  const qc = useQueryClient();

  const [view, setView] = useState<'list' | 'new'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // New quote form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([]);

  const { data: quotations = [] } = useQuery({
    queryKey: ['hw-quotations', tenantId, statusFilter, search],
    queryFn: () => listHwQuotations(tenantId, { status: statusFilter || undefined, search: search || undefined }),
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['hw-products-all', tenantId],
    queryFn: () => listHwProducts(tenantId, {}),
    enabled: !!tenantId,
  });

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)).slice(0, 12);
  }, [products, productSearch]);

  function addProduct(p: HwProduct) {
    setLines(prev => [...prev, {
      key: `${p.id}-${Date.now()}`, product_id: p.id, product_name: `${p.name}${p.variant ? ` (${p.variant})` : ''}`,
      unit: p.unit, quantity: 1, rate: p.selling_price, discount: 0, gst_rate: p.gst_rate,
    }]);
    setProductSearch('');
  }

  function addCustomLine() {
    setLines(prev => [...prev, { key: `custom-${Date.now()}`, product_id: null, product_name: '', unit: 'piece', quantity: 1, rate: 0, discount: 0, gst_rate: 18 }]);
  }

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(l => l.key !== key));
  }

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0, total = 0;
    for (const l of lines) {
      const b = lineAmount(l);
      subtotal += b.gross; discount += b.discountAmt; tax += b.tax; total += b.total;
    }
    return { subtotal, discount, tax, total };
  }, [lines]);

  function resetForm() {
    setCustomerName(''); setCustomerPhone(''); setValidUntil(''); setNotes('');
    setProductSearch(''); setLines([]);
  }

  const saveQuote = useMutation({
    mutationFn: () => saveHwQuotation(tenantId, {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax_total: totals.tax,
      total: totals.total,
      valid_until: validUntil || undefined,
      status: 'draft',
      notes,
      items: lines.map(l => {
        const b = lineAmount(l);
        return { product_id: l.product_id, product_name: l.product_name, unit: l.unit, quantity: l.quantity, rate: l.rate, gst_rate: l.gst_rate, discount: l.discount, amount: b.total };
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-quotations'] });
      toast.success('Quotation saved');
      resetForm();
      setView('list');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save quotation'),
  });

  async function changeStatus(q: HwQuotation, status: HwQuotation['status']) {
    try {
      const items = await getHwQuotationItems(tenantId, q.id);
      await saveHwQuotation(tenantId, {
        id: q.id, customer_name: q.customer_name, customer_phone: q.customer_phone,
        subtotal: q.subtotal, discount: q.discount, tax_total: q.tax_total, total: q.total,
        valid_until: q.valid_until ?? undefined, status, notes: q.notes,
        items: items.map(i => ({ product_id: i.product_id, product_name: i.product_name, unit: i.unit, quantity: i.quantity, rate: i.rate, gst_rate: i.gst_rate, discount: i.discount, amount: i.amount })),
      });
      qc.invalidateQueries({ queryKey: ['hw-quotations'] });
      toast.success(`Marked as ${STATUS_META[status].label}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  }

  const convertToSale = useMutation({
    mutationFn: (id: string) => convertHwQuotationToSale(tenantId, id, 'cash'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-quotations'] });
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success('Converted to sale — stock updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to convert'),
  });

  const removeQuote = useMutation({
    mutationFn: (id: string) => deleteHwQuotation(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-quotations'] });
      toast.success('Quotation deleted');
    },
  });

  async function printQuotation(q: HwQuotation) {
    const items = await getHwQuotationItems(tenantId, q.id);
    const shopName = (config?.shop_name ?? 'Hardware Store').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const date = new Date(q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const rows = items.map(i => `
      <tr>
        <td>${i.product_name}</td>
        <td style="text-align:center">${i.quantity} ${i.unit}</td>
        <td style="text-align:right">${fmt(i.rate)}</td>
        <td style="text-align:right">${i.discount > 0 ? `${i.discount}%` : '—'}</td>
        <td style="text-align:right">${i.gst_rate > 0 ? `${i.gst_rate}%` : '—'}</td>
        <td style="text-align:right;font-weight:600">${fmt(i.amount)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:A5;margin:10mm}
      *{box-sizing:border-box} body{font-family:Arial,sans-serif;margin:0;padding:0;font-size:12px;color:#111}
      .header{text-align:center;border-bottom:2px solid ${ACCENT};padding-bottom:8px;margin-bottom:10px}
      .shop{font-size:18px;font-weight:800;color:${ACCENT}}
      .sub{font-size:10px;color:#666;margin-top:2px}
      .title{text-align:center;font-weight:800;letter-spacing:2px;color:${ACCENT};margin:6px 0;font-size:13px}
      .meta{display:flex;justify-content:space-between;font-size:11px;color:#444;margin-bottom:8px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{text-align:left;border-bottom:1px solid #ddd;padding:5px 4px;color:#666;font-size:10px;text-transform:uppercase}
      td{padding:5px 4px;border-bottom:1px solid #f1f1f1}
      .totals{margin-top:10px;margin-left:auto;width:60%}
      .totals .row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
      .totals .grand{font-size:15px;font-weight:800;color:${ACCENT};border-top:2px solid #111;padding-top:6px;margin-top:4px}
      .footer{text-align:center;margin-top:18px;font-size:10px;color:#999;border-top:1px dashed #ccc;padding-top:8px}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
      <div class="header">
        <div class="shop">${shopName}</div>
        ${config?.address_line1 ? `<div class="sub">${[config.address_line1, config.city].filter(Boolean).join(', ')}</div>` : ''}
        ${config?.phone ? `<div class="sub">📞 ${config.phone}${(config as any)?.gstin ? ` · GSTIN: ${(config as any).gstin}` : ''}</div>` : ''}
      </div>
      <div class="title">QUOTATION / ESTIMATE</div>
      <div class="meta">
        <span><b>Quote No:</b> ${q.quote_no}</span>
        <span><b>Date:</b> ${date}</span>
      </div>
      <div class="meta">
        <span><b>Customer:</b> ${q.customer_name}${q.customer_phone ? ` · ${q.customer_phone}` : ''}</span>
        ${q.valid_until ? `<span><b>Valid Until:</b> ${q.valid_until}</span>` : ''}
      </div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Disc.</th><th style="text-align:right">GST</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${fmt(q.subtotal)}</span></div>
        ${q.discount > 0 ? `<div class="row"><span>Discount</span><span>− ${fmt(q.discount)}</span></div>` : ''}
        ${q.tax_total > 0 ? `<div class="row"><span>GST</span><span>${fmt(q.tax_total)}</span></div>` : ''}
        <div class="row grand"><span>Total</span><span>${fmt(q.total)}</span></div>
      </div>
      ${q.notes ? `<div class="sub" style="margin-top:10px">${q.notes}</div>` : ''}
      <div class="footer">This is an estimate, not a tax invoice · Powered by FrontStores</div>
      <script>window.onload=()=>{window.print()}</script>
    </body></html>`;

    const dir = await appCacheDir();
    const path = `${dir}/hw-quote-${q.quote_no}.html`;
    await writeTextFile(path, html);
    await shellOpen(path);
  }

  if (view === 'new') {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { resetForm(); setView('list'); }} className="p-2 rounded-xl hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-900">New Quotation</h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="e.g. Ramesh Constructions" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="10-digit mobile" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search products to add…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
            {filteredProducts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-lg divide-y divide-slate-50">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex justify-between">
                    <span>{p.name}{p.variant ? ` · ${p.variant}` : ''}</span>
                    <span className="text-slate-400">{fmt(p.selling_price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No items yet — search above or add a custom line.</p>
          ) : (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 px-1">
                <span className="col-span-4">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Rate</span>
                <span className="col-span-1 text-right">Disc%</span>
                <span className="col-span-1 text-right">GST%</span>
                <span className="col-span-1 text-right">Amount</span>
                <span className="col-span-1"></span>
              </div>
              {lines.map(l => {
                const b = lineAmount(l);
                return (
                  <div key={l.key} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-xl p-2">
                    <input value={l.product_name} onChange={e => updateLine(l.key, { product_name: e.target.value })} placeholder="Description" className="col-span-12 sm:col-span-4 px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none" />
                    <input type="number" value={l.quantity} onChange={e => updateLine(l.key, { quantity: parseFloat(e.target.value) || 0 })} className="col-span-4 sm:col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center focus:outline-none" />
                    <input type="number" value={l.rate} onChange={e => updateLine(l.key, { rate: parseFloat(e.target.value) || 0 })} className="col-span-4 sm:col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-right focus:outline-none" />
                    <input type="number" value={l.discount} onChange={e => updateLine(l.key, { discount: parseFloat(e.target.value) || 0 })} className="col-span-2 sm:col-span-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-right focus:outline-none" />
                    <input type="number" value={l.gst_rate} onChange={e => updateLine(l.key, { gst_rate: parseFloat(e.target.value) || 0 })} className="col-span-2 sm:col-span-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-right focus:outline-none" />
                    <span className="col-span-10 sm:col-span-1 text-right text-sm font-semibold text-slate-700">{fmt(b.total)}</span>
                    <button onClick={() => removeLine(l.key)} className="col-span-2 sm:col-span-1 p-1.5 rounded-lg hover:bg-red-50 text-red-400 justify-self-end">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={addCustomLine} className="text-sm font-semibold" style={{ color: ACCENT }}>+ Add custom line</button>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="Terms, delivery notes, etc." />
          </div>

          {lines.length > 0 && (
            <div className="ml-auto w-full sm:w-72 space-y-1 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>− {fmt(totals.discount)}</span></div>}
              {totals.tax > 0 && <div className="flex justify-between text-slate-500"><span>GST</span><span>{fmt(totals.tax)}</span></div>}
              <div className="flex justify-between text-base font-bold pt-1 border-t border-slate-200" style={{ color: ACCENT }}><span>Total</span><span>{fmt(totals.total)}</span></div>
            </div>
          )}

          <button
            onClick={() => saveQuote.mutate()}
            disabled={!customerName.trim() || lines.length === 0 || saveQuote.isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 12px -2px rgba(37,99,235,0.4)' }}
          >
            {saveQuote.isPending ? 'Saving…' : 'Save Quotation'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900">Quotations / Estimates</h1>
        <button
          onClick={() => { resetForm(); setView('new'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 12px -2px rgba(37,99,235,0.4)' }}
        >
          <Plus className="h-4 w-4" /> New Quotation
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, quote no…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      {quotations.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>No quotations yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map(q => {
            const meta = STATUS_META[q.status];
            return (
              <div key={q.id} className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900">{q.customer_name}</p>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                  <p className="text-xs text-slate-400">{q.quote_no} · {q.created_at?.slice(0, 10)}{q.valid_until ? ` · valid till ${q.valid_until}` : ''}</p>
                </div>
                <p className="font-semibold text-slate-900">{fmt(q.total)}</p>
                <div className="flex gap-1.5">
                  <button onClick={() => printQuotation(q)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Print">
                    <Printer className="h-4 w-4" />
                  </button>
                  {q.status === 'draft' && (
                    <button onClick={() => changeStatus(q, 'sent')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100">Mark Sent</button>
                  )}
                  {(q.status === 'sent' || q.status === 'draft') && (
                    <button onClick={() => changeStatus(q, 'accepted')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100">Mark Accepted</button>
                  )}
                  {q.status !== 'converted' && (
                    <button
                      onClick={() => { if (confirm(`Convert quotation ${q.quote_no} to a sale? This will deduct stock.`)) convertToSale.mutate(q.id); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Convert to Sale
                    </button>
                  )}
                  <button onClick={() => { if (confirm('Delete this quotation?')) removeQuote.mutate(q.id); }} className="p-2 rounded-lg hover:bg-red-50 text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
