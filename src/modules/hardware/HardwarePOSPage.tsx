// [hardware] [all tenants]
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, CheckCircle, Printer, BadgeIndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { useAppStore } from '@/app/store/app.store';
import {
  listHwProducts, createHwSale, listHwCreditAccounts, saveHwCreditAccount,
  type HwProduct, type HwCreditAccount,
} from '@/lib/db/hardware';

const ACCENT = '#2563eb';

interface CartItem {
  product: HwProduct;
  quantity: number;
  rate: number;
  discount: number; // percent
  gst_rate: number; // percent
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

function lineBreakdown(item: CartItem) {
  const gross = item.quantity * item.rate;
  const discountAmt = gross * (item.discount / 100);
  const taxable = gross - discountAmt;
  const tax = taxable * (item.gst_rate / 100);
  return { gross, discountAmt, taxable, tax, total: taxable + tax };
}

export function HardwarePOSPage() {
  const config = useAppStore(s => s.config);
  const tenantId = config?.tenant_id ?? '';
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [billDiscount, setBillDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [creditSearch, setCreditSearch] = useState('');
  const [resultIndex, setResultIndex] = useState(0);
  const [completedBill, setCompletedBill] = useState<{ billNo: string; total: number; balance: number } | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ['hw-products-pos', tenantId, search],
    queryFn: () => listHwProducts(tenantId, { search: search || undefined }),
    enabled: !!tenantId && search.length > 0,
  });

  const { data: creditAccounts = [] } = useQuery({
    queryKey: ['hw-credit-accounts-pos', tenantId, creditSearch],
    queryFn: () => listHwCreditAccounts(tenantId, creditSearch || undefined),
    enabled: !!tenantId && paymentMode === 'credit',
  });

  function addToCart(product: HwProduct) {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product, quantity: 1, rate: product.selling_price, discount: 0, gst_rate: product.gst_rate ?? 0 }];
    });
    setSearch('');
    setResultIndex(0);
  }

  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setResultIndex(0);
  }, [search, products.length]);

  useEffect(() => {
    resultRefs.current[resultIndex]?.scrollIntoView({ block: 'nearest' });
  }, [resultIndex]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (products.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResultIndex(i => Math.min(i + 1, products.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResultIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = products[resultIndex];
      if (p) addToCart(p);
    }
  }

  function patchItem(productId: string, patch: Partial<CartItem>) {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, ...patch } : c));
  }

  function removeItem(productId: string) {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  }

  const lines = cart.map(c => ({ item: c, ...lineBreakdown(c) }));
  const subtotal = lines.reduce((s, l) => s + l.gross, 0);
  const itemDiscountTotal = lines.reduce((s, l) => s + l.discountAmt, 0);
  const taxTotal = lines.reduce((s, l) => s + l.tax, 0);
  const billDiscountAmt = parseFloat(billDiscount) || 0;
  const discountTotal = itemDiscountTotal + billDiscountAmt;
  const grandTotal = Math.max(0, lines.reduce((s, l) => s + l.total, 0) - billDiscountAmt);
  const paidAmt = paymentMode === 'credit' ? (parseFloat(paid) || 0) : (parseFloat(paid) || grandTotal);
  const balance = paidAmt - grandTotal;

  const printReceipt = async (billNo: string) => {
    const shopName = (config?.shop_name ?? 'Hardware Store').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const date = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const rows = lines.map(l => `
      <tr>
        <td>${l.item.product.name}${l.item.product.variant ? ` (${l.item.product.variant})` : ''}</td>
        <td style="text-align:center">${l.item.quantity} ${l.item.product.unit}</td>
        <td style="text-align:right">${fmt(l.item.rate)}</td>
        <td style="text-align:right">${l.item.discount > 0 ? `${l.item.discount}%` : '—'}</td>
        <td style="text-align:right">${l.item.gst_rate > 0 ? `${l.item.gst_rate}%` : '—'}</td>
        <td style="text-align:right;font-weight:600">${fmt(l.total)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:A5;margin:10mm}
      *{box-sizing:border-box} body{font-family:Arial,sans-serif;margin:0;padding:0;font-size:12px;color:#111}
      .header{text-align:center;border-bottom:2px solid ${ACCENT};padding-bottom:8px;margin-bottom:10px}
      .shop{font-size:18px;font-weight:800;color:${ACCENT}}
      .sub{font-size:10px;color:#666;margin-top:2px}
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
      <div class="meta">
        <span><b>Bill No:</b> ${billNo}</span>
        <span><b>Date:</b> ${date}</span>
      </div>
      ${customerName ? `<div class="meta"><span><b>Customer:</b> ${customerName}${customerPhone ? ` · ${customerPhone}` : ''}</span></div>` : ''}
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Disc.</th><th style="text-align:right">GST</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        ${discountTotal > 0 ? `<div class="row"><span>Discount</span><span>− ${fmt(discountTotal)}</span></div>` : ''}
        ${taxTotal > 0 ? `<div class="row"><span>GST</span><span>${fmt(taxTotal)}</span></div>` : ''}
        <div class="row grand"><span>Total</span><span>${fmt(grandTotal)}</span></div>
        <div class="row"><span>Paid (${paymentMode.toUpperCase()})</span><span>${fmt(paidAmt)}</span></div>
        ${balance < 0 ? `<div class="row" style="color:#dc2626;font-weight:700"><span>Balance Due</span><span>${fmt(-balance)}</span></div>` : ''}
        ${balance > 0 && paymentMode !== 'credit' ? `<div class="row" style="color:#16a34a;font-weight:700"><span>Change</span><span>${fmt(balance)}</span></div>` : ''}
      </div>
      <div class="footer">Thank you for shopping with us! · Powered by FrontStores</div>
      <script>window.onload=()=>{window.print()}</script>
    </body></html>`;

    const dir = await appCacheDir();
    const path = `${dir}/hw-receipt-${billNo}.html`;
    await writeTextFile(path, html);
    await shellOpen(path);
  };

  const saveSale = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('Cart is empty');
      if (paymentMode === 'credit' && !creditAccountId) throw new Error('Select a credit account for credit sale');
      const result = await createHwSale(tenantId, {
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal,
        discount: discountTotal,
        tax_total: taxTotal,
        total: grandTotal,
        paid: paidAmt,
        payment_mode: paymentMode,
        credit_account_id: paymentMode === 'credit' ? creditAccountId : undefined,
        sale_date: new Date().toISOString().split('T')[0],
        items: cart.map(c => {
          const b = lineBreakdown(c);
          return {
            product_id: c.product.id,
            product_name: c.product.name,
            unit: c.product.unit,
            quantity: c.quantity,
            rate: c.rate,
            gst_rate: c.gst_rate,
            discount: c.discount,
            amount: b.total,
          };
        }),
      });
      return result;
    },
    onSuccess: async ({ billNo }) => {
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      qc.invalidateQueries({ queryKey: ['hw-low-stock'] });
      qc.invalidateQueries({ queryKey: ['hw-credit-accounts'] });
      qc.invalidateQueries({ queryKey: ['hw-credit-accounts-pos'] });
      setCompletedBill({ billNo, total: grandTotal, balance });
      toast.success(`Bill ${billNo} saved successfully`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save sale'),
  });

  function resetBill() {
    setCart([]); setCustomerName(''); setCustomerPhone(''); setPaid('');
    setBillDiscount(''); setPaymentMode('cash'); setCreditAccountId(''); setCompletedBill(null);
  }

  if (completedBill) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-bold text-slate-900">Bill {completedBill.billNo} Saved!</h2>
        <p className="text-slate-500">Total: {fmt(completedBill.total)}</p>
        {paymentMode !== 'credit' && completedBill.balance > 0 && <p className="text-green-600 font-semibold">Change: {fmt(completedBill.balance)}</p>}
        {completedBill.balance < 0 && <p className="text-red-600 font-semibold">Balance due: {fmt(-completedBill.balance)}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => printReceipt(completedBill.billNo)}
            className="px-5 py-3 rounded-2xl text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: '#334155' }}
          >
            <Printer className="h-4 w-4" /> Print Receipt
          </button>
          <button onClick={resetBill} className="px-6 py-3 rounded-2xl text-sm font-semibold text-white" style={{ background: ACCENT }}>
            New Bill
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Billing / POS</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Product search + cart */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, brand, category, or scan barcode…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
          </div>
          {products.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <p className="px-4 py-1.5 text-[11px] text-slate-400 bg-slate-50 border-b border-slate-100">Use ↑ ↓ to navigate, Enter to add to bill</p>
              {products.map((p, i) => (
                <button
                  key={p.id}
                  ref={el => { resultRefs.current[i] = el; }}
                  onClick={() => addToCart(p)}
                  onMouseEnter={() => setResultIndex(i)}
                  className={`w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0 text-left transition-colors ${i === resultIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div>
                    <p className="font-medium text-slate-800">{p.name}{p.variant ? <span className="text-slate-400 font-normal"> · {p.variant}</span> : ''}</p>
                    <p className="text-xs text-slate-400">{p.category} · {p.brand} · Stock: {p.stock} {p.unit} · GST {p.gst_rate}%</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{fmt(p.selling_price)}</p>
                      <p className="text-xs text-slate-400">/{p.unit}</p>
                    </div>
                    {i === resultIndex && <span className="text-[10px] font-semibold text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">↵ Enter</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <p>Search and add products above</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <div className="col-span-3">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-center">Rate</div>
                  <div className="col-span-2 text-center">Disc %</div>
                  <div className="col-span-1 text-center">GST %</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                {lines.map(({ item, total }) => (
                  <div key={item.product.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="col-span-3 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{item.product.name}</p>
                      <p className="text-xs text-slate-400">{item.product.variant || item.product.unit}</p>
                    </div>
                    <input type="number" value={item.quantity} step="0.01" min="0"
                      onChange={e => { const v = parseFloat(e.target.value); if (!v || v <= 0) removeItem(item.product.id); else patchItem(item.product.id, { quantity: v }); }}
                      className="col-span-2 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none" />
                    <input type="number" value={item.rate}
                      onChange={e => patchItem(item.product.id, { rate: parseFloat(e.target.value) || 0 })}
                      className="col-span-2 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none" />
                    <input type="number" value={item.discount} min="0" max="100"
                      onChange={e => patchItem(item.product.id, { discount: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                      className="col-span-2 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none" />
                    <input type="number" value={item.gst_rate} min="0" max="28"
                      onChange={e => patchItem(item.product.id, { gst_rate: parseFloat(e.target.value) || 0 })}
                      className="col-span-1 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none" />
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-sm font-semibold text-slate-700">{fmt(total)}</span>
                      <button onClick={() => removeItem(item.product.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Billing panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Customer (Optional)</h2>
            <input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            <input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 space-y-3 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Discount</span>
              <div className="flex items-center gap-2">
                {itemDiscountTotal > 0 && <span className="text-xs text-slate-400">item: {fmt(itemDiscountTotal)} +</span>}
                <input type="number" value={billDiscount} placeholder="0" min="0"
                  onChange={e => setBillDiscount(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm text-right focus:outline-none" />
              </div>
            </div>
            {taxTotal > 0 && <div className="flex justify-between text-slate-500"><span>GST</span><span>{fmt(taxTotal)}</span></div>}
            <div className="flex items-center justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
              <span>Total</span>
              <span>{fmt(grandTotal)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {['cash', 'upi', 'card', 'credit'].map(m => (
                  <button key={m} onClick={() => setPaymentMode(m)}
                    className="py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                    style={paymentMode === m ? { background: ACCENT, color: 'white' } : { background: '#f1f5f9', color: '#64748b' }}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {paymentMode === 'credit' ? (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-500">Udhar Khata Account</label>
                <input placeholder="Search customer by name/phone…" value={creditSearch}
                  onChange={e => setCreditSearch(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {creditAccounts.map(acc => (
                    <button key={acc.id} onClick={() => { setCreditAccountId(acc.id); setCustomerName(acc.customer_name); setCustomerPhone(acc.phone); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm border ${creditAccountId === acc.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <span className="font-medium text-slate-800">{acc.customer_name}</span>
                      <span className="text-xs text-slate-400 ml-2">{acc.phone} · Balance {fmt(acc.balance)}</span>
                    </button>
                  ))}
                  {creditSearch && creditAccounts.length === 0 && (
                    <button
                      onClick={async () => {
                        if (!creditSearch.trim()) return;
                        const id = await saveHwCreditAccount(tenantId, { customer_name: creditSearch.trim(), phone: customerPhone });
                        setCreditAccountId(id); setCustomerName(creditSearch.trim());
                        qc.invalidateQueries({ queryKey: ['hw-credit-accounts-pos'] });
                        toast.success('Credit account created');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm border border-dashed border-blue-300 text-blue-700"
                    >
                      + Create new account "{creditSearch}"
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Advance Paid Now (₹, optional)</label>
                  <input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Amount Received (₹)</label>
                <input type="number" value={paid} onChange={e => setPaid(e.target.value)}
                  placeholder={String(Math.ceil(grandTotal))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
              </div>
            )}

            {paymentMode !== 'credit' && paidAmt > 0 && (
              <div className={`flex justify-between text-sm font-semibold rounded-xl px-3 py-2 ${balance >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span>{balance >= 0 ? 'Change' : 'Balance Due'}</span>
                <span>{fmt(Math.abs(balance))}</span>
              </div>
            )}
            {paymentMode === 'credit' && (
              <div className="flex justify-between text-sm font-semibold rounded-xl px-3 py-2 bg-blue-50 text-blue-700">
                <span className="flex items-center gap-1.5"><BadgeIndianRupee className="h-4 w-4" /> Adding to Khata</span>
                <span>{fmt(grandTotal - paidAmt)}</span>
              </div>
            )}

            <button
              onClick={() => saveSale.mutate()}
              disabled={cart.length === 0 || saveSale.isPending}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: ACCENT }}
            >
              {saveSale.isPending ? 'Saving…' : 'Save Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
