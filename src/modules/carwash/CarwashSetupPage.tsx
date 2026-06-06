// [carwash] [all tenants] — unified setup: vehicle types, services, staff
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Trash2, Edit2, X, Users, Car, Droplets,
  ToggleLeft, ToggleRight, ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllVehicleTypes, createVehicleType, updateVehicleType, deleteVehicleType, seedDefaultVehicleTypes,
  listAllServices, createService, updateService, deleteService, isServiceInActiveJobs,
  getAllServicePrices, upsertServicePrice,
  listAllCarwashStaff, createCarwashStaff, updateCarwashStaff, deleteCarwashStaff,
  type CarwashVehicleTypeRecord, type CarwashService, type CarwashStaff,
} from '@/lib/db/carwash';

type Tab = 'vehicles' | 'services' | 'staff';

const ROLES = ['washer', 'polisher', 'detailer', 'manager', 'cashier'];
const ICON_OPTIONS = ['🚗','🚙','🏎️','🚐','🛻','🚌','🚎','🚑','🚒','🚕','🚚','🚛','🚜','🛺','🏍️','🛵','🚲'];

const inp = (extra?: string) => `w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${extra ?? ''}`;
const inpStyle = { borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' } as React.CSSProperties;
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

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
      if (editing) return updateVehicleType(tenantId, editing.id, { name: name.trim(), icon, price_multiplier: editing.price_multiplier, is_active: editing.is_active, sort_order: editing.sort_order });
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
        <p className="text-sm font-medium" style={{ color: '#86868b' }}>Define the types of vehicles you service.</p>
        <div className="flex gap-2">
          {types.length === 0 && (
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
              className="btn-secondary text-sm px-3 py-2 rounded-xl font-semibold">Add Defaults</button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#0071e3' }}>
            <Plus className="h-4 w-4" /> Add Vehicle Type
          </button>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {isLoading && <div className="p-6 text-sm animate-pulse" style={{ color: '#86868b' }}>Loading…</div>}
        {!isLoading && types.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2">
            <Car className="h-10 w-10 opacity-20" />
            <p className="text-sm" style={{ color: '#86868b' }}>No vehicle types yet. Click "Add Defaults" to get started.</p>
          </div>
        )}
        {types.map((t, i) => (
          <div key={t.id} className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: i < types.length - 1 ? '1px solid #e5e5ea' : undefined }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.icon}</span>
              <span className="font-semibold text-sm" style={{ color: '#1d1d1f' }}>{t.name}</span>
              {!t.is_active && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f2f2f7', color: '#86868b' }}>Inactive</span>}
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
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: '#1d1d1f' }}>{editing ? 'Edit Vehicle Type' : 'Add Vehicle Type'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: '#86868b' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SUV, Bike, Truck" className={inp()} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#86868b' }}>Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(ic => (
                  <button key={ic} onClick={() => setIcon(ic)}
                    className="h-10 w-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all"
                    style={{ borderColor: icon === ic ? '#0071e3' : '#e5e5ea', background: icon === ic ? '#f2f2f7' : 'transparent' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: '#0071e3' }}>
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
  // [carwash] [all tenants]
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

  const openAddSvc = () => { setEditingSvc(null); setSvcName(''); setSvcDuration('30'); setSvcActive(true); setShowServiceForm(true); };
  const openEditSvc = (s: CarwashService) => { setEditingSvc(s); setSvcName(s.name); setSvcDuration(String(s.duration_minutes)); setSvcActive(s.is_active); setShowServiceForm(true); };

  const saveSvcMutation = useMutation({
    mutationFn: async () => {
      if (!svcName.trim()) throw new Error('Service name required');
      const data = {
        name: svcName.trim(), description: null,
        duration_minutes: Number(svcDuration) || 30, is_active: svcActive,
        price_hatchback: 0, price_sedan: 0, price_suv: 0, price_luxury: 0,
        gst_rate: 0, sort_order: editingSvc?.sort_order ?? 99,
      };
      if (editingSvc) {
        await updateService(tenantId, editingSvc.id, data);
        return editingSvc.id;
      }
      await createService(tenantId, data);
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
        <p className="text-sm font-medium" style={{ color: '#86868b' }}>Set prices for each service per vehicle type. Click any price to edit.</p>
        <button onClick={openAddSvc}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#0071e3' }}>
          <Plus className="h-4 w-4" /> Add Service
        </button>
      </div>
      {activeVtypes.length === 0 && (
        <div className="rounded-2xl p-6 text-center text-sm" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)', color: '#86868b' }}>
          Add vehicle types first (in the Vehicles tab) to set prices.
        </div>
      )}
      {activeVtypes.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${200 + activeVtypes.length * 110}px` }}>
              <thead>
                <tr style={{ background: '#f2f2f7', borderBottom: '1px solid #e5e5ea' }}>
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10" style={{ color: '#86868b', background: '#f2f2f7', minWidth: '180px' }}>Service</th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: '#86868b', width: '70px' }}>Min</th>
                  {activeVtypes.map(vt => (
                    <th key={vt.id} className="text-center px-3 py-3 font-semibold" style={{ color: '#86868b', minWidth: '100px' }}>{vt.icon} {vt.name}</th>
                  ))}
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {svcLoading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e5ea' }}>
                    {Array.from({ length: activeVtypes.length + 3 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: '#f2f2f7' }} /></td>
                    ))}
                  </tr>
                ))}
                {!svcLoading && services.length === 0 && (
                  <tr><td colSpan={activeVtypes.length + 3} className="text-center py-10 text-sm" style={{ color: '#86868b' }}>No services yet. Click "Add Service" above.</td></tr>
                )}
                {services.map(svc => (
                  <tr key={svc.id} style={{ borderBottom: '1px solid #e5e5ea', opacity: svc.is_active ? 1 : 0.5 }}>
                    <td className="px-4 py-2 sticky left-0" style={{ background: '#ffffff' }}>
                      <button onClick={() => openEditSvc(svc)} className="text-left">
                        <p className="font-semibold text-sm" style={{ color: '#1d1d1f' }}>{svc.name}</p>
                        {!svc.is_active && <span className="text-xs" style={{ color: '#86868b' }}>Inactive</span>}
                      </button>
                    </td>
                    <td className="text-center px-3 py-2 text-xs" style={{ color: '#86868b' }}>{svc.duration_minutes}m</td>
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
                                borderColor: isSaved ? '#16a34a' : isDirty ? '#0071e3' : '#e5e5ea',
                                background: isSaved ? '#f0fdf4' : isDirty ? '#e8f0fe' : '#f2f2f7',
                                color: '#1d1d1f',
                                transition: 'border-color 0.3s, background 0.3s',
                              }} />
                            {isSaved
                              ? <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none font-bold" style={{ color: '#16a34a' }}>✓</span>
                              : val && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#86868b' }}>₹</span>
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
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: '#1d1d1f' }}>{editingSvc ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => setShowServiceForm(false)}><X className="h-5 w-5" style={{ color: '#86868b' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Service Name *</label>
              <input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. Basic Wash, Full Detail" className={inp()} style={inpStyle} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Duration (minutes)</label>
              <input type="number" value={svcDuration} onChange={e => setSvcDuration(e.target.value)} placeholder="30" className={inp()} style={inpStyle} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={svcActive} onChange={e => setSvcActive(e.target.checked)} />
              <span className="text-sm font-medium" style={{ color: '#86868b' }}>Active (show in job card)</span>
            </label>
            <button onClick={() => saveSvcMutation.mutate()} disabled={saveSvcMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: '#0071e3' }}>
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
  const navigate = useNavigate();
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
        <p className="text-sm font-medium" style={{ color: '#86868b' }}>Manage your wash team, salaries and deduction rules.</p>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#0071e3' }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {isLoading && <div className="p-6 text-sm animate-pulse" style={{ color: '#86868b' }}>Loading…</div>}
        {!isLoading && staff.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2">
            <Users className="h-10 w-10 opacity-20" />
            <p className="text-sm" style={{ color: '#86868b' }}>No staff added yet</p>
          </div>
        )}
        {staff.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: i < staff.length - 1 ? '1px solid #e5e5ea' : undefined, cursor: 'pointer' }}
            onClick={() => navigate(`/carwash/staff/${s.id}`)}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#0071e3' }}>{s.name[0].toUpperCase()}</div>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#1d1d1f' }}>{s.name}</p>
                <p className="text-xs capitalize" style={{ color: '#86868b' }}>{s.role}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
              {s.monthly_salary > 0 && <p className="text-sm font-bold hidden sm:block" style={{ color: '#0071e3' }}>{fmt(s.monthly_salary)}/mo</p>}
              <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Edit2 className="h-4 w-4" /></button>
              <button onClick={() => { if (!confirm(`Remove ${s.name}?`)) return; deleteMutation.mutate(s.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              <ChevronRight className="h-4 w-4 opacity-30" />
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: '#1d1d1f' }}>{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="h-5 w-5" style={{ color: '#86868b' }} /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ramesh" className={inp()} style={inpStyle} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" className={inp()} style={inpStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp()} style={inpStyle}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#f2f2f7', border: '1px solid #e5e5ea' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0071e3' }}>💰 Salary Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#86868b' }}>Monthly Salary (₹)</label>
                  <input type="number" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))} placeholder="15000" className={inp()} style={inpStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#86868b' }}>Joining Date</label>
                  <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} className={inp()} style={inpStyle} />
                </div>
              </div>
              <p className="text-xs" style={{ color: '#86868b' }}>If staff joins mid-month, salary is pro-rated from joining date.</p>
              <button type="button" onClick={() => setForm(f => ({ ...f, deduct_half_day: !f.deduct_half_day }))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: '#1d1d1f' }}>Deduct half day?</p>
                  <p className="text-xs" style={{ color: '#86868b' }}>Deduct 0.5 day salary on half day</p>
                </div>
                {form.deduct_half_day ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: '#0071e3' }} /> : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: '#86868b' }} />}
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, deduct_full_day_leave: !f.deduct_full_day_leave }))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: '#1d1d1f' }}>Deduct paid leave?</p>
                  <p className="text-xs" style={{ color: '#86868b' }}>When OFF, leave is paid (no deduction)</p>
                </div>
                {form.deduct_full_day_leave ? <ToggleRight className="h-6 w-6 flex-shrink-0" style={{ color: '#0071e3' }} /> : <ToggleLeft className="h-6 w-6 flex-shrink-0" style={{ color: '#86868b' }} />}
              </button>
            </div>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: '#0071e3' }}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update Staff' : 'Add Staff Member'}
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
];

export function CarwashSetupPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) ?? 'vehicles';
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-col" style={{ background: '#f5f5f7', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating white plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>Setup</h1>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: tab === t.id ? '#0071e3' : 'transparent', color: tab === t.id ? '#ffffff' : '#86868b' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'vehicles'   && <VehiclesTab   tenantId={tenantId} />}
      {tab === 'services'   && <ServicesTab   tenantId={tenantId} />}
      {tab === 'staff'      && <StaffTab      tenantId={tenantId} />}

      </div>
    </div>
  );
}
