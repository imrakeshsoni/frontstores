// [catering] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Pencil, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listCateringMenuItems, saveCateringMenuItem, deleteCateringMenuItem, type CateringMenuItem } from '@/lib/db/catering';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const CATEGORIES = ['starter', 'main', 'dessert', 'beverage', 'snack', 'other'];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  starter:  { bg: '#fef3c7', text: '#d97706' },
  main:     { bg: '#dcfce7', text: '#16a34a' },
  dessert:  { bg: '#fce7f3', text: '#db2777' },
  beverage: { bg: '#dbeafe', text: '#2563eb' },
  snack:    { bg: '#ffedd5', text: '#ea580c' },
  other:    { bg: '#f1f5f9', text: '#64748b' },
};

type FormState = { name: string; category: string; price_per_plate: number; min_order: number };
const emptyForm: FormState = { name: '', category: 'main', price_per_plate: 0, min_order: 50 };

export function CateringMenuPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ['catering-menu', tenantId],
    queryFn: () => listCateringMenuItems(tenantId),
    enabled: !!tenantId,
  });

  function startEdit(item: CateringMenuItem) {
    setEditing(item.id);
    setForm({ name: item.name, category: item.category, price_per_plate: item.price_per_plate, min_order: item.min_order });
    setShowForm(false);
  }

  function cancel() {
    setEditing(null);
    setShowForm(false);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.price_per_plate <= 0) { toast.error('Price must be greater than 0'); return; }
    setSaving(true);
    try {
      await saveCateringMenuItem(tenantId, { name: form.name.trim(), category: form.category, price_per_plate: form.price_per_plate, min_order: form.min_order }, editing ?? undefined);
      qc.invalidateQueries({ queryKey: ['catering-menu'] });
      toast.success(editing ? 'Item updated' : 'Item added');
      cancel();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this menu item?')) return;
    await deleteCateringMenuItem(tenantId, id);
    qc.invalidateQueries({ queryKey: ['catering-menu'] });
    toast.success('Deleted');
  }

  const grouped = CATEGORIES.reduce<Record<string, CateringMenuItem[]>>((acc, c) => {
    acc[c] = items.filter(i => i.category === c);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Menu Management</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Manage your catering menu items</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <PlusCircle className="h-4 w-4" />
          Add Item
        </button>
      </div>

      {(showForm || editing !== null) && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Item' : 'New Menu Item'}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Item Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Paneer Butter Masala"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Price/Plate (₹) *</label>
              <input type="number" value={form.price_per_plate || ''} onChange={e => setForm(f => ({ ...f, price_per_plate: Number(e.target.value) }))} placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Min Order</label>
              <input type="number" value={form.min_order || ''} onChange={e => setForm(f => ({ ...f, min_order: Number(e.target.value) }))} placeholder="50"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancel} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              <X className="h-4 w-4" />Cancel
            </button>
          </div>
        </div>
      )}

      {CATEGORIES.map(cat => {
        const list = grouped[cat];
        if (!list || list.length === 0) return null;
        const colors = CATEGORY_COLORS[cat] ?? { bg: '#f1f5f9', text: '#64748b' };
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: colors.bg, color: colors.text }}>{cat}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{list.length} item{list.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {list.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{fmt(item.price_per_plate)}/plate · min {item.min_order}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-tertiary)' }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => del(item.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && !showForm && (
        <div className="text-center py-12 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No menu items yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Add your catering menu items with pricing</p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
            Add First Item
          </button>
        </div>
      )}
    </div>
  );
}
