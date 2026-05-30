// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, GripVertical } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllVehicleTypes, createVehicleType, updateVehicleType, deleteVehicleType,
  type CarwashVehicleTypeRecord,
} from '@/lib/db/carwash';

// All available icons the user can pick from
const ICON_OPTIONS = [
  // Cars
  { icon: '🚗', label: 'Hatchback' },
  { icon: '🚙', label: 'Sedan' },
  { icon: '🏎️', label: 'Sports' },
  { icon: '🚐', label: 'SUV / MPV' },
  { icon: '🛻', label: 'Pickup' },
  // Bikes
  { icon: '🏍️', label: 'Motorcycle' },
  { icon: '🛵', label: 'Scooter' },
  { icon: '🚲', label: 'Bicycle' },
  // Commercial
  { icon: '🚌', label: 'Bus' },
  { icon: '🚎', label: 'Minibus' },
  { icon: '🚐', label: 'Van' },
  { icon: '🚑', label: 'Ambulance' },
  { icon: '🚒', label: 'Fire Truck' },
  { icon: '🚓', label: 'Police' },
  { icon: '🚕', label: 'Taxi / Cab' },
  { icon: '🚚', label: 'Mini Truck' },
  { icon: '🚛', label: 'Heavy Truck' },
  { icon: '🚜', label: 'Tractor' },
  // Indian specific
  { icon: '🛺', label: 'Auto' },
  { icon: '🛤️', label: 'Tempo' },
  // Other
  { icon: '🚁', label: 'Helicopter' },
  { icon: '⛵', label: 'Boat' },
  { icon: '🚢', label: 'Ship' },
  { icon: '✈️', label: 'Aircraft' },
];

// Common multiplier presets
const MULTIPLIER_PRESETS = [
  { label: 'Bike (0.4×)', value: 0.4 },
  { label: 'Auto (0.5×)', value: 0.5 },
  { label: 'Hatchback (0.75×)', value: 0.75 },
  { label: 'Sedan (1×)', value: 1.0 },
  { label: 'SUV (1.4×)', value: 1.4 },
  { label: 'Van (1.8×)', value: 1.8 },
  { label: 'Luxury (2×)', value: 2.0 },
  { label: 'Bus (2.5×)', value: 2.5 },
  { label: 'Truck (3×)', value: 3.0 },
];

type VTypeForm = { name: string; icon: string; price_multiplier: string };
const emptyForm: VTypeForm = { name: '', icon: '🚗', price_multiplier: '1.0' };

export function CarwashVehicleTypesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarwashVehicleTypeRecord | null>(null);
  const [form, setForm] = useState<VTypeForm>(emptyForm);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const { data: vehicleTypes = [], isLoading } = useQuery({
    queryKey: ['carwash-vtypes', tenantId],
    queryFn: () => listAllVehicleTypes(tenantId),
    enabled: !!tenantId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['carwash-vtypes', tenantId] });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Name is required');
      const mul = parseFloat(form.price_multiplier);
      if (isNaN(mul) || mul <= 0) throw new Error('Enter a valid price multiplier');
      return createVehicleType(tenantId, { name: form.name, icon: form.icon, price_multiplier: mul });
    },
    onSuccess: () => {
      toast.success('Vehicle type added');
      setShowForm(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) return Promise.resolve();
      const mul = parseFloat(form.price_multiplier);
      if (isNaN(mul) || mul <= 0) throw new Error('Enter a valid price multiplier');
      return updateVehicleType(tenantId, editing.id, {
        name: form.name.trim(),
        icon: form.icon,
        price_multiplier: mul,
        is_active: editing.is_active,
        sort_order: editing.sort_order,
      });
    },
    onSuccess: () => {
      toast.success('Updated');
      setEditing(null);
      setForm(emptyForm);
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: (vt: CarwashVehicleTypeRecord) =>
      updateVehicleType(tenantId, vt.id, { ...vt, is_active: !vt.is_active }),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicleType(tenantId, id),
    onSuccess: () => { toast.success('Removed'); invalidate(); },
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (vt: CarwashVehicleTypeRecord) => {
    setEditing(vt);
    setForm({ name: vt.name, icon: vt.icon, price_multiplier: String(vt.price_multiplier) });
    setShowForm(true);
  };

  // Example: show what price looks like for a ₹200 sedan service
  const examplePrice = (mul: number) => Math.round(200 * mul);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Vehicle Types</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            Prices are multiplied from your sedan service price
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Type
        </button>
      </div>

      {/* How it works banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <span className="text-xl">💡</span>
        <div className="text-sm" style={{ color: '#0369a1' }}>
          <p className="font-semibold">How pricing works</p>
          <p className="mt-0.5">Each vehicle type has a multiplier vs. Sedan (1×). Example: if Foam Wash costs ₹200 for Sedan, a Truck at 2.5× costs ₹500 automatically.</p>
        </div>
      </div>

      {/* Vehicle type list */}
      {isLoading && Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
      ))}

      <div className="space-y-2">
        {vehicleTypes.map((vt) => (
          <div key={vt.id} className={`rounded-2xl p-4 flex items-center gap-4 transition-opacity ${!vt.is_active ? 'opacity-50' : ''}`}
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>

            {/* Icon */}
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: 'var(--surface-2)' }}>
              {vt.icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{vt.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#dbeafe', color: '#2563eb' }}>
                  {vt.price_multiplier}× sedan
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Example: ₹200 service → ₹{examplePrice(vt.price_multiplier)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => toggleMutation.mutate(vt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all`}
                style={vt.is_active
                  ? { background: '#dcfce7', color: '#16a34a' }
                  : { background: '#f3f4f6', color: '#6b7280' }}>
                {vt.is_active ? 'Active' : 'Hidden'}
              </button>
              <button onClick={() => openEdit(vt)}
                className="p-2 rounded-xl btn-secondary">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => {
                if (confirm(`Delete "${vt.name}"?`)) deleteMutation.mutate(vt.id);
              }} className="p-2 rounded-xl" style={{ color: '#dc2626' }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {vehicleTypes.length === 0 && !isLoading && (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="text-3xl mb-3">🚗</p>
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No vehicle types yet</p>
            <button onClick={openAdd} className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
              Add First Type
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl w-full max-w-sm" style={{ background: 'var(--surface)' }}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {editing ? 'Edit Vehicle Type' : 'Add Vehicle Type'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); setShowIconPicker(false); }}>
                  <X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>

              {/* Icon selector */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Icon</label>
                <button onClick={() => setShowIconPicker(p => !p)}
                  className="flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)' }}>
                  <span className="text-3xl">{form.icon}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {showIconPicker ? 'Close picker' : 'Tap to choose icon'}
                  </span>
                </button>

                {showIconPicker && (
                  <div className="mt-2 rounded-xl p-3 grid grid-cols-6 gap-2 max-h-52 overflow-y-auto"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                    {ICON_OPTIONS.map(opt => (
                      <button key={opt.icon + opt.label} onClick={() => { setForm(f => ({ ...f, icon: opt.icon })); setShowIconPicker(false); }}
                        title={opt.label}
                        className={`h-11 w-11 rounded-xl text-2xl flex items-center justify-center transition-all hover:scale-110 ${form.icon === opt.icon ? 'ring-2 ring-offset-1' : ''}`}
                        style={{
                          background: form.icon === opt.icon ? '#e0f2fe' : 'var(--surface)',
                          outline: form.icon === opt.icon ? '2px solid var(--accent)' : 'none',
                        }}>
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Mini Truck, School Bus, Auto…"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>

              {/* Price multiplier */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Price Multiplier * &nbsp;
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    (vs Sedan = 1×)
                  </span>
                </label>

                {/* Preset chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {MULTIPLIER_PRESETS.map(p => (
                    <button key={p.value} onClick={() => setForm(f => ({ ...f, price_multiplier: String(p.value) }))}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                      style={parseFloat(form.price_multiplier) === p.value
                        ? { background: 'var(--accent)', color: '#fff' }
                        : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <input type="number" step="0.1" min="0.1" max="10"
                  value={form.price_multiplier}
                  onChange={e => setForm(f => ({ ...f, price_multiplier: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />

                {/* Live preview */}
                {form.price_multiplier && !isNaN(parseFloat(form.price_multiplier)) && (
                  <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    A ₹200 Sedan service → <span style={{ color: 'var(--accent)' }}>₹{examplePrice(parseFloat(form.price_multiplier))}</span> for {form.name || 'this type'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); setShowIconPicker(false); }}
                  className="flex-1 btn-secondary py-2.5 rounded-xl text-sm">Cancel</button>
                <button onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}>
                  {editing ? 'Save Changes' : `Add ${form.icon} ${form.name || 'Type'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
