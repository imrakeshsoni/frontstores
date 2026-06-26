import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store/app.store';
import { listProducts, createProduct, updateProduct, deleteProduct } from '@/lib/db/products';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { isMedicalShopType, isGroceryShopType, useActiveShopType } from '@/lib/shop/shopType';
import { handleFormTabNav } from '@/lib/formNav';

type ProductSaveMode = 'close' | 'inventory' | 'new';

type ProductForm = {
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  dosage_form: string;
  ml_volume: string;
  mrp: string;
  selling_price: string;
  wholesale_price: string;
  cost_price: string;
  gst_rate: string;
  total_units: string;
  loose_selling_price: string;
  min_stock_qty: string;
  gm_volume: string;
  requires_prescription: boolean;
  location_section: string;
  location_rack: string;
  location_shelf: string;
};

const DOSAGE_FORM_OPTIONS = ['Tablet', 'Syrup', 'Powder', 'Drop', 'Injection', 'Opthalmic', 'Ointment', 'Inhalation', 'Lotion', 'Other']; // [medical] [all tenants] — added 'Other'

const emptyForm: ProductForm = {
  name: '', sku: '', barcode: '', unit: 'piece', dosage_form: '', ml_volume: '',
  mrp: '', selling_price: '', wholesale_price: '', cost_price: '', gst_rate: '12', total_units: '',
  loose_selling_price: '', min_stock_qty: '', gm_volume: '', requires_prescription: false,
  location_section: '', location_rack: '', location_shelf: '',
};

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const activeShopType = useActiveShopType();
  const isMedicalStore = isMedicalShopType(activeShopType);
  const isGrocery = isGroceryShopType(activeShopType);
  const defaultGstRate = isGrocery ? '0' : isMedicalStore ? '5' : '12';
  const unitOptions = isMedicalStore
    ? ['ml', 'piece', 'strip', 'dozen', 'unit']
    : ['kg', 'gram', 'litre', 'ml', 'piece', 'strip', 'box', 'pack', 'dozen', 'unit'];
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // [medical] [all tenants] — keyboard nav refs for product form footer
  const minStockRef = useRef<HTMLInputElement>(null);
  const nrxRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const createNewRef = useRef<HTMLButtonElement>(null);
  const createInventoryRef = useRef<HTMLButtonElement>(null);
  const createProductRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const formBodyRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page, tenantId],
    queryFn: () => listProducts(tenantId, { search, page, perPage: 20 }),
    enabled: !!tenantId,
  });

  // [medical] [all tenants] — focus the Name field as soon as Add Product opens
  useEffect(() => {
    if (showForm && !editing) {
      const t = setTimeout(() => nameRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showForm, editing]);

  // [medical] [all tenants] — warn (and block) when a product name already exists
  const trimmedName = form.name.trim();
  const { data: nameCheck } = useQuery({
    queryKey: ['product-name-check', tenantId, trimmedName],
    queryFn: () => listProducts(tenantId, { search: trimmedName, perPage: 6 }),
    enabled: !!tenantId && showForm && trimmedName.length >= 2,
  });
  const nameMatches = (nameCheck?.items ?? []).filter(
    (p) => p.id !== editing?.id && p.name.toLowerCase().includes(trimmedName.toLowerCase()),
  );
  const exactDuplicate = trimmedName
    ? nameMatches.find((p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase())
    : undefined;

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? '',
        sku: editing.sku ?? '',
        barcode: editing.barcode ?? '',
        unit: editing.unit ?? 'piece',
        dosage_form: editing.dosage_form ?? '',
        ml_volume: editing.ml_volume ? String(editing.ml_volume) : '',
        mrp: editing.mrp ? String(editing.mrp) : '',
        selling_price: editing.selling_price ? String(editing.selling_price) : '',
        wholesale_price: editing.wholesale_price ? String(editing.wholesale_price) : '',
        cost_price: editing.cost_price ? String(editing.cost_price) : '',
        gst_rate: editing.gst_rate ? String(editing.gst_rate) : defaultGstRate,
        total_units: editing.total_units ? String(editing.total_units) : '',
        loose_selling_price: editing.loose_selling_price ? String(editing.loose_selling_price) : '',
        min_stock_qty: editing.min_stock_qty ? String(editing.min_stock_qty) : '',
        gm_volume: editing.gm_volume ?? '',
        requires_prescription: !!editing.requires_prescription,
        location_section: '',
        location_rack: '',
        location_shelf: '',
      });
    } else {
      setForm({ ...emptyForm, gst_rate: defaultGstRate });
    }
  }, [editing]);

  useEffect(() => {
    if (!isMedicalStore || form.unit !== 'strip') return;
    const stripPrice = Number(form.mrp || 0);
    const totalUnits = Number(form.total_units || 0);
    if (stripPrice > 0 && totalUnits > 0) {
      setForm((c) => ({ ...c, loose_selling_price: (stripPrice / totalUnits).toFixed(2) }));
    }
  }, [form.mrp, form.total_units, form.unit, isMedicalStore]);

  const saveMutation = useMutation({
    mutationFn: async (saveMode: ProductSaveMode) => {
      if (!tenantId) throw new Error('App not configured');
      if (!form.name.trim()) throw new Error('Product name is required');

      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        unit: form.unit,
        mrp: form.mrp ? Number(form.mrp) : 0,
        selling_price: isMedicalStore
          ? (form.mrp ? Number(form.mrp) : 0)
          : (form.selling_price ? Number(form.selling_price) : 0),
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
        cost_price: form.cost_price ? Number(form.cost_price) : null,
        gst_rate: Number(form.gst_rate || 0),
        dosage_form: isMedicalStore && form.dosage_form ? form.dosage_form : null,
        ml_volume: (form.unit === 'ml' || form.dosage_form === 'Lotion') && form.ml_volume ? form.ml_volume : null,
        gm_volume: form.dosage_form === 'Ointment' && form.gm_volume ? form.gm_volume : null,
        total_units: isMedicalStore && form.unit === 'strip' && form.total_units ? Number(form.total_units) : null,
        min_stock_qty: form.min_stock_qty ? Number(form.min_stock_qty) : 0,
        requires_prescription: isMedicalStore ? form.requires_prescription : false,
        category: null, brand: null, description: null, hsn_code: null,
        salt_composition: null, manufacturer: null, is_active: true,
      };

      if (editing?.id) {
        await updateProduct(tenantId, editing.id, payload);
        return { id: editing.id, saveMode };
      }
      // [medical] [all tenants] — block creating a product that already exists by name
      const existing = await listProducts(tenantId, { search: payload.name, perPage: 10 });
      if (existing.items.some((p) => p.name.trim().toLowerCase() === payload.name.toLowerCase())) {
        throw new Error(`"${payload.name}" is already in your catalogue`);
      }
      const product = await createProduct(tenantId, payload);
      return { id: product.id, name: product.name, saveMode };
    },
    onSuccess: ({ id, name, saveMode }) => {
      toast.success(editing ? 'Product updated' : 'Product created');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-search'] });
      queryClient.invalidateQueries({ queryKey: ['pos-top-products'] });

      if (!editing && saveMode === 'inventory' && id) {
        setShowForm(false); setEditing(null); setForm({ ...emptyForm, gst_rate: defaultGstRate });
        navigate('/inventory', { state: { openAdjustStock: true, productId: id, productName: name, direction: 'add', type: 'purchase' } });
        return;
      }
      if (!editing && saveMode === 'new') {
        setEditing(null); setForm({ ...emptyForm, gst_rate: defaultGstRate });
      } else {
        setShowForm(false); setEditing(null); setForm({ ...emptyForm, gst_rate: defaultGstRate });
      }
    },
    onError: (err: any) => toast.error(err.message ?? 'Unable to save product'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(tenantId, id),
    onSuccess: () => {
      toast.success('Product deactivated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-search'] });
      queryClient.invalidateQueries({ queryKey: ['pos-top-products'] });
      setDeleteTarget(null);
    },
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Catalog"
        title="Products with editorial clarity."
        description="Browse, search, create, and maintain your product catalog."
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        }
      />

      <div className="card p-5">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, SKU or barcode…"
            className="input pl-11"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Unit</th>
                <th className="text-right">MRP</th>
                {!isMedicalStore && <th className="text-right">Selling Price</th>}
                {isGrocery && <th className="text-right">Margin</th>}
                <th className="text-right">GST</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: isMedicalStore ? 7 : isGrocery ? 9 : 8 }).map((_, j) => (
                  <td key={j}><div className="h-4 rounded bg-slate-200 animate-pulse" /></td>
                ))}</tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={isMedicalStore ? 7 : isGrocery ? 9 : 8} className="p-0">
                  <EmptyState icon={<Package className="h-8 w-8" />} title="No products yet"
                    description="Start your catalog with a few products, then expand it into a richer library." />
                </td></tr>
              )}
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <p className="font-semibold text-slate-950">{p.name}</p>
                    {p.dosage_form && <p className="mt-0.5 text-xs font-medium text-emerald-700">{p.dosage_form}</p>}
                  </td>
                  <td className="text-slate-500">{p.sku ?? '—'}</td>
                  <td className="text-slate-500">{p.unit}</td>
                  <td className="text-right">{formatCurrency(p.mrp)}</td>
                  {!isMedicalStore && <td className="text-right font-semibold text-blue-700">{formatCurrency(p.selling_price)}</td>}
                  {isGrocery && (() => {
                    const cost = p.cost_price;
                    const sell = p.selling_price;
                    if (!cost || cost <= 0 || !sell) return <td className="text-right text-slate-400">—</td>;
                    const margin = ((sell - cost) / cost) * 100;
                    const color = margin >= 20 ? '#16a34a' : margin >= 10 ? '#ca8a04' : '#dc2626';
                    return <td className="text-right text-xs font-semibold" style={{ color }}>{margin.toFixed(1)}%</td>;
                  })()}
                  <td className="text-right font-semibold text-blue-700">{p.gst_rate}%</td>
                  <td className="text-right">
                    <span className={`badge ${p.stock_qty <= p.min_stock_qty ? 'badge-red' : 'badge-green'}`}>
                      {p.stock_qty} {p.unit}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded-full bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                        onClick={() => { setEditing(p); setShowForm(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(p)}
                        className="rounded-full bg-rose-50 p-2 text-rose-500 hover:bg-rose-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>{total} products · Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            ref={formBodyRef}
            className="card-strong flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[2rem] p-6"
            onKeyDown={(e) => handleFormTabNav(formBodyRef.current, e)}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-label">Products</p>
                <h2 className="mt-2 text-2xl">{editing ? 'Edit product' : 'Add product'}</h2>
              </div>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Close</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Name *</label>
                  <input ref={nameRef} className="input" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
                  {!editing && nameMatches.length > 0 && (
                    <div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${exactDuplicate ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                      <p className="font-semibold">
                        {exactDuplicate
                          ? `⚠ "${exactDuplicate.name}" is already in your catalogue — you can't add it again.`
                          : 'Already in your catalogue:'}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {nameMatches.map((p) => (
                          <li key={p.id} className="flex justify-between gap-2">
                            <span className="truncate">{p.name}</span>
                            <span className="shrink-0 text-slate-400">{p.sku || p.unit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {!isMedicalStore && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">SKU</label>
                      <input className="input" value={form.sku} onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Barcode</label>
                      <input className="input" value={form.barcode} onChange={(e) => setForm((c) => ({ ...c, barcode: e.target.value }))} />
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Unit</label>
                  <select className="input" value={form.unit} onChange={(e) => setForm((c) => ({ ...c, unit: e.target.value }))}>
                    {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {isMedicalStore && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Dosage Form</label>
                    <select className="input" value={form.dosage_form} onChange={(e) => setForm((c) => ({ ...c, dosage_form: e.target.value }))}>
                      <option value="">Select dosage form</option>
                      {DOSAGE_FORM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                {form.unit === 'ml' && (
                  <div>
                    {/* [medical] [all tenants] — manual entry only; no preset volumes */}
                    <label className="mb-2 block text-sm font-medium text-slate-700">Volume (ml)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="Enter volume in ml"
                      value={form.ml_volume}
                      onChange={(e) => setForm((c) => ({ ...c, ml_volume: e.target.value }))}
                    />
                  </div>
                )}
                {isMedicalStore && form.dosage_form === 'Lotion' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Volume (ml)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="Enter volume in ml"
                      value={form.ml_volume}
                      onChange={(e) => setForm((c) => ({ ...c, ml_volume: e.target.value }))}
                    />
                  </div>
                )}
                {/* [medical] [all tenants] — Ointment gram volume is entered manually (no preset options) */}
                {isMedicalStore && form.dosage_form === 'Ointment' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Volume (grams)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="Enter volume in grams"
                      value={form.gm_volume}
                      onChange={(e) => setForm((c) => ({ ...c, gm_volume: e.target.value }))}
                    />
                  </div>
                )}
                {isMedicalStore && form.unit === 'strip' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Total Units per Strip</label>
                    <input type="number" className="input" value={form.total_units} onChange={(e) => setForm((c) => ({ ...c, total_units: e.target.value }))} />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{form.unit === 'strip' ? 'Strip MRP' : 'MRP'}</label>
                  <input type="number" className="input" value={form.mrp} onChange={(e) => setForm((c) => ({ ...c, mrp: e.target.value }))} />
                </div>
                {isMedicalStore && form.unit === 'strip' && Number(form.loose_selling_price) > 0 && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Per Unit (Loose) Price</label>
                    <input
                      type="number"
                      className="input bg-emerald-50 border-emerald-200"
                      value={form.loose_selling_price}
                      onChange={(e) => setForm((c) => ({ ...c, loose_selling_price: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-slate-400">Auto-calculated from Strip MRP ÷ Units. You can override.</p>
                  </div>
                )}
                {!isMedicalStore && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Selling Price (Retail)</label>
                      <input type="number" className="input" value={form.selling_price} onChange={(e) => setForm((c) => ({ ...c, selling_price: e.target.value }))} />
                    </div>
                    {isGrocery && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Wholesale Price</label>
                        <input type="number" className="input" value={form.wholesale_price} onChange={(e) => setForm((c) => ({ ...c, wholesale_price: e.target.value }))} placeholder="Optional" />
                      </div>
                    )}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Purchase / Cost Price</label>
                      <input type="number" className="input" value={form.cost_price} onChange={(e) => setForm((c) => ({ ...c, cost_price: e.target.value }))} />
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">GST Rate</label>
                  <select className="input" value={form.gst_rate} onChange={(e) => setForm((c) => ({ ...c, gst_rate: e.target.value }))}>
                    {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Low Stock Alert Qty</label>
                  <input
                    ref={minStockRef}
                    type="number" min="0" className="input"
                    value={form.min_stock_qty}
                    onChange={(e) => setForm((c) => ({ ...c, min_stock_qty: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div>
                {isMedicalStore && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">NRX</span>
                    <button
                      ref={nrxRef}
                      type="button"
                      onClick={() => setForm((c) => ({ ...c, requires_prescription: !c.requires_prescription }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); setForm((c) => ({ ...c, requires_prescription: !c.requires_prescription })); }
                      }}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${form.requires_prescription ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.requires_prescription ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  ref={cancelRef}
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >Cancel</button>
                {editing ? (
                  <button className="btn-primary" onClick={() => saveMutation.mutate('close')} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving…' : 'Update Product'}
                  </button>
                ) : (
                  <>
                    <button
                      ref={createNewRef}
                      className="btn-secondary"
                      onClick={() => saveMutation.mutate('new')}
                      disabled={saveMutation.isPending || !!exactDuplicate}
                    >{saveMutation.isPending ? 'Saving…' : 'Create And New'}</button>
                    <button
                      ref={createInventoryRef}
                      className="btn-secondary"
                      onClick={() => saveMutation.mutate('inventory')}
                      disabled={saveMutation.isPending || !!exactDuplicate}
                    >{saveMutation.isPending ? 'Saving…' : 'Create And Add Inventory'}</button>
                    <button
                      ref={createProductRef}
                      className="btn-primary"
                      onClick={() => saveMutation.mutate('close')}
                      disabled={saveMutation.isPending || !!exactDuplicate}
                    >{saveMutation.isPending ? 'Saving…' : 'Create Product'}</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        message={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"?`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
