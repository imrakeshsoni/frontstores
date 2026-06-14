import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Users, X, Edit2, Car, Phone, Mail, Tag, Star, ClipboardList, Printer, AlertTriangle, ChevronDown, ChevronUp, Check, Merge } from 'lucide-react';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { useAppStore } from '@/app/store/app.store';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/db/customers';
import { findVehiclesByPhone, upsertVehicle, listAllVehicleTypes, getJobsByCustomerPhone, findDuplicateCustomerGroups, mergeCustomers, type CarwashVehicle, type DuplicateGroup } from '@/lib/db/carwash';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type CustomerForm = { name: string; phone: string; email: string; tags: string };
const emptyForm: CustomerForm = { name: '', phone: '', email: '', tags: '' };

const VEHICLE_ICONS: Record<string, string> = {
  hatchback: '🚗', sedan: '🚙', suv: '🚐', luxury: '🏎️',
  motorcycle: '🏍️', scooter: '🛵', auto: '🛺', bus: '🚌',
  truck: '🚛', van: '🚌', bicycle: '🚲',
};
function vehicleIcon(type: string) {
  return VEHICLE_ICONS[type?.toLowerCase()] ?? '🚗';
}

export function CustomersPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'vehicles' | 'jobs'>('vehicles');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ reg_number: '', vehicle_type: '', make: '', model: '', color: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page, tenantId],
    queryFn: () => listCustomers(tenantId, { search, page, perPage: 20 }),
    enabled: !!tenantId,
  });

  const config = useAppStore((s) => s.config);
  const isCarwash = config?.shop_type === 'carwash';

  // Load vehicles for selected customer via phone lookup
  const { data: customerVehicles = [], refetch: refetchVehicles } = useQuery<CarwashVehicle[]>({
    queryKey: ['customer-vehicles', tenantId, selectedCustomer?.phone],
    queryFn: () => findVehiclesByPhone(tenantId, selectedCustomer.phone),
    enabled: !!selectedCustomer?.phone,
  });

  // Load job history for carwash customers
  const { data: customerJobs = [] } = useQuery({
    queryKey: ['customer-jobs', tenantId, selectedCustomer?.phone],
    queryFn: () => getJobsByCustomerPhone(tenantId, selectedCustomer.phone),
    enabled: !!selectedCustomer?.phone && isCarwash,
  });

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['carwash-vtypes', tenantId],
    queryFn: () => listAllVehicleTypes(tenantId),
    enabled: !!tenantId,
  });

  // [carwash] [all tenants] — duplicate customer detection
  const [dupExpanded, setDupExpanded] = useState(true);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [mergeKeepId, setMergeKeepId] = useState<string | null>(null);

  const { data: dupGroups = [], refetch: refetchDups } = useQuery<DuplicateGroup[]>({
    queryKey: ['dup-groups', tenantId],
    queryFn: () => findDuplicateCustomerGroups(tenantId),
    enabled: !!tenantId && isCarwash,
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!mergeGroup || !mergeKeepId) throw new Error('Select the customer to keep');
      const removeIds = mergeGroup.entries
        .map(e => e.customer_id)
        .filter((id): id is string => !!id && id !== mergeKeepId);
      if (!removeIds.length) throw new Error('Nothing to merge — select a different primary');
      await mergeCustomers(tenantId, mergeKeepId, removeIds);
    },
    onSuccess: () => {
      toast.success('Customers merged successfully');
      setMergeGroup(null);
      setMergeKeepId(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dup-groups'] });
      refetchDups();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Merge failed'),
  });

  const addVehicleMutation = useMutation({
    mutationFn: () => {
      if (!vehicleForm.reg_number.trim()) throw new Error('Registration number is required');
      if (!vehicleForm.vehicle_type) throw new Error('Select a vehicle type');
      return upsertVehicle(tenantId, {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone ?? null,
        reg_number: vehicleForm.reg_number.toUpperCase().trim(),
        vehicle_type: vehicleForm.vehicle_type as any,
        make: vehicleForm.make || null,
        model: vehicleForm.model || null,
        color: vehicleForm.color || null,
        notes: null,
      });
    },
    onSuccess: () => {
      toast.success('Vehicle added');
      setShowAddVehicle(false);
      setVehicleForm({ reg_number: '', vehicle_type: '', make: '', model: '', color: '' });
      refetchVehicles();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to add vehicle'),
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? '',
        phone: editing.phone ?? '',
        email: editing.email ?? '',
        tags: Array.isArray(editing.tags) ? editing.tags.join(', ') : '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Customer name is required');
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: null, city: null, notes: null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        credit_limit: 0,
      };
      if (editing?.id) { await updateCustomer(tenantId, editing.id, payload); return editing.id; }
      const c = await createCustomer(tenantId, payload);
      return c.id;
    },
    onSuccess: () => {
      toast.success(editing ? 'Customer updated' : 'Customer created');
      setShowForm(false); setEditing(null); setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Unable to save customer'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(tenantId, id),
    onSuccess: () => {
      toast.success('Customer removed');
      setSelectedCustomer(null);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Customers"
        title="Know your customers."
        description="Manage your customer directory, track credit, and build loyalty."
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        }
      />

      {/* [carwash] [all tenants] — duplicate customers alert */}
      {isCarwash && dupGroups.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #ffd60a', background: '#fffbea' }}>
          <button type="button" onClick={() => setDupExpanded(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 gap-3 text-left"
            style={{ background: '#fff8cc' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: '#b45309' }} />
              <div>
                <p className="font-bold text-sm" style={{ color: '#92400e' }}>
                  {dupGroups.length} Possible Duplicate {dupGroups.length === 1 ? 'Group' : 'Groups'} Found
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                  Multiple customers linked to the same vehicle or phone number. Review and merge to keep records clean.
                </p>
              </div>
            </div>
            {dupExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: '#b45309' }} /> : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: '#b45309' }} />}
          </button>

          {dupExpanded && (
            <div className="divide-y" style={{ borderColor: '#fde68a' }}>
              {dupGroups.map(group => (
                <div key={group.key} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {group.reason === 'vehicle'
                          ? <Car className="h-4 w-4 flex-shrink-0" style={{ color: '#0071e3' }} />
                          : <Phone className="h-4 w-4 flex-shrink-0" style={{ color: '#0071e3' }} />}
                        <span className="font-bold text-sm" style={{ color: '#1d1d1f' }}>
                          {group.reason === 'vehicle' ? 'Vehicle' : 'Phone'}: {group.display}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                          {group.entries.length} customers
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.entries.map((e, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                            <span className="font-semibold" style={{ color: '#1d1d1f' }}>{e.customer_name}</span>
                            <span style={{ color: '#6b7280' }}>·</span>
                            <span style={{ color: '#6b7280' }}>{e.phone}</span>
                            {e.job_count > 0 && <span className="text-xs" style={{ color: '#6b7280' }}>{e.job_count} job{e.job_count !== 1 ? 's' : ''}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => { setMergeGroup(group); setMergeKeepId(group.entries.find(e => !!e.customer_id)?.customer_id ?? null); }}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: '#0071e3', color: '#ffffff' }}>
                      <Merge className="h-4 w-4" />
                      Merge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or phone…"
            className="input pl-11"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Tags</th>
                <th className="text-right">Loyalty Points</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j}><div className="h-4 rounded bg-slate-200 animate-pulse" /></td>
                ))}</tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={6} className="p-0">
                  <EmptyState icon={<Users className="h-8 w-8" />} title="No customers yet"
                    description="Add your first customer to track purchases and loyalty." />
                </td></tr>
              )}
              {items.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                  <td className="font-semibold text-slate-950">{c.name}</td>
                  <td className="text-slate-500">{c.phone ?? '—'}</td>
                  <td className="text-slate-500">{c.email ?? '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t: string) => <span key={t} className="chip text-xs">{t}</span>)}
                    </div>
                  </td>
                  <td className="text-right text-slate-500">{c.loyalty_points}</td>
                  <td className="text-right">
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                      className="rounded-full bg-rose-50 p-2 text-rose-500 hover:bg-rose-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>{total} customers · Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* ── Customer Detail Popup ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedCustomer(null); }}>
          <div className="rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden"
            style={{ width: '88vw', maxWidth: '1200px', height: '85vh', background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: 'var(--accent)', color: '#111' }}>
                  {selectedCustomer.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{selectedCustomer.name}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Customer Profile</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditing(selectedCustomer); setSelectedCustomer(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'var(--accent)', color: '#111' }}>
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => setSelectedCustomer(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl"
                  style={{ background: 'var(--surface-2)' }}>
                  <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            </div>

            {/* Two-column body */}
            <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '300px 1fr' }}>

              {/* Left — Customer Details */}
              <div className="px-7 py-6 space-y-5 overflow-y-auto" style={{ borderRight: '1px solid var(--surface-border)' }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Customer Details</p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <div>
                      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Phone</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedCustomer.phone || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <div>
                      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Email</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedCustomer.email || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Star className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <div>
                      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Loyalty Points</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{selectedCustomer.loyalty_points ?? 0}</p>
                    </div>
                  </div>

                  {selectedCustomer.tags?.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Tag className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      <div>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCustomer.tags.map((t: string) => (
                            <span key={t} className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ background: 'var(--accent)', color: '#111' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <div className="pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
                  <button onClick={() => setDeleteTarget(selectedCustomer)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete Customer
                  </button>
                </div>
              </div>

              {/* Right — Tabs: Vehicles | Job History */}
              <div className="px-7 py-6 space-y-4 overflow-y-auto">

                {/* Tab switcher — show Job History tab only for carwash */}
                {isCarwash && (
                  <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                    <button onClick={() => setDetailTab('vehicles')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: detailTab === 'vehicles' ? 'var(--accent)' : 'transparent', color: detailTab === 'vehicles' ? '#111' : 'var(--text-secondary)' }}>
                      <Car className="h-3.5 w-3.5" /> Vehicles {customerVehicles.length > 0 && `(${customerVehicles.length})`}
                    </button>
                    <button onClick={() => setDetailTab('jobs')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: detailTab === 'jobs' ? 'var(--accent)' : 'transparent', color: detailTab === 'jobs' ? '#111' : 'var(--text-secondary)' }}>
                      <ClipboardList className="h-3.5 w-3.5" /> Job History {customerJobs.length > 0 && `(${customerJobs.length})`}
                    </button>
                  </div>
                )}

                {/* Vehicles tab */}
                {(!isCarwash || detailTab === 'vehicles') && (
                <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Vehicles</p>
                    {customerVehicles.length > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#111' }}>
                        {customerVehicles.length}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowAddVehicle(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'var(--accent)', color: '#111' }}>
                    <Plus className="h-3 w-3" /> Add Vehicle
                  </button>
                </div>

                {/* Add Vehicle inline form */}
                {showAddVehicle && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}>
                    <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>New Vehicle</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Reg Number *</label>
                        <input value={vehicleForm.reg_number}
                          onChange={e => setVehicleForm(f => ({ ...f, reg_number: e.target.value.toUpperCase() }))}
                          placeholder="MH12AB1234"
                          className="w-full rounded-xl border px-3 py-2 text-sm font-bold tracking-wider outline-none"
                          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Color</label>
                        <input value={vehicleForm.color}
                          onChange={e => setVehicleForm(f => ({ ...f, color: e.target.value }))}
                          placeholder="e.g. White"
                          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Make</label>
                        <input value={vehicleForm.make}
                          onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))}
                          placeholder="e.g. Maruti"
                          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Model</label>
                        <input value={vehicleForm.model}
                          onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))}
                          placeholder="e.g. Swift"
                          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Vehicle Type *</label>
                      <div className="flex flex-wrap gap-1.5">
                        {vehicleTypes.filter(vt => vt.is_active).map(vt => (
                          <button key={vt.id} type="button"
                            onClick={() => setVehicleForm(f => ({ ...f, vehicle_type: vt.name }))}
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold transition-all"
                            style={vehicleForm.vehicle_type === vt.name
                              ? { background: 'var(--accent)', color: '#111' }
                              : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                            {vt.icon} {vt.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setShowAddVehicle(false)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                        Cancel
                      </button>
                      <button onClick={() => addVehicleMutation.mutate()} disabled={addVehicleMutation.isPending}
                        className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-60"
                        style={{ background: 'var(--accent)', color: '#111' }}>
                        {addVehicleMutation.isPending ? 'Saving…' : 'Save Vehicle'}
                      </button>
                    </div>
                  </div>
                )}

                {!selectedCustomer.phone && (
                  <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                    <Car className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add a phone number to see vehicles</p>
                  </div>
                )}

                {selectedCustomer.phone && customerVehicles.length === 0 && (
                  <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                    <Car className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No vehicles on record yet</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Vehicles appear here after a job card is created</p>
                  </div>
                )}

                <div className="space-y-3">
                  {customerVehicles.map(v => (
                    <div key={v.id} className="rounded-xl p-4 flex items-center gap-4"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: 'var(--surface)' }}>
                        {vehicleIcon(v.vehicle_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {v.reg_number ?? 'No Reg'}
                        </p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-secondary)' }}>
                          {v.vehicle_type}{(v.make || v.model) ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
                        </p>
                        {v.color && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Color: {v.color}</p>}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' }}>
                        {v.vehicle_type}
                      </span>
                    </div>
                  ))}
                </div>
                </div>
                )}

                {/* Job History tab */}
                {isCarwash && detailTab === 'jobs' && (
                  <div className="space-y-3">
                    {!selectedCustomer.phone && (
                      <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add a phone number to see job history</p>
                      </div>
                    )}
                    {selectedCustomer.phone && customerJobs.length === 0 && (
                      <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No job cards yet</p>
                      </div>
                    )}

                    {customerJobs.length > 0 && (
                      <>
                        {/* Summary + Print All */}
                        <div className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Total Jobs</p>
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{customerJobs.length}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Total Spent</p>
                            <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
                              ₹{customerJobs.reduce((s: number, j: any) => s + (j.total ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <button onClick={async () => {
                            const logo = (config?.settings as any)?.logo_base64;
                            const shopName = config?.shop_name ?? 'Car Wash';
                            const rows = customerJobs.map((j: any) => `
                              <tr>
                                <td>${new Date(j.created_at).toLocaleDateString('en-IN')}</td>
                                <td><b>${j.job_number}</b></td>
                                <td>${j.reg_number}</td>
                                <td>${(j.items ?? []).map((i: any) => i.service_name).join(', ')}</td>
                                <td style="color:${j.status==='delivered'?'#16a34a':'#d97706'};font-weight:600">${j.status}</td>
                                <td style="text-align:right;font-weight:700">₹${Math.round(j.total).toLocaleString('en-IN')}</td>
                              </tr>`).join('');
                            const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
                            <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}
                            .header{text-align:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #f59e0b}
                            .logo{max-height:60px;max-width:150px;object-fit:contain}
                            h1{font-size:18px;margin:4px 0}.subtitle{color:#6b7280;font-size:12px}
                            table{width:100%;border-collapse:collapse;margin-top:12px}
                            th{background:#f59e0b;color:#111;padding:8px;text-align:left;font-size:12px}
                            td{padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px}
                            tr:nth-child(even){background:#f9fafb}
                            .total{text-align:right;font-size:14px;font-weight:700;padding:12px 0;color:#f59e0b}
                            .footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:16px}</style>
                            </head><body>
                            <div class="header">${logo?`<div><img src="${logo}" class="logo"/></div>`:''}
                            <h1>${shopName}</h1>
                            ${config?.phone?`<div class="subtitle">📞 ${config.phone}</div>`:''}
                            </div>
                            <h2 style="margin:0 0 4px">Customer: ${selectedCustomer.name}</h2>
                            <div class="subtitle">${selectedCustomer.phone ? `📞 ${selectedCustomer.phone}` : ''}</div>
                            <table><thead><tr><th>Date</th><th>Job #</th><th>Vehicle</th><th>Services</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead>
                            <tbody>${rows}</tbody></table>
                            <div class="total">Total Spent: ₹${customerJobs.reduce((s:number,j:any)=>s+(j.total??0),0).toLocaleString('en-IN',{maximumFractionDigits:0})}</div>
                            <div class="footer">Printed on ${new Date().toLocaleDateString('en-IN')}</div>
                            </body></html>`;
                            const finalHtml = html.replace('</body>', `<script>window.addEventListener('load',()=>setTimeout(window.print,400))<\/script></body>`);
                            try {
                              const cacheDir = await appCacheDir();
                              const sep = cacheDir.endsWith('/')||cacheDir.endsWith('\\')?'':'/';
                              const path = `${cacheDir}${sep}customer-history-${selectedCustomer.id}.html`;
                              await writeTextFile(path, finalHtml);
                              await shellOpen(path);
                            } catch(e:any) { toast.error('Print failed: '+(e?.message??e)); }
                          }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                            style={{ background: 'var(--accent)', color: '#111' }}>
                            <Printer className="h-3.5 w-3.5" /> Print History
                          </button>
                        </div>

                        {/* Job list */}
                        {customerJobs.map((j: any) => (
                          <div key={j.id} className="rounded-xl p-3 space-y-2"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{j.job_number}</span>
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(j.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>₹{Math.round(j.total).toLocaleString('en-IN')}</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                                  style={{ background: j.status === 'delivered' ? '#dcfce7' : '#fef3c7', color: j.status === 'delivered' ? '#16a34a' : '#d97706' }}>
                                  {j.status}
                                </span>
                                <button title="Print invoice" onClick={async () => {
                                  const logo = (config?.settings as any)?.logo_base64;
                                  const shopName = config?.shop_name ?? 'Car Wash';
                                  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
                                  <style>body{font-family:'Courier New',monospace;max-width:300px;margin:0 auto;padding:12px;font-size:12px}
                                  .center{text-align:center}.bold{font-weight:700}.line{border-top:1px dashed #000;margin:6px 0}
                                  .row{display:flex;justify-content:space-between;margin:2px 0}.big{font-size:16px;font-weight:700}
                                  .logo{max-height:50px;max-width:120px;object-fit:contain}</style></head><body>
                                  <div class="center">${logo?`<img src="${logo}" class="logo"/><br/>`:''}
                                  <span class="bold" style="font-size:15px">${shopName}</span></div>
                                  ${config?.address_line1?`<div class="center" style="font-size:10px">${[config.address_line1,config.city].filter(Boolean).join(', ')}</div>`:''}
                                  ${config?.phone?`<div class="center" style="font-size:10px">📞 ${config.phone}</div>`:''}
                                  <div class="line"></div><div class="center bold big">INVOICE</div>
                                  <div class="row"><span>Invoice #</span><span class="bold">${j.job_number}</span></div>
                                  <div class="row"><span>Date</span><span>${new Date(j.created_at).toLocaleDateString('en-IN')}</span></div>
                                  <div class="row"><span>Reg Number</span><span class="bold">${j.reg_number}</span></div>
                                  <div class="row"><span>Vehicle Type</span><span>${j.vehicle_type}</span></div>
                                  ${j.make||j.model?`<div class="row"><span>Make / Model</span><span>${[j.make,j.model].filter(Boolean).join(' ')}</span></div>`:''}
                                  ${j.color?`<div class="row"><span>Color</span><span>${j.color}</span></div>`:''}
                                  ${j.customer_name?`<div class="row"><span>Customer</span><span>${j.customer_name}</span></div>`:''}
                                  ${j.customer_phone?`<div class="row"><span>Phone</span><span>${j.customer_phone}</span></div>`:''}
                                  ${j.staff_name?`<div class="row"><span>Staff</span><span>${j.staff_name}</span></div>`:''}
                                  <div class="line"></div><div class="bold" style="margin-bottom:4px">Services</div>
                                  ${(j.items??[]).map((i:any)=>`<div class="row"><span>${i.service_name}</span><span>${fmt(i.price)}</span></div>`).join('')}
                                  <div class="line"></div>
                                  ${j.discount>0?`<div class="row"><span>Discount</span><span>-${fmt(j.discount)}</span></div>`:''}
                                  ${j.gst_amount>0?`<div class="row"><span>GST</span><span>${fmt(j.gst_amount)}</span></div>`:''}
                                  <div class="row bold big"><span>TOTAL</span><span>${fmt(j.total)}</span></div>
                                  ${j.payment_method?`<div class="row" style="font-size:10px"><span>Payment</span><span>${j.payment_method.toUpperCase()}</span></div>`:''}
                                  <div class="line"></div><div class="center" style="font-size:10px;margin-top:6px">Thank you! Come again 🚗</div>
                                  </body></html>`;
                                  const fh = html.replace('</body>',`<script>window.addEventListener('load',()=>setTimeout(window.print,400))<\/script></body>`);
                                  try {
                                    const cd = await appCacheDir();
                                    const sep = cd.endsWith('/')||cd.endsWith('\\')?'':'/';
                                    const p = `${cd}${sep}invoice-${j.id}.html`;
                                    await writeTextFile(p, fh);
                                    await shellOpen(p);
                                  } catch(e:any) { toast.error('Print failed: '+(e?.message??e)); }
                                }}
                                  className="p-1 rounded-lg btn-secondary hover:text-amber-500 transition-colors">
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>🚗 {j.reg_number}</p>
                              <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{j.vehicle_type}</p>
                              {(j.make || j.model) && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{[j.make, j.model].filter(Boolean).join(' ')}</p>}
                              {j.color && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>· {j.color}</p>}
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {(j.items ?? []).map((i: any) => i.service_name).join(' · ')}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong w-full max-w-lg rounded-[2rem] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="btn-secondary" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input className="input" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Tags (comma separated)</label>
                <input className="input" value={form.tags} onChange={(e) => setForm((c) => ({ ...c, tags: e.target.value }))} placeholder="regular, wholesale, vip" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* [carwash] [all tenants] — merge customers modal */}
      {mergeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="rounded-3xl flex flex-col" style={{ width: 540, maxHeight: '90vh', background: '#ffffff', boxShadow: '0 8px 40px rgba(0,0,0,0.28)' }}>
            <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
              <div>
                <h2 className="font-bold text-xl" style={{ color: '#1d1d1f' }}>Merge Duplicate Customers</h2>
                <p className="text-sm mt-0.5" style={{ color: '#86868b' }}>
                  {mergeGroup.reason === 'vehicle' ? `Vehicle: ${mergeGroup.display}` : `Phone: ${mergeGroup.display}`}
                </p>
              </div>
              <button onClick={() => { setMergeGroup(null); setMergeKeepId(null); }}
                className="h-9 w-9 flex items-center justify-center rounded-xl"
                style={{ background: '#f2f2f7' }}>
                <X className="h-4 w-4" style={{ color: '#86868b' }} />
              </button>
            </div>

            <div className="px-7 py-5 overflow-y-auto space-y-4">
              <p className="text-sm" style={{ color: '#3a3a3c' }}>
                Select which customer record to <strong>keep</strong>. All job history, vehicles, and loyalty points from the others will be transferred to it, and the rest will be removed.
              </p>

              <div className="space-y-3">
                {mergeGroup.entries.map((e, i) => {
                  const isKeep = mergeKeepId === e.customer_id;
                  const hasId = !!e.customer_id;
                  return (
                    <button key={i} type="button"
                      disabled={!hasId}
                      onClick={() => setMergeKeepId(e.customer_id)}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all"
                      style={isKeep
                        ? { background: '#e8f0fe', border: '2px solid #0071e3' }
                        : { background: '#f7f7f8', border: '2px solid #e5e5ea', opacity: hasId ? 1 : 0.5 }}>
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
                        style={{ background: isKeep ? '#0071e3' : '#e5e5ea', color: isKeep ? '#ffffff' : '#6b7280' }}>
                        {isKeep ? <Check className="h-5 w-5" /> : (e.customer_name?.[0]?.toUpperCase() ?? '?')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: '#1d1d1f' }}>{e.customer_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>
                          📞 {e.phone}
                          {e.job_count > 0 && <> · {e.job_count} job{e.job_count !== 1 ? 's' : ''}</>}
                          {!hasId && <> · (no customer record)</>}
                        </p>
                      </div>
                      {isKeep && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                          style={{ background: '#0071e3', color: '#ffffff' }}>Keep</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {mergeGroup.entries.filter(e => !!e.customer_id && e.customer_id !== mergeKeepId).length > 0 && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{ background: '#fff3cd', border: '1px solid #fde68a' }}>
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#b45309' }} />
                  <p className="text-xs" style={{ color: '#92400e' }}>
                    The other {mergeGroup.entries.filter(e => !!e.customer_id && e.customer_id !== mergeKeepId).length} customer record(s) will be permanently removed after merging. This cannot be undone.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-7 py-5" style={{ borderTop: '1px solid #e5e5ea', flexShrink: 0 }}>
              <button onClick={() => { setMergeGroup(null); setMergeKeepId(null); }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#f2f2f7', color: '#3a3a3c' }}>
                Cancel
              </button>
              <button onClick={() => mergeMutation.mutate()}
                disabled={!mergeKeepId || mergeMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: '#0071e3' }}>
                <Merge className="h-4 w-4" />
                {mergeMutation.isPending ? 'Merging…' : 'Merge Customers'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        message={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"?`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
