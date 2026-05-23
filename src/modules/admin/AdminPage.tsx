import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Ban,
  Building2,
  Database,
  KeyRound,
  MessageSquare,
  Search,
  ShieldCheck,
  ShieldOff,
  Store,
  Users,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/app/store/auth.store';
import { PageIntro } from '@/components/ui/PageIntro';

const money = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';

const badgeClass = (value?: string | boolean | null) => {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'active' || normalized === 'true' || normalized === 'paid') return 'badge-green';
  if (normalized === 'suspended' || normalized === 'locked' || normalized === 'false') return 'badge-red';
  if (normalized === 'churned' || normalized === 'pending') return 'badge-yellow';
  if (normalized === 'starter' || normalized === 'growth' || normalized === 'enterprise') return 'badge-blue';
  return 'badge-gray';
};

type AdminTab = 'overview' | 'tenants' | 'users' | 'explorer' | 'enquiries';

const TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'tenants', label: 'Tenants', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'enquiries', label: 'Enquiries', icon: MessageSquare },
  { key: 'explorer', label: 'Explorer', icon: Database },
];

export function AdminPage() {
  const isPlatformAdmin = useAuthStore((state) => state.user?.isPlatformAdmin === true);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [table, setTable] = useState('tenants');
  const [tablePage, setTablePage] = useState(1);
  const [tableSearch, setTableSearch] = useState('');
  const [tenantPage, setTenantPage] = useState(1);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantStatus, setTenantStatus] = useState('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userAccess, setUserAccess] = useState('all');
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [enquiryStatus, setEnquiryStatus] = useState('all');
  const [enquiryNotes, setEnquiryNotes] = useState<Record<string, string>>({});

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiClient.get('/api/core/admin/overview').then((r) => r.data.data),
    enabled: isPlatformAdmin,
  });

  const { data: tenants, isFetching: isTenantsFetching } = useQuery({
    queryKey: ['admin-tenants', tenantPage, tenantSearch, tenantStatus],
    queryFn: () =>
      apiClient
        .get('/api/core/admin/tenants', {
          params: { page: tenantPage, perPage: 12, search: tenantSearch, status: tenantStatus },
        })
        .then((r) => r.data.data),
    enabled: isPlatformAdmin,
  });

  const { data: tenantDetail, isFetching: isTenantDetailFetching } = useQuery({
    queryKey: ['admin-tenant-detail', selectedTenantId],
    queryFn: () => apiClient.get(`/api/core/admin/tenants/${selectedTenantId}`).then((r) => r.data.data),
    enabled: isPlatformAdmin && !!selectedTenantId,
  });

  const { data: users, isFetching: isUsersFetching } = useQuery({
    queryKey: ['admin-users', userPage, userSearch, userAccess],
    queryFn: () =>
      apiClient
        .get('/api/core/admin/users', {
          params: { page: userPage, perPage: 15, search: userSearch, access: userAccess },
        })
        .then((r) => r.data.data),
    enabled: isPlatformAdmin,
  });

  const { data: enquiries, isFetching: isEnquiriesFetching } = useQuery({
    queryKey: ['admin-enquiries', enquiryPage, enquiryStatus],
    queryFn: () =>
      apiClient
        .get('/api/core/enquiries', { params: { page: enquiryPage, perPage: 20, status: enquiryStatus } })
        .then((r) => r.data.data),
    enabled: isPlatformAdmin,
  });

  const enquiryMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) =>
      apiClient.patch(`/api/core/enquiries/${id}`, { status, adminNotes }),
    onSuccess: () => {
      toast.success('Enquiry updated');
      queryClient.invalidateQueries({ queryKey: ['admin-enquiries'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Unable to update enquiry'),
  });

  const { data: tables } = useQuery({
    queryKey: ['admin-tables'],
    queryFn: () => apiClient.get('/api/core/admin/tables').then((r) => r.data.data),
    enabled: isPlatformAdmin,
  });

  const { data: tableData, isFetching: isTableFetching } = useQuery({
    queryKey: ['admin-table', table, tablePage, tableSearch],
    queryFn: () =>
      apiClient
        .get('/api/core/admin/table', {
          params: { name: table, page: tablePage, perPage: 25, search: tableSearch },
        })
        .then((r) => r.data.data),
    enabled: isPlatformAdmin,
  });

  const tenantStatusMutation = useMutation({
    mutationFn: ({ tenantId, status }: { tenantId: string; status: string }) =>
      apiClient.patch(`/api/core/admin/tenants/${tenantId}/status`, { status }),
    onSuccess: () => {
      toast.success('Tenant status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tenant-detail'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Unable to update tenant');
    },
  });

  const userAccessMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Record<string, boolean> }) =>
      apiClient.patch(`/api/core/admin/users/${userId}/access`, payload),
    onSuccess: () => {
      toast.success('User access updated');
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tenant-detail'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Unable to update user');
    },
  });

  const passwordResetMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      apiClient.post(`/api/core/admin/users/${userId}/reset-password`, { password }),
    onSuccess: (res) => {
      toast.success(`Temporary password set: ${res.data.data.temporaryPassword}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tenant-detail'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Unable to reset password');
    },
  });

  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Platform Admin"
        title="Control every tenant from one surface."
        description="Monitor platform health, manage tenants, adjust user access, and inspect live data without leaving the admin command center."
        actions={<span className="chip"><ShieldCheck className="h-3.5 w-3.5" /> Platform admin</span>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Tenants', overview?.counts?.tenants ?? 0, Building2],
          ['Users', overview?.counts?.users ?? 0, Users],
          ['Revenue 30d', money(overview?.revenue30d ?? 0), Store],
          ['Locked users', overview?.accessStats?.locked_users ?? 0, Ban],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="stat-tile">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-3">
          <div className="mb-3 px-2 text-sm font-semibold text-slate-900">Admin modules</div>
          <div className="space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`nav-item w-full ${tab === key ? 'active' : ''}`}
                onClick={() => setTab(key)}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="card p-5">
                  <div className="mb-4">
                    <p className="section-label">Platform mix</p>
                    <h2 className="mt-2">Tenant status and plan distribution</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="card-inset p-4">
                      <p className="text-sm font-semibold text-slate-900">Tenant status</p>
                      <div className="mt-4 space-y-3">
                        {(overview?.tenantStatus ?? []).map((item: any) => (
                          <div key={item.status} className="flex items-center justify-between">
                            <span className={`badge ${badgeClass(item.status)}`}>{item.status}</span>
                            <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="card-inset p-4">
                      <p className="text-sm font-semibold text-slate-900">Plan mix</p>
                      <div className="mt-4 space-y-3">
                        {(overview?.planMix ?? []).map((item: any) => (
                          <div key={item.plan} className="flex items-center justify-between">
                            <span className={`badge ${badgeClass(item.plan)}`}>{item.plan}</span>
                            <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card p-5">
                  <div className="mb-4">
                    <p className="section-label">Access posture</p>
                    <h2 className="mt-2">Admin-sensitive account signals</h2>
                  </div>
                  <div className="grid gap-3">
                    {[
                      ['Platform admins', overview?.accessStats?.platform_admins ?? 0],
                      ['Active last 7 days', overview?.accessStats?.active_last_7d ?? 0],
                      ['Locked users', overview?.accessStats?.locked_users ?? 0],
                      ['Lifetime revenue', money(overview?.totalRevenue ?? 0)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="card-inset flex items-center justify-between p-4">
                        <span className="text-sm text-slate-600">{label}</span>
                        <span className="text-base font-semibold text-slate-950">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="card overflow-hidden">
                  <div className="border-b border-slate-200 p-4">
                    <p className="section-label">Newest tenants</p>
                    <h2 className="mt-2">Recent onboarding activity</h2>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Status</th>
                        <th>Plan</th>
                        <th>Footprint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.recentTenants ?? []).map((tenant: any) => (
                        <tr key={tenant.id}>
                          <td>
                            <div className="font-medium text-slate-950">{tenant.name}</div>
                            <div className="text-xs text-slate-500">{tenant.slug}</div>
                          </td>
                          <td><span className={`badge ${badgeClass(tenant.status)}`}>{tenant.status}</span></td>
                          <td><span className={`badge ${badgeClass(tenant.plan)}`}>{tenant.plan}</span></td>
                          <td className="text-sm text-slate-600">{tenant.shops} shops, {tenant.users} users</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card overflow-hidden">
                  <div className="border-b border-slate-200 p-4">
                    <p className="section-label">Recent orders</p>
                    <h2 className="mt-2">Cross-tenant commercial activity</h2>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bill</th>
                        <th>Tenant</th>
                        <th>Status</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.recentOrders ?? []).map((order: any) => (
                        <tr key={order.id}>
                          <td>
                            <div className="font-medium text-slate-950">{order.bill_number}</div>
                            <div className="text-xs text-slate-500">{dateTime(order.created_at)}</div>
                          </td>
                          <td>
                            <div className="text-sm text-slate-950">{order.tenant_name}</div>
                            <div className="text-xs text-slate-500">{order.tenant_slug}</div>
                          </td>
                          <td><span className={`badge ${badgeClass(order.payment_status)}`}>{order.status}</span></td>
                          <td className="text-right font-medium text-slate-950">{money(order.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'tenants' && (
            <div className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
              <div className="card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="section-label">Tenant management</p>
                    <h2 className="mt-2">Control plans, status, and support context</h2>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pl-9"
                        placeholder="Search tenant, slug, plan"
                        value={tenantSearch}
                        onChange={(event) => {
                          setTenantSearch(event.target.value);
                          setTenantPage(1);
                        }}
                      />
                    </div>
                    <select
                      className="input md:w-44"
                      value={tenantStatus}
                      onChange={(event) => {
                        setTenantStatus(event.target.value);
                        setTenantPage(1);
                      }}
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="churned">Churned</option>
                    </select>
                  </div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Status</th>
                      <th>Plan</th>
                      <th>Usage</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tenants?.rows ?? []).map((tenant: any) => (
                      <tr
                        key={tenant.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedTenantId(tenant.id)}
                      >
                        <td>
                          <div className="font-medium text-slate-950">{tenant.name}</div>
                          <div className="text-xs text-slate-500">{tenant.slug}</div>
                        </td>
                        <td><span className={`badge ${badgeClass(tenant.status)}`}>{tenant.status}</span></td>
                        <td><span className={`badge ${badgeClass(tenant.plan)}`}>{tenant.plan}</span></td>
                        <td className="text-sm text-slate-600">
                          {tenant.shop_count} shops, {tenant.user_count} users, {tenant.order_count} orders
                        </td>
                        <td className="text-right font-medium text-slate-950">{money(tenant.revenue)}</td>
                      </tr>
                    ))}
                    {!isTenantsFetching && tenants?.rows?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-500">No tenants found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="flex items-center justify-between border-t border-slate-200 p-4">
                  <button className="btn-secondary" disabled={tenantPage <= 1} onClick={() => setTenantPage((current) => Math.max(1, current - 1))}>
                    Previous
                  </button>
                  <span className="text-sm text-slate-500">
                    Page {tenants?.meta?.page ?? tenantPage} of {tenants?.meta?.totalPages ?? 1}
                  </span>
                  <button
                    className="btn-secondary"
                    disabled={tenantPage >= (tenants?.meta?.totalPages ?? 1)}
                    onClick={() => setTenantPage((current) => current + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="card p-5">
                {!selectedTenantId && (
                  <div className="empty-state min-h-[420px]">
                    <Building2 className="mb-3 h-10 w-10 text-slate-400" />
                    <h3>Select a tenant</h3>
                    <p className="mt-2 max-w-sm text-sm text-slate-500">
                      Open a tenant to inspect its footprint, recent orders, users, and take support actions.
                    </p>
                  </div>
                )}

                {selectedTenantId && tenantDetail && (
                  <div className="space-y-5">
                    <div>
                      <p className="section-label">Tenant detail</p>
                      <h2 className="mt-2">{tenantDetail.tenant.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{tenantDetail.tenant.slug}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`badge ${badgeClass(tenantDetail.tenant.status)}`}>{tenantDetail.tenant.status}</span>
                      <span className={`badge ${badgeClass(tenantDetail.tenant.plan)}`}>{tenantDetail.tenant.plan}</span>
                      <span className="badge-gray badge">Created {dateTime(tenantDetail.tenant.created_at)}</span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        ['Shops', tenantDetail.metrics.shops],
                        ['Users', tenantDetail.metrics.users],
                        ['Orders', tenantDetail.metrics.orders],
                        ['Products', tenantDetail.metrics.products],
                        ['Customers', tenantDetail.metrics.customers],
                        ['Revenue', money(tenantDetail.metrics.revenue)],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="card-inset p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-secondary"
                        disabled={tenantStatusMutation.isPending}
                        onClick={() => tenantStatusMutation.mutate({ tenantId: selectedTenantId, status: 'active' })}
                      >
                        Activate
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={tenantStatusMutation.isPending}
                        onClick={() => tenantStatusMutation.mutate({ tenantId: selectedTenantId, status: 'suspended' })}
                      >
                        Suspend
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={tenantStatusMutation.isPending}
                        onClick={() => tenantStatusMutation.mutate({ tenantId: selectedTenantId, status: 'churned' })}
                      >
                        Mark churned
                      </button>
                    </div>

                    <div>
                      <h3>Recent users</h3>
                      <div className="mt-3 space-y-3">
                        {(tenantDetail.users ?? []).map((user: any) => (
                          <div key={user.id} className="card-inset p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-slate-950">{user.name}</p>
                                <p className="text-sm text-slate-500">{user.email}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className={`badge ${badgeClass(user.is_active)}`}>{user.is_active ? 'active' : 'locked'}</span>
                                {user.is_platform_admin ? <span className="badge-blue badge">platform admin</span> : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3>Recent orders</h3>
                      <div className="mt-3 space-y-3">
                        {(tenantDetail.recentOrders ?? []).map((order: any) => (
                          <div key={order.id} className="card-inset flex items-center justify-between gap-4 p-4">
                            <div>
                              <p className="font-medium text-slate-950">{order.bill_number}</p>
                              <p className="text-sm text-slate-500">{dateTime(order.created_at)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-slate-950">{money(order.total)}</p>
                              <p className="text-sm text-slate-500">{order.payment_status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedTenantId && isTenantDetailFetching && (
                  <p className="text-sm text-slate-500">Loading tenant detail…</p>
                )}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="section-label">User power controls</p>
                  <h2 className="mt-2">Manage platform admins, account locks, and password recovery</h2>
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      placeholder="Search user, phone, tenant"
                      value={userSearch}
                      onChange={(event) => {
                        setUserSearch(event.target.value);
                        setUserPage(1);
                      }}
                    />
                  </div>
                  <select
                    className="input md:w-52"
                    value={userAccess}
                    onChange={(event) => {
                      setUserAccess(event.target.value);
                      setUserPage(1);
                    }}
                  >
                    <option value="all">All users</option>
                    <option value="platform-admins">Platform admins</option>
                    <option value="locked">Locked</option>
                    <option value="inactive">Inactive 30d+</option>
                  </select>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Tenant</th>
                    <th>Access</th>
                    <th>Last login</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(users?.rows ?? []).map((user: any) => (
                    <tr key={user.id}>
                      <td>
                        <div className="font-medium text-slate-950">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td>
                        <div className="text-sm text-slate-950">{user.tenant_name}</div>
                        <div className="text-xs text-slate-500">{user.tenant_slug}</div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <span className={`badge ${badgeClass(user.is_active)}`}>{user.is_active ? 'active' : 'locked'}</span>
                          {user.is_platform_admin ? <span className="badge-blue badge">platform admin</span> : null}
                        </div>
                      </td>
                      <td className="text-sm text-slate-600">{dateTime(user.last_login)}</td>
                      <td className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            className="btn-secondary"
                            disabled={userAccessMutation.isPending}
                            onClick={() =>
                              userAccessMutation.mutate({
                                userId: user.id,
                                payload: { isActive: !user.is_active },
                              })
                            }
                          >
                            {user.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            {user.is_active ? 'Lock' : 'Unlock'}
                          </button>
                          <button
                            className="btn-secondary"
                            disabled={userAccessMutation.isPending}
                            onClick={() =>
                              userAccessMutation.mutate({
                                userId: user.id,
                                payload: { isPlatformAdmin: !user.is_platform_admin },
                              })
                            }
                          >
                            <ShieldCheck className="h-4 w-4" />
                            {user.is_platform_admin ? 'Remove admin' : 'Make admin'}
                          </button>
                          <button
                            className="btn-secondary"
                            disabled={passwordResetMutation.isPending}
                            onClick={() =>
                              passwordResetMutation.mutate({
                                userId: user.id,
                                password: 'Temp1234',
                              })
                            }
                          >
                            <KeyRound className="h-4 w-4" />
                            Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isUsersFetching && users?.rows?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t border-slate-200 p-4">
                <button className="btn-secondary" disabled={userPage <= 1} onClick={() => setUserPage((current) => Math.max(1, current - 1))}>
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {users?.meta?.page ?? userPage} of {users?.meta?.totalPages ?? 1}
                </span>
                <button
                  className="btn-secondary"
                  disabled={userPage >= (users?.meta?.totalPages ?? 1)}
                  onClick={() => setUserPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {tab === 'enquiries' && (
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="section-label">Enquiries</p>
                  <h2 className="mt-2">Contact form submissions from interested shops</h2>
                </div>
                <select
                  className="input lg:w-44"
                  value={enquiryStatus}
                  onChange={(e) => { setEnquiryStatus(e.target.value); setEnquiryPage(1); }}
                >
                  <option value="all">All statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                </select>
              </div>

              <div className="divide-y divide-slate-100">
                {!isEnquiriesFetching && (enquiries?.rows ?? []).length === 0 && (
                  <div className="py-12 text-center text-sm text-slate-500">No enquiries found.</div>
                )}
                {(enquiries?.rows ?? []).map((enq: any) => (
                  <div key={enq.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{enq.name}</p>
                          <span className={`badge ${enq.status === 'new' ? 'badge-yellow' : enq.status === 'converted' ? 'badge-green' : 'badge-gray'}`}>
                            {enq.status}
                          </span>
                          {enq.businessType && (
                            <span className="badge badge-blue capitalize">{enq.businessType}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{enq.email}{enq.phone ? ` · ${enq.phone}` : ''}</p>
                        {enq.message && (
                          <p className="mt-2 text-sm leading-6 text-slate-500">{enq.message}</p>
                        )}
                        <p className="mt-2 text-xs text-slate-400">{dateTime(enq.createdAt)}</p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 lg:w-64">
                        <textarea
                          rows={2}
                          placeholder="Admin notes…"
                          className="input resize-none text-sm"
                          value={enquiryNotes[enq.id] ?? enq.adminNotes ?? ''}
                          onChange={(e) => setEnquiryNotes((prev) => ({ ...prev, [enq.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <select
                            className="input flex-1 text-sm"
                            defaultValue={enq.status}
                            onChange={(e) =>
                              enquiryMutation.mutate({
                                id: enq.id,
                                status: e.target.value,
                                adminNotes: enquiryNotes[enq.id] ?? enq.adminNotes,
                              })
                            }
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="converted">Converted</option>
                          </select>
                          <button
                            className="btn-secondary"
                            disabled={enquiryMutation.isPending}
                            onClick={() =>
                              enquiryMutation.mutate({
                                id: enq.id,
                                status: enq.status,
                                adminNotes: enquiryNotes[enq.id] ?? enq.adminNotes,
                              })
                            }
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 p-4">
                <button className="btn-secondary" disabled={enquiryPage <= 1} onClick={() => setEnquiryPage((p) => Math.max(1, p - 1))}>
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {enquiries?.meta?.page ?? enquiryPage} of {enquiries?.meta?.totalPages ?? 1}
                </span>
                <button
                  className="btn-secondary"
                  disabled={enquiryPage >= (enquiries?.meta?.totalPages ?? 1)}
                  onClick={() => setEnquiryPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {tab === 'explorer' && (
            <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
              <aside className="card h-fit p-3">
                <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold text-slate-900">
                  <Database className="h-4 w-4" />
                  Tables
                </div>
                <div className="space-y-1">
                  {(tables ?? []).map((option: any) => (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => {
                        setTable(option.name);
                        setTablePage(1);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                        table === option.name ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {option.name.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </aside>

              <section className="card min-w-0 overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="section-label">Data explorer</p>
                    <h2 className="mt-2">{table.replace(/_/g, ' ')}</h2>
                    <p className="mt-1 text-sm text-slate-500">{tableData?.meta?.total ?? 0} rows</p>
                  </div>
                  <div className="relative w-full md:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-9"
                      placeholder="Search this table"
                      value={tableSearch}
                      onChange={(event) => {
                        setTableSearch(event.target.value);
                        setTablePage(1);
                      }}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {(tableData?.columns ?? []).map((column: string) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(tableData?.rows ?? []).map((row: any, index: number) => (
                        <tr key={row.id ?? index}>
                          {tableData.columns.map((column: string) => (
                            <td key={column} className="max-w-[280px] truncate">
                              {typeof row[column] === 'object' && row[column] !== null
                                ? JSON.stringify(row[column])
                                : String(row[column] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {!isTableFetching && tableData?.rows?.length === 0 && (
                        <tr>
                          <td colSpan={tableData?.columns?.length ?? 1} className="py-10 text-center text-slate-500">
                            No rows found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 p-4">
                  <button className="btn-secondary" disabled={tablePage <= 1} onClick={() => setTablePage((current) => Math.max(1, current - 1))}>
                    Previous
                  </button>
                  <span className="text-sm text-slate-500">
                    Page {tableData?.meta?.page ?? tablePage} of {tableData?.meta?.totalPages ?? 1}
                  </span>
                  <button className="btn-secondary" disabled={tablePage >= (tableData?.meta?.totalPages ?? 1)} onClick={() => setTablePage((current) => current + 1)}>
                    Next
                  </button>
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
