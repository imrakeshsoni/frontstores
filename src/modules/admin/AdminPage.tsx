// [admin] [all tenants] — Native admin panel, talks to the cloud Worker (update.frontstores.com)
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Bug, Mail, BarChart3, RefreshCw, LogOut, ChevronLeft, CheckCircle, Snowflake, Ban, Eye, EyeOff } from 'lucide-react';
import {
  ADMIN_API,
  getAdminPassword, saveAdminPassword, clearAdminPassword,
  adminGet, adminPost, subStatus, daysLeft,
  type Tenant, type ErrorReport, type Contact,
} from './adminApi';

// ── Password gate ──────────────────────────────────────────────────────────────

function PasswordGate({ children }: { children: React.ReactNode }) {
  const [pwd, setPwd] = useState(getAdminPassword());
  const [input, setInput] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setTesting(true); setError('');
    try {
      const res = await fetch(`${ADMIN_API}/admin/api/customers`, {
        headers: { 'Authorization': `Basic ${btoa(':' + input)}` },
      });
      if (res.status === 401) { setError('Wrong password'); return; }
      if (!res.ok) { setError('Server error'); return; }
      saveAdminPassword(input); setPwd(input);
    } catch {
      setError('Cannot connect to update.frontstores.com. Check your internet connection.');
    } finally { setTesting(false); }
  }

  if (!pwd) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-xl p-8 w-full max-w-sm">
        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-5"><span className="text-2xl">🛡️</span></div>
        <h1 className="text-white text-xl font-bold mb-1">Admin Panel</h1>
        <p className="text-slate-400 text-sm mb-6">Enter your ADMIN_PASSWORD to connect to update.frontstores.com</p>
        <div className="relative mb-3">
          <input type={showPwd ? 'text' : 'password'} value={input} onChange={e => setInput(e.target.value)}
            placeholder="Admin password" autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-amber-500 pr-10" />
          <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-200">
            {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <button type="submit" disabled={testing || !input}
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-40">
          {testing ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  );
  return <>{children}</>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:   'bg-green-900/50 text-green-300 border-green-700',
    trial:    'bg-amber-900/50 text-amber-300 border-amber-700',
    expiring: 'bg-orange-900/50 text-orange-300 border-orange-700',
    expired:  'bg-red-900/50 text-red-300 border-red-700',
    frozen:   'bg-cyan-900/50 text-cyan-300 border-cyan-700',
    revoked:  'bg-slate-700/50 text-slate-400 border-slate-600',
    pending:  'bg-violet-900/50 text-violet-300 border-violet-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${map[status] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>{status}</span>;
}

// ── Tenant detail ─────────────────────────────────────────────────────────────

function TenantDetail({ tenant, onBack, onAction }: { tenant: Tenant; onBack: () => void; onAction: (id: string, action: string, body?: object) => void }) {
  const status = subStatus(tenant);
  const dl = daysLeft(tenant.expires_at);
  const [extending, setExtending] = useState(false);
  const [months, setMonths] = useState(1);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 border-b border-slate-800">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4">
          <ChevronLeft size={16}/> Back
        </button>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏪</div>
          <div>
            <h2 className="text-white text-lg font-bold">{tenant.shop_name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={status}/>
              <span className="text-slate-500 text-xs">{tenant.shop_type}</span>
              {tenant.city && <span className="text-slate-500 text-xs">📍 {tenant.city}</span>}
              {tenant.is_client && <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700 px-2 py-0.5 rounded">Client</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="p-5 grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Subscription</div>
          <div className={`text-3xl font-black mb-1 ${dl < 0 ? 'text-red-400' : dl <= 14 ? 'text-orange-400' : 'text-white'}`}>
            {dl < 0 ? 'Expired' : `${dl}d`}
          </div>
          <div className="text-slate-400 text-xs mb-4">
            {dl >= 0 ? 'remaining' : `${Math.abs(dl)} days ago`}<br/>
            Expires {new Date(tenant.expires_at).toLocaleDateString('en-IN')}
          </div>
          {status !== 'revoked' && (extending ? (
            <div className="space-y-2">
              <div className="flex gap-1">
                {[1,3,6,12].map(m => (
                  <button key={m} onClick={() => setMonths(m)}
                    className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${months===m ? 'bg-amber-500 text-slate-900 border-amber-500' : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-amber-500'}`}>
                    +{m}m
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onAction(tenant.tenant_id, 'extend', { months }); setExtending(false); }}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white py-1.5 rounded text-xs font-bold transition-colors">
                  Confirm +{months}m
                </button>
                <button onClick={() => setExtending(false)} className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs">✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setExtending(true)}
              className="w-full bg-slate-700 hover:bg-amber-500 hover:text-slate-900 text-white py-2 rounded-lg text-xs font-bold transition-colors border border-slate-600">
              Extend Subscription
            </button>
          ))}
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Actions</div>
          <div className="space-y-2">
            {status === 'pending' && (
              <button onClick={() => onAction(tenant.tenant_id, 'approve', { months: 1 })}
                className="w-full flex items-center gap-2 bg-green-800 hover:bg-green-700 text-green-200 py-2 px-3 rounded-lg text-xs font-semibold transition-colors">
                <CheckCircle size={13}/> Approve (1 month trial)
              </button>
            )}
            {status !== 'frozen' && status !== 'revoked' && (
              <button onClick={() => onAction(tenant.tenant_id, 'freeze')}
                className="w-full flex items-center gap-2 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 py-2 px-3 rounded-lg text-xs font-semibold transition-colors border border-cyan-800">
                <Snowflake size={13}/> Freeze
              </button>
            )}
            {status === 'frozen' && (
              <button onClick={() => onAction(tenant.tenant_id, 'unfreeze')}
                className="w-full flex items-center gap-2 bg-green-900/50 hover:bg-green-800 text-green-300 py-2 px-3 rounded-lg text-xs font-semibold transition-colors border border-green-800">
                <CheckCircle size={13}/> Unfreeze
              </button>
            )}
            {status !== 'revoked' && (
              <button onClick={() => { if (confirm(`Revoke ${tenant.shop_name}?`)) onAction(tenant.tenant_id, 'revoke'); }}
                className="w-full flex items-center gap-2 bg-red-900/50 hover:bg-red-800 text-red-300 py-2 px-3 rounded-lg text-xs font-semibold transition-colors border border-red-800">
                <Ban size={13}/> Revoke
              </button>
            )}
            <button onClick={() => onAction(tenant.tenant_id, 'tag', { is_client: !tenant.is_client })}
              className="w-full flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-3 rounded-lg text-xs font-semibold transition-colors">
              {tenant.is_client ? '← Mark as Tester' : '✓ Mark as Client'}
            </button>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Contact</div>
          <div className="space-y-2 text-sm">
            {tenant.owner_name && <div><div className="text-slate-500 text-xs">Owner</div><div className="text-white">{tenant.owner_name}</div></div>}
            {tenant.phone      && <div><div className="text-slate-500 text-xs">Phone</div><div className="text-white font-mono">{tenant.phone}</div></div>}
            {tenant.email      && <div><div className="text-slate-500 text-xs">Email</div><div className="text-white truncate">{tenant.email}</div></div>}
            <div><div className="text-slate-500 text-xs">Tenant ID</div><div className="text-slate-400 font-mono text-xs truncate">{tenant.tenant_id}</div></div>
            {tenant.sync_code  && <div><div className="text-slate-500 text-xs">Sync Code</div><div className="text-amber-400 font-mono">{tenant.sync_code}</div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Customers tab ─────────────────────────────────────────────────────────────

function AdminCustomersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Tenant | null>(null);

  const { data: customers = [], isLoading, error, refetch } = useQuery<Tenant[]>({
    queryKey: ['admin-customers'],
    queryFn: () => adminGet('/admin/api/customers'),
    staleTime: 0, retry: false,
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: object }) =>
      adminPost(`/admin/api/customers/${id}/${action}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-customers'] }),
  });

  const handleAction = (id: string, action: string, body?: object) => actionMut.mutate({ id, action, body });
  const freshSelected = customers.find(c => c.tenant_id === selected?.tenant_id);

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading customers…</div>;
  if (error)    return <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400"><p className="text-red-400">Cannot connect to admin server</p><button onClick={() => refetch()} className="px-4 py-2 bg-slate-700 rounded-lg text-sm">Retry</button></div>;
  if (freshSelected) return <TenantDetail tenant={freshSelected} onBack={() => setSelected(null)} onAction={handleAction}/>;

  const counts: Record<string, number> = { all: customers.length, pending: 0, active: 0, trial: 0, expiring: 0, expired: 0, frozen: 0 };
  customers.forEach(c => { const s = subStatus(c); if (s in counts) counts[s]++; });

  const filtered = customers.filter(c => {
    if (filter !== 'all' && subStatus(c) !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.shop_name?.toLowerCase().includes(q) || c.owner_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.city?.toLowerCase().includes(q);
  });

  const colClass: Record<string, string> = { expired:'text-red-400', expiring:'text-orange-400', trial:'text-amber-400', pending:'text-violet-400', frozen:'text-cyan-400' };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex gap-2 p-4 border-b border-slate-800 flex-wrap">
        {Object.entries(counts).map(([k, n]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`flex flex-col items-center px-3 py-2 rounded-xl border transition-colors text-xs ${filter===k ? 'bg-slate-700 border-slate-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
            <span className={`text-lg font-black ${colClass[k] ?? 'text-white'}`}>{n}</span>
            <span className="text-slate-400 capitalize">{k}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 px-4 py-2 border-b border-slate-800">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shops, owners, phone…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500"/>
        <button onClick={() => refetch()} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><RefreshCw size={15}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
              <th className="text-left py-3 px-4 font-semibold">Shop</th>
              <th className="text-left py-3 px-4 font-semibold">Type</th>
              <th className="text-left py-3 px-4 font-semibold">Status</th>
              <th className="text-left py-3 px-4 font-semibold">Expires</th>
              <th className="text-left py-3 px-4 font-semibold">Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const st = subStatus(c); const dl = daysLeft(c.expires_at);
              return (
                <tr key={c.tenant_id} onClick={() => setSelected(c)}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors ${st==='frozen'?'opacity-60':st==='revoked'?'opacity-30':''}`}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{c.shop_name}</div>
                    {c.owner_name && <div className="text-slate-500 text-xs">{c.owner_name}</div>}
                    {c.phone      && <div className="text-slate-500 text-xs font-mono">{c.phone}</div>}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{c.shop_type}</td>
                  <td className="py-3 px-4"><StatusBadge status={st}/></td>
                  <td className="py-3 px-4">
                    <div className={`font-semibold ${dl<0?'text-red-400':dl<=14?'text-orange-400':'text-slate-300'}`}>{dl<0?`${Math.abs(dl)}d ago`:`${dl}d`}</div>
                    <div className="text-slate-500 text-xs">{new Date(c.expires_at).toLocaleDateString('en-IN')}</div>
                  </td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 flex-wrap">
                      {st !== 'revoked' && <button onClick={() => handleAction(c.tenant_id, 'extend')} className="px-2 py-1 bg-green-900/50 hover:bg-green-800 text-green-300 rounded text-xs border border-green-800">+30d</button>}
                      {st !== 'frozen' && st !== 'revoked' && <button onClick={() => handleAction(c.tenant_id, 'freeze')} className="px-2 py-1 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 rounded text-xs border border-cyan-800">Freeze</button>}
                      {st === 'frozen' && <button onClick={() => handleAction(c.tenant_id, 'unfreeze')} className="px-2 py-1 bg-green-900/50 hover:bg-green-800 text-green-300 rounded text-xs border border-green-800">Unfreeze</button>}
                      {st === 'pending' && <button onClick={() => handleAction(c.tenant_id, 'approve', { months: 1 })} className="px-2 py-1 bg-violet-900/50 hover:bg-violet-800 text-violet-300 rounded text-xs border border-violet-800">Approve</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-16 text-slate-500 text-sm">No customers found</div>}
      </div>
    </div>
  );
}

// ── Errors tab ────────────────────────────────────────────────────────────────

function AdminErrorsTab() {
  const { data: errors = [], isLoading, refetch } = useQuery<ErrorReport[]>({
    queryKey: ['admin-errors'], queryFn: () => adminGet('/admin/api/errors'), staleTime: 0, retry: false,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="text-slate-400 text-sm">{errors.filter(e => !e.resolved).length} unresolved / {errors.length} total</div>
        <button onClick={() => refetch()} className="p-2 text-slate-400 hover:text-white"><RefreshCw size={14}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>}
        {!isLoading && errors.length === 0 && <div className="text-center py-16 text-slate-500 text-sm">No errors 🎉</div>}
        {errors.map(e => (
          <div key={e.id} className={`border-b border-slate-800 px-4 py-3 ${e.resolved ? 'opacity-40' : ''}`}>
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${e.resolved ? 'bg-slate-600' : 'bg-red-500'}`}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {e.shop_name  && <span className="text-amber-400 text-xs font-semibold">{e.shop_name}</span>}
                  {e.app_version && <span className="text-slate-500 text-xs">v{e.app_version}</span>}
                  <span className="text-slate-500 text-xs ml-auto">{new Date(e.at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                </div>
                <div className="text-red-300 text-sm font-mono truncate">{e.error}</div>
                {e.context && <div className="text-slate-500 text-xs mt-1">{e.context}</div>}
                {e.stack && (
                  <>
                    <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="text-xs text-slate-500 hover:text-slate-300 mt-1">
                      {expanded === e.id ? '▲ hide stack' : '▼ show stack'}
                    </button>
                    {expanded === e.id && <pre className="mt-2 text-xs text-slate-400 bg-slate-800 rounded p-3 overflow-x-auto max-h-40">{e.stack}</pre>}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Contacts tab ──────────────────────────────────────────────────────────────

function AdminContactsTab() {
  const { data: contacts = [], isLoading, refetch } = useQuery<Contact[]>({
    queryKey: ['admin-contacts'], queryFn: () => adminGet('/admin/api/contacts'), staleTime: 0, retry: false,
  });

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="text-slate-400 text-sm">{contacts.filter(c => !c.resolved).length} new leads / {contacts.length} total</div>
        <button onClick={() => refetch()} className="p-2 text-slate-400 hover:text-white"><RefreshCw size={14}/></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>}
        {!isLoading && contacts.length === 0 && <div className="text-center py-16 text-slate-500 text-sm">No contacts yet</div>}
        {contacts.map(c => (
          <div key={c.id} className={`border-b border-slate-800 px-4 py-4 ${c.resolved ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${c.resolved ? 'bg-slate-600' : 'bg-green-500'}`}/>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-sm">{c.name}</span>
                  {c.shop_type && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{c.shop_type}</span>}
                  <span className="text-slate-500 text-xs ml-auto">{new Date(c.at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                </div>
                {c.phone   && <div className="text-amber-400 text-sm font-mono">{c.phone}</div>}
                {c.email   && <div className="text-slate-400 text-xs">{c.email}</div>}
                {c.message && <div className="text-slate-300 text-sm mt-2 italic">"{c.message}"</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AdminAnalyticsTab() {
  const { data: customers = [], isLoading, refetch } = useQuery<Tenant[]>({
    queryKey: ['admin-customers'], queryFn: () => adminGet('/admin/api/customers'), staleTime: 0, retry: false,
  });

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;

  const active  = customers.filter(c => ['active','trial','expiring'].includes(subStatus(c))).length;
  const clients = customers.filter(c => c.is_client).length;
  const syncOn  = customers.filter(c => c.sync_enabled).length;
  const byType  = Object.entries(
    customers.reduce<Record<string,number>>((acc, c) => { acc[c.shop_type] = (acc[c.shop_type] ?? 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-lg font-bold">Analytics</h2>
        <button onClick={() => refetch()} className="p-2 text-slate-400 hover:text-white"><RefreshCw size={14}/></button>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {([['Total Tenants',customers.length,'#3b82f6'],['Active/Trial',active,'#16a34a'],['Paying Clients',clients,'#d97706'],['Cloud Sync',syncOn,'#8b5cf6']] as [string,number,string][]).map(([l,v,c]) => (
          <div key={l} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{l}</div>
            <div className="text-3xl font-black" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">By App Type</div>
        <div className="space-y-2">
          {byType.map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <div className="text-slate-300 text-sm w-36 capitalize">{type}</div>
              <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="h-2 bg-amber-500 rounded-full" style={{ width: `${(count/customers.length)*100}%` }}/>
              </div>
              <div className="text-amber-400 font-bold text-sm w-5 text-right">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main admin page ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'contacts',  label: 'Contacts',  icon: Mail },
  { id: 'errors',    label: 'Errors',    icon: Bug },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;
type TabId = typeof TABS[number]['id'];

export function AdminPage() {
  const [tab, setTab] = useState<TabId>('customers');

  return (
    <PasswordGate>
      <div className="flex flex-col h-full bg-slate-950">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">🛡️</span>
            <span className="text-white font-bold">FrontStores Admin</span>
            <span className="text-slate-500 text-xs">update.frontstores.com</span>
          </div>
          <div className="flex items-center gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab===t.id ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                  <Icon size={14}/>{t.label}
                </button>
              );
            })}
            <button onClick={() => { clearAdminPassword(); window.location.reload(); }}
              className="ml-2 p-1.5 text-slate-500 hover:text-red-400 transition-colors" title="Sign out">
              <LogOut size={14}/>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'customers' && <AdminCustomersTab/>}
          {tab === 'contacts'  && <AdminContactsTab/>}
          {tab === 'errors'    && <AdminErrorsTab/>}
          {tab === 'analytics' && <AdminAnalyticsTab/>}
        </div>
      </div>
    </PasswordGate>
  );
}
