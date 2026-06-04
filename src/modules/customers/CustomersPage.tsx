import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Users, X, Edit2, Car, Phone, Mail, Tag, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/db/customers';
import { findVehiclesByPhone, upsertVehicle, listAllVehicleTypes, type CarwashVehicle } from '@/lib/db/carwash';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';

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
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ reg_number: '', vehicle_type: '', make: '', model: '', color: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page, tenantId],
    queryFn: () => listCustomers(tenantId, { search, page, perPage: 20 }),
    enabled: !!tenantId,
  });

  // Load vehicles for selected customer via phone lookup
  const { data: customerVehicles = [], refetch: refetchVehicles } = useQuery<CarwashVehicle[]>({
    queryKey: ['customer-vehicles', tenantId, selectedCustomer?.phone],
    queryFn: () => findVehiclesByPhone(tenantId, selectedCustomer.phone),
    enabled: !!selectedCustomer?.phone,
  });

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['carwash-vtypes', tenantId],
    queryFn: () => listAllVehicleTypes(tenantId),
    enabled: !!tenantId,
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
                    <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={e => { if (e.target === e.currentTarget) setSelectedCustomer(null); }}>
          <div className="rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden"
            style={{ maxWidth: '860px', maxHeight: '88vh', background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>

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
            <div className="grid grid-cols-2 flex-1 overflow-hidden">

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
                  <button onClick={() => { if (confirm(`Delete ${selectedCustomer.name}?`)) deleteMutation.mutate(selectedCustomer.id); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete Customer
                  </button>
                </div>
              </div>

              {/* Right — Vehicles */}
              <div className="px-7 py-6 space-y-4 overflow-y-auto">
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
    </div>
  );
}
