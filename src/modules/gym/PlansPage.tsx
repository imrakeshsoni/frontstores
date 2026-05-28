// [gym] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listPlans, savePlan, deletePlan, type GymPlan } from '@/lib/db/gym';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const EMPTY: Partial<GymPlan> & { name: string } = { name: '', duration_days: 30, price: 0, description: null, is_active: true };

export function PlansPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: plans = [] } = useQuery({ queryKey: ['gym-plans', tenantId], queryFn: () => listPlans(tenantId), enabled: !!tenantId });

  const save = useMutation({
    mutationFn: (d: typeof EMPTY) => savePlan(tenantId, d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-plans'] }); setForm(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePlan(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gym-plans'] }),
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const presets = [
    { name: 'Monthly', duration_days: 30 },
    { name: 'Quarterly', duration_days: 90 },
    { name: 'Half Yearly', duration_days: 180 },
    { name: 'Annual', duration_days: 365 },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Membership Plans</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
            <p className="text-4xl mb-2">📋</p>
            <p className="font-medium">No plans created yet</p>
            <p className="text-sm mt-1 text-slate-400">Add membership plans to get started</p>
          </div>
        ) : plans.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {p.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-1">{fmt(p.price)}</p>
            <p className="text-sm text-slate-500">{p.duration_days} days</p>
            {p.description && <p className="text-xs text-slate-400 mt-2">{p.description}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setForm({ ...p })} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-blue-600 border border-blue-100 hover:bg-blue-50">Edit</button>
              <button onClick={() => { if (confirm(`Delete plan "${p.name}"?`)) del.mutate(p.id!); }} className="py-1.5 px-3 rounded-lg text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Plan' : 'Add Plan'}</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {presets.map(p => (
                <button key={p.name} onClick={() => setForm(f => f ? { ...f, name: p.name, duration_days: p.duration_days } : f)}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">{p.name}</button>
              ))}
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Plan Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} placeholder="e.g. Monthly" autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Duration (Days)</label><input type="number" className="input w-full" value={form.duration_days} onChange={e => up('duration_days', Number(e.target.value))} /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Price (₹)</label><input type="number" className="input w-full" value={form.price} onChange={e => up('price', Number(e.target.value))} /></div>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Description</label><input className="input w-full" value={form.description ?? ''} onChange={e => up('description', e.target.value || null)} placeholder="Optional description" /></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.is_active} onChange={e => up('is_active', e.target.checked)} className="rounded" />
                <span className="text-sm text-slate-700">Active plan</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
