import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Package, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/app/store/auth.store';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  tags: string;
};

const emptyForm: CustomerForm = { name: '', phone: '', email: '', tags: '' };

export function CustomersPage() {
  const can = useAuthStore((s) => s.can);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [predefinedSearch, setPredefinedSearch] = useState('');
  const [predefinedProducts, setPredefinedProducts] = useState<any[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const predefinedSearchRef = useRef<HTMLInputElement>(null);
  const shopId = useAuthStore((s) => s.activeShopId);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () =>
      apiClient
        .get(`/api/core/customers?search=${encodeURIComponent(search)}&page=${page}&perPage=20`)
        .then((r) => r.data),
  });

  const { data: customerDetail } = useQuery({
    queryKey: ['customer-detail', selectedCustomer?.id],
    queryFn: () => apiClient.get(`/api/core/customers/${selectedCustomer.id}`).then((r) => r.data.data),
    enabled: !!selectedCustomer?.id,
  });

  const trimmedPredefinedSearch = predefinedSearch.trim();
  const { data: productSearchResults, isFetching: isFetchingProducts } = useQuery({
    queryKey: ['customer-product-search', trimmedPredefinedSearch, shopId],
    queryFn: () =>
      apiClient
        .get(`/api/core/products?search=${encodeURIComponent(trimmedPredefinedSearch)}&perPage=20`)
        .then((r) => r.data.data),
    enabled: showForm && trimmedPredefinedSearch.length > 1,
  });

  const { data: existingPredefined } = useQuery({
    queryKey: ['customer-predefined', editing?.id],
    queryFn: () =>
      apiClient.get(`/api/core/customers/${editing!.id}/predefined-products`).then((r) => r.data.data),
    enabled: !!editing?.id,
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
      setPredefinedProducts([]);
    }
    setPredefinedSearch('');
    setShowProductDropdown(false);
  }, [editing]);

  useEffect(() => {
    if (existingPredefined) {
      setPredefinedProducts(existingPredefined);
    }
  }, [existingPredefined]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (!payload.name) throw new Error('Customer name is required');

      let customerId = editing?.id;
      if (customerId) {
        await apiClient.put(`/api/core/customers/${customerId}`, payload);
      } else {
        const res = await apiClient.post('/api/core/customers', payload);
        customerId = res.data.data?.id;
      }

      if (customerId) {
        await apiClient.put(`/api/core/customers/${customerId}/predefined-products`, {
          productIds: predefinedProducts.map((p: any) => p.id),
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Customer updated' : 'Customer created');
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      setPredefinedProducts([]);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-predefined'] });
    },
    onError: (err: any) => {
      toast.error(err.message ?? err.response?.data?.message ?? 'Unable to save customer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/core/customers/${id}`),
    onSuccess: () => {
      toast.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Unable to delete customer');
    },
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer?.id) throw new Error('Select a customer');
      const amount = Number(paymentAmount || 0);
      if (amount <= 0) throw new Error('Enter a valid amount');
      return apiClient.post(`/api/core/customers/${selectedCustomer.id}/collect-payment`, {
        amount,
        method: 'cash',
      });
    },
    onSuccess: () => {
      toast.success('Credit payment collected');
      setPaymentAmount('');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail', selectedCustomer?.id] });
      queryClient.invalidateQueries({ queryKey: ['report-closing'] });
      queryClient.invalidateQueries({ queryKey: ['report-audit'] });
    },
    onError: (err: any) => {
      toast.error(err.message ?? err.response?.data?.message ?? 'Unable to collect payment');
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer?.id) throw new Error('Select a customer');
      return apiClient.post(`/api/core/customers/${selectedCustomer.id}/send-reminder`, {
        channel: 'manual',
        notes: reminderNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Reminder logged');
      setReminderNotes('');
      queryClient.invalidateQueries({ queryKey: ['customer-detail', selectedCustomer?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message ?? err.response?.data?.message ?? 'Unable to log reminder');
    },
  });

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Customers"
        title="Customer records that are finally usable."
        description="View, create, edit, and maintain customer profiles with loyalty balances and tags using the existing management surface."
        actions={
          can('customers', 'write') ? (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
          ) : undefined
        }
      />

      <div className="card p-5">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-11"
            placeholder="Search customers by name, phone, or email…"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th className="text-right">Loyalty</th>
              <th className="text-right">Credit</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && (data?.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState
                    icon={<Users className="h-8 w-8" />}
                    title="No customers yet"
                    description="Create a few customer records so loyalty tracking, POS history, and future CRM flows have real data to work with."
                  />
                </td>
              </tr>
            )}
            {(data?.data ?? []).map((customer: any) => (
              <tr key={customer.id} className="cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                <td className="font-semibold text-slate-950">{customer.name}</td>
                <td>{customer.phone ?? '—'}</td>
                <td>{customer.email ?? '—'}</td>
                <td className="text-right">{customer.loyaltyPoints ?? 0}</td>
                <td className="text-right">₹{Number(customer.creditBalance ?? 0).toFixed(2)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {can('customers', 'write') && (
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(null);
                          setEditing(customer);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {can('customers', 'delete') && (
                      <button
                        className="rounded-full bg-rose-50 p-2 text-rose-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(customer.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.meta && (
        <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>
            {data.meta.total} customers · Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              className="btn-secondary disabled:opacity-50"
              disabled={page >= (data.meta.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedCustomer && customerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong w-full max-w-3xl rounded-[2rem] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-label">Customer</p>
                <h2 className="mt-2 text-2xl">{customerDetail.name}</h2>
              </div>
              <button className="btn-secondary" onClick={() => setSelectedCustomer(null)}>Close</button>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="card p-4">
                <p className="text-xs text-slate-500">Phone</p>
                <p className="mt-1 font-semibold text-slate-900">{customerDetail.phone ?? '—'}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-slate-500">Credit Balance</p>
                <p className="mt-1 font-semibold text-slate-900">₹{Number(customerDetail.creditBalance ?? 0).toFixed(2)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-slate-500">Loyalty Points</p>
                <p className="mt-1 font-semibold text-slate-900">{customerDetail.loyaltyPoints ?? 0}</p>
              </div>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <div className="card p-4">
                <p className="text-xs text-slate-500">Current</p>
                <p className="mt-1 font-semibold text-slate-900">₹{Number(customerDetail.aging?.current ?? 0).toFixed(2)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-slate-500">31-60 Days</p>
                <p className="mt-1 font-semibold text-slate-900">₹{Number(customerDetail.aging?.bucket_31_60 ?? 0).toFixed(2)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-slate-500">61-90 Days</p>
                <p className="mt-1 font-semibold text-slate-900">₹{Number(customerDetail.aging?.bucket_61_90 ?? 0).toFixed(2)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-slate-500">90+ Days</p>
                <p className="mt-1 font-semibold text-rose-600">₹{Number(customerDetail.aging?.bucket_90_plus ?? 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Collect Credit Payment</label>
                  <input
                    type="number"
                    className="input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Amount"
                  />
                </div>
                <button className="btn-secondary" onClick={() => collectMutation.mutate()} disabled={collectMutation.isPending}>
                  <Banknote className="h-4 w-4" />
                  {collectMutation.isPending ? 'Collecting…' : 'Collect'}
                </button>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Reminder Note</label>
                  <input
                    className="input"
                    value={reminderNotes}
                    onChange={(e) => setReminderNotes(e.target.value)}
                    placeholder="Called customer / follow-up promised / WhatsApp reminder"
                  />
                </div>
                <button className="btn-secondary" onClick={() => reminderMutation.mutate()} disabled={reminderMutation.isPending}>
                  {reminderMutation.isPending ? 'Saving…' : 'Log Reminder'}
                </button>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-slate-200/60 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Linked Orders</p>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(customerDetail.orders ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-400">No orders linked yet</td>
                    </tr>
                  )}
                  {(customerDetail.orders ?? []).map((order: any) => (
                    <tr key={order.id}>
                      <td className="font-semibold text-slate-900">{order.bill_number}</td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>{order.payment_status}</td>
                      <td className="text-right">₹{Number(order.total ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-slate-200/60 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Customer Ledger</p>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(customerDetail.ledger ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400">No ledger entries yet</td>
                    </tr>
                  )}
                  {(customerDetail.ledger ?? []).map((entry: any) => (
                    <tr key={`${entry.id}-${entry.created_at}`}>
                      <td className="font-semibold text-slate-900">{entry.bill_number}</td>
                      <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="capitalize">{entry.entry_type}</td>
                      <td>{entry.payment_status}</td>
                      <td className="text-right">₹{Number(entry.total ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-slate-200/60 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Reminder History</p>
              </div>
              <div className="divide-y divide-slate-100">
                {(customerDetail.reminderHistory ?? []).length === 0 && (
                  <div className="px-4 py-5 text-sm text-slate-400">No reminders logged yet.</div>
                )}
                {(customerDetail.reminderHistory ?? []).map((entry: any, index: number) => (
                  <div key={`${entry.sentAt}-${index}`} className="px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-900">{entry.channel ?? 'manual'} reminder</p>
                    <p className="mt-1 text-slate-500">
                      {new Date(entry.sentAt).toLocaleString()} · Outstanding ₹{Number(entry.outstanding ?? 0).toFixed(2)}
                    </p>
                    {entry.notes && <p className="mt-1 text-slate-600">{entry.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem]">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-label">Customers</p>
                <h2 className="mt-2 text-2xl">{editing ? 'Edit customer' : 'Add customer'}</h2>
              </div>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Close</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Tags</label>
                <input
                  className="input"
                  value={form.tags}
                  onChange={(e) => setForm((current) => ({ ...current, tags: e.target.value }))}
                  placeholder="vip, chronic-care, wholesale"
                />
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200/70 pt-5">
              <label className="mb-1 block text-sm font-medium text-slate-700">Predefined Products</label>
              <p className="mb-3 text-xs text-slate-400">
                Products linked to this customer will filter the billing search automatically.
              </p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={predefinedSearchRef}
                  className="input pl-9"
                  placeholder="Search product by name or SKU…"
                  value={predefinedSearch}
                  onChange={(e) => {
                    setPredefinedSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
                />
                {showProductDropdown && trimmedPredefinedSearch.length > 1 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                    {isFetchingProducts && (
                      <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
                    )}
                    {!isFetchingProducts && (!productSearchResults || productSearchResults.length === 0) && (
                      <div className="px-4 py-3 text-sm text-slate-400">No products found</div>
                    )}
                    {(productSearchResults ?? [])
                      .filter((p: any) => !predefinedProducts.some((sel: any) => sel.id === p.id))
                      .map((product: any) => (
                        <button
                          key={product.id}
                          type="button"
                          className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                          onMouseDown={() => {
                            setPredefinedProducts((prev) => [...prev, product]);
                            setPredefinedSearch('');
                            setShowProductDropdown(false);
                            predefinedSearchRef.current?.focus();
                          }}
                        >
                          <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{product.name}</p>
                            <p className="text-xs text-slate-400">
                              {[product.sku, product.supplierName].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {predefinedProducts.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Unit</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">MRP</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">GST%</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {predefinedProducts.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium text-slate-900">{p.name}</td>
                          <td className="px-3 py-2.5 text-slate-500">{p.sku || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{p.unit || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">
                            {p.mrp ? `₹${Number(p.mrp).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">
                            {(p.gstRate ?? p.gst_rate) ? `${p.gstRate ?? p.gst_rate}%` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{p.supplierName ?? p.supplier_name ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setPredefinedProducts((prev) => prev.filter((x: any) => x.id !== p.id))}
                              className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

            <div className="border-t border-slate-200/70 px-6 py-4 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Update Customer' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
