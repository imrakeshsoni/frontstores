import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/db/customers';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';

type CustomerForm = { name: string; phone: string; email: string; tags: string };
const emptyForm: CustomerForm = { name: '', phone: '', email: '', tags: '' };

export function CustomersPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page, tenantId],
    queryFn: () => listCustomers(tenantId, { search, page, perPage: 20 }),
    enabled: !!tenantId,
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
      if (editing?.id) {
        await updateCustomer(tenantId, editing.id, payload);
        return editing.id;
      }
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
                <tr key={c.id}>
                  <td className="font-semibold text-slate-950">{c.name}</td>
                  <td className="text-slate-500">{c.phone ?? '—'}</td>
                  <td className="text-slate-500">{c.email ?? '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => <span key={t} className="chip text-xs">{t}</span>)}
                    </div>
                  </td>
                  <td className="text-right text-slate-500">{c.loyalty_points}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded-full bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                        onClick={() => { setEditing(c); setShowForm(true); }}>
                        <Search className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(c.id)}
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
        <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>{total} customers · Page {page} of {totalPages}</span>
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
