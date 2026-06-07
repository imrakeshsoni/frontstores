// [hardware] [all tenants]
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Upload, Download, PackagePlus, PackageMinus, Barcode } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import {
  listHwProducts, saveHwProduct, deleteHwProduct, listHwCategories,
  recordHwStockMovement, adjustHwStock, type HwProduct,
} from '@/lib/db/hardware';
import { listSuppliers } from '@/lib/db/suppliers';

const UNITS = ['piece', 'kg', 'meter', 'liter', 'box', 'bag', 'bundle', 'pair', 'set', 'roll'];
const GST_RATES = [0, 5, 12, 18, 28];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

const emptyForm = (): Partial<HwProduct> => ({
  name: '', category: '', unit: 'piece', brand: '',
  stock: 0, min_stock: 0, purchase_price: 0, selling_price: 0,
  barcode: '', hsn_code: '', gst_rate: 18, variant: '', supplier_id: '',
});

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): string[][] {
  return text.split(/\r?\n/).filter(l => l.trim().length > 0).map(line => {
    const cells: string[] = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { cells.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    cells.push(cur);
    return cells.map(c => c.trim());
  });
}

export function HardwareProductsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<HwProduct>>(emptyForm());
  const [adjustFor, setAdjustFor] = useState<HwProduct | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['hw-products', tenantId, search, filterCat],
    queryFn: () => listHwProducts(tenantId, { search: search || undefined, category: filterCat || undefined }),
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['hw-categories', tenantId],
    queryFn: () => listHwCategories(tenantId),
    enabled: !!tenantId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['hw-suppliers-list', tenantId],
    queryFn: async () => (await listSuppliers(tenantId, { perPage: 200 })).items,
    enabled: !!tenantId,
  });

  const saveProduct = useMutation({
    mutationFn: () => saveHwProduct(tenantId, form as Partial<HwProduct> & { name: string }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-categories'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success('Product saved');
      setShowForm(false);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => deleteHwProduct(tenantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success('Product deleted');
    },
  });

  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!adjustFor) return;
      const qty = parseFloat(adjustQty);
      if (!qty) throw new Error('Enter a quantity');
      await adjustHwStock(tenantId, adjustFor.id, qty);
      await recordHwStockMovement(tenantId, {
        product_id: adjustFor.id, product_name: adjustFor.name, qty_delta: qty,
        reason: 'adjustment', note: adjustReason || (qty > 0 ? 'Stock added' : 'Stock removed'),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      qc.invalidateQueries({ queryKey: ['hw-stock-movements'] });
      toast.success('Stock updated');
      setAdjustFor(null); setAdjustQty(''); setAdjustReason('');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to adjust stock'),
  });

  function editProduct(p: HwProduct) {
    setForm({ ...p });
    setShowForm(true);
  }

  function upd(k: keyof HwProduct, v: string | number) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function generateBarcode() {
    upd('barcode', `HW${Date.now().toString().slice(-9)}`);
  }

  function downloadSampleCSV() {
    downloadCSV('hardware-products-sample.csv', [
      ['name', 'category', 'brand', 'unit', 'variant', 'stock', 'purchase_price', 'selling_price', 'gst_rate', 'hsn_code'],
      ['Asian Paints Tractor Emulsion', 'Paint', 'Asian Paints', 'liter', '4L White', '20', '450', '620', '18', '3209'],
      ['Stanley Claw Hammer', 'Tools', 'Stanley', 'piece', '450g', '15', '280', '399', '18', '8205'],
    ]);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) { toast.error('CSV has no data rows'); return; }
      const header = rows[0].map(h => h.toLowerCase());
      const idx = (key: string) => header.indexOf(key);
      let imported = 0;
      for (const row of rows.slice(1)) {
        const name = row[idx('name')]?.trim();
        if (!name) continue;
        await saveHwProduct(tenantId, {
          name,
          category: row[idx('category')] ?? '',
          brand: row[idx('brand')] ?? '',
          unit: row[idx('unit')] || 'piece',
          variant: idx('variant') >= 0 ? row[idx('variant')] ?? '' : '',
          stock: parseFloat(row[idx('stock')]) || 0,
          purchase_price: parseFloat(row[idx('purchase_price')]) || 0,
          selling_price: parseFloat(row[idx('selling_price')]) || 0,
          gst_rate: idx('gst_rate') >= 0 ? (parseFloat(row[idx('gst_rate')]) || 0) : 18,
          hsn_code: idx('hsn_code') >= 0 ? row[idx('hsn_code')] ?? '' : '',
        } as any);
        imported++;
      }
      qc.invalidateQueries({ queryKey: ['hw-products'] });
      qc.invalidateQueries({ queryKey: ['hw-categories'] });
      qc.invalidateQueries({ queryKey: ['hw-stats'] });
      toast.success(`Imported ${imported} product${imported === 1 ? '' : 's'}`);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900">Products</h1>
        <div className="flex items-center gap-2">
          <button onClick={downloadSampleCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Sample CSV
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <button
            onClick={() => { setForm(emptyForm()); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#d97706' }}
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">{form.id ? 'Edit Product' : 'New Product'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
              <input value={form.name ?? ''} onChange={e => upd('name', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="Product name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <input value={form.category ?? ''} onChange={e => upd('category', e.target.value)} list="cat-list" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="Category" />
              <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Brand</label>
              <input value={form.brand ?? ''} onChange={e => upd('brand', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="e.g. Asian Paints" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Variant (size / shade)</label>
              <input value={form.variant ?? ''} onChange={e => upd('variant', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="e.g. 4L, White, 20mm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
              <select value={form.unit ?? 'piece'} onChange={e => upd('unit', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Supplier</label>
              <select value={form.supplier_id ?? ''} onChange={e => upd('supplier_id', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                <option value="">— None —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Barcode / SKU</label>
              <div className="flex gap-2">
                <input value={form.barcode ?? ''} onChange={e => upd('barcode', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="Scan or enter" />
                <button type="button" onClick={generateBarcode} className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100" title="Generate barcode">
                  <Barcode className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">HSN Code</label>
              <input value={form.hsn_code ?? ''} onChange={e => upd('hsn_code', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="e.g. 3209" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">GST Rate</label>
              <select value={form.gst_rate ?? 18} onChange={e => upd('gst_rate', parseFloat(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Stock</label>
              <input type="number" value={form.stock ?? 0} onChange={e => upd('stock', parseFloat(e.target.value) || 0)} step="0.01" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Stock Alert</label>
              <input type="number" value={form.min_stock ?? 0} onChange={e => upd('min_stock', parseFloat(e.target.value) || 0)} step="0.01" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Price (₹)</label>
              <input type="number" value={form.purchase_price ?? 0} onChange={e => upd('purchase_price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Selling Price (₹)</label>
              <input type="number" value={form.selling_price ?? 0} onChange={e => upd('selling_price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => saveProduct.mutate()}
              disabled={!form.name?.trim() || saveProduct.isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#d97706' }}
            >
              {saveProduct.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stock adjustment panel */}
      {adjustFor && (
        <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Adjust Stock — {adjustFor.name}</h2>
          <p className="text-xs text-slate-500">Current stock: {adjustFor.stock} {adjustFor.unit}. Enter a positive number to add, negative to remove.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Quantity (+/-)</label>
              <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} step="0.01" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="e.g. 10 or -2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reason / Note</label>
              <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none" placeholder="e.g. Damaged stock, recount" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => adjustStock.mutate()}
              disabled={adjustStock.isPending || !adjustQty}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#0891b2' }}
            >
              {adjustStock.isPending ? 'Updating…' : 'Apply Adjustment'}
            </button>
            <button onClick={() => { setAdjustFor(null); setAdjustQty(''); setAdjustReason(''); }} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, brand, barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Product table */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🔧</p>
          <p>No products yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => {
            const lowStock = p.stock <= p.min_stock;
            const reorderQty = Math.max(0, p.min_stock - p.stock);
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${lowStock ? 'border-orange-200' : 'border-slate-100'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900">{p.name}{p.variant ? <span className="text-slate-400 font-normal"> · {p.variant}</span> : ''}</p>
                    {lowStock && (
                      <span className="flex items-center gap-1 text-xs text-orange-600 font-semibold">
                        <AlertTriangle className="h-3 w-3" /> Low Stock{reorderQty > 0 ? ` · reorder ${reorderQty} ${p.unit}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {p.category}{p.brand ? ` · ${p.brand}` : ''}{p.gst_rate ? ` · GST ${p.gst_rate}%` : ''}{p.barcode ? ` · #${p.barcode}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">{p.stock} {p.unit}</p>
                  <p className="text-xs text-slate-400">min: {p.min_stock}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{fmt(p.selling_price)}</p>
                  <p className="text-xs text-slate-400">cost: {fmt(p.purchase_price)}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setAdjustFor(p); setAdjustQty(''); setAdjustReason(''); }} className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600" title="Stock in">
                    <PackagePlus className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setAdjustFor(p); setAdjustQty('-'); setAdjustReason(''); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Stock out / adjust">
                    <PackageMinus className="h-4 w-4" />
                  </button>
                  <button onClick={() => editProduct(p)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete product?')) deleteProduct.mutate(p.id); }}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400"
                  >
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
