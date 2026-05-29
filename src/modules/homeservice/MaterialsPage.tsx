// [homeservice] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listMaterials, createMaterial, type HsMaterial } from '@/lib/db/homeservice';

export function MaterialsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'piece', stock: '', purchase_price: '', selling_price: '' });

  const { data: materials = [] } = useQuery({ queryKey: ['hs-materials', tenantId], queryFn: () => listMaterials(tenantId) });

  const saveMutation = useMutation({
    mutationFn: () => createMaterial(tenantId, { ...form, stock: Number(form.stock) || 0, purchase_price: Number(form.purchase_price) || 0, selling_price: Number(form.selling_price) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hs-materials'] }); setAdding(false); setForm({ name: '', unit: 'piece', stock: '', purchase_price: '', selling_price: '' }); toast.success('Material saved'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Materials / Parts</h1>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {adding && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Unit</label>
              <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                {['piece', 'meter', 'kg', 'litre', 'box'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Stock</label><input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} /></div>
            <div className="space-y-1"><label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Selling Price ₹</label><input type="number" value={form.selling_price} onChange={e => setForm(p => ({ ...p, selling_price: e.target.value }))} className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMutation.mutate()} disabled={!form.name} className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(materials as HsMaterial[]).map((m: HsMaterial) => (
          <div key={m.id} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                {m.stock <= 2 && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Stock: {m.stock} {m.unit} · ₹{m.selling_price}/{m.unit}</p>
            </div>
          </div>
        ))}
        {materials.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No materials added yet</p>}
      </div>
    </div>
  );
}
