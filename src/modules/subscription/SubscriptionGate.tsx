import { useEffect, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { getDb, now } from '@/lib/db/index';

const WHATSAPP = '919999999999'; // replace with your number
const EMAIL = 'support@frontstores.com';
const SERVER = 'https://update.frontstores.com'; // your Cloudflare tunnel

type Status = 'loading' | 'active' | 'expired' | 'grace';

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const config = useAppStore((s) => s.config);
  const loadConfig = useAppStore((s) => s.loadConfig);
  const [status, setStatus] = useState<Status>('loading');
  const [daysLeft, setDaysLeft] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!config) return;
    checkSubscription();
  }, [config]);

  async function checkSubscription() {
    if (!config) return;

    const expires = config.subscription_expires_at
      ? new Date(config.subscription_expires_at)
      : null;

    if (!expires) { setStatus('active'); return; }

    const msLeft = expires.getTime() - Date.now();
    const days = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    setDaysLeft(Math.max(0, days));

    if (days > 0) {
      setStatus('active');
      return;
    }

    // Trial/subscription expired — check server for extension
    try {
      const res = await fetch(`${SERVER}/license/${config.tenant_id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.expires_at) {
          // Server has extended — update local DB
          const db = await getDb();
          await db.execute(
            `UPDATE app_config SET subscription_expires_at = ?, subscription_status = ?, updated_at = ? WHERE tenant_id = ?`,
            [data.expires_at, 'active', now(), config.tenant_id]
          );
          await loadConfig();
          return;
        }
      }
    } catch {
      // Server unreachable — give 3-day grace period
      setStatus('grace');
      return;
    }

    setStatus('expired');
  }

  async function handleRecheck() {
    setChecking(true);
    await checkSubscription();
    setChecking(false);
  }

  if (status === 'loading') return <>{children}</>;
  if (status === 'active') return <>{children}</>;

  const isGrace = status === 'grace';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">{isGrace ? '⚠️' : '🔒'}</div>
          <h1 className="text-2xl font-bold text-white">
            {isGrace ? 'Unable to verify subscription' : 'Your trial has ended'}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isGrace
              ? 'We could not reach the server to verify your subscription. Please check your internet connection.'
              : 'Your 30-day free trial has expired. Subscribe to continue using FrontStores.'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-4 mb-6">
            <p className="text-indigo-300 text-sm font-semibold mb-1">Subscription — ₹999/month</p>
            <p className="text-indigo-400 text-xs">Includes all features, all shop types, unlimited bills, auto-updates.</p>
          </div>

          <p className="text-slate-300 text-sm font-medium mb-3">To subscribe, contact us:</p>

          <div className="space-y-3">
            <a
              href={`https://wa.me/${WHATSAPP}?text=Hi, I want to subscribe to FrontStores. My Shop ID is: ${config?.tenant_id?.substring(0, 8)}`}
              className="flex items-center gap-3 bg-green-900 border border-green-700 rounded-2xl p-4 hover:bg-green-800 transition-colors"
            >
              <span className="text-2xl">💬</span>
              <div>
                <p className="text-white font-semibold text-sm">WhatsApp Us</p>
                <p className="text-green-300 text-xs">Fastest response · Usually within 1 hour</p>
              </div>
            </a>

            <a
              href={`mailto:${EMAIL}?subject=FrontStores Subscription&body=Hi, I want to subscribe. Shop ID: ${config?.tenant_id?.substring(0, 8)}`}
              className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4 hover:bg-slate-700 transition-colors"
            >
              <span className="text-2xl">📧</span>
              <div>
                <p className="text-white font-semibold text-sm">Email Us</p>
                <p className="text-slate-400 text-xs">{EMAIL}</p>
              </div>
            </a>
          </div>

          <div className="mt-4 p-3 bg-slate-800 rounded-xl text-center">
            <p className="text-slate-500 text-xs">Your Shop ID (share this with us)</p>
            <p className="text-slate-300 font-mono text-sm mt-1">{config?.tenant_id?.substring(0, 16)}…</p>
          </div>

          <button
            onClick={handleRecheck}
            disabled={checking}
            className="mt-4 w-full py-3 rounded-2xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {checking ? 'Checking…' : '🔄 I have paid — Check again'}
          </button>

          {daysLeft === 0 && (
            <p className="text-center text-slate-600 text-xs mt-3">
              Your data is safe and will not be deleted.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
