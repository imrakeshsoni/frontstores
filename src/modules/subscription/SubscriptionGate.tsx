import { useEffect, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { getDb, now } from '@/lib/db/index';

const CONTACT_URL = 'https://frontstores.com/#contact';
const SERVER = 'https://update.frontstores.com';
const OFFLINE_GRACE_DAYS = 7;
const ROLLBACK_TOLERANCE_MS = 60 * 60 * 1000;     // 1 hour
const VERIFY_INTERVAL_MS   = 24 * 60 * 60 * 1000; // re-verify with server every 24h

type Status = 'loading' | 'active' | 'warning' | 'locked' | 'pending';

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

    // NULL expiry: never grant free pass — always require server confirmation
    if (!expires) {
      const serverResult = await tryServerCheck();
      if (serverResult === 'extended') return;
      if (serverResult === 'pending') {
        const db = await getDb();
        await db.execute(`UPDATE app_config SET subscription_status = 'pending', updated_at = ? WHERE tenant_id = ?`, [now(), config.tenant_id]);
        setStatus('pending');
        return;
      }
      if (serverResult === 'frozen')  { setLockReason('frozen');  setStatus('locked'); return; }
      if (serverResult === 'revoked') { setLockReason('revoked'); setStatus('locked'); return; }
      // confirmed_expired OR unreachable with no local expiry
      // If locally marked pending, show pending screen (not locked) — server may be temporarily unreachable
      if (serverResult === 'unreachable' && config.subscription_status === 'pending') {
        setStatus('pending');
        return;
      }
      setLockReason('expired');
      setStatus('locked');
      return;
    }

    // Clock rollback detection: local clock is behind last known server timestamp
    const lastServerTime = config.last_server_time ? new Date(config.last_server_time).getTime() : null;
    if (lastServerTime !== null && Date.now() < lastServerTime - ROLLBACK_TOLERANCE_MS) {
      const serverResult = await tryServerCheck();
      if (serverResult === 'extended') return;
      if (serverResult === 'frozen')  { setLockReason('frozen');  setStatus('locked'); return; }
      if (serverResult === 'revoked') { setLockReason('revoked'); setStatus('locked'); return; }
      if (serverResult === 'confirmed_expired') { setLockReason('expired'); setStatus('locked'); return; }
      // Suspicious clock + unreachable server → lock with no grace
      setLockReason('expired');
      setStatus('locked');
      return;
    }

    const daysUntilExpiry = Math.ceil((expires.getTime() - Date.now()) / 864e5);

    if (daysUntilExpiry > 0) {
      setStatus('active');

      // 24h freshness: if we haven't verified with server in 24h, do a blocking check now
      const lastVerified = config.last_verified_at ? new Date(config.last_verified_at).getTime() : 0;
      const stale = Date.now() - lastVerified > VERIFY_INTERVAL_MS;

      if (stale && navigator.onLine) {
        const serverResult = await tryServerCheck();
        if (serverResult === 'pending')          { setStatus('pending');                        return; }
        if (serverResult === 'frozen')           { setLockReason('frozen');  setStatus('locked'); return; }
        if (serverResult === 'revoked')          { setLockReason('revoked'); setStatus('locked'); return; }
        if (serverResult === 'confirmed_expired'){ setLockReason('expired'); setStatus('locked'); return; }
        // extended or unreachable — stay active
        return;
      }

      // Background check for freeze/revoke/pending even when not stale
      tryServerCheck().then((result) => {
        if (result === 'pending')           { setStatus('pending'); }
        if (result === 'frozen')            { setLockReason('frozen');  setStatus('locked'); }
        if (result === 'revoked')           { setLockReason('revoked'); setStatus('locked'); }
        if (result === 'confirmed_expired') { setLockReason('expired'); setStatus('locked'); }
      });
      return;
    }

    // Expired locally — must verify with server
    const serverResult = await tryServerCheck();
    if (serverResult === 'extended') return;
    if (serverResult === 'pending') {
      const db = await getDb();
      await db.execute(`UPDATE app_config SET subscription_status = 'pending', updated_at = ? WHERE tenant_id = ?`, [now(), config.tenant_id]);
      setStatus('pending');
      return;
    }
    if (serverResult === 'frozen')  { setLockReason('frozen');  setStatus('locked'); return; }
    if (serverResult === 'revoked') { setLockReason('revoked'); setStatus('locked'); return; }
    if (serverResult === 'confirmed_expired') { setLockReason('expired'); setStatus('locked'); return; }

    // Server unreachable — apply grace period
    const daysSinceExpiry = Math.ceil((Date.now() - expires.getTime()) / 864e5);
    const graceLeft = OFFLINE_GRACE_DAYS - daysSinceExpiry;
    if (graceLeft > 0) {
      setGraceDaysLeft(graceLeft);
      setStatus('warning');
    } else {
      setLockReason('expired');
      setStatus('locked');
    }
  }

  async function tryServerCheck(): Promise<'extended' | 'confirmed_expired' | 'frozen' | 'revoked' | 'pending' | 'unreachable'> {
    if (!config) return 'unreachable';
    try {
      const res = await fetch(`${SERVER}/license/${config.tenant_id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return 'unreachable';

      const data = await res.json();

      // Persist server timestamp + verification time on every response
      const db = await getDb();
      await db.execute(
        `UPDATE app_config SET last_server_time = ?, last_verified_at = ?, updated_at = ? WHERE tenant_id = ?`,
        [data.server_time || new Date().toISOString(), now(), now(), config.tenant_id]
      );

      if (data.reason === 'pending') return 'pending';
      if (data.reason === 'frozen') return 'frozen';
      if (data.reason === 'revoked') return 'revoked';

      if (data.active && data.expires_at) {
        await db.execute(
          `UPDATE app_config SET subscription_expires_at = ?, subscription_status = 'active', updated_at = ? WHERE tenant_id = ?`,
          [data.expires_at, now(), config.tenant_id]
        );
        await loadConfig();
        setStatus('active');
        return 'extended';
      }

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

  // [core] [all tenants] — never show the app during the initial server check
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Verifying access…</div>
      </div>
    );
  }
  if (status === 'active') return <>{children}</>;

  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-white">Awaiting Approval</h1>
            <p className="text-slate-400 mt-2 text-sm">
              Your account is pending review. You'll be able to use FrontStores once approved.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-4 mb-6">
              <p className="text-indigo-300 text-sm font-semibold mb-1">What happens next?</p>
              <ul className="text-indigo-400 text-xs space-y-1 mt-2">
                <li>• We review your registration details</li>
                <li>• You get 30 days free trial upon approval</li>
                <li>• Usually approved within a few hours</li>
              </ul>
            </div>
            <p className="text-slate-300 text-sm font-medium mb-3">Need help? Contact us:</p>
            <a
              href={CONTACT_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 bg-indigo-900 border border-indigo-700 rounded-2xl p-4 hover:bg-indigo-800 transition-colors"
            >
              <span className="text-2xl">📩</span>
              <div>
                <p className="text-white font-semibold text-sm">Get in touch</p>
                <p className="text-indigo-300 text-xs">frontstores.com · Usually within a few hours</p>
              </div>
            </a>
            <div className="mt-4 p-3 bg-slate-800 rounded-xl text-center">
              <p className="text-slate-500 text-xs">Your Shop ID</p>
              <p className="text-slate-300 font-mono text-sm mt-1">{config?.tenant_id?.substring(0, 16)}…</p>
            </div>
            <button
              onClick={handleRecheck}
              disabled={checking}
              className="mt-4 w-full py-3 rounded-2xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {checking ? 'Checking…' : '🔄 Check approval status'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          <p className="text-slate-300 text-sm font-medium mb-3">Contact us to continue:</p>
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 bg-indigo-900 border border-indigo-700 rounded-2xl p-4 hover:bg-indigo-800 transition-colors"
          >
            <span className="text-2xl">📩</span>
            <div>
              <p className="text-white font-semibold text-sm">Get in touch</p>
              <p className="text-indigo-300 text-xs">frontstores.com · Usually within a few hours</p>
            </div>
          </a>

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
