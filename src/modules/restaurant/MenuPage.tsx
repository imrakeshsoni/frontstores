// [restaurant] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, BookOpen, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listMenuCategories,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
  type MenuCategory,
  type MenuItem,
} from '@/lib/db/restaurant';

const GST_OPTIONS = [0, 5, 12, 18];

type CategoryForm = { name: string; sort_order: string };
type ItemForm = {
  name: string;
  category_id: string;
  description: string;
  price: string;
  half_price: string;
  gst_rate: string;
  is_veg: boolean;
  is_available: boolean;
};

const emptyCatForm: CategoryForm = { name: '', sort_order: '0' };
const emptyItemForm: ItemForm = {
  name: '', category_id: '', description: '',
  price: '', half_price: '', gst_rate: '5',
  is_veg: true, is_available: true,
};

export function MenuPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Category form state
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCatForm);

  // Item form state
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['menu-categories', tenantId],
    queryFn: () => listMenuCategories(tenantId),
    enabled: !!tenantId,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items', tenantId, selectedCategoryId],
    queryFn: () => listMenuItems(tenantId, selectedCategoryId),
    enabled: !!tenantId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['menu-categories', tenantId] });
    qc.invalidateQueries({ queryKey: ['menu-items', tenantId] });
  };

  const saveCatMutation = useMutation({
    mutationFn: async () => {
      if (!catForm.name.trim()) throw new Error('Category name is required');
      if (editingCat) {
        await updateMenuCategory(tenantId, editingCat.id, {
          name: catForm.name,
          sort_order: Number(catForm.sort_order) || 0,
        });
      } else {
        await createMenuCategory(tenantId, {
          name: catForm.name,
          sort_order: Number(catForm.sort_order) || 0,
        });
      }
    },
    onSuccess: () => {
      toast.success(editingCat ? 'Category updated' : 'Category created');
      invalidate();
      setShowCatForm(false);
      setEditingCat(null);
      setCatForm(emptyCatForm);
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save category'),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => deleteMenuCategory(tenantId, id),
    onSuccess: () => {
      toast.success('Category removed');
      invalidate();
      if (selectedCategoryId) setSelectedCategoryId(null);
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      if (!itemForm.name.trim()) throw new Error('Item name is required');
      if (!itemForm.price || Number(itemForm.price) <= 0) throw new Error('Price must be greater than 0');
      const payload = {
        name: itemForm.name.trim(),
        category_id: itemForm.category_id || null,
        description: itemForm.description.trim() || null,
        price: Number(itemForm.price),
        half_price: itemForm.half_price ? Number(itemForm.half_price) : null,
        gst_rate: Number(itemForm.gst_rate),
        is_veg: itemForm.is_veg,
        is_available: itemForm.is_available,
      };
      if (editingItem) {
        await updateMenuItem(tenantId, editingItem.id, {
          ...payload,
          is_veg: payload.is_veg ? 1 : 0,
          is_available: payload.is_available ? 1 : 0,
        });
      } else {
        await createMenuItem(tenantId, payload);
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? 'Item updated' : 'Item created');
      invalidate();
      setShowItemForm(false);
      setEditingItem(null);
      setItemForm(emptyItemForm);
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save item'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteMenuItem(tenantId, id),
    onSuccess: () => { toast.success('Item removed'); invalidate(); },
  });

  const toggleAvailMutation = useMutation({
    mutationFn: (id: string) => toggleMenuItemAvailability(tenantId, id),
    onSuccess: () => { invalidate(); },
  });

  function openEditCat(cat: MenuCategory) {
    setEditingCat(cat);
    setCatForm({ name: cat.name, sort_order: String(cat.sort_order) });
    setShowCatForm(true);
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category_id: item.category_id ?? '',
      description: item.description ?? '',
      price: String(item.price),
      half_price: item.half_price ? String(item.half_price) : '',
      gst_rate: String(item.gst_rate),
      is_veg: !!item.is_veg,
      is_available: !!item.is_available,
    });
    setShowItemForm(true);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="flex h-full min-h-0">
      {/* Left — category list */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: '1px solid var(--surface-border)', background: 'var(--surface)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Categories
            </h2>
            <button
              className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
              onClick={() => { setEditingCat(null); setCatForm(emptyCatForm); setShowCatForm(true); }}
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {catsLoading && (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-lg bg-slate-200 animate-pulse" />
              ))}
            </div>
          )}
          {!catsLoading && (
            <>
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedCategoryId === null ? 'font-semibold' : ''
                }`}
                style={{
                  color: selectedCategoryId === null ? 'var(--accent)' : 'var(--text-primary)',
                  background: selectedCategoryId === null ? 'var(--surface-2)' : 'transparent',
                }}
              >
                All Items
              </button>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center group"
                  style={{
                    background: selectedCategoryId === cat.id ? 'var(--surface-2)' : 'transparent',
                    borderLeft: selectedCategoryId === cat.id ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <button
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className="flex-1 text-left px-4 py-2.5 text-sm transition-colors"
                    style={{
                      color: selectedCategoryId === cat.id ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {cat.name}
                  </button>
                  <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditCat(cat)}
                      className="p-1 rounded hover:bg-blue-100 text-blue-500"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => deleteCatMutation.mutate(cat.id)}
                      className="p-1 rounded hover:bg-rose-100 text-rose-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="p-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  No categories yet
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Right — items */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}
        >
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {selectedCategory ? selectedCategory.name : 'All Menu Items'}
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => {
              setEditingItem(null);
              setItemForm({
                ...emptyItemForm,
                category_id: selectedCategoryId ?? '',
              });
              setShowItemForm(true);
            }}
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {itemsLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card p-4 h-16 animate-pulse" style={{ background: 'var(--surface-2)' }} />
              ))}
            </div>
          )}

          {!itemsLoading && items.length === 0 && (
            <div
              className="flex flex-col items-center justify-center h-64 gap-3"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <BookOpen className="h-12 w-12 opacity-30" />
              <p className="text-sm">No items in this category</p>
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemForm({ ...emptyItemForm, category_id: selectedCategoryId ?? '' });
                  setShowItemForm(true);
                }}
              >
                <Plus size={14} /> Add First Item
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="card p-4"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-border)',
                  opacity: item.is_available ? 1 : 0.6,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Veg / Non-veg dot */}
                    <span
                      className="flex-shrink-0 h-3 w-3 rounded-full border-2"
                      style={{
                        background: item.is_veg ? '#16a34a' : '#dc2626',
                        borderColor: item.is_veg ? '#16a34a' : '#dc2626',
                      }}
                      title={item.is_veg ? 'Veg' : 'Non-Veg'}
                    />
                    <p
                      className="font-semibold text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditItem(item)}
                      className="p-1.5 rounded-full hover:bg-blue-100 text-blue-500"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => deleteItemMutation.mutate(item.id)}
                      className="p-1.5 rounded-full hover:bg-rose-100 text-rose-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {item.category_name && (
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    {item.category_name}
                  </p>
                )}
                {item.description && (
                  <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2">
                  <div>
                    <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
                      {fmt(item.price)}
                    </span>
                    {item.half_price && (
                      <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                        Half: {fmt(item.half_price)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}
                    >
                      GST {item.gst_rate}%
                    </span>
                    <button
                      onClick={() => toggleAvailMutation.mutate(item.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors`}
                      style={{ background: item.is_available ? 'var(--accent)' : '#94a3b8' }}
                      title={item.is_available ? 'Available — click to hide' : 'Unavailable — click to show'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          item.is_available ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingCat ? 'Edit Category' : 'New Category'}
              </h2>
              <button
                onClick={() => { setShowCatForm(false); setEditingCat(null); }}
                className="p-2 rounded-full hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Name *
                </label>
                <input
                  className="input w-full"
                  value={catForm.name}
                  onChange={(e) => setCatForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. Starters"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Sort Order
                </label>
                <input
                  type="number"
                  className="input w-full"
                  value={catForm.sort_order}
                  onChange={(e) => setCatForm((c) => ({ ...c, sort_order: e.target.value }))}
                  min="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                className="btn-secondary"
                onClick={() => { setShowCatForm(false); setEditingCat(null); }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => saveCatMutation.mutate()}
                disabled={saveCatMutation.isPending}
              >
                {saveCatMutation.isPending ? 'Saving…' : editingCat ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingItem ? 'Edit Item' : 'New Menu Item'}
              </h2>
              <button
                onClick={() => { setShowItemForm(false); setEditingItem(null); }}
                className="p-2 rounded-full hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Name *
                </label>
                <input
                  className="input w-full"
                  value={itemForm.name}
                  onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Paneer Tikka"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Category
                </label>
                <select
                  className="input w-full"
                  value={itemForm.category_id}
                  onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Description
                </label>
                <textarea
                  className="input w-full resize-none"
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description…"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    Full Price (₹) *
                  </label>
                  <input
                    type="number"
                    className="input w-full"
                    value={itemForm.price}
                    onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))}
                    min="0"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    Half Price (₹)
                  </label>
                  <input
                    type="number"
                    className="input w-full"
                    value={itemForm.half_price}
                    onChange={(e) => setItemForm((f) => ({ ...f, half_price: e.target.value }))}
                    min="0"
                    step="0.5"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  GST Rate
                </label>
                <select
                  className="input w-full"
                  value={itemForm.gst_rate}
                  onChange={(e) => setItemForm((f) => ({ ...f, gst_rate: e.target.value }))}
                >
                  {GST_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}%</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Veg</span>
                  <button
                    type="button"
                    onClick={() => setItemForm((f) => ({ ...f, is_veg: !f.is_veg }))}
                    className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors"
                    style={{ background: itemForm.is_veg ? '#16a34a' : '#dc2626' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        itemForm.is_veg ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs" style={{ color: itemForm.is_veg ? '#16a34a' : '#dc2626' }}>
                    {itemForm.is_veg ? 'Veg' : 'Non-Veg'}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Available</span>
                  <button
                    type="button"
                    onClick={() => setItemForm((f) => ({ ...f, is_available: !f.is_available }))}
                    className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors"
                    style={{ background: itemForm.is_available ? 'var(--accent)' : '#94a3b8' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        itemForm.is_available ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="btn-secondary"
                onClick={() => { setShowItemForm(false); setEditingItem(null); }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => saveItemMutation.mutate()}
                disabled={saveItemMutation.isPending}
              >
                {saveItemMutation.isPending ? 'Saving…' : editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
