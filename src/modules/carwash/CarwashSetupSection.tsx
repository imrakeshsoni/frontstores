// [carwash] [all tenants] — Setup section embedded at bottom of SettingsPage
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, X, Users, Car, Droplets } from 'lucide-react';
import {
  listAllVehicleTypes, createVehicleType, updateVehicleType, deleteVehicleType, seedDefaultVehicleTypes,
  listAllServices, createService, updateService, deleteService, isServiceInActiveJobs,
  getAllServicePrices, upsertServicePrice,
  listCarwashStaff, createCarwashStaff, deleteCarwashStaff,
  type CarwashVehicleTypeRecord, type CarwashService,
} from '@/lib/db/carwash';

type Tab = 'vehicles' | 'services' | 'staff';

const ROLES = ['washer', 'polisher', 'detailer', 'manager', 'cashier'];
const ICON_OPTIONS = ['🚗','🚙','🏎️','🚐','🛻','🚌','🚎','🚑','🚒','🚕','🚚','🚛','🚜','🛺','🏍️','🛵','🚲'];

const inp = 'w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2';
const inpStyle = { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' } as React.CSSProperties;

// ── Vehicle Types ─────────────────────────────────────────────────────────────
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Define the types of vehicles you service.</p>
        <div className="flex gap-2">
          {types.length === 0 && (
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
              className="btn-secondary text-xs px-3 py-1.5 rounded-lg font-semibold">Add Defaults</button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus className="h-3.5 w-3.5" /> Add Type
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
        {isLoading && <div className="p-4 text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!isLoading && types.length === 0 && (
          <div className="flex flex-col items-center py-8 gap-2">
            <Car className="h-8 w-8 opacity-20" />
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No vehicle types yet.</p>
          </div>
        )}
        {types.map((t, i) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: i < types.length - 1 ? '1px solid var(--surface-border)' : undefined }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{t.icon}</span>
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit' : 'Add'} Vehicle Type</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SUV, Bike, Truck"
                className={inp} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(ic => (
                  <button key={ic} onClick={() => setIcon(ic)}
                    className="h-9 w-9 rounded-xl text-lg flex items-center justify-center border-2 transition-all"
                    style={{ borderColor: icon === ic ? 'var(--accent)' : 'var(--surface-border)', background: icon === ic ? 'var(--surface-2)' : 'transparent' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add Vehicle Type'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Services & Pricing ────────────────────────────────────────────────────────
function ServicesTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSvc, setEditingSvc] = useState<CarwashService | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDuration, setSvcDuration] = useState('30');
  const [svcActive, setSvcActive] = useState(true);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [durationEdits, setDurationEdits] = useState<Record<string, string>>({});
  const savingRef = useRef<Set<string>>(new Set());

  const { data: vtypes = [] } = useQuery({ queryKey: ['cw-vtypes-all', tenantId], queryFn: () => listAllVehicleTypes(tenantId), enabled: !!tenantId });
  const { data: services = [], isLoading } = useQuery({ queryKey: ['cw-services-all', tenantId], queryFn: () => listAllServices(tenantId), enabled: !!tenantId });
  const { data: pricesMap = {}, refetch: refetchPrices } = useQuery({ queryKey: ['cw-service-prices', tenantId], queryFn: () => getAllServicePrices(tenantId), enabled: !!tenantId });

  const invSvc = () => { qc.invalidateQueries({ queryKey: ['cw-services-all'] }); qc.invalidateQueries({ queryKey: ['carwash-services-all'] }); qc.invalidateQueries({ queryKey: ['carwash-services'] }); };

  const openAdd = () => { setEditingSvc(null); setSvcName(''); setSvcDuration('30'); setSvcActive(true); setShowForm(true); };
  const openEdit = (s: CarwashService) => { setEditingSvc(s); setSvcName(s.name); setSvcDuration(String(s.duration_minutes)); setSvcActive(s.is_active); setShowForm(true); };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!svcName.trim()) throw new Error('Service name required');
      const data = { name: svcName.trim(), description: null, duration_minutes: Number(svcDuration) || 30, is_active: svcActive, price_hatchback: 0, price_sedan: 0, price_suv: 0, price_luxury: 0, gst_rate: 0, sort_order: editingSvc?.sort_order ?? 99 };
      return editingSvc ? updateService(tenantId, editingSvc.id, data) : createService(tenantId, data);
    },
    onSuccess: () => { toast.success(editingSvc ? 'Updated' : 'Service added'); setShowForm(false); invSvc(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (await isServiceInActiveJobs(tenantId, id)) throw new Error('Service is in active jobs.');
      return deleteService(tenantId, id);
    },
    onSuccess: () => { toast.success('Removed'); invSvc(); refetchPrices(); },
    onError: (e: any) => toast.error(e?.message ?? 'Cannot delete'),
  });

  async function saveDuration(svc: CarwashService, raw: string) {
    const mins = parseInt(raw, 10);
    if (isNaN(mins) || mins <= 0 || mins === svc.duration_minutes) {
      setDurationEdits(e => { const n = { ...e }; delete n[svc.id]; return n; });
      return;
    }
    try {
      await updateService(tenantId, svc.id, { ...svc, duration_minutes: mins });
      invSvc();
    } finally {
      setDurationEdits(e => { const n = { ...e }; delete n[svc.id]; return n; });
    }
  }

  const key = (sid: string, vid: string) => `${sid}_${vid}`;
  const getCellVal = (sid: string, vid: string) => {
    const k = key(sid, vid);
    if (k in priceEdits) return priceEdits[k];
    const p = pricesMap[sid]?.[vid];
    return p != null && p > 0 ? String(p) : '';
  };

  async function savePrice(sid: string, vid: string, raw: string) {
    const k = key(sid, vid);
    if (savingRef.current.has(k)) return;
    const price = parseInt(raw, 10);
    const stored = pricesMap[sid]?.[vid] ?? 0;
    const val = isNaN(price) ? 0 : price;
    if (val === stored) { setPriceEdits(e => { const n = { ...e }; delete n[k]; return n; }); return; }
    savingRef.current.add(k);
    try { await upsertServicePrice(tenantId, sid, vid, val); refetchPrices(); }
    finally { savingRef.current.delete(k); setPriceEdits(e => { const n = { ...e }; delete n[k]; return n; }); }
  }

  const activeVtypes = vtypes.filter(v => v.is_active);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Click any price cell and type the amount. Saves on Enter or click away.</p>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-3.5 w-3.5" /> Add Service
        </button>
      </div>

      {activeVtypes.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>Add vehicle types first (in the Vehicles tab).</p>
      )}

      {activeVtypes.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${180 + activeVtypes.length * 100}px` }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs sticky left-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)', minWidth: '150px' }}>Service</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)', width: '55px' }}>Min</th>
                  {activeVtypes.map(vt => (
                    <th key={vt.id} className="text-center px-2 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)', minWidth: '90px' }}>
                      {vt.icon} {vt.name}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    {Array.from({ length: activeVtypes.length + 3 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="h-3 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && services.length === 0 && (
                  <tr><td colSpan={activeVtypes.length + 3} className="text-center py-8 text-xs" style={{ color: 'var(--text-tertiary)' }}>No services yet.</td></tr>
                )}
                {services.map(svc => (
                  <tr key={svc.id} style={{ borderBottom: '1px solid var(--surface-border)', opacity: svc.is_active ? 1 : 0.5 }}>
                    <td className="px-4 py-2 sticky left-0" style={{ background: 'var(--surface)' }}>
                      <button onClick={() => openEdit(svc)} className="text-left">
                        <p className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{svc.name}</p>
                      </button>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <div className="relative">
                        <input
                          type="number" min="1"
                          value={svc.id in durationEdits ? durationEdits[svc.id] : String(svc.duration_minutes)}
                          onChange={e => setDurationEdits(d => ({ ...d, [svc.id]: e.target.value }))}
                          onBlur={e => saveDuration(svc, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="w-full rounded-lg border px-1.5 py-1.5 text-xs text-center font-semibold outline-none"
                          style={{ borderColor: svc.id in durationEdits ? 'var(--accent)' : 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', minWidth: '52px' }}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>m</span>
                      </div>
                    </td>
                    {activeVtypes.map(vt => {
                      const k = key(svc.id, vt.id);
                      const val = getCellVal(svc.id, vt.id);
                      const dirty = k in priceEdits;
                      return (
                        <td key={vt.id} className="px-1.5 py-1.5">
                          <div className="relative">
                            <input
                              type="number" min="0" value={val} placeholder="—"
                              onChange={e => setPriceEdits(p => ({ ...p, [k]: e.target.value }))}
                              onBlur={e => savePrice(svc.id, vt.id, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              className="w-full rounded-lg border px-1.5 py-1.5 text-xs text-center font-semibold outline-none"
                              style={{ borderColor: dirty ? 'var(--accent)' : 'var(--surface-border)', background: dirty ? 'color-mix(in srgb, var(--accent) 8%, var(--surface-2))' : 'var(--surface-2)', color: 'var(--text-primary)' }}
                            />
                            {val && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>₹</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-1.5 py-1.5">
                      <button onClick={() => deleteMutation.mutate(svc.id)} className="p-1 rounded text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editingSvc ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Service Name *</label>
              <input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. Basic Wash"
                className={inp} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration (minutes)</label>
              <input type="number" value={svcDuration} onChange={e => setSvcDuration(e.target.value)} className={inp} style={inpStyle} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={svcActive} onChange={e => setSvcActive(e.target.checked)} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active (show in job card)</span>
            </label>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editingSvc ? 'Update' : 'Add Service'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff ─────────────────────────────────────────────────────────────────────
function StaffTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('washer');

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['carwash-staff-list', tenantId], queryFn: () => listCarwashStaff(tenantId), enabled: !!tenantId });
  const inv = () => { qc.invalidateQueries({ queryKey: ['carwash-staff-list'] }); qc.invalidateQueries({ queryKey: ['carwash-staff'] }); };

  const addMutation = useMutation({
    mutationFn: () => { if (!name.trim()) throw new Error('Name required'); return createCarwashStaff(tenantId, { name: name.trim(), phone: phone || undefined, role }); },
    onSuccess: () => { toast.success('Added'); setName(''); setPhone(''); setRole('washer'); setShowForm(false); inv(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCarwashStaff(tenantId, id),
    onSuccess: () => { toast.success('Removed'); inv(); },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Manage your wash team.</p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-3.5 w-3.5" /> Add Staff
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
        {isLoading && <div className="p-4 text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!isLoading && staff.length === 0 && (
          <div className="flex flex-col items-center py-8 gap-2"><Users className="h-8 w-8 opacity-20" /><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No staff yet</p></div>
        )}
        {staff.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: i < staff.length - 1 ? '1px solid var(--surface-border)' : undefined }}>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent)', color: 'var(--on-accent, #111)' }}>
                {s.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.role}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
            </div>
            <button onClick={() => deleteMutation.mutate(s.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
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
            <div><label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ramesh" className={inp} style={inpStyle} autoFocus /></div>
            <div><label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" className={inp} style={inpStyle} /></div>
            <div><label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className={inp} style={inpStyle}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {addMutation.isPending ? 'Adding…' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main exported section ─────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'vehicles', label: 'Vehicle Types',      icon: <Car className="h-3.5 w-3.5" /> },
  { id: 'services', label: 'Services & Pricing', icon: <Droplets className="h-3.5 w-3.5" /> },
  { id: 'staff',    label: 'Staff',              icon: <Users className="h-3.5 w-3.5" /> },
];

export function CarwashSetupSection({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<Tab>('vehicles');

  return (
    <div className="card p-6 space-y-4">
      <p className="section-label">Car Wash Setup</p>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'white' : 'var(--text-secondary)',
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'vehicles' && <VehiclesTab tenantId={tenantId} />}
      {tab === 'services' && <ServicesTab tenantId={tenantId} />}
      {tab === 'staff'    && <StaffTab tenantId={tenantId} />}
    </div>
  );
}
