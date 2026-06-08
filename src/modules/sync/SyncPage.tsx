// [core] [all apps] [all tenants]
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Smartphone } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  refreshCloudSyncStatus, requestCloudSync, getCloudSyncStatus,
  pushSyncData, pushDelta, pullDelta, setMobilePin,
} from '@/lib/db/cloudSync';

// ── Component ─────────────────────────────────────────────────────────────────

export default function SyncPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);

  const { data: syncStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['cloud-sync-status', tenantId],
    queryFn: () => refreshCloudSyncStatus(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  const requestMutation = useMutation({
    mutationFn: () => requestCloudSync(tenantId),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.error ?? 'Could not send request'); return; }
      toast.success('Request sent — we\'ll approve it from our end shortly.');
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['cloud-sync-status', tenantId] });
    },
  });

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const status = await getCloudSyncStatus();
      const result = status.lastSyncedAt
        ? await pushDelta(tenantId)
        : await pushSyncData(tenantId);
      if (!result.ok) { toast.error(result.error ?? 'Sync failed'); return; }
      await pullDelta(tenantId);
      toast.success('✅ Synced!');
      refetchStatus();
    } catch (e: any) {
      toast.error('Sync failed: ' + (e?.message ?? 'Check internet connection'));
    } finally { setSyncing(false); }
  };

  const lastSynced = syncStatus?.lastSyncedAt
    ? (() => {
        const diff = Math.round((Date.now() - new Date(syncStatus.lastSyncedAt).getTime()) / 60000);
        if (diff < 1) return 'just now';
        if (diff < 60) return `${diff} min ago`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
        return `${Math.floor(diff / 1440)}d ago`;
      })()
    : null;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Data Sync</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Keep your devices in sync.</p>
      </div>

      {/* Cloud Sync */}
      <div style={{
        background: '#fff', border: '1.5px solid var(--border)',
        borderRadius: 16, padding: 20, marginBottom: 16,
        boxShadow: '0 2px 8px rgba(124,58,237,.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>☁️</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Cloud Sync</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#7c3aed', borderRadius: 999, padding: '2px 8px' }}>PAID</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Sync across any network, anywhere</div>
          </div>
        </div>

        {!syncStatus?.enabled ? (
          <div style={{ marginTop: 16, background: 'rgba(124,58,237,.06)', border: '1.5px solid rgba(124,58,237,.2)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>How it works</div>
              <div>1. Tap "Request Cloud Sync" below</div>
              <div>2. FrontStores reviews and approves your request</div>
              <div>3. Once approved, it switches on here automatically — no code to enter</div>
              <div>4. Then tap "Sync Now" to push your data and get your mobile dashboard link</div>
            </div>

            {syncStatus?.requestStatus === 'pending' && (
              <div style={{ borderRadius: 12, padding: 12, marginBottom: 12, background: 'rgba(234,179,8,.1)', border: '1.5px solid rgba(234,179,8,.25)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#b45309' }}>Request pending approval</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>We'll switch on Cloud Sync for your account shortly — check back here.</div>
              </div>
            )}
            {syncStatus?.requestStatus === 'rejected' && (
              <div style={{ borderRadius: 12, padding: 12, marginBottom: 12, background: 'rgba(244,63,94,.08)', border: '1.5px solid rgba(244,63,94,.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e11d48' }}>Your request wasn't approved. Contact FrontStores support, or send a new request.</div>
              </div>
            )}

            <button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || syncStatus?.requestStatus === 'pending'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#7c3aed', color: '#fff', borderRadius: 12, padding: '12px 24px',
                fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', opacity: (requestMutation.isPending || syncStatus?.requestStatus === 'pending') ? 0.5 : 1,
              }}
            >
              ☁️ {requestMutation.isPending ? 'Sending request…' : syncStatus?.requestStatus === 'pending' ? 'Request pending…' : syncStatus?.requestStatus === 'rejected' ? 'Send request again' : 'Request Cloud Sync'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(124,58,237,.06)', border: '1.5px solid rgba(124,58,237,.2)', borderRadius: 14, padding: 16 }}>
              <div style={{ height: 32, width: 32, borderRadius: 999, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 16 }}>☁️</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>Cloud Sync Active ✓</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lastSynced ? `Last synced ${lastSynced}` : 'Never synced — tap Sync Now'}</div>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: '#7c3aed', color: '#fff',
                  borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: 13, border: 'none',
                  cursor: 'pointer', opacity: syncing ? 0.5 : 1,
                }}
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            </div>

            {/* Mobile PIN setup */}
            <div style={{ marginTop: 12, borderRadius: 14, padding: 16, background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    <Smartphone size={14} /> Mobile Login PIN
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {syncStatus.mobilePinSet ? '✓ PIN set — staff can log in from Android app' : 'Set a PIN so you can log in on the Android app'}
                  </div>
                </div>
                <button
                  onClick={() => setShowPinForm(v => !v)}
                  style={{ fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}
                >
                  {syncStatus.mobilePinSet ? 'Change PIN' : 'Set PIN'}
                </button>
              </div>
              {showPinForm && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input
                    type="password" inputMode="numeric" maxLength={8}
                    value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="4–8 digit PIN"
                    style={{ flex: 1, borderRadius: 10, border: '1.5px solid var(--border)', padding: '10px 12px', fontSize: 14, fontFamily: 'monospace', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
                  />
                  <button
                    onClick={async () => {
                      if (!tenantId || pinInput.length < 4) return;
                      const r = await setMobilePin(tenantId, pinInput);
                      if (!r.ok) { toast.error(r.error ?? 'Failed'); return; }
                      toast.success('Mobile PIN set! Android app users can now log in.');
                      setPinInput(''); setShowPinForm(false); refetchStatus();
                    }}
                    disabled={pinInput.length < 4}
                    style={{ borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', opacity: pinInput.length < 4 ? 0.5 : 1 }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {syncStatus.dashboardUrl && (
              <div style={{ marginTop: 12, borderRadius: 14, padding: 16, background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  <Smartphone size={14} /> Your Mobile Dashboard
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Open this link on your phone to see live shop data:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 12, color: '#7c3aed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{syncStatus.dashboardUrl}</code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(syncStatus.dashboardUrl!); toast.success('Link copied!'); }}
                    style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Copy
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>💡 Bookmark this on your phone for quick access. Works best in Chrome or Safari.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>How Sync Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['📲', 'Your data stays on your device. Nothing is sent to any server without your permission.'],
            ['🔁', 'Sync merges changes from all your devices. The most recently updated record wins.'],
            ['☁️', 'Cloud Sync (paid): works from anywhere, any network, any time — once approved for your account.'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
