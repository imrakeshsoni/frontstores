// [core] [all tenants]
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, Clock, AlertCircle, ArrowRight, RefreshCw, Users } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { APP_REGISTRY } from '@/lib/shop/shopType';
import {
  getLinkedAccounts, upsertLinkedAccount, switchActiveApp, createLinkedAppConfig,
  joinShopWithPin,
  type LinkedAccount,
} from '@/lib/db/linkedAccounts';
import { copyAuth } from '@/lib/db/auth';
import { setStaffPassword } from '@/lib/db/staffUsers';
import { triggerAutoSync } from '@/lib/autoSync';

const SERVER = 'https://update.frontstores.com';

interface SwitchAppModalProps {
  onClose: () => void;
}

export function SwitchAppModal({ onClose }: SwitchAppModalProps) {
  const navigate   = useNavigate();
  const config     = useAppStore(s => s.config);
  const loadConfig = useAppStore(s => s.loadConfig);
  const setAuthenticated = useAppStore(s => s.setAuthenticated);

  const [linked, setLinked]       = useState<LinkedAccount[]>([]);
  const [registering, setRegistering] = useState<string | null>(null);
  const [shopName, setShopName]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError]         = useState('');

  // Join as team member flow
  const [showJoin, setShowJoin]   = useState(false);
  const [joinCode, setJoinCode]   = useState('');
  const [joinPin, setJoinPin]     = useState('');
  const [joining, setJoining]     = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState<{ shopName: string; username: string; tenantId: string; staffId: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    getLinkedAccounts().then(setLinked);
    // Seed current app if not in linked_accounts yet
    if (config) {
      upsertLinkedAccount({
        tenant_id: config.tenant_id,
        shop_type: config.shop_type,
        shop_name: config.shop_name,
        owner_name: config.owner_name ?? '',
        status: 'active',
        expires_at: config.subscription_expires_at ?? null,
        registered_at: config.trial_started_at ?? null,
      }).then(() => getLinkedAccounts().then(setLinked));
    }
  }, []);

  // Sync latest status from server for all linked accounts
  const syncFromServer = async () => {
    if (!config?.tenant_id) return;
    setSyncing(true);
    try {
      const res = await fetch(`${SERVER}/linked-apps?tenant_id=${config.tenant_id}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json() as { apps: Array<{ tenant_id: string; shop_type: string; shop_name: string; account_status: string; expires_at: string }> };
        for (const app of data.apps) {
          await upsertLinkedAccount({
            tenant_id: app.tenant_id,
            shop_type: app.shop_type,
            shop_name: app.shop_name,
            owner_name: config.owner_name ?? '',
            status: app.account_status === 'active' ? 'active' : app.account_status === 'pending' ? 'pending' : 'rejected',
            expires_at: app.expires_at ?? null,
          });
        }
        const fresh = await getLinkedAccounts();
        setLinked(fresh);
      }
    } catch { /* offline — ignore */ }
    setSyncing(false);
  };

  // Register for a new app type
  const handleRegister = async () => {
    if (!shopName.trim() || !registering || !config) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${SERVER}/register-app-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existing_tenant_id: config.tenant_id,
          shop_type: registering,
          shop_name: shopName.trim(),
          owner_name: config.owner_name ?? '',
          phone: config.phone ?? '',
          email: config.email ?? '',
          city: config.city ?? '',
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json() as { ok: boolean; new_tenant_id?: string; error?: string };
      if (!data.ok) { setError(data.error ?? 'Registration failed. Try again.'); setSubmitting(false); return; }

      // Store locally as pending
      await upsertLinkedAccount({
        tenant_id: data.new_tenant_id!,
        shop_type: registering,
        shop_name: shopName.trim(),
        owner_name: config.owner_name ?? '',
        status: 'pending',
      });
      setLinked(await getLinkedAccounts());
      setRegistering(null);
      setShopName('');
    } catch (e: unknown) {
      setError(e instanceof Error && e.message.includes('timed out') ? 'No internet connection. Try again when online.' : 'Server error. Please try again.');
    }
    setSubmitting(false);
  };

  // Switch to an already-active app
  const handleSwitch = async (account: LinkedAccount) => {
    if (account.tenant_id === config?.tenant_id) { onClose(); return; }
    setSwitchingTo(account.shop_type);
    try {
      // If this app's config row doesn't exist locally yet (first switch after approval), create it
      const existingRows = await (async () => {
        const { getDb } = await import('@/lib/db/index');
        const db = await getDb();
        return db.select<{ id: string }[]>(`SELECT id FROM app_config WHERE tenant_id=? LIMIT 1`, [account.tenant_id]);
      })();
      if (existingRows.length === 0) {
        await createLinkedAppConfig({
          tenant_id: account.tenant_id,
          shop_type: account.shop_type,
          shop_name: account.shop_name,
          owner_name: config?.owner_name ?? account.owner_name,
          phone: config?.phone ?? null,
          email: config?.email ?? null,
          city: config?.city ?? null,
        });
        // Copy current app's credentials to the new app so owner uses the same password
        if (config?.tenant_id) await copyAuth(config.tenant_id, account.tenant_id);
      } else {
        await switchActiveApp(account.tenant_id);
      }
      await loadConfig();
      setAuthenticated(false); // Re-authenticate for the new app
      onClose();
      navigate('/');
    } catch {
      setSwitchingTo(null);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    const pin  = joinPin.replace(/-/g, '').trim();
    if (!code || pin.length < 6) { setJoinError('Enter a valid shop code and PIN'); return; }
    setJoining(true); setJoinError('');
    const result = await joinShopWithPin(code, pin);
    if (!result.ok) { setJoinError(result.error); setJoining(false); return; }
    await loadConfig();
    setJoinSuccess({ shopName: result.shopName, username: result.username, tenantId: result.tenantId, staffId: result.staffId });
    setJoining(false);
  };

  const handleSwitchAfterJoin = () => {
    setAuthenticated(false);
    onClose();
    navigate('/');
  };

  const handleSetJoinPassword = async () => {
    if (!joinSuccess) return;
    if (newPassword.length < 4) { setPasswordError('Password must be at least 4 characters'); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError('Passwords do not match'); return; }
    setSettingPassword(true); setPasswordError('');
    try {
      const result = await setStaffPassword(joinSuccess.tenantId, joinSuccess.staffId, newPassword);
      if (!result.ok) { setPasswordError(result.error ?? 'Could not set password'); return; }
      triggerAutoSync(true);
      setPasswordSet(true);
    } finally {
      setSettingPassword(false);
    }
  };

  const linkedMap = new Map(linked.map(a => [a.shop_type, a]));
  const currentType = config?.shop_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ width: '90%', background: 'var(--bg)', border: '1px solid var(--surface-border)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--surface-border)' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Switch App</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              All apps share your owner profile · Each app has its own data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={syncFromServer} disabled={syncing} title="Sync from server"
              className="h-9 w-9 rounded-xl flex items-center justify-center border transition-colors"
              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* App grid */}
        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {APP_REGISTRY.map(app => {
              const acc = linkedMap.get(app.type);
              const isCurrent = app.type === currentType;
              const isActive = acc?.status === 'active';
              const isPending = acc?.status === 'pending';
              const isRegistered = !!acc;

              return (
                <div key={app.type}
                  className="rounded-2xl p-4 flex items-start gap-4 transition-all"
                  style={{
                    background: isCurrent ? `${app.bgColor}` : 'var(--surface)',
                    border: `2px solid ${isCurrent ? app.color + '60' : 'var(--surface-border)'}`,
                  }}>
                  {/* Icon */}
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: app.bgColor }}>
                    {app.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{app.label}</p>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: app.color, color: '#fff' }}>Current</span>
                      )}
                      {isPending && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: '#fef3c7', color: '#d97706' }}>
                          <Clock className="h-3 w-3" /> Pending approval
                        </span>
                      )}
                      {isActive && !isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: '#dcfce7', color: '#16a34a' }}>
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{app.description}</p>
                    {acc?.expires_at && !isCurrent && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Expires: {new Date(acc.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="mt-3">
                      {isCurrent ? (
                        <span className="text-xs font-medium" style={{ color: app.color }}>✓ You are here</span>
                      ) : isActive ? (
                        <button
                          onClick={() => handleSwitch(acc!)}
                          disabled={switchingTo === app.type}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-60 transition-all"
                          style={{ background: app.color }}>
                          {switchingTo === app.type ? 'Switching…' : <><ArrowRight className="h-3 w-3" /> Switch to {app.label}</>}
                        </button>
                      ) : isPending ? (
                        <div className="flex items-start gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#d97706' }} />
                          <p className="text-xs" style={{ color: '#d97706' }}>
                            Request sent — waiting for admin approval. Check back in a few hours.
                          </p>
                        </div>
                      ) : registering === app.type ? (
                        <div className="space-y-2">
                          <input
                            value={shopName}
                            onChange={e => setShopName(e.target.value)}
                            placeholder={`${app.label} name…`}
                            className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                            autoFocus
                          />
                          {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
                          <div className="flex gap-2">
                            <button onClick={handleRegister} disabled={!shopName.trim() || submitting}
                              className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                              style={{ background: app.color }}>
                              {submitting ? 'Sending…' : 'Request Access'}
                            </button>
                            <button onClick={() => { setRegistering(null); setShopName(''); setError(''); }}
                              className="px-3 py-1.5 rounded-xl text-xs border"
                              style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRegistering(app.type); setShopName(''); setError(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                          style={{ borderColor: app.color + '60', color: app.color, background: app.bgColor + '40' }}>
                          + Register for {app.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-tertiary)' }}>
            Each app requires admin approval before activation · Your data is separate per app
          </p>

          {/* ── Join as team member ── */}
          <div className="mt-5 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--surface-border)' }}>
            <button
              onClick={() => { setShowJoin(v => !v); setJoinError(''); setJoinSuccess(null); }}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
              style={{ background: 'var(--surface)' }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
                  <Users className="h-4 w-4" style={{ color: '#6d28d9' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Join as team member</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Your manager shares a Shop Code + one-time PIN</p>
                </div>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '18px' }}>{showJoin ? '−' : '+'}</span>
            </button>

            {showJoin && (
              <div className="px-5 pb-5 pt-1" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--surface-border)' }}>
                {joinSuccess ? (
                  <div className="text-center py-4 space-y-3">
                    <div className="text-4xl">🎉</div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      Joined <span style={{ color: '#6d28d9' }}>{joinSuccess.shopName}</span>!
                    </p>
                    {passwordSet ? (
                      <>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Log in with username <strong>{joinSuccess.username}</strong> and the password you just set.
                        </p>
                        <button
                          onClick={handleSwitchAfterJoin}
                          className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                          style={{ background: '#6d28d9' }}>
                          Go to Login →
                        </button>
                      </>
                    ) : (
                      <div className="text-left space-y-3">
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Set a password for username <strong>{joinSuccess.username}</strong> to finish:
                        </p>
                        <div>
                          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>New Password</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
                            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Confirm Password</label>
                          <input
                            type="password"
                            value={confirmNewPassword}
                            onChange={e => setConfirmNewPassword(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
                            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                          />
                        </div>
                        {passwordError && <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>⚠ {passwordError}</p>}
                        <button
                          onClick={handleSetJoinPassword}
                          disabled={settingPassword || !newPassword || !confirmNewPassword}
                          className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                          style={{ background: '#6d28d9' }}>
                          {settingPassword ? 'Saving…' : 'Set Password'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-3">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Shop Code</label>
                      <input
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="e.g. FS-ABC123"
                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none font-mono tracking-wider"
                        style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>One-time PIN</label>
                      <input
                        value={joinPin}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9]/g, '');
                          setJoinPin(v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4, 8) : v);
                        }}
                        placeholder="1234-5678"
                        maxLength={9}
                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none font-mono tracking-widest"
                        style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                        autoComplete="off"
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>PIN expires in 48 hours · Works only once · Requires Cloud Sync on owner's app</p>
                    </div>
                    {joinError && <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>⚠ {joinError}</p>}
                    <button
                      onClick={handleJoin}
                      disabled={joining || !joinCode.trim() || joinPin.replace(/-/g, '').length < 6}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: '#6d28d9' }}>
                      {joining ? 'Verifying…' : 'Join Shop'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
