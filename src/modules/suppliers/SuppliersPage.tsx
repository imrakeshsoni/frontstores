import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/lib/db/suppliers';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';

type SupplierForm = { name: string; gstin: string; phone: string; email: string; address: string; drug_license_no: string; notes: string };
const emptyForm: SupplierForm = { name: '', gstin: '', phone: '', email: '', address: '', drug_license_no: '', notes: '' };

export function SuppliersPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search, page, tenantId],
    queryFn: () => listSuppliers(tenantId, { search, page, perPage: 20 }),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? '',
        gstin: editing.gstin ?? '',
        phone: editing.phone ?? '',
        email: editing.email ?? '',
        address: editing.address ?? '',
        drug_license_no: editing.drug_license_no ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Supplier name is required');
      const payload = {
        name: form.name.trim(),
        gstin: form.gstin.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        drug_license_no: form.drug_license_no.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing?.id) {
        await updateSupplier(tenantId, editing.id, payload);
      } else {
        await createSupplier(tenantId, payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Supplier updated' : 'Supplier created');
      setShowForm(false); setEditing(null); setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-suppliers'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Unable to save supplier'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(tenantId, id),
    onSuccess: () => {
      toast.success('Supplier removed');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-suppliers'] });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Suppliers"
        title="Manage your supply chain."
        description="Track your suppliers, their contact details, and GST numbers."
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        }
      />

      <div className="card p-5">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or GSTIN…" className="input pl-11" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Phone</th>
                <th>GSTIN</th>
                <th>City</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><div className="h-4 rounded bg-slate-200 animate-pulse" /></td>)}</tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={5} className="p-0">
                  <EmptyState icon={<Truck className="h-8 w-8" />} title="No suppliers yet" description="Add your first supplier." />
                </td></tr>
              )}
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-semibold text-slate-950">{s.name}</p>
                    {s.drug_license_no && <p className="text-xs text-slate-400">DL: {s.drug_license_no}</p>}
                  </td>
                  <td className="text-slate-500">{s.phone ?? '—'}</td>
                  <td className="text-slate-500 font-mono text-xs">{s.gstin ?? '—'}</td>
                  <td className="text-slate-500">{s.address ?? '—'}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded-full bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                        onClick={() => { setEditing(s); setShowForm(true); }}>
                        <Search className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(s.id)}
                        className="rounded-full bg-rose-50 p-2 text-rose-500 hover:bg-rose-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} suppliers · Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-50">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong w-full max-w-lg rounded-[2rem] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button className="btn-secondary" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Name *', key: 'name' },
                { label: 'Phone', key: 'phone' },
                { label: 'Email', key: 'email' },
                { label: 'GSTIN', key: 'gstin' },
                { label: 'Drug License No', key: 'drug_license_no' },
                { label: 'Address / City', key: 'address' },
                { label: 'Notes', key: 'notes' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
                  <input className="input" value={(form as any)[key]} onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))} />
                </div>
              ))}
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
