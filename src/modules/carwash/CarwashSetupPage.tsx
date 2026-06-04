// [carwash] [all tenants] — unified setup: vehicle types, services & pricing, staff
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, X, Users, Car, Droplets, Check } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllVehicleTypes, createVehicleType, updateVehicleType, deleteVehicleType, seedDefaultVehicleTypes,
  listAllServices, createService, updateService, deleteService, isServiceInActiveJobs,
  getAllServicePrices, upsertServicePrice,
  listCarwashStaff, createCarwashStaff, deleteCarwashStaff,
  type CarwashVehicleTypeRecord, type CarwashService,
} from '@/lib/db/carwash';

type Tab = 'vehicles' | 'services' | 'staff';

const ROLES = ['washer', 'polisher', 'detailer', 'manager', 'cashier'];

const ICON_OPTIONS = [
  '🚗','🚙','🏎️','🚐','🛻','🚌','🚎','🚑','🚒','🚕','🚚','🚛','🚜','🛺','🏍️','🛵','🚲',
];

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp = (extra?: string) =>
  `w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${extra ?? ''}`;
const inpStyle = { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' } as React.CSSProperties;

// ── Vehicle Types Tab ─────────────────────────────────────────────────────────
function VehiclesTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarwashVehicleTypeRecord | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🚗');

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['cw-vtypes-all', tenantId],
    queryFn: () => listAllVehicleTypes(tenantId),
    enabled: !!tenantId,
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['cw-vtypes-all'] });
    qc.invalidateQueries({ queryKey: ['cw-vtypes'] });
    qc.invalidateQueries({ queryKey: ['carwash-vehicle-types'] });
  };

  const openAdd = () => { setEditing(null); setName(''); setIcon('🚗'); setShowForm(true); };
  const openEdit = (t: CarwashVehicleTypeRecord) => { setEditing(t); setName(t.name); setIcon(t.icon); setShowForm(true); };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Name required');
      if (editing) return updateVehicleType(tenantId, editing.id, { name: name.trim(), icon, price_multiplier: 1, is_active: editing.is_active, sort_order: editing.sort_order });
      return createVehicleType(tenantId, { name: name.trim(), icon, price_multiplier: 1 });
    },
    onSuccess: () => { toast.success(editing ? 'Updated' : 'Vehicle type added'); setShowForm(false); inv(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicleType(tenantId, id),
    onSuccess: () => { toast.success('Removed'); inv(); },
  });

  const seedMutation = useMutation({
    mutationFn: () => seedDefaultVehicleTypes(tenantId),
    onSuccess: () => { toast.success('Default types added'); inv(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Define the types of vehicles you service.
        </p>
        <div className="flex gap-2">
          {types.length === 0 && (
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
              className="btn-secondary text-sm px-3 py-2 rounded-xl font-semibold">
              Add Defaults
            </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus className="h-4 w-4" /> Add Vehicle Type
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {isLoading && <div className="p-6 text-sm animate-pulse" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!isLoading && types.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2">
            <Car className="h-10 w-10 opacity-20" />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No vehicle types yet. Click "Add Defaults" to get started.</p>
          </div>
        )}
        {types.map((t, i) => (
          <div key={t.id} className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: i < types.length - 1 ? '1px solid var(--surface-border)' : undefined }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.icon}</span>
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
              {!t.is_active && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>Inactive</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Vehicle Type' : 'Add Vehicle Type'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SUV, Bike, Truck"
                className={inp()} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(ic => (
                  <button key={ic} onClick={() => setIcon(ic)}
                    className="h-10 w-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all"
                    style={{ borderColor: icon === ic ? 'var(--accent)' : 'var(--surface-border)', background: icon === ic ? 'var(--surface-2)' : 'transparent' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add Vehicle Type'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Services & Pricing Tab ────────────────────────────────────────────────────
function ServicesTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingSvc, setEditingSvc] = useState<CarwashService | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDuration, setSvcDuration] = useState('30');
  const [svcActive, setSvcActive] = useState(true);
  // local price edits: { [serviceId_vtypeId]: string }
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const savingRef = useRef<Set<string>>(new Set());

  const { data: vtypes = [] } = useQuery({
    queryKey: ['cw-vtypes-all', tenantId],
    queryFn: () => listAllVehicleTypes(tenantId),
    enabled: !!tenantId,
  });

  const { data: services = [], isLoading: svcLoading } = useQuery({
    queryKey: ['cw-services-all', tenantId],
    queryFn: () => listAllServices(tenantId),
    enabled: !!tenantId,
  });

  const { data: pricesMap = {}, refetch: refetchPrices } = useQuery({
    queryKey: ['cw-service-prices', tenantId],
    queryFn: () => getAllServicePrices(tenantId),
    enabled: !!tenantId,
  });

  const invSvc = () => {
    qc.invalidateQueries({ queryKey: ['cw-services-all'] });
    qc.invalidateQueries({ queryKey: ['carwash-services-all'] });
    qc.invalidateQueries({ queryKey: ['carwash-services'] });
  };

  const openAddSvc = () => { setEditingSvc(null); setSvcName(''); setSvcDuration('30'); setSvcActive(true); setShowServiceForm(true); };
  const openEditSvc = (s: CarwashService) => {
    setEditingSvc(s); setSvcName(s.name); setSvcDuration(String(s.duration_minutes)); setSvcActive(s.is_active);
    setShowServiceForm(true);
  };

  const saveSvcMutation = useMutation({
    mutationFn: () => {
      if (!svcName.trim()) throw new Error('Service name required');
      const data = { name: svcName.trim(), description: null, duration_minutes: Number(svcDuration) || 30, is_active: svcActive,
        price_hatchback: 0, price_sedan: 0, price_suv: 0, price_luxury: 0, gst_rate: 0, sort_order: editingSvc?.sort_order ?? 99 };
      return editingSvc ? updateService(tenantId, editingSvc.id, data) : createService(tenantId, data);
    },
    onSuccess: () => { toast.success(editingSvc ? 'Service updated' : 'Service added'); setShowServiceForm(false); invSvc(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteSvcMutation = useMutation({
    mutationFn: async (id: string) => {
      const inUse = await isServiceInActiveJobs(tenantId, id);
      if (inUse) throw new Error('Service is in active jobs. Complete those first.');
      return deleteService(tenantId, id);
    },
    onSuccess: () => { toast.success('Service removed'); invSvc(); refetchPrices(); },
    onError: (e: any) => toast.error(e?.message ?? 'Cannot delete'),
  });

  function priceKey(serviceId: string, vtypeId: string) { return `${serviceId}_${vtypeId}`; }

  function getCellValue(serviceId: string, vtypeId: string): string {
    const key = priceKey(serviceId, vtypeId);
    if (key in priceEdits) return priceEdits[key];
    const p = pricesMap[serviceId]?.[vtypeId];
    return p != null && p > 0 ? String(p) : '';
  }

  async function savePrice(serviceId: string, vtypeId: string, raw: string) {
    const key = priceKey(serviceId, vtypeId);
    if (savingRef.current.has(key)) return;
    const price = parseInt(raw, 10);
    const stored = pricesMap[serviceId]?.[vtypeId] ?? 0;
    if (isNaN(price) && !raw.trim()) {
      // treat empty as 0
      if (stored === 0) { setPriceEdits(e => { const n = { ...e }; delete n[key]; return n; }); return; }
      savingRef.current.add(key);
      await upsertServicePrice(tenantId, serviceId, vtypeId, 0);
      savingRef.current.delete(key);
      setPriceEdits(e => { const n = { ...e }; delete n[key]; return n; });
      refetchPrices();
      return;
    }
    if (isNaN(price)) return;
    if (price === stored) { setPriceEdits(e => { const n = { ...e }; delete n[key]; return n; }); return; }
    savingRef.current.add(key);
    try {
      await upsertServicePrice(tenantId, serviceId, vtypeId, price);
      refetchPrices();
    } finally {
      savingRef.current.delete(key);
      setPriceEdits(e => { const n = { ...e }; delete n[key]; return n; });
    }
  }

  const activeVtypes = vtypes.filter(v => v.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Set prices for each service per vehicle type. Click any price to edit.
        </p>
        <button onClick={openAddSvc}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Service
        </button>
      </div>

      {activeVtypes.length === 0 && (
        <div className="rounded-2xl p-6 text-center text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-tertiary)' }}>
          Add vehicle types first (in the Vehicles tab) to set prices.
        </div>
      )}

      {activeVtypes.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${200 + activeVtypes.length * 110}px` }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)', minWidth: '180px' }}>
                    Service
                  </th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)', width: '70px' }}>Min</th>
                  {activeVtypes.map(vt => (
                    <th key={vt.id} className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)', minWidth: '100px' }}>
                      {vt.icon} {vt.name}
                    </th>
                  ))}
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {svcLoading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    {Array.from({ length: activeVtypes.length + 3 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} /></td>
                    ))}
                  </tr>
                ))}
                {!svcLoading && services.length === 0 && (
                  <tr>
                    <td colSpan={activeVtypes.length + 3} className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      No services yet. Click "Add Service" above.
                    </td>
                  </tr>
                )}
                {services.map(svc => (
                  <tr key={svc.id} style={{ borderBottom: '1px solid var(--surface-border)', opacity: svc.is_active ? 1 : 0.5 }}>
                    <td className="px-4 py-2 sticky left-0" style={{ background: 'var(--surface)' }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditSvc(svc)} className="text-left">
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{svc.name}</p>
                          {!svc.is_active && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Inactive</span>}
                        </button>
                      </div>
                    </td>
                    <td className="text-center px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {svc.duration_minutes}m
                    </td>
                    {activeVtypes.map(vt => {
                      const key = priceKey(svc.id, vt.id);
                      const val = getCellValue(svc.id, vt.id);
                      const isDirty = key in priceEdits;
                      return (
                        <td key={vt.id} className="px-2 py-1.5">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={val}
                              placeholder="—"
                              onChange={e => setPriceEdits(p => ({ ...p, [key]: e.target.value }))}
                              onBlur={e => savePrice(svc.id, vt.id, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              className="w-full rounded-lg border px-2 py-1.5 text-sm text-center font-semibold outline-none"
                              style={{
                                borderColor: isDirty ? 'var(--accent)' : 'var(--surface-border)',
                                background: isDirty ? 'color-mix(in srgb, var(--accent) 8%, var(--surface-2))' : 'var(--surface-2)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            {val && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>₹</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      <button onClick={() => deleteSvcMutation.mutate(svc.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Service add/edit modal */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editingSvc ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => setShowServiceForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Service Name *</label>
              <input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. Basic Wash, Full Detail"
                className={inp()} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration (minutes)</label>
              <input type="number" value={svcDuration} onChange={e => setSvcDuration(e.target.value)} placeholder="30"
                className={inp()} style={inpStyle} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={svcActive} onChange={e => setSvcActive(e.target.checked)} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active (show in job card)</span>
            </label>
            <button onClick={() => saveSvcMutation.mutate()} disabled={saveSvcMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveSvcMutation.isPending ? 'Saving…' : editingSvc ? 'Update Service' : 'Add Service'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────
function StaffTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('washer');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['carwash-staff-list', tenantId],
    queryFn: () => listCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['carwash-staff-list'] });
    qc.invalidateQueries({ queryKey: ['carwash-staff'] });
  };

  const addMutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Name required');
      return createCarwashStaff(tenantId, { name: name.trim(), phone: phone || undefined, role });
    },
    onSuccess: () => { toast.success('Staff member added'); setName(''); setPhone(''); setRole('washer'); setShowForm(false); inv(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCarwashStaff(tenantId, id),
    onSuccess: () => { toast.success('Staff removed'); inv(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Manage your wash team.</p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {isLoading && <div className="p-6 text-sm animate-pulse" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!isLoading && staff.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2">
            <Users className="h-10 w-10 opacity-20" />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No staff added yet</p>
          </div>
        )}
        {staff.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: i < staff.length - 1 ? '1px solid var(--surface-border)' : undefined }}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'var(--accent)' }}>
                {s.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>
                  {s.role}{s.phone ? ` · ${s.phone}` : ''}
                </p>
              </div>
            </div>
            <button onClick={() => deleteMutation.mutate(s.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add Staff</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ramesh"
                className={inp()} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210"
                className={inp()} style={inpStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className={inp()} style={inpStyle}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {addMutation.isPending ? 'Adding…' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'vehicles', label: 'Vehicle Types', icon: <Car className="h-4 w-4" /> },
  { id: 'services', label: 'Services & Pricing', icon: <Droplets className="h-4 w-4" /> },
  { id: 'staff',    label: 'Staff',              icon: <Users className="h-4 w-4" /> },
];

export function CarwashSetupPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [tab, setTab] = useState<Tab>('vehicles');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Setup</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'white' : 'var(--text-secondary)',
            }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'vehicles' && <VehiclesTab tenantId={tenantId} />}
      {tab === 'services' && <ServicesTab tenantId={tenantId} />}
      {tab === 'staff'    && <StaffTab tenantId={tenantId} />}
    </div>
  );
}
