import { useEffect, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { getDb, now } from '@/lib/db/index';

const WHATSAPP = '919999999999';
const EMAIL = 'support@frontstores.com';
const SERVER = 'https://update.frontstores.com';
const OFFLINE_GRACE_DAYS = 7; // days after expiry before locking when offline

type Status = 'loading' | 'active' | 'warning' | 'locked';

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const config = useAppStore((s) => s.config);
  const loadConfig = useAppStore((s) => s.loadConfig);
  const [status, setStatus] = useState<Status>('loading');
  const [graceDaysLeft, setGraceDaysLeft] = useState(0);
  const [checking, setChecking] = useState(false);
  const [lockReason, setLockReason] = useState<'expired' | 'frozen' | 'revoked'>('expired');

  useEffect(() => {
    if (!config) return;
    checkSubscription();
  }, [config]);

  // Re-check whenever internet comes back
  useEffect(() => {
    const handler = () => checkSubscription();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [config]);

  async function checkSubscription() {
    if (!config) return;

    const expires = config.subscription_expires_at
      ? new Date(config.subscription_expires_at)
      : null;

    // No expiry set = unlimited (dev/admin installs)
    if (!expires) { setStatus('active'); return; }

    const daysUntilExpiry = Math.ceil((expires.getTime() - Date.now()) / 864e5);

    // Still active locally — try a background server check to catch freeze/revoke
    if (daysUntilExpiry > 0) {
      setStatus('active');
      tryServerCheck(); // silent background check, won't block the app
      return;
    }

    // Subscription expired locally — must verify with server
    const serverResult = await tryServerCheck();

    if (serverResult === 'extended') return; // already reloaded config
    if (serverResult === 'frozen') { setLockReason('frozen'); setStatus('locked'); return; }
    if (serverResult === 'revoked') { setLockReason('revoked'); setStatus('locked'); return; }

    if (serverResult === 'confirmed_expired') {
      setLockReason('expired'); setStatus('locked'); return;
    }

    // Server unreachable (offline or Mac is off) — apply grace period
    // Grace = 7 days from the expiry date
    const daysSinceExpiry = Math.ceil((Date.now() - expires.getTime()) / 864e5);
    const graceLeft = OFFLINE_GRACE_DAYS - daysSinceExpiry;

    if (graceLeft > 0) {
      // Still within grace — app works, show warning banner
      setGraceDaysLeft(graceLeft);
      setStatus('warning');
    } else {
      // Grace exhausted — lock
      setLockReason('expired');
      setStatus('locked');
    }
  }

  async function tryServerCheck(): Promise<'extended' | 'confirmed_expired' | 'frozen' | 'revoked' | 'unreachable'> {
    if (!config) return 'unreachable';
    try {
      const res = await fetch(`${SERVER}/license/${config.tenant_id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return 'unreachable';

      const data = await res.json();

      if (data.reason === 'frozen') return 'frozen';
      if (data.reason === 'revoked') return 'revoked';

      if (data.active && data.expires_at) {
        // Server has a valid (possibly extended) expiry — update local DB
        const db = await getDb();
        await db.execute(
          `UPDATE app_config SET subscription_expires_at = ?, subscription_status = 'active', last_verified_at = ?, updated_at = ? WHERE tenant_id = ?`,
          [data.expires_at, now(), now(), config.tenant_id]
        );
        await loadConfig();
        setStatus('active');
        return 'extended';
      }

      // Server confirmed: expired
      return 'confirmed_expired';
    } catch {
      return 'unreachable';
    }
  }

  async function handleRecheck() {
    setChecking(true);
    await checkSubscription();
    setChecking(false);
  }

  if (status === 'loading' || status === 'active') return <>{children}</>;

  // Warning banner — app still works, just a dismissible notice at top
  if (status === 'warning') {
    return (
      <>
        <div className="bg-amber-900 border-b border-amber-700 px-4 py-2 flex items-center justify-between gap-4">
          <p className="text-amber-200 text-sm">
            ⚠️ Subscription expired — unable to reach server.
            App will lock in <strong>{graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''}</strong> if not verified.
            Connect to internet to auto-verify.
          </p>
          <button
            onClick={handleRecheck}
            disabled={checking}
            className="text-amber-300 text-xs font-semibold border border-amber-600 px-3 py-1 rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 shrink-0"
          >
            {checking ? 'Checking…' : 'Check now'}
          </button>
        </div>
        {children}
      </>
    );
  }

  // Locked screen
  const isOfflineExpired = lockReason === 'expired';
  const isFrozen = lockReason === 'frozen';
  const isRevoked = lockReason === 'revoked';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">{isFrozen ? '🧊' : isRevoked ? '🚫' : '🔒'}</div>
          <h1 className="text-2xl font-bold text-white">
            {isFrozen ? 'Account Frozen' : isRevoked ? 'Access Revoked' : 'Subscription Ended'}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isFrozen
              ? 'Your account has been temporarily frozen. Contact support to resolve.'
              : isRevoked
              ? 'Your access has been revoked. Contact support for more information.'
              : 'Your subscription has expired. Contact us to continue using FrontStores.'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          {isOfflineExpired && (
            <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-4 mb-6">
              <p className="text-indigo-300 text-sm font-semibold mb-1">₹999/month</p>
              <p className="text-indigo-400 text-xs">All features · All shop types · Unlimited bills · Auto-updates</p>
            </div>
          )}

          <p className="text-slate-300 text-sm font-medium mb-3">Contact us:</p>
          <div className="space-y-3">
            <a
              href={`https://wa.me/${WHATSAPP}?text=Hi, ${isFrozen ? 'my account is frozen' : isRevoked ? 'my access was revoked' : 'I want to subscribe to FrontStores'}. My Shop ID is: ${config?.tenant_id?.substring(0, 8)}`}
              className="flex items-center gap-3 bg-green-900 border border-green-700 rounded-2xl p-4 hover:bg-green-800 transition-colors"
            >
              <span className="text-2xl">💬</span>
              <div>
                <p className="text-white font-semibold text-sm">WhatsApp</p>
                <p className="text-green-300 text-xs">Fastest response · Usually within 1 hour</p>
              </div>
            </a>
            <a
              href={`mailto:${EMAIL}?subject=FrontStores - ${isFrozen ? 'Account Frozen' : isRevoked ? 'Access Revoked' : 'Subscription'}&body=Hi, Shop ID: ${config?.tenant_id?.substring(0, 8)}`}
              className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4 hover:bg-slate-700 transition-colors"
            >
              <span className="text-2xl">📧</span>
              <div>
                <p className="text-white font-semibold text-sm">Email</p>
                <p className="text-slate-400 text-xs">{EMAIL}</p>
              </div>
            </a>
          </div>

          <div className="mt-4 p-3 bg-slate-800 rounded-xl text-center">
            <p className="text-slate-500 text-xs">Your Shop ID</p>
            <p className="text-slate-300 font-mono text-sm mt-1">{config?.tenant_id?.substring(0, 16)}…</p>
          </div>

          <button
            onClick={handleRecheck}
            disabled={checking}
            className="mt-4 w-full py-3 rounded-2xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {checking ? 'Checking…' : '🔄 I have paid — Check again'}
          </button>

          <p className="text-center text-slate-600 text-xs mt-3">
            Your data is safe and will not be deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
