// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Package, AlertTriangle, Edit2, Trash2, X, Minus } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listInventory, createInventoryItem, updateInventoryItem, adjustInventoryQuantity, deleteInventoryItem,
  type CarwashInventoryItem,
} from '@/lib/db/carwash';

const CATEGORIES = ['chemical', 'equipment', 'consumable', 'other'];
const UNITS = ['litre', 'ml', 'kg', 'gram', 'piece', 'packet', 'bottle', 'can', 'bag'];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  chemical:    { label: 'Chemical',    color: '#2563eb', bg: '#dbeafe' },
  equipment:   { label: 'Equipment',   color: '#7c3aed', bg: '#ede9fe' },
  consumable:  { label: 'Consumable',  color: '#16a34a', bg: '#dcfce7' },
  other:       { label: 'Other',       color: '#6b7280', bg: '#f3f4f6' },
};

type ItemForm = {
  name: string; category: string; unit: string;
  quantity: string; min_quantity: string; cost_per_unit: string; notes: string;
};

const emptyForm: ItemForm = {
  name: '', category: 'chemical', unit: 'litre',
  quantity: '', min_quantity: '', cost_per_unit: '', notes: '',
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

export function CarwashInventoryPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarwashInventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['carwash-inventory', tenantId],
    queryFn: () => listInventory(tenantId),
    enabled: !!tenantId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['carwash-inventory', tenantId] });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Name is required');
      if (!form.quantity) throw new Error('Quantity is required');
      return createInventoryItem(tenantId, {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        quantity: Number(form.quantity),
        min_quantity: Number(form.min_quantity) || 0,
        cost_per_unit: Number(form.cost_per_unit) || 0,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => { toast.success('Item added'); setShowForm(false); setForm(emptyForm); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to add'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) return Promise.resolve();
      return updateInventoryItem(tenantId, editing.id, {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        quantity: Number(form.quantity),
        min_quantity: Number(form.min_quantity) || 0,
        cost_per_unit: Number(form.cost_per_unit) || 0,
        notes: form.notes || null,
      });
    },
    onSuccess: () => { toast.success('Updated'); setEditing(null); setForm(emptyForm); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adjustInventoryQuantity(tenantId, id, delta),
    onSuccess: () => { toast.success('Stock updated'); setAdjustId(null); setAdjustDelta(''); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(tenantId, id),
    onSuccess: () => { toast.success('Removed'); invalidate(); },
  });

  const startEdit = (item: CarwashInventoryItem) => {
    setEditing(item);
    setForm({
      name: item.name, category: item.category, unit: item.unit,
      quantity: String(item.quantity), min_quantity: String(item.min_quantity),
      cost_per_unit: String(item.cost_per_unit), notes: item.notes ?? '',
    });
  };

  const filtered = filterCat === 'all' ? inventory : inventory.filter(i => i.category === filterCat);
  const lowStock = inventory.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity);
  const totalValue = inventory.reduce((s, i) => s + i.quantity * i.cost_per_unit, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Supply Inventory</h1>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Total Items</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{inventory.length}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Low Stock</p>
          <p className="text-2xl font-bold" style={{ color: lowStock.length > 0 ? '#dc2626' : '#16a34a' }}>{lowStock.length}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Stock Value</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{fmt(totalValue)}</p>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: '#dc2626' }}>Low stock alert</p>
            <p className="text-xs mt-0.5" style={{ color: '#991b1b' }}>
              {lowStock.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...CATEGORIES] as const).map(cat => {
          const cc = CATEGORY_CONFIG[cat] ?? { color: '#6b7280', bg: '#f3f4f6' };
          const count = cat === 'all' ? inventory.length : inventory.filter(i => i.category === cat).length;
          return (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all`}
              style={filterCat === cat
                ? { background: cat === 'all' ? 'var(--accent)' : cc.color, color: '#fff' }
                : { background: cat === 'all' ? 'var(--surface-2)' : cc.bg, color: cat === 'all' ? 'var(--text-secondary)' : cc.color }}>
              {cat === 'all' ? 'All' : cc.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Inventory list */}
      {isLoading && Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
      ))}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No items yet</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const cc = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.other;
          const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
          return (
            <div key={item.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: `1px solid ${isLow ? '#fca5a5' : 'var(--surface-border)'}` }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cc.bg }}>
                  <Package className="h-5 w-5" style={{ color: cc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: cc.bg, color: cc.color }}>{cc.label}</span>
                    {isLow && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>⚠ Low</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    Min: {item.min_quantity} {item.unit} · {fmt(item.cost_per_unit)}/{item.unit}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold" style={{ color: isLow ? '#dc2626' : 'var(--text-primary)' }}>
                    {item.quantity}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.unit}</p>
                </div>
              </div>

              {/* Adjust + actions row */}
              <div className="flex items-center gap-2 mt-3">
                {adjustId === item.id ? (
                  <>
                    <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)}
                      placeholder="+5 or -2" className="w-24 rounded-xl border px-3 py-1.5 text-sm outline-none"
                      style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                    <button onClick={() => adjustMutation.mutate({ id: item.id, delta: Number(adjustDelta) })}
                      disabled={!adjustDelta || isNaN(Number(adjustDelta))}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: 'var(--accent)' }}>Apply</button>
                    <button onClick={() => { setAdjustId(null); setAdjustDelta(''); }}
                      className="px-3 py-1.5 rounded-xl text-xs btn-secondary">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setAdjustId(item.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold btn-secondary">
                      ± Adjust Stock
                    </button>
                    <button onClick={() => startEdit(item)}
                      className="px-2 py-1.5 rounded-xl btn-secondary">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (confirm('Remove this item?')) deleteMutation.mutate(item.id); }}
                      className="px-2 py-1.5 rounded-xl" style={{ color: '#dc2626' }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit modal */}
      {(showForm || editing) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {editing ? 'Edit Item' : 'Add Supply Item'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}>
                  <X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Car Shampoo"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_CONFIG[c]?.label ?? c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Qty *</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Min Qty</label>
                  <input type="number" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Cost/Unit ₹</label>
                  <input type="number" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Brand, supplier, etc."
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}
                  className="flex-1 btn-secondary py-2.5 rounded-xl text-sm">Cancel</button>
                <button onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}>
                  {editing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
