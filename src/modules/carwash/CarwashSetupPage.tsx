// [carwash] [all tenants] — unified setup: vehicle types, services, staff, attendance
import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import {
  Plus, Trash2, Edit2, X, Users, Car, Droplets,
  UserCheck, ChevronLeft, ChevronRight, Printer,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllVehicleTypes, createVehicleType, updateVehicleType, deleteVehicleType, seedDefaultVehicleTypes,
  listAllServices, createService, updateService, deleteService, isServiceInActiveJobs,
  getAllServicePrices, upsertServicePrice,
  listAllCarwashStaff, createCarwashStaff, updateCarwashStaff, deleteCarwashStaff,
  getAttendanceForMonth, upsertAttendance, computeSalary,
  getSalaryAdvancesForMonth, addSalaryAdvance, deleteSalaryAdvance,
  type CarwashVehicleTypeRecord, type CarwashService, type CarwashStaff, type AttendanceStatus, type CarwashSalaryAdvance,
} from '@/lib/db/carwash';

type Tab = 'vehicles' | 'services' | 'staff' | 'attendance';

const ROLES = ['washer', 'polisher', 'detailer', 'manager', 'cashier'];
const ICON_OPTIONS = ['🚗','🚙','🏎️','🚐','🛻','🚌','🚎','🚑','🚒','🚕','🚚','🚛','🚜','🛺','🏍️','🛵','🚲'];
const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; color: string; bg: string }> = {
  present:  { label: 'Present',  short: 'P', color: '#16a34a', bg: '#dcfce7' },
  half_day: { label: 'Half Day', short: 'H', color: '#d97706', bg: '#fef3c7' },
  absent:   { label: 'Absent',   short: 'A', color: '#dc2626', bg: '#fee2e2' },
  leave:    { label: 'Leave',    short: 'L', color: '#7c3aed', bg: '#ede9fe' },
  holiday:  { label: 'Holiday',  short: 'O', color: '#0891b2', bg: '#e0f2fe' },
};
const STATUS_CYCLE: AttendanceStatus[] = ['present', 'half_day', 'absent', 'leave', 'holiday'];

const inp = (extra?: string) => `w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${extra ?? ''}`;
const inpStyle = { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' } as React.CSSProperties;
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

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
    qc.invalidateQueries({ queryKey: ['carwash-vtypes'] });
  };

  const openAdd = () => { setEditing(null); setName(''); setIcon('🚗'); setShowForm(true); };
  const openEdit = (t: CarwashVehicleTypeRecord) => { setEditing(t); setName(t.name); setIcon(t.icon); setShowForm(true); };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Name required');
      if (name.trim().length > 30) throw new Error('Name too long (max 30 characters)');
      if (editing) return updateVehicleType(tenantId, editing.id, { name: name.trim(), icon, price_multiplier: 1.0, is_active: editing.is_active, sort_order: editing.sort_order });
      return createVehicleType(tenantId, { name: name.trim(), icon, price_multiplier: 1.0 });
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
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Define the types of vehicles you service.</p>
        <div className="flex gap-2">
          {types.length === 0 && (
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
              className="btn-secondary text-sm px-3 py-2 rounded-xl font-semibold">Add Defaults</button>
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
              <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Edit2 className="h-4 w-4" /></button>
              <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
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
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SUV, Bike, Truck" className={inp()} style={inpStyle} autoFocus />
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
  const [svcBasePrice, setSvcBasePrice] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savedCells, setSavedCells] = useState<Record<string, boolean>>({});
  const savingRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  const openAddSvc = () => { setEditingSvc(null); setSvcName(''); setSvcDuration('30'); setSvcActive(true); setSvcBasePrice(''); setShowServiceForm(true); };
  const openEditSvc = (s: CarwashService) => { setEditingSvc(s); setSvcName(s.name); setSvcDuration(String(s.duration_minutes)); setSvcActive(s.is_active); setSvcBasePrice(''); setShowServiceForm(true); };

  const saveSvcMutation = useMutation({
    mutationFn: async () => {
      if (!svcName.trim()) throw new Error('Service name required');
      const basePrice = Math.max(0, Number(svcBasePrice) || 0);
      const data = {
        name: svcName.trim(), description: null,
        duration_minutes: Number(svcDuration) || 30, is_active: svcActive,
        price_hatchback: 0, price_sedan: basePrice, price_suv: 0, price_luxury: 0,
        gst_rate: 0, sort_order: editingSvc?.sort_order ?? 99,
      };
      if (editingSvc) {
        await updateService(tenantId, editingSvc.id, data);
        return editingSvc.id;
      }
      // For new service: create it then get its ID to pre-populate prices
      await createService(tenantId, data);
      const all = await listAllServices(tenantId);
      const created = all.find(s => s.name === svcName.trim());
      if (created && basePrice > 0) {
        const activeVtypes = vtypes.filter(v => v.is_active);
        await Promise.all(activeVtypes.map(vt =>
          upsertServicePrice(tenantId, created.id, vt.id, basePrice)
        ));
      }
    },
    onSuccess: () => {
      toast.success(editingSvc ? 'Service updated' : 'Service added');
      setShowServiceForm(false);
      invSvc();
      qc.invalidateQueries({ queryKey: ['cw-service-prices'] });
      qc.invalidateQueries({ queryKey: ['carwash-service-prices'] });
    },
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
    const finalPrice = isNaN(price) ? 0 : price;
    if (finalPrice === stored) { setPriceEdits(e => { const n = { ...e }; delete n[key]; return n; }); return; }
    savingRef.current.add(key);
    try {
      await upsertServicePrice(tenantId, serviceId, vtypeId, finalPrice);
      refetchPrices();
      setSavedCells(c => ({ ...c, [key]: true }));
      setTimeout(() => setSavedCells(c => { const n = { ...c }; delete n[key]; return n; }), 1500);
    } finally {
      savingRef.current.delete(key);
      setPriceEdits(e => { const n = { ...e }; delete n[key]; return n; });
    }
  }

  function handlePriceChange(serviceId: string, vtypeId: string, value: string) {
    const key = priceKey(serviceId, vtypeId);
    setPriceEdits(p => ({ ...p, [key]: value }));
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => savePrice(serviceId, vtypeId, value), 800);
  }

  const activeVtypes = vtypes.filter(v => v.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Set prices for each service per vehicle type. Click any price to edit.</p>
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
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)', minWidth: '180px' }}>Service</th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)', width: '70px' }}>Min</th>
                  {activeVtypes.map(vt => (
                    <th key={vt.id} className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)', minWidth: '100px' }}>{vt.icon} {vt.name}</th>
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
                  <tr><td colSpan={activeVtypes.length + 3} className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>No services yet. Click "Add Service" above.</td></tr>
                )}
                {services.map(svc => (
                  <tr key={svc.id} style={{ borderBottom: '1px solid var(--surface-border)', opacity: svc.is_active ? 1 : 0.5 }}>
                    <td className="px-4 py-2 sticky left-0" style={{ background: 'var(--surface)' }}>
                      <button onClick={() => openEditSvc(svc)} className="text-left">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{svc.name}</p>
                        {!svc.is_active && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Inactive</span>}
                      </button>
                    </td>
                    <td className="text-center px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{svc.duration_minutes}m</td>
                    {activeVtypes.map(vt => {
                      const key = priceKey(svc.id, vt.id);
                      const val = getCellValue(svc.id, vt.id);
                      const isDirty = key in priceEdits;
                      const isSaved = savedCells[key];
                      return (
                        <td key={vt.id} className="px-2 py-1.5">
                          <div className="relative">
                            <input type="number" min="0" value={val} placeholder="—"
                              onChange={e => handlePriceChange(svc.id, vt.id, e.target.value)}
                              onBlur={e => savePrice(svc.id, vt.id, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              className="w-full rounded-lg border px-2 py-1.5 text-sm text-center font-semibold outline-none"
                              style={{
                                borderColor: isSaved ? '#16a34a' : isDirty ? 'var(--accent)' : 'var(--surface-border)',
                                background: isSaved ? '#f0fdf4' : isDirty ? 'color-mix(in srgb, var(--accent) 8%, var(--surface-2))' : 'var(--surface-2)',
                                color: 'var(--text-primary)',
                                transition: 'border-color 0.3s, background 0.3s',
                              }} />
                            {isSaved
                              ? <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none font-bold" style={{ color: '#16a34a' }}>✓</span>
                              : val && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>₹</span>
                            }
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      <button onClick={() => deleteSvcMutation.mutate(svc.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editingSvc ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => setShowServiceForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Service Name *</label>
              <input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. Basic Wash, Full Detail" className={inp()} style={inpStyle} autoFocus />
            </div>
            {!editingSvc && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Base Price (₹) *</label>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Prices for all vehicle types are auto-calculated from this</p>
                <input type="number" value={svcBasePrice} onChange={e => setSvcBasePrice(e.target.value)} placeholder="e.g. 200"
                  className={inp()} style={inpStyle} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration (minutes)</label>
              <input type="number" value={svcDuration} onChange={e => setSvcDuration(e.target.value)} placeholder="30" className={inp()} style={inpStyle} />
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
type StaffForm = { name: string; phone: string; role: string; monthly_salary: string; joining_date: string; deduct_half_day: boolean; deduct_full_day_leave: boolean };
const emptyStaffForm: StaffForm = { name: '', phone: '', role: 'washer', monthly_salary: '', joining_date: '', deduct_half_day: true, deduct_full_day_leave: false };

function StaffTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CarwashStaff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyStaffForm);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['carwash-staff-list', tenantId],
    queryFn: () => listAllCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const inv = () => { qc.invalidateQueries({ queryKey: ['carwash-staff-list'] }); qc.invalidateQueries({ queryKey: ['carwash-staff'] }); };

  const openAdd = () => { setEditing(null); setForm(emptyStaffForm); setShowForm(true); };
  const openEdit = (s: CarwashStaff) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone ?? '', role: s.role, monthly_salary: s.monthly_salary > 0 ? String(s.monthly_salary) : '', joining_date: s.joining_date ?? '', deduct_half_day: s.deduct_half_day, deduct_full_day_leave: s.deduct_full_day_leave });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error('Name required');
      const salary = Number(form.monthly_salary) || 0;
      if (salary < 0 || salary > 999999) throw new Error('Salary must be between ₹0 and ₹9,99,999');
      if (form.phone && !/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) throw new Error('Phone must be 10 digits');
      const data = { name: form.name.trim(), phone: form.phone || undefined, role: form.role, monthly_salary: salary, joining_date: form.joining_date || undefined, deduct_half_day: form.deduct_half_day, deduct_full_day_leave: form.deduct_full_day_leave };
      return editing ? updateCarwashStaff(tenantId, editing.id, data) : createCarwashStaff(tenantId, data);
    },
    onSuccess: () => { toast.success(editing ? 'Staff updated' : 'Staff added'); setShowForm(false); setEditing(null); inv(); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCarwashStaff(tenantId, id),
    onSuccess: () => { toast.success('Staff removed'); inv(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Manage your wash team, salaries and deduction rules.</p>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
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
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>{s.name[0].toUpperCase()}</div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.role}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {s.monthly_salary > 0 && <p className="text-sm font-bold hidden sm:block" style={{ color: 'var(--accent)' }}>{fmt(s.monthly_salary)}/mo</p>}
              <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Edit2 className="h-4 w-4" /></button>
              <button onClick={() => { if (!confirm(`Remove ${s.name}?`)) return; deleteMutation.mutate(s.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ramesh" className={inp()} style={inpStyle} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" className={inp()} style={inpStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp()} style={inpStyle}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>💰 Salary Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Monthly Salary (₹)</label>
                  <input type="number" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))} placeholder="15000" className={inp()} style={inpStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Joining Date</label>
                  <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} className={inp()} style={inpStyle} />
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>If staff joins mid-month, salary is pro-rated from joining date.</p>
              <button type="button" onClick={() => setForm(f => ({ ...f, deduct_half_day: !f.deduct_half_day }))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Deduct half day?</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Deduct 0.5 day salary on half day</p>
                </div>
                {form.deduct_half_day ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--accent)' }} /> : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />}
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, deduct_full_day_leave: !f.deduct_full_day_leave }))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Deduct paid leave?</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>When OFF, leave is paid (no deduction)</p>
                </div>
                {form.deduct_full_day_leave ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--accent)' }} /> : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />}
              </button>
            </div>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update Staff' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────
function AttendanceTab({ tenantId }: { tenantId: string }) {
  const config = useAppStore((s) => s.config);
  const qc = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [advanceModal, setAdvanceModal] = useState<CarwashStaff | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  const { data: staff = [] } = useQuery({
    queryKey: ['carwash-staff-list', tenantId],
    queryFn: () => listAllCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const { data: attendance = [] } = useQuery({
    queryKey: ['carwash-attendance', tenantId, year, month],
    queryFn: () => getAttendanceForMonth(tenantId, year, month),
    enabled: !!tenantId,
  });

  const { data: advances = [] } = useQuery({
    queryKey: ['carwash-advances', tenantId, monthStr],
    queryFn: () => getSalaryAdvancesForMonth(tenantId, monthStr),
    enabled: !!tenantId,
  });

  const addAdvanceMutation = useMutation({
    mutationFn: () => {
      if (!advanceModal) throw new Error('No staff selected');
      const amt = Number(advanceAmount);
      if (!amt || amt <= 0) throw new Error('Enter a valid amount');
      if (amt > 999999) throw new Error('Amount too large');
      // Find the net salary to cap advance
      const summary = summaries.find(sm => sm.staff.id === advanceModal!.id);
      const alreadyAdvanced = advances.filter(a => a.staff_id === advanceModal!.id).reduce((t, a) => t + a.amount, 0);
      if (summary && alreadyAdvanced + amt > summary.net_salary) throw new Error(`Total advance (₹${alreadyAdvanced + amt}) cannot exceed net salary (₹${summary.net_salary})`);

      return addSalaryAdvance(tenantId, advanceModal.id, monthStr, amt, advanceNote || undefined);
    },
    onSuccess: () => {
      toast.success('Advance recorded');
      setAdvanceModal(null); setAdvanceAmount(''); setAdvanceNote('');
      qc.invalidateQueries({ queryKey: ['carwash-advances', tenantId, monthStr] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteAdvanceMutation = useMutation({
    mutationFn: (id: string) => deleteSalaryAdvance(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carwash-advances', tenantId, monthStr] }),
  });

  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  const attMap = useMemo(() => {
    const map: Record<string, Record<number, AttendanceStatus>> = {};
    for (const a of attendance) {
      const day = parseInt(a.date.slice(8, 10));
      if (!map[a.staff_id]) map[a.staff_id] = {};
      map[a.staff_id][day] = a.status as AttendanceStatus;
    }
    return map;
  }, [attendance]);

  const markMutation = useMutation({
    mutationFn: ({ staffId, day, status }: { staffId: string; day: number; status: AttendanceStatus }) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return upsertAttendance(tenantId, staffId, date, status);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carwash-attendance', tenantId, year, month] }),
    onError: () => toast.error('Failed to save'),
  });

  const cycleStatus = (staffId: string, day: number) => {
    const cur = attMap[staffId]?.[day];
    const idx = cur ? STATUS_CYCLE.indexOf(cur) : -1;
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    markMutation.mutate({ staffId, day, status: next });
  };

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const summaries = useMemo(() =>
    staff.map(s => {
      const summary = computeSalary(s, attendance.filter(a => a.staff_id === s.id), year, month);
      const advance = advances.filter(a => a.staff_id === s.id).reduce((t, a) => t + a.amount, 0);
      return { ...summary, advance, payable_amount: Math.max(0, summary.net_salary - advance) };
    }),
    [staff, attendance, advances, year, month]
  );

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const printSalarySlip = async (s: CarwashStaff) => {
    const summary = summaries.find(sm => sm.staff.id === s.id);
    if (!summary) return;
    const logo = (config?.settings as any)?.logo_base64;
    const shopName = config?.shop_name ?? 'Car Wash';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:20px;font-size:13px;color:#111}.header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f59e0b}.logo{max-height:60px;max-width:150px;object-fit:contain;margin-bottom:8px}.shop{font-size:18px;font-weight:700}.slip-title{background:#f59e0b;color:#111;text-align:center;font-weight:700;font-size:14px;padding:6px;border-radius:6px;margin:12px 0}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6}.row.bold{font-weight:700;font-size:14px}.section-title{font-weight:700;color:#6b7280;text-transform:uppercase;font-size:11px;letter-spacing:.5px;margin:12px 0 4px}.green{color:#16a34a}.red{color:#dc2626}.big{font-size:16px;font-weight:700}.footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:10px}</style>
    </head><body>
    <div class="header">${logo ? `<div><img src="${logo}" class="logo" /></div>` : ''}<div class="shop">${shopName}</div>${config?.address_line1 ? `<div style="font-size:11px;color:#6b7280">${[config.address_line1, config.city].filter(Boolean).join(', ')}</div>` : ''}${config?.phone ? `<div style="font-size:11px;color:#6b7280">📞 ${config.phone}</div>` : ''}</div>
    <div class="slip-title">SALARY SLIP — ${monthName}</div>
    <div class="section-title">Employee Details</div>
    <div class="row"><span>Name</span><span><b>${s.name}</b></span></div>
    <div class="row"><span>Role</span><span>${s.role.charAt(0).toUpperCase() + s.role.slice(1)}</span></div>
    ${s.phone ? `<div class="row"><span>Phone</span><span>${s.phone}</span></div>` : ''}
    ${s.joining_date ? `<div class="row"><span>Joining Date</span><span>${new Date(s.joining_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>` : ''}
    <div class="section-title">Attendance — ${monthName}</div>
    <div class="row"><span>Working Days (period)</span><span>${summary.working_days}</span></div>
    <div class="row"><span class="green">Present Days</span><span class="green">${summary.present}</span></div>
    <div class="row"><span style="color:#d97706">Half Days</span><span style="color:#d97706">${summary.half_day}</span></div>
    <div class="row"><span style="color:#7c3aed">Leave Days</span><span style="color:#7c3aed">${summary.leave}</span></div>
    <div class="row"><span class="red">Absent Days</span><span class="red">${summary.absent}</span></div>
    <div class="section-title">Salary Calculation</div>
    <div class="row"><span>Monthly Salary</span><span>${fmt(s.monthly_salary)}</span></div>
    <div class="row"><span>Per Day Rate</span><span>${fmt(summary.per_day_rate)}</span></div>
    <div class="row"><span>Payable Days</span><span>${summary.payable_days.toFixed(1)}</span></div>
    <div class="row"><span style="color:#0891b2">Holidays</span><span style="color:#0891b2">${summary.holiday}</span></div>
    ${summary.deductions > 0 ? `<div class="row"><span class="red">Deductions</span><span class="red">− ${fmt(summary.deductions)}</span></div>` : ''}
    <div class="row bold"><span>Net Salary</span><span class="big green">${fmt(summary.net_salary)}</span></div>
    ${summary.advance > 0 ? `<div class="row"><span style="color:#d97706">Advance Paid</span><span style="color:#d97706">− ${fmt(summary.advance)}</span></div><div class="row bold"><span>Balance Payable</span><span class="big green">${fmt(summary.payable_amount)}</span></div>` : ''}
    <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN')}</div>
    </body></html>`;
    const finalHtml = html.replace('</body>', `<script>window.addEventListener('load',()=>setTimeout(window.print,400))<\/script></body>`);
    try {
      const cacheDir = await appCacheDir();
      const sep = cacheDir.endsWith('/') || cacheDir.endsWith('\\') ? '' : '/';
      const filePath = `${cacheDir}${sep}salary-slip-${s.id}-${year}-${month}.html`;
      await writeTextFile(filePath, finalHtml);
      await shellOpen(filePath);
    } catch (e: any) { toast.error('Print failed: ' + (e?.message ?? e)); }
  };

  return (
    <div className="space-y-4">
      {/* Month nav + legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl btn-secondary"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-bold px-2" style={{ color: 'var(--text-primary)', minWidth: '140px', textAlign: 'center' }}>{monthName}</span>
          <button onClick={nextMonth} className="p-2 rounded-xl btn-secondary"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <span key={k} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: v.bg, color: v.color }}>{v.short} = {v.label}</span>
          ))}
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>· = Unmarked</span>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <Users className="h-10 w-10 opacity-20 mx-auto mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No staff yet — add staff in the Staff tab first</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="overflow-x-auto">
            <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-sm" style={{ color: 'var(--text-secondary)', minWidth: '140px', borderBottom: '2px solid var(--surface-border)', position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 5 }}>Staff</th>
                  {days.map(d => {
                    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                    const isToday = dateStr === todayISO();
                    return (
                      <th key={d} className="text-center py-2 font-semibold" style={{ minWidth: '32px', width: '32px', borderBottom: '2px solid var(--surface-border)', color: isToday ? 'var(--accent)' : 'var(--text-tertiary)', opacity: dateStr > todayISO() ? 0.4 : 1 }}>{d}</th>
                    );
                  })}
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: '#16a34a', borderBottom: '2px solid var(--surface-border)', minWidth: '36px' }}>P</th>
                  <th className="text-center px-2 py-3 font-semibold" style={{ color: '#d97706', borderBottom: '2px solid var(--surface-border)', minWidth: '36px' }}>H</th>
                  <th className="text-center px-2 py-3 font-semibold" style={{ color: '#dc2626', borderBottom: '2px solid var(--surface-border)', minWidth: '36px' }}>A</th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--accent)', borderBottom: '2px solid var(--surface-border)', minWidth: '90px' }}>Net Salary</th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: '#d97706', borderBottom: '2px solid var(--surface-border)', minWidth: '80px' }}>Advance</th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: '#16a34a', borderBottom: '2px solid var(--surface-border)', minWidth: '90px' }}>Payable</th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--surface-border)', minWidth: '50px' }}>Slip</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s, si) => {
                  const summary = summaries[si];
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td className="px-4 py-2" style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 3, borderRight: '1px solid var(--surface-border)' }}>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--accent)' }}>{s.name[0].toUpperCase()}</div>
                          <div>
                            <p className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                            <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{s.role}</p>
                          </div>
                        </div>
                      </td>
                      {days.map(d => {
                        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const isFuture = dateStr > todayISO();
                        const status = attMap[s.id]?.[d];
                        let beforeJoining = false;
                        if (s.joining_date) {
                          const jd = new Date(s.joining_date);
                          if (jd.getFullYear() === year && jd.getMonth() + 1 === month && jd.getDate() > d) beforeJoining = true;
                        }
                        if (beforeJoining) return <td key={d} style={{ width: '32px', textAlign: 'center', padding: '4px 2px', background: 'var(--surface-2)', opacity: 0.4 }}><span style={{ color: 'var(--text-tertiary)' }}>—</span></td>;
                        const cfg = status ? STATUS_CONFIG[status] : null;
                        return (
                          <td key={d} style={{ width: '32px', padding: '4px 2px', textAlign: 'center' }}>
                            <button disabled={isFuture || markMutation.isPending} onClick={() => cycleStatus(s.id, d)}
                              className="w-7 h-7 rounded-lg text-xs font-bold transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                              style={cfg ? { background: cfg.bg, color: cfg.color } : { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
                              {cfg ? cfg.short : '·'}
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-center px-2 py-2 font-semibold text-xs" style={{ color: '#16a34a' }}>{summary.present}</td>
                      <td className="text-center px-2 py-2 font-semibold text-xs" style={{ color: '#d97706' }}>{summary.half_day}</td>
                      <td className="text-center px-2 py-2 font-semibold text-xs" style={{ color: '#dc2626' }}>{summary.absent}</td>
                      <td className="text-center px-3 py-2">
                        {s.monthly_salary > 0 ? (
                          <div>
                            <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmt(summary.net_salary)}</p>
                            {summary.deductions > 0 && <p className="text-xs" style={{ color: '#dc2626' }}>-{fmt(summary.deductions)}</p>}
                          </div>
                        ) : <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</p>}
                      </td>
                      <td className="text-center px-3 py-2">
                        <button onClick={() => { setAdvanceModal(s); setAdvanceAmount(''); setAdvanceNote(''); }}
                          className="text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{ background: summary.advance > 0 ? '#fef3c7' : 'var(--surface-2)', color: summary.advance > 0 ? '#d97706' : 'var(--text-tertiary)', border: '1px solid var(--surface-border)' }}>
                          {summary.advance > 0 ? fmt(summary.advance) : '+ Advance'}
                        </button>
                      </td>
                      <td className="text-center px-3 py-2">
                        {s.monthly_salary > 0 ? (
                          <p className="font-bold text-sm" style={{ color: '#16a34a' }}>{fmt(summary.payable_amount)}</p>
                        ) : <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</p>}
                      </td>
                      <td className="text-center px-3 py-2">
                        <button onClick={() => printSalarySlip(s)} className="p-1.5 rounded-lg btn-secondary" title="Print salary slip"><Printer className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Summary footer */}
          <div className="flex items-center gap-6 px-5 py-3 flex-wrap" style={{ borderTop: '2px solid var(--surface-border)', background: 'var(--surface-2)' }}>
            <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Month Total</p>
            <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Payroll</p><p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmt(summaries.reduce((s, sm) => s + sm.net_salary, 0))}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Advance</p><p className="font-bold text-sm" style={{ color: '#d97706' }}>{fmt(summaries.reduce((s, sm) => s + sm.advance, 0))}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Balance Payable</p><p className="font-bold text-sm" style={{ color: '#16a34a' }}>{fmt(summaries.reduce((s, sm) => s + sm.payable_amount, 0))}</p></div>
          </div>
        </div>
      )}

      {/* Advance Salary Modal */}
      {advanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Advance Salary — {advanceModal.name}</h2>
              <button onClick={() => setAdvanceModal(null)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Month: <b>{monthName}</b></p>
            {advances.filter(a => a.staff_id === advanceModal.id).length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
                <p className="text-xs font-semibold px-3 py-2 uppercase" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>Advances given this month</p>
                {advances.filter(a => a.staff_id === advanceModal.id).map(a => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#d97706' }}>{fmt(a.amount)}</p>
                      {a.note && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{a.note}</p>}
                    </div>
                    <button onClick={() => deleteAdvanceMutation.mutate(a.id)} className="p-1 rounded text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Advance Amount (₹) *</label>
              <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="e.g. 2000" className={inp()} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
              <input value={advanceNote} onChange={e => setAdvanceNote(e.target.value)} placeholder="e.g. Emergency, Festival advance" className={inp()} style={inpStyle} />
            </div>
            <button onClick={() => addAdvanceMutation.mutate()} disabled={addAdvanceMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: '#d97706' }}>
              {addAdvanceMutation.isPending ? 'Saving…' : 'Give Advance'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'vehicles',   label: 'Vehicle Types',    icon: <Car className="h-4 w-4" /> },
  { id: 'services',   label: 'Services & Pricing', icon: <Droplets className="h-4 w-4" /> },
  { id: 'staff',      label: 'Staff',             icon: <Users className="h-4 w-4" /> },
  { id: 'attendance', label: 'Attendance',        icon: <UserCheck className="h-4 w-4" /> },
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
            style={{ background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? 'white' : 'var(--text-secondary)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'vehicles'   && <VehiclesTab   tenantId={tenantId} />}
      {tab === 'services'   && <ServicesTab   tenantId={tenantId} />}
      {tab === 'staff'      && <StaffTab      tenantId={tenantId} />}
      {tab === 'attendance' && <AttendanceTab tenantId={tenantId} />}
    </div>
  );
}
