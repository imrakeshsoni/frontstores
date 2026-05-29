// [homeservice] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listTechnicians, createTechnician, deleteTechnician } from '@/lib/db/homeservice';

export function TechniciansPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', specialization: '' });

  const { data: techs = [] } = useQuery({ queryKey: ['hs-techs', tenantId], queryFn: () => listTechnicians(tenantId) });

  const saveMutation = useMutation({
    mutationFn: () => createTechnician(tenantId, { ...form, status: 'active' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hs-techs'] }); setAdding(false); setForm({ name: '', phone: '', specialization: '' }); toast.success('Technician added'); },
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteTechnician(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hs-techs'] }); toast.success('Removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Technicians</h1>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {adding && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="grid grid-cols-3 gap-3">
            {(['name', 'phone', 'specialization'] as const).map(f => (
              <div key={f} className="space-y-1">
                <label className="text-xs font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>{f}</label>
                <input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMutation.mutate()} disabled={!form.name} className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(techs as import('@/lib/db/homeservice').HsTechnician[]).map(t => (
          <div key={t.id} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.specialization} · {t.phone}</p>
            </div>
            <button onClick={() => delMutation.mutate(t.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {techs.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No technicians yet</p>}
      </div>
    </div>
  );
}
