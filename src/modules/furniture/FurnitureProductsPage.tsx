// [furniture] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listFurnProducts, createFurnProduct, updateFurnProduct, deleteFurnProduct } from '@/lib/db/furniture';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function FurnitureProductsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', material: '', dimensions: '', stock: '', purchase_price: '', selling_price: '' });
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['furn-products', tenantId, search],
    queryFn: () => listFurnProducts(tenantId, search),
    enabled: !!tenantId,
  });

  function resetForm() { setForm({ name: '', category: '', material: '', dimensions: '', stock: '', purchase_price: '', selling_price: '' }); setShowAdd(false); setEditId(null); }

  async function handleSave() {
    if (!form.name) { toast.error('Product name required'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        category: form.category,
        material: form.material,
        dimensions: form.dimensions,
        stock: parseInt(form.stock) || 0,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
      };
      if (editId) {
        await updateFurnProduct(tenantId, editId, data);
        toast.success('Product updated');
      } else {
        await createFurnProduct(tenantId, data);
        toast.success('Product added');
      }
      resetForm();
      qc.invalidateQueries({ queryKey: ['furn-products', tenantId] });
      qc.invalidateQueries({ queryKey: ['furn-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  function startEdit(p: (typeof products)[0]) {
    setEditId(p.id);
    setForm({ name: p.name, category: p.category, material: p.material, dimensions: p.dimensions, stock: String(p.stock), purchase_price: String(p.purchase_price), selling_price: String(p.selling_price) });
    setShowAdd(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return;
    try { await deleteFurnProduct(tenantId, id); toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['furn-products', tenantId] }); }
    catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Furniture Catalog</h1>
        <button onClick={() => { resetForm(); setShowAdd(s => !s); }} className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
          + Add Product
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">{editId ? 'Edit Product' : 'New Product'}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ['Product Name *', 'name', 'text'],
              ['Category', 'category', 'text'],
              ['Material', 'material', 'text'],
              ['Dimensions', 'dimensions', 'text'],
              ['Stock Qty', 'stock', 'number'],
              ['Purchase Price (₹)', 'purchase_price', 'number'],
              ['Selling Price (₹)', 'selling_price', 'number'],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type={type} value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={resetForm} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl bg-amber-700 text-white text-sm font-semibold disabled:opacity-40 hover:bg-amber-600">
              {saving ? 'Saving…' : editId ? 'Update' : 'Add Product'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {products.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No products yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Material</th>
                  <th className="pb-2 font-medium">Dimensions</th>
                  <th className="pb-2 font-medium">Stock</th>
                  <th className="pb-2 font-medium">Price</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="py-2 text-slate-500">{p.category}</td>
                    <td className="py-2 text-slate-500">{p.material}</td>
                    <td className="py-2 text-slate-500">{p.dimensions}</td>
                    <td className="py-2">{p.stock}</td>
                    <td className="py-2 font-semibold text-amber-700">{fmt(p.selling_price)}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
