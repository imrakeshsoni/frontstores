// [carwash] [all tenants]
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, X, Zap } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listAllServices, createService, updateService, deleteService, seedDefaultServices,
  isServiceInActiveJobs, getAllServicePrices, upsertServicePrice,
  listAllVehicleTypes, type CarwashService,
} from '@/lib/db/carwash';

const inp = 'w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2';
const inpStyle = { borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' } as React.CSSProperties;

export function CarwashServicesPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const [showForm, setShowForm]     = useState(false);
  const [editingSvc, setEditingSvc] = useState<CarwashService | null>(null);
  const [svcName, setSvcName]       = useState('');
  const [svcDuration, setSvcDuration] = useState('30');
  const [svcGst, setSvcGst]         = useState('18');
  const [svcActive, setSvcActive]   = useState(true);
  const [modalPrices, setModalPrices] = useState<Record<string, string>>({});

  const [priceEdits, setPriceEdits]     = useState<Record<string, string>>({});
  const [durationEdits, setDurationEdits] = useState<Record<string, string>>({});
  const savingRef = useRef<Set<string>>(new Set());

  const { data: vtypes = [] } = useQuery({
    queryKey: ['cw-vtypes-all', tenantId],
    queryFn: () => listAllVehicleTypes(tenantId),
    enabled: !!tenantId,
  });
  const { data: services = [], isLoading } = useQuery({
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

  const openAdd = () => {
    setEditingSvc(null); setSvcName(''); setSvcDuration('30'); setSvcGst('18'); setSvcActive(true); setModalPrices({});
    setShowForm(true);
  };
  const openEdit = (s: CarwashService) => {
    setEditingSvc(s);
    setSvcName(s.name);
    setSvcDuration(String(s.duration_minutes));
    setSvcGst(String(s.gst_rate ?? 18));
    setSvcActive(s.is_active);
    const fills: Record<string, string> = {};
    Object.entries(pricesMap[s.id] ?? {}).forEach(([vtId, price]) => {
      if ((price as number) > 0) fills[vtId] = String(price);
    });
    setModalPrices(fills);
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!svcName.trim()) throw new Error('Service name required');
      const data = {
        name: svcName.trim(), description: null,
        duration_minutes: Number(svcDuration) || 30,
        gst_rate: Number(svcGst) || 0,
        is_active: svcActive,
        price_hatchback: 0, price_sedan: 0, price_suv: 0, price_luxury: 0,
        sort_order: editingSvc?.sort_order ?? 99,
      };
      let svcId = editingSvc?.id;
      if (editingSvc) {
        await updateService(tenantId, editingSvc.id, data);
      } else {
        const created = await createService(tenantId, data);
        svcId = created.id;
      }
      if (svcId) {
        for (const [vtId, priceStr] of Object.entries(modalPrices)) {
          await upsertServicePrice(tenantId, svcId, vtId, Number(priceStr) || 0);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingSvc ? 'Service updated' : 'Service added');
      setShowForm(false); invSvc(); refetchPrices();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (await isServiceInActiveJobs(tenantId, id)) throw new Error('Service is in active jobs — complete them first.');
      return deleteService(tenantId, id);
    },
    onSuccess: () => { toast.success('Service removed'); invSvc(); refetchPrices(); },
    onError: (e: any) => toast.error(e?.message ?? 'Cannot delete'),
  });

  const seedMutation = useMutation({
    mutationFn: () => seedDefaultServices(tenantId),
    onSuccess: () => { toast.success('Default services added!'); invSvc(); },
  });

  async function saveDuration(svc: CarwashService, raw: string) {
    const mins = parseInt(raw, 10);
    if (isNaN(mins) || mins <= 0 || mins === svc.duration_minutes) {
      setDurationEdits(e => { const n = { ...e }; delete n[svc.id]; return n; });
      return;
    }
    try { await updateService(tenantId, svc.id, { ...svc, duration_minutes: mins }); invSvc(); }
    finally { setDurationEdits(e => { const n = { ...e }; delete n[svc.id]; return n; }); }
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
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#86868b' }}>Car Wash</p>
          <h1 className="text-2xl font-bold" style={{ color: '#1d1d1f' }}>Services & Pricing</h1>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>Click any price cell to edit — saves on Enter or click away</p>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm btn-secondary">
              <Zap className="h-4 w-4" /> Add Defaults
            </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#0071e3', color: '#111' }}>
            <Plus className="h-4 w-4" /> Add Service
          </button>
        </div>
      </div>

      {activeVtypes.length === 0 && (
        <div className="rounded-2xl p-6 text-center text-sm" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)', color: '#86868b' }}>
          No vehicle types configured — go to Settings → Car Wash Setup → Vehicle Types to add them first.
        </div>
      )}

      {activeVtypes.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${200 + activeVtypes.length * 100}px` }}>
              <thead>
                <tr style={{ background: '#f2f2f7', borderBottom: '1px solid #e5e5ea' }}>
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10" style={{ color: '#86868b', background: '#f2f2f7', minWidth: '160px' }}>Service</th>
                  <th className="text-center px-2 py-3 font-semibold text-xs" style={{ color: '#86868b', width: '60px' }}>Min</th>
                  {activeVtypes.map(vt => (
                    <th key={vt.id} className="text-center px-2 py-3 font-semibold text-xs" style={{ color: '#86868b', minWidth: '90px' }}>
                      {vt.icon} {vt.name}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e5ea' }}>
                    {Array.from({ length: activeVtypes.length + 3 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: '#f2f2f7' }} /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && services.length === 0 && (
                  <tr><td colSpan={activeVtypes.length + 3} className="text-center py-10 text-sm" style={{ color: '#86868b' }}>
                    No services yet — click "Add Defaults" to get started quickly.
                  </td></tr>
                )}
                {services.map(svc => (
                  <tr key={svc.id} style={{ borderBottom: '1px solid #e5e5ea', opacity: svc.is_active ? 1 : 0.5 }}>
                    <td className="px-4 py-2 sticky left-0" style={{ background: '#ffffff' }}>
                      <button onClick={() => openEdit(svc)} className="text-left">
                        <p className="font-semibold text-sm" style={{ color: '#1d1d1f' }}>{svc.name}</p>
                        {!svc.is_active && <span className="text-xs" style={{ color: '#86868b' }}>Inactive</span>}
                      </button>
                    </td>
                    {/* Duration — inline edit */}
                    <td className="px-1.5 py-1.5">
                      <div className="relative">
                        <input
                          type="number" min="1"
                          value={svc.id in durationEdits ? durationEdits[svc.id] : String(svc.duration_minutes)}
                          onChange={e => setDurationEdits(d => ({ ...d, [svc.id]: e.target.value }))}
                          onBlur={e => saveDuration(svc, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="w-full rounded-lg border px-1.5 py-1.5 text-xs text-center font-semibold outline-none"
                          style={{ borderColor: svc.id in durationEdits ? '#0071e3' : '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f', minWidth: '52px' }}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#86868b' }}>m</span>
                      </div>
                    </td>
                    {/* Price per vehicle type — inline edit */}
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
                              style={{
                                borderColor: dirty ? '#0071e3' : '#e5e5ea',
                                background: dirty ? '#e8f0fe' : '#f2f2f7',
                                color: '#1d1d1f',
                              }}
                            />
                            {val && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#86868b' }}>₹</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-1.5 py-1.5">
                      <button onClick={() => deleteMutation.mutate(svc.id)} className="p-1 rounded text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[90vh] flex flex-col" style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg" style={{ color: '#1d1d1f' }}>{editingSvc ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: '#86868b' }} /></button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Service Name *</label>
                <input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. Basic Wash, Full Detail"
                  className={inp} style={inpStyle} autoFocus />
              </div>

              {activeVtypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#86868b' }}>Price per Vehicle Type (₹)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {activeVtypes.map(vt => (
                      <div key={vt.id}>
                        <label className="block text-xs mb-1" style={{ color: '#86868b' }}>{vt.icon} {vt.name}</label>
                        <input type="number" min="0" placeholder="0"
                          value={modalPrices[vt.id] ?? ''}
                          onChange={e => setModalPrices(p => ({ ...p, [vt.id]: e.target.value }))}
                          className={inp} style={inpStyle} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Duration (min)</label>
                  <input type="number" min="1" value={svcDuration} onChange={e => setSvcDuration(e.target.value)} className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>GST Rate (%)</label>
                  <select value={svcGst} onChange={e => setSvcGst(e.target.value)} className={inp} style={inpStyle}>
                    {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={svcActive} onChange={e => setSvcActive(e.target.checked)} />
                <span className="text-sm font-medium" style={{ color: '#86868b' }}>Active (show in job card)</span>
              </label>
            </div>

            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60 mt-4"
              style={{ background: '#0071e3', color: '#111' }}>
              {saveMutation.isPending ? 'Saving…' : editingSvc ? 'Update Service' : 'Add Service'}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>{/* end scrollable content */}
    </div>
  );
}
