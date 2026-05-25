// [core] [all tenants] — Native admin panel calling local server at localhost:3002
import { useState, useEffect, useCallback } from 'react';
import { Users, AlertCircle, CheckCircle, XCircle, RefreshCw, Lock, Unlock, Ban, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_PORT = 3002;

type Tenant = {
  tenant_id: string;
  shop_name: string;
  owner_name: string;
  shop_type: string;
  phone: string;
  email: string;
  city: string;
  account_status: string;
  expires_at: string | null;
  registered_at: string;
};

type AppError = {
  id: string;
  tenant_id: string;
  shop_name: string;
  message: string;
  context: string;
  app_version: string;
  received_at: string;
  resolved: boolean;
};

function makeAuth(password: string) {
  return 'Basic ' + btoa(`:${password}`);
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:  'bg-emerald-100 text-emerald-700',
    pending: 'bg-yellow-100 text-yellow-700',
    frozen:  'bg-blue-100 text-blue-700',
    revoked: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'customers' | 'errors'>('customers');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const api = useCallback(async (path: string, method = 'GET', body?: object) => {
    const csrfToken = (window as any).__CSRF_TOKEN__ ?? '';
    const res = await fetch(`http://localhost:${ADMIN_PORT}${path}`, {
      method,
      headers: {
        'Authorization': makeAuth(password),
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) throw new Error('Wrong password');
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }, [password]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'customers') {
        const data = await api('/admin/api/customers');
        setTenants(data);
      } else {
        const data = await api('/admin/api/errors');
        setErrors(data);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, tab]);

  const login = async () => {
    try {
      await api('/admin/api/customers');
      setAuthed(true);
    } catch (e: any) {
      toast.error(e.message === 'Wrong password' ? 'Wrong password' : 'Server not reachable. Make sure the update server is running.');
    }
  };

  useEffect(() => {
    if (authed) loadData();
  }, [authed, tab, loadData]);

  const action = async (tenantId: string, act: string) => {
    try {
      await api(`/admin/api/customers/${tenantId}/${act}`, 'POST');
      toast.success(`${act} done`);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resolveError = async (id: string) => {
    try {
      await api(`/admin/api/errors/${id}/resolve`, 'POST');
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = tenants.filter(t =>
    !search || t.shop_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.city?.toLowerCase().includes(search.toLowerCase())
  );

  const pending = tenants.filter(t => t.account_status === 'pending').length;
  const unresolvedErrors = errors.filter(e => !e.resolved).length;

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="card p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">FrontStores Admin</p>
              <p className="text-xs text-slate-500">Enter admin password</p>
            </div>
          </div>
          <input
            type="password"
            className="input w-full mb-3"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            autoFocus
          />
          <button className="btn-primary w-full" onClick={login}>
            Unlock Admin Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell page-stack">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">Admin Panel</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">FrontStores Control Center</h1>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('customers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'customers' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
        >
          <Users className="h-4 w-4" />
          Customers
          {pending > 0 && <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">{pending}</span>}
        </button>
        <button
          onClick={() => setTab('errors')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'errors' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
        >
          <AlertCircle className="h-4 w-4" />
          Errors
          {unresolvedErrors > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unresolvedErrors}</span>}
        </button>
      </div>

      {/* Customers tab */}
      {tab === 'customers' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900">{tenants.length} registered shops</p>
            <input
              className="input w-64 text-sm"
              placeholder="Search shop, owner, city…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading && <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">No customers found.</div>
          )}

          <div className="divide-y divide-slate-100">
            {filtered.map(t => (
              <div key={t.tenant_id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{t.shop_name}</p>
                      <StatusBadge status={t.account_status} />
                      <span className="text-xs text-slate-400 capitalize">{t.shop_type}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{t.owner_name} {t.city ? `· ${t.city}` : ''} {t.phone ? `· ${t.phone}` : ''}</p>
                    <div className="flex gap-4 mt-1 text-xs text-slate-400">
                      <span>Registered: {fmtDate(t.registered_at)}</span>
                      {t.expires_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Expires: {fmtDate(t.expires_at)}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {t.account_status === 'pending' && (
                      <button onClick={() => action(t.tenant_id, 'approve')} className="btn-primary text-xs px-3 py-1.5">
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    <button onClick={() => action(t.tenant_id, 'extend')} className="btn-secondary text-xs px-3 py-1.5">
                      +30 days
                    </button>
                    {t.account_status === 'frozen' ? (
                      <button onClick={() => action(t.tenant_id, 'unfreeze')} className="btn-secondary text-xs px-3 py-1.5">
                        <Unlock className="h-3.5 w-3.5" /> Unfreeze
                      </button>
                    ) : (
                      <button onClick={() => action(t.tenant_id, 'freeze')} className="btn-secondary text-xs px-3 py-1.5">
                        <Lock className="h-3.5 w-3.5" /> Freeze
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`Revoke ${t.shop_name}?`)) action(t.tenant_id, 'revoke'); }} className="btn-secondary text-xs px-3 py-1.5 text-red-600 hover:bg-red-50">
                      <Ban className="h-3.5 w-3.5" /> Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors tab */}
      {tab === 'errors' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900">{unresolvedErrors} unresolved errors</p>
          </div>

          {loading && <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>}
          {!loading && errors.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No errors reported.</div>}

          <div className="divide-y divide-slate-100">
            {errors.map(e => (
              <div key={e.id} className={`p-4 ${e.resolved ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{e.shop_name}</p>
                      {e.resolved
                        ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Resolved</span>
                        : <span className="text-xs text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" />Unresolved</span>
                      }
                      {e.app_version && <span className="text-xs text-slate-400">v{e.app_version}</span>}
                    </div>
                    <p className="text-sm text-red-700 mt-1 font-medium">{e.message}</p>
                    {e.context && <p className="text-xs text-slate-400 mt-0.5">Context: {e.context}</p>}
                    <p className="text-xs text-slate-400 mt-1">{fmtDate(e.received_at)}</p>
                  </div>
                  {!e.resolved && (
                    <button onClick={() => resolveError(e.id)} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">
                      <CheckCircle className="h-3.5 w-3.5" /> Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
