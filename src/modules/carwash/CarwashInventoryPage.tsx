// [carwash] [all tenants]
import { useEffect, useRef, useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Package, RotateCcw, X, History } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listInventory, createInventoryItem, updateInventoryItem,
  adjustInventoryQuantity, deleteInventoryItem, getLowStockInventory,
  listInventoryLogs,
  type CarwashInventoryItem, type CarwashInventoryLog,
} from '@/lib/db/carwash';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Chemicals', 'Tools & Applicators', 'Equipment', 'Consumables', 'Accessories', 'Other'];
const UNITS = ['litre', 'ml', 'piece', 'bottle', 'can', 'kg', 'gram', 'roll', 'pack', 'box', 'set', 'pair'];
const GST_RATES = [0, 5, 12, 18, 28];

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  'Chemicals': [
    'Car Shampoo', 'Snow Foam', 'Pre-Wash Spray', 'All Purpose Cleaner', 'Wax Polish',
    'Dashboard Polish', 'Tyre Dressing', 'Glass Cleaner', 'Iron Remover', 'Tar Remover',
    'Engine Degreaser', 'Leather Conditioner', 'Fabric Protector', 'Quick Detailer',
    'Wheel Cleaner', 'Rim Cleaner', 'Odour Eliminator',
  ],
  'Tools & Applicators': [
    'Microfiber Cloth', 'Wash Mitt', 'Clay Bar', 'Foam Applicator Pad',
    'Detailing Brush Set', 'Wheel Brush', 'Soft Bristle Brush',
    'Drying Towel', 'Interior Detailing Brush', 'Upholstery Brush',
  ],
  'Equipment': [
    'Pressure Washer Nozzle', 'Foam Lance', 'Vacuum Filter Bag',
    'Spray Bottle', 'Trigger Sprayer', 'Water Blade', 'Squeegee',
    'Polishing Pad', 'Backing Plate',
  ],
  'Consumables': [
    'Air Freshener', 'Disposable Floor Mat', 'Seat Cover (Disposable)',
    'Steering Wheel Cover (Disposable)', 'Key Tag', 'Invoice Book',
    'Rubber Gloves', 'Dust Mask',
  ],
  'Accessories': [
    'Tyre Shine Spray', 'Number Plate Frame', 'Car Duster',
    'Windshield Sunshade', 'Car Wax Kit',
  ],
};

type Tab = 'products' | 'inventory';

type ItemForm = {
  name: string; category: string; brand: string; sku: string; unit: string;
  cost_per_unit: string; selling_price: string; gst_rate: string;
  min_quantity: string; notes: string;
};

const emptyForm: ItemForm = {
  name: '', category: 'Chemicals', brand: '', sku: '', unit: 'litre',
  cost_per_unit: '', selling_price: '', gst_rate: '18', min_quantity: '', notes: '',
};

type AdjustForm = {
  itemId: string; direction: 'add' | 'remove'; qty: string;
  reason: string; supplier: string; invoice: string; date: string; notes: string;
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

// ── Component ──────────────────────────────────────────────────────────────────

export function CarwashInventoryPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [tab, setTab]             = useState<Tab>('products');
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<CarwashInventoryItem | null>(null);
  const [form, setForm]           = useState<ItemForm>(emptyForm);
  const [showSugg, setShowSugg]   = useState(false);
  const suggRef                   = useRef<HTMLDivElement>(null);

  const [showAdjust, setShowAdjust]   = useState(false);
  const [adjForm, setAdjForm]         = useState<AdjustForm>({ itemId: '', direction: 'add', qty: '', reason: 'purchase', supplier: '', invoice: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [showLog, setShowLog]         = useState(false);
  const [logItemId, setLogItemId]     = useState<string | undefined>(undefined);
  const [adjSearch, setAdjSearch]     = useState('');
  const [showAdjDrop, setShowAdjDrop] = useState(false);
  const adjDropRef                    = useRef<HTMLDivElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['carwash-inventory', tenantId],
    queryFn: () => listInventory(tenantId),
    enabled: !!tenantId,
    staleTime: 0,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['carwash-low-stock', tenantId],
    queryFn: () => getLowStockInventory(tenantId),
    enabled: !!tenantId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['carwash-inv-log', tenantId, logItemId],
    queryFn: () => listInventoryLogs(tenantId, logItemId, 200),
    enabled: !!tenantId && showLog,
    staleTime: 0,
  });

  const filtered = useMemo(() => {
    let r = items;
    if (catFilter !== 'All') r = r.filter(i => i.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(i => i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q));
    }
    return r;
  }, [items, search, catFilter]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (suggRef.current && !suggRef.current.contains(e.target as Node)) setShowSugg(false);
      if (adjDropRef.current && !adjDropRef.current.contains(e.target as Node)) setShowAdjDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name, category: editing.category, brand: editing.brand ?? '',
        sku: editing.sku ?? '', unit: editing.unit,
        cost_per_unit: editing.cost_per_unit > 0 ? String(editing.cost_per_unit) : '',
        selling_price: (editing.selling_price ?? 0) > 0 ? String(editing.selling_price) : '',
        gst_rate: String(editing.gst_rate ?? 18),
        min_quantity: editing.min_quantity > 0 ? String(editing.min_quantity) : '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['carwash-inventory', tenantId] });
    qc.invalidateQueries({ queryKey: ['carwash-low-stock', tenantId] });
  };

  const saveMutation = useMutation({
    mutationFn: async (andNew: boolean) => {
      if (!form.name.trim()) throw new Error('Product name is required');
      const data = {
        name: form.name.trim(), category: form.category,
        brand: form.brand.trim() || undefined, sku: form.sku.trim() || undefined,
        unit: form.unit, quantity: editing ? editing.quantity : 0,
        min_quantity: form.min_quantity ? Number(form.min_quantity) : 0,
        cost_per_unit: form.cost_per_unit ? Number(form.cost_per_unit) : 0,
        selling_price: form.selling_price ? Number(form.selling_price) : 0,
        gst_rate: Number(form.gst_rate || 18),
        notes: form.notes.trim() || undefined,
      };
      if (editing) await updateInventoryItem(tenantId, editing.id, { ...editing, ...data });
      else await createInventoryItem(tenantId, data);
      return andNew;
    },
    onSuccess: (andNew) => {
      toast.success(editing ? 'Product updated' : 'Product added');
      invalidate();
      if (andNew && !editing) { setEditing(null); setForm(emptyForm); }
      else { setShowForm(false); setEditing(null); setForm(emptyForm); }
    },
    onError: (e: any) => toast.error(String(e?.message ?? e ?? 'Failed to save')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(tenantId, id),
    onSuccess: () => { toast.success('Product removed'); invalidate(); },
    onError: (e: any) => toast.error(String(e?.message ?? e ?? 'Failed to delete')),
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjForm.itemId) throw new Error('Select a product');
      const qty = Number(adjForm.qty);
      if (!qty || qty <= 0) throw new Error('Enter a valid quantity');
      await adjustInventoryQuantity(tenantId, adjForm.itemId, adjForm.direction === 'add' ? qty : -qty, {
        reason: adjForm.reason || undefined,
        supplier: adjForm.supplier || undefined,
        invoice: adjForm.invoice || undefined,
        date: adjForm.date || new Date().toISOString().slice(0, 10),
        notes: adjForm.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Stock updated');
      setShowAdjust(false);
      setAdjForm({ itemId: '', direction: 'add', qty: '', reason: 'purchase', supplier: '', invoice: '', date: new Date().toISOString().slice(0, 10), notes: '' });
      setAdjSearch('');
      invalidate();
    },
    onError: (e: any) => toast.error(String(e?.message ?? e ?? 'Failed to adjust')),
  });

  const adjItems = useMemo(() => {
    if (!adjSearch) return items;
    const q = adjSearch.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q));
  }, [items, adjSearch]);

  const selectedAdj = items.find(i => i.id === adjForm.itemId);

  const openAdjust = (item?: CarwashInventoryItem) => {
    setAdjForm({ itemId: item?.id ?? '', direction: 'add', qty: '', reason: 'purchase', supplier: '', invoice: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    setAdjSearch(item?.name ?? '');
    setShowAdjDrop(false);
    setShowAdjust(true);
  };

  const nameSuggestions = useMemo(() => {
    const pool = CATEGORY_SUGGESTIONS[form.category] ?? [];
    if (!form.name) return pool;
    return pool.filter(s => s.toLowerCase().includes(form.name.toLowerCase()));
  }, [form.name, form.category]);

  const inp = 'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none';
  const inpStyle = { borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' };

  return (
    <div className="flex flex-col" style={{ background: 'linear-gradient(160deg,#1c2133 0%,#111520 100%)', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating white plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>Inventory</h1>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>
            {items.length} product{items.length !== 1 ? 's' : ''}
            {lowStock.length > 0 && <span className="ml-2 font-bold" style={{ color: '#dc2626' }}>· {lowStock.length} low stock</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLogItemId(undefined); setShowLog(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: '#f2f2f7', border: '1px solid #e5e5ea', color: '#1d1d1f' }}>
            <History className="h-4 w-4" /> History
          </button>
          <button onClick={() => openAdjust()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: '#f2f2f7', border: '1px solid #e5e5ea', color: '#1d1d1f' }}>
            <RotateCcw className="h-4 w-4" /> Adjust Stock
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5), 0 1px 2px rgba(0,0,0,0.15)' }}>
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Low stock banner */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#dc2626' }}>Low Stock — {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} need restocking</p>
            <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>
              {lowStock.map(i => `${i.name} (${i.quantity} ${i.unit} left)`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#f2f2f7', width: 'fit-content' }}>
        {(['products', 'inventory'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === t ? { background: '#0071e3', color: '#ffffff' } : { color: '#86868b' }}>
            {t === 'products' ? '📦 Products' : '📊 Stock Levels'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#86868b' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
            className="rounded-xl border pl-9 pr-4 py-2 text-sm outline-none w-56"
            style={{ borderColor: '#e5e5ea', background: '#ffffff', color: '#1d1d1f' }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={catFilter === c
                ? { background: '#0071e3', color: '#ffffff' }
                : { background: '#f2f2f7', color: '#86868b', border: '1px solid #e5e5ea' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e5ea' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f2f2f7' }}>
              <tr>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#86868b' }}>Product</th>
                <th className="text-left px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Category</th>
                <th className="text-left px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Unit</th>
                <th className="text-right px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Cost</th>
                <th className="text-right px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Stock</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e5ea' }}>
                  {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: '#f2f2f7' }} /></td>)}
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-14 text-center">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium" style={{ color: '#86868b' }}>
                    {items.length === 0 ? 'No products yet — click "Add Product" to get started' : 'No products match this filter'}
                  </p>
                </td></tr>
              )}
              {filtered.map(item => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
                return (
                  <tr key={item.id} style={{ borderTop: '1px solid #e5e5ea' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: '#1d1d1f' }}>{item.name}</p>
                      {item.brand && (
                        <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>{item.brand}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f2f2f7', color: '#86868b' }}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm" style={{ color: '#86868b' }}>{item.unit}</td>
                    <td className="px-3 py-3 text-right text-sm" style={{ color: '#86868b' }}>{item.cost_per_unit > 0 ? fmt(item.cost_per_unit) : '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: isLow ? '#fef2f2' : '#d1fae5', color: isLow ? '#dc2626' : '#16a34a' }}>
                        {isLow && '⚠ '}{item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditing(item); setShowForm(true); }}
                          className="p-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#0071e3' }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteMutation.mutate(item.id); }}
                          className="p-1.5 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Levels tab */}
      {tab === 'inventory' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e5ea' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f2f2f7' }}>
              <tr>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: '#86868b' }}>Product</th>
                <th className="text-left px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Category</th>
                <th className="text-right px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Stock</th>
                <th className="text-right px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Min Stock</th>
                <th className="text-right px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Status</th>
                <th className="text-right px-3 py-3 font-semibold" style={{ color: '#86868b' }}>Updated</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e5ea' }}>
                  {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: '#f2f2f7' }} /></td>)}
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <p className="text-sm" style={{ color: '#86868b' }}>No products found</p>
                </td></tr>
              )}
              {filtered.map(item => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
                return (
                  <tr key={item.id} style={{ borderTop: '1px solid #e5e5ea' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: '#1d1d1f' }}>{item.name}</p>
                      {item.brand && <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>{item.brand}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f2f2f7', color: '#86868b' }}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: isLow ? '#dc2626' : '#1d1d1f' }}>
                      {item.quantity} <span className="font-normal text-xs" style={{ color: '#86868b' }}>{item.unit}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm" style={{ color: '#86868b' }}>
                      {item.min_quantity > 0 ? `${item.min_quantity} ${item.unit}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isLow
                        ? <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#dc2626' }}><AlertTriangle className="h-3 w-3" /> Low</span>
                        : <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#d1fae5', color: '#16a34a' }}>OK</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs" style={{ color: '#86868b' }}>
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => { setLogItemId(item.id); setShowLog(true); }}
                        className="p-1.5 rounded-lg mr-1" style={{ background: '#f2f2f7', color: '#86868b' }} title="View history">
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openAdjust(item)}
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#0071e3' }} title="Adjust stock">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Product modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#86868b' }}>Inventory</p>
                <h2 className="text-xl font-bold mt-0.5" style={{ color: '#1d1d1f' }}>{editing ? 'Edit Product' : 'Add Product'}</h2>
              </div>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="h-5 w-5" style={{ color: '#86868b' }} /></button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* Name + suggestions */}
              <div ref={suggRef} className="relative">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Product Name *</label>
                <input value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setShowSugg(true); }}
                  onFocus={() => setShowSugg(true)}
                  placeholder="e.g. Car Shampoo, Microfiber Cloth…"
                  className={inp} style={inpStyle} />
                {showSugg && nameSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                    style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {nameSuggestions.slice(0, 8).map(s => (
                      <button key={s} onClick={() => { setForm(f => ({ ...f, name: s })); setShowSugg(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                        style={{ color: '#1d1d1f', borderBottom: '1px solid #e5e5ea' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp} style={inpStyle}>
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className={inp} style={inpStyle}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Brand (optional)</label>
                  <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Meguiar's, 3M, Turtle Wax" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Purchase / Cost Price (₹)</label>
                  <input type="number" min="0" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Low Stock Alert Qty</label>
                  <input type="number" min="0" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} placeholder="e.g. 2" className={inp} style={inpStyle} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-5 pt-4" style={{ borderTop: '1px solid #e5e5ea' }}>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#f2f2f7', color: '#86868b' }}>
                Cancel
              </button>
              {!editing && (
                <button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: '#f2f2f7', border: '1px solid #e5e5ea', color: '#1d1d1f' }}>
                  {saveMutation.isPending ? 'Saving…' : 'Save & Add Another'}
                </button>
              )}
              <button onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
                style={{ background: '#0071e3', color: '#ffffff' }}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold" style={{ color: '#1d1d1f' }}>Adjust Stock</h2>
              <button onClick={() => setShowAdjust(false)}><X className="h-5 w-5" style={{ color: '#86868b' }} /></button>
            </div>

            <div className="space-y-4">
              {/* Product search dropdown */}
              <div ref={adjDropRef} className="relative">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Product *</label>
                <input value={adjSearch}
                  onChange={e => { setAdjSearch(e.target.value); setShowAdjDrop(true); setAdjForm(f => ({ ...f, itemId: '' })); }}
                  onFocus={() => setShowAdjDrop(true)}
                  placeholder="Search product…" className={inp} style={inpStyle} />
                {showAdjDrop && adjItems.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl shadow-lg"
                    style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {adjItems.slice(0, 15).map(i => (
                      <button key={i.id}
                        onClick={() => { setAdjForm(f => ({ ...f, itemId: i.id })); setAdjSearch(i.name); setShowAdjDrop(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                        style={{ color: '#1d1d1f', borderBottom: '1px solid #e5e5ea' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span className="font-medium">{i.name}</span>
                        <span className="ml-2 text-xs" style={{ color: '#86868b' }}>({i.quantity} {i.unit} in stock)</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedAdj && (
                  <p className="text-xs mt-1" style={{ color: '#86868b' }}>
                    Current stock: <b>{selectedAdj.quantity} {selectedAdj.unit}</b>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Action</label>
                  <select value={adjForm.direction}
                    onChange={e => setAdjForm(f => ({ ...f, direction: e.target.value as 'add' | 'remove', reason: e.target.value === 'add' ? 'purchase' : 'used' }))}
                    className={inp} style={inpStyle}>
                    <option value="add">Add Stock</option>
                    <option value="remove">Remove Stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Reason</label>
                  <select value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))} className={inp} style={inpStyle}>
                    {adjForm.direction === 'add'
                      ? <><option value="purchase">Purchase / Restock</option><option value="return">Customer Return</option><option value="adjustment">Manual Adjustment</option></>
                      : <><option value="used">Used in Service</option><option value="adjustment">Manual Adjustment</option><option value="write-off">Write-off / Damage</option><option value="return">Return to Supplier</option></>
                    }
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Quantity *</label>
                <input type="number" min="0.01" step="any" value={adjForm.qty}
                  onChange={e => setAdjForm(f => ({ ...f, qty: e.target.value }))}
                  placeholder="e.g. 5" className={inp} style={inpStyle} />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Date *</label>
                <input type="date" value={adjForm.date} onChange={e => setAdjForm(f => ({ ...f, date: e.target.value }))} className={inp} style={inpStyle} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Supplier (optional)</label>
                  <input value={adjForm.supplier} onChange={e => setAdjForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Supplier name" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Invoice No. (optional)</label>
                  <input value={adjForm.invoice} onChange={e => setAdjForm(f => ({ ...f, invoice: e.target.value }))} placeholder="INV-001" className={inp} style={inpStyle} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#86868b' }}>Notes (optional)</label>
                <input value={adjForm.notes} onChange={e => setAdjForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes…" className={inp} style={inpStyle} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4" style={{ borderTop: '1px solid #e5e5ea' }}>
              <button onClick={() => setShowAdjust(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#f2f2f7', color: '#86868b' }}>
                Cancel
              </button>
              <button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || !adjForm.itemId}
                className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
                style={{ background: adjForm.direction === 'add' ? '#16a34a' : '#dc2626', color: '#fff' }}>
                {adjustMutation.isPending ? 'Saving…' : adjForm.direction === 'add' ? '+ Add Stock' : '− Remove Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Transaction History modal */}
      {showLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#86868b' }}>Inventory</p>
                <h2 className="text-xl font-bold mt-0.5" style={{ color: '#1d1d1f' }}>
                  {logItemId ? (items.find(i => i.id === logItemId)?.name ?? 'Transaction History') : 'All Transactions'}
                </h2>
              </div>
              <button onClick={() => setShowLog(false)}><X className="h-5 w-5" style={{ color: '#86868b' }} /></button>
            </div>

            <div className="overflow-y-auto flex-1">
              {logs.length === 0 ? (
                <div className="py-12 text-center">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm" style={{ color: '#86868b' }}>No transactions recorded yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead style={{ background: '#f2f2f7' }}>
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold" style={{ color: '#86868b' }}>Date</th>
                      {!logItemId && <th className="text-left px-3 py-2.5 font-semibold" style={{ color: '#86868b' }}>Product</th>}
                      <th className="text-left px-3 py-2.5 font-semibold" style={{ color: '#86868b' }}>Action</th>
                      <th className="text-right px-3 py-2.5 font-semibold" style={{ color: '#86868b' }}>Qty</th>
                      <th className="text-left px-3 py-2.5 font-semibold" style={{ color: '#86868b' }}>Reason</th>
                      <th className="text-left px-3 py-2.5 font-semibold" style={{ color: '#86868b' }}>Supplier / Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} style={{ borderTop: '1px solid #e5e5ea' }}>
                        <td className="px-3 py-2.5 text-sm" style={{ color: '#1d1d1f' }}>
                          {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        {!logItemId && <td className="px-3 py-2.5 text-sm font-medium" style={{ color: '#1d1d1f' }}>{log.item_name}</td>}
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: log.direction === 'add' ? '#d1fae5' : '#fef2f2', color: log.direction === 'add' ? '#16a34a' : '#dc2626' }}>
                            {log.direction === 'add' ? '+ Added' : '− Removed'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold" style={{ color: log.direction === 'add' ? '#16a34a' : '#dc2626' }}>
                          {log.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-sm capitalize" style={{ color: '#86868b' }}>
                          {log.reason?.replace(/-/g, ' ') ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: '#86868b' }}>
                          {[log.supplier, log.invoice_no].filter(Boolean).join(' / ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: '1px solid #e5e5ea' }}>
              {logItemId && (
                <button onClick={() => { setLogItemId(undefined); }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: '#f2f2f7', color: '#86868b' }}>
                  View All Products
                </button>
              )}
              <button onClick={() => setShowLog(false)}
                className="ml-auto px-4 py-2 rounded-xl text-sm font-medium" style={{ background: '#f2f2f7', color: '#86868b' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>{/* end scrollable */}
  );
}