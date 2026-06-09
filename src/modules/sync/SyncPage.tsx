// [core] [all apps] [all tenants]
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Smartphone, Check, Lock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  refreshCloudSyncStatus, requestCloudSync, getCloudSyncStatus,
  pushSyncData, pushDelta, pullDelta, setMobilePin,
  getCloudDbStatus, refreshCloudDbStatus, requestCloudDb, pushToCloudDb, pullFromCloudDb,
} from '@/lib/db/cloudSync';
import { setCloudDbApprovedHandler } from '@/lib/autoSync';

// ─────────────────────────────────────────────────────────────────────────────

export default function SyncPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  const [cloudDbPushing, setCloudDbPushing] = useState(false);
  const [cloudDbPulling, setCloudDbPulling] = useState(false);

  // ── Cloud Sync status ────────────────────────────────────────────────────────
  const { data: syncStatus, refetch: refetchSync } = useQuery({
    queryKey: ['cloud-sync-status', tenantId],
    queryFn: () => refreshCloudSyncStatus(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // ── Cloud DB status ──────────────────────────────────────────────────────────
  const { data: cloudDbStatus, refetch: refetchCloudDb } = useQuery({
    queryKey: ['cloud-db-status', tenantId],
    queryFn: () => refreshCloudDbStatus(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Register SSE handler so admin approval instantly refreshes status
  useEffect(() => {
    setCloudDbApprovedHandler(() => {
      queryClient.invalidateQueries({ queryKey: ['cloud-db-status', tenantId] });
    });
    return () => setCloudDbApprovedHandler(() => {});
  }, [tenantId, queryClient]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const requestSyncMutation = useMutation({
    mutationFn: () => requestCloudSync(tenantId),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.error ?? 'Could not send request'); return; }
      toast.success('Request sent — we\'ll approve it shortly.');
      refetchSync();
    },
  });

  const requestCloudDbMutation = useMutation({
    mutationFn: () => requestCloudDb(tenantId),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.error ?? 'Could not send request'); return; }
      toast.success('Cloud Storage request sent — pending approval.');
      refetchCloudDb();
    },
  });

  // ── Cloud Sync manual sync ───────────────────────────────────────────────────
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const status = await getCloudSyncStatus();
      const result = status.lastSyncedAt ? await pushDelta(tenantId) : await pushSyncData(tenantId);
      if (!result.ok) { toast.error(result.error ?? 'Sync failed'); return; }
      await pullDelta(tenantId);
      toast.success('Synced!');
      refetchSync();
    } catch (e: any) {
      toast.error('Sync failed: ' + (e?.message ?? 'Check internet'));
    } finally { setSyncing(false); }
  };

  // ── Cloud DB manual push/pull ────────────────────────────────────────────────
  const handleCloudDbPush = async () => {
    setCloudDbPushing(true);
    try {
      const r = await pushToCloudDb(tenantId);
      if (!r.ok) { toast.error(r.error ?? 'Push failed'); return; }
      toast.success('Data saved to cloud!');
      refetchCloudDb();
    } catch { toast.error('Push failed'); } finally { setCloudDbPushing(false); }
  };

  const handleCloudDbPull = async () => {
    setCloudDbPulling(true);
    try {
      const r = await pullFromCloudDb(tenantId);
      if (!r.ok) { toast.error(r.error ?? 'Pull failed'); return; }
      toast.success(`Restored ${r.rows} records from cloud!`);
      queryClient.invalidateQueries();
    } catch { toast.error('Pull failed'); } finally { setCloudDbPulling(false); }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const lastSynced = syncStatus?.lastSyncedAt ? fmtAgo(syncStatus.lastSyncedAt) : null;
  const lastSnapshot = cloudDbStatus?.lastSnapshotAt ? fmtAgo(cloudDbStatus.lastSnapshotAt) : null;
  const cloudSyncActive = !!syncStatus?.enabled;

  // ── Tier styles ──────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1.5px solid var(--border)',
    borderRadius: 16, padding: 20, marginBottom: 16,
  };
  const activeCard: React.CSSProperties = { ...card, borderColor: '#7c3aed', boxShadow: '0 0 0 3px rgba(124,58,237,.08)' };
  const lockedCard: React.CSSProperties = { ...card, opacity: 0.55, pointerEvents: 'none' };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Data & Cloud</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          Choose how your shop data is stored and shared. Set up in order — each tier unlocks the next.
        </p>
      </div>

      {/* ── TIER 1: Local Storage ─────────────────────────────────────────────── */}
      <TierHeader step={1} label="Local Storage" active />
      <div style={activeCard}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 26 }}>💾</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Local Storage</span>
              <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>ACTIVE</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              Your data stays on this device — fast, private, works 100% offline. All your bills, customers, inventory, and reports are stored locally in SQLite.
            </p>
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#15803d', fontWeight: 700, marginBottom: 4 }}>Good for you if:</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
                <li>You run a single-person shop with one computer</li>
                <li>You don't need other staff to access data</li>
                <li>Internet is unreliable in your area</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIER 2: Cloud Sync ────────────────────────────────────────────────── */}
      <TierHeader step={2} label="Cloud Sync" active={cloudSyncActive} />
      <div style={syncStatus?.enabled ? activeCard : card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 26 }}>☁️</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Cloud Sync</span>
              <span style={{ fontSize: 11, background: '#ede9fe', color: '#5b21b6', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>PAID</span>
              {syncStatus?.enabled && <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>ACTIVE</span>}
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 10px' }}>
              Sync your shop data across any number of devices and users in real-time. Your staff can log in and see live data from their own phones or computers.
            </p>

            <div style={{ padding: '10px 14px', background: 'rgba(124,58,237,.05)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>Why upgrade to Cloud Sync:</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
                <li>Add staff login — let cashiers, managers access their own account</li>
                <li>Use the mobile dashboard on your phone to monitor sales live</li>
                <li>Work from multiple computers in the same shop</li>
                <li>Never lose data if your computer crashes (data also on server)</li>
              </ul>
            </div>

            {!syncStatus?.enabled ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--text)' }}>How to activate:</b> Send a request below → FrontStores reviews → switches on automatically. Then tap "Sync Now" to push your data.
                </div>
                {syncStatus?.requestStatus === 'pending' && (
                  <StatusBadge color="amber" text="Request pending approval — check back shortly" />
                )}
                {syncStatus?.requestStatus === 'rejected' && (
                  <StatusBadge color="red" text="Request not approved. Contact FrontStores support or send again." />
                )}
                <button
                  onClick={() => requestSyncMutation.mutate()}
                  disabled={requestSyncMutation.isPending || syncStatus?.requestStatus === 'pending'}
                  style={primaryBtn(requestSyncMutation.isPending || syncStatus?.requestStatus === 'pending')}
                >
                  ☁️ {requestSyncMutation.isPending ? 'Sending…' : syncStatus?.requestStatus === 'pending' ? 'Pending approval…' : syncStatus?.requestStatus === 'rejected' ? 'Send again' : 'Request Cloud Sync'}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(124,58,237,.06)', border: '1.5px solid rgba(124,58,237,.2)', borderRadius: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>Cloud Sync Active</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lastSynced ? `Last synced ${lastSynced}` : 'Never synced — tap Sync Now'}</div>
                  </div>
                  <button onClick={handleSync} disabled={syncing} style={outlineBtn(syncing)}>
                    <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                </div>

                {/* Mobile PIN */}
                <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        <Smartphone size={13} /> Mobile Login PIN
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {syncStatus.mobilePinSet ? 'PIN set — staff can log in from any device' : 'Set a PIN so staff can log in on their device'}
                      </div>
                    </div>
                    <button onClick={() => setShowPinForm(v => !v)} style={ghostBtn()}>
                      {syncStatus.mobilePinSet ? 'Change PIN' : 'Set PIN'}
                    </button>
                  </div>
                  {showPinForm && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <input
                        type="password" inputMode="numeric" maxLength={8}
                        value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="4–8 digit PIN"
                        style={{ flex: 1, borderRadius: 10, border: '1.5px solid var(--border)', padding: '9px 12px', fontSize: 14, fontFamily: 'monospace', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                      <button
                        onClick={async () => {
                          if (!tenantId || pinInput.length < 4) return;
                          const r = await setMobilePin(tenantId, pinInput);
                          if (!r.ok) { toast.error(r.error ?? 'Failed'); return; }
                          toast.success('PIN set! Staff can now log in.');
                          setPinInput(''); setShowPinForm(false); refetchSync();
                        }}
                        disabled={pinInput.length < 4}
                        style={{ ...primaryBtn(pinInput.length < 4), padding: '9px 16px' }}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {syncStatus.dashboardUrl && (
                  <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Mobile Dashboard Link</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Share with staff — opens live shop data on any device:</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <code style={{ flex: 1, fontSize: 11, color: '#7c3aed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{syncStatus.dashboardUrl}</code>
                      <button onClick={() => { navigator.clipboard?.writeText(syncStatus.dashboardUrl!); toast.success('Copied!'); }} style={ghostBtn()}>Copy</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── TIER 3: Cloud Storage ─────────────────────────────────────────────── */}
      <TierHeader step={3} label="Cloud Storage" active={cloudDbStatus?.enabled} locked={!cloudSyncActive} />
      <div style={!cloudSyncActive ? lockedCard : cloudDbStatus?.enabled ? activeCard : card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 26 }}>🗄️</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Cloud Storage</span>
              <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>PAID · REQUIRES CLOUD SYNC</span>
              {cloudDbStatus?.enabled && <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>ACTIVE</span>}
            </div>

            {!cloudSyncActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b45309', background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                <Lock size={12} /> Enable Cloud Sync (Step 2) first to unlock Cloud Storage
              </div>
            )}

            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 10px' }}>
              The cloud becomes your primary database. Every change is automatically saved to the server. When internet is available, your app runs from the cloud. When offline, it works from local data — and syncs back up when you reconnect.
            </p>

            <div style={{ padding: '10px 14px', background: 'rgba(234,88,12,.05)', border: '1px solid rgba(234,88,12,.15)', borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#c2410c', fontWeight: 700, marginBottom: 4 }}>Why Cloud Storage is powerful:</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
                <li><b>Full backup</b> — your data is safe even if your computer completely fails</li>
                <li><b>Instant restore</b> — reinstall the app on any machine, pull your data, done</li>
                <li><b>Works like a cloud app</b> — new staff devices get all data from day one</li>
                <li><b>Offline-first</b> — if server is down or no internet, local data keeps working</li>
                <li><b>Auto-sync</b> — every sale, every entry auto-pushed to cloud (no manual steps)</li>
              </ul>
            </div>

            {!cloudDbStatus?.enabled ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--text)' }}>How to activate:</b> Send a request → FrontStores reviews → switched on automatically. Once active, all data auto-saves to cloud every time you make a change.
                </div>
                {cloudDbStatus?.requestStatus === 'pending' && (
                  <StatusBadge color="amber" text="Cloud Storage request pending approval — check back shortly" />
                )}
                {cloudDbStatus?.requestStatus === 'rejected' && (
                  <StatusBadge color="red" text="Request not approved. Contact FrontStores support or send again." />
                )}
                <button
                  onClick={() => requestCloudDbMutation.mutate()}
                  disabled={requestCloudDbMutation.isPending || cloudDbStatus?.requestStatus === 'pending' || !cloudSyncActive}
                  style={primaryBtn(requestCloudDbMutation.isPending || cloudDbStatus?.requestStatus === 'pending' || !cloudSyncActive, '#ea580c')}
                >
                  🗄️ {requestCloudDbMutation.isPending ? 'Sending…' : cloudDbStatus?.requestStatus === 'pending' ? 'Pending approval…' : cloudDbStatus?.requestStatus === 'rejected' ? 'Send again' : 'Request Cloud Storage'}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(234,88,12,.06)', border: '1.5px solid rgba(234,88,12,.2)', borderRadius: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ea580c' }}>Cloud Storage Active</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{lastSnapshot ? `Last cloud snapshot ${lastSnapshot}` : 'No snapshot yet — push data now'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleCloudDbPush} disabled={cloudDbPushing} style={outlineBtn(cloudDbPushing, '#ea580c')}>
                      <RefreshCw size={12} className={cloudDbPushing ? 'animate-spin' : ''} />
                      {cloudDbPushing ? 'Saving…' : 'Save to Cloud'}
                    </button>
                    <button onClick={handleCloudDbPull} disabled={cloudDbPulling} style={ghostBtn()}>
                      {cloudDbPulling ? 'Restoring…' : 'Restore'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  Data is automatically saved to cloud every time you make changes. Use "Save to Cloud" to push manually, or "Restore" to pull data back from cloud (useful after reinstalling the app).
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* How it works summary */}
      <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>How the 3 tiers work together</div>
        {[
          ['💾', 'Local', 'Always on. Data on this device. Works fully offline.'],
          ['☁️', 'Cloud Sync', 'Add Cloud Sync → your staff can log in on their own devices and see live data.'],
          ['🗄️', 'Cloud Storage', 'Add Cloud Storage on top → full backup in cloud. Reinstall any time, restore in seconds.'],
        ].map(([icon, name, text]) => (
          <div key={name} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}><b style={{ color: 'var(--text)' }}>{name}:</b> {text}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function TierHeader({ step, label, active, locked }: { step: number; label: string; active?: boolean; locked?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: step === 1 ? 0 : 4 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 900, flexShrink: 0,
        background: locked ? 'var(--border)' : active ? '#7c3aed' : 'var(--surface)',
        border: locked ? '2px solid var(--border)' : active ? 'none' : '2px solid var(--border)',
        color: locked ? 'var(--muted)' : active ? '#fff' : 'var(--muted)',
      }}>
        {active && !locked ? <Check size={13} strokeWidth={3} /> : step}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: locked ? 'var(--muted)' : active ? 'var(--text)' : 'var(--muted)' }}>Step {step}: {label}</span>
      {step < 3 && <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />}
    </div>
  );
}

function StatusBadge({ color, text }: { color: 'amber' | 'red'; text: string }) {
  const colors = { amber: { bg: 'rgba(234,179,8,.08)', border: 'rgba(234,179,8,.25)', text: '#92400e' }, red: { bg: 'rgba(239,68,68,.06)', border: 'rgba(239,68,68,.2)', text: '#be123c' } };
  const c = colors[color];
  return (
    <div style={{ fontSize: 12, color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>{text}</div>
  );
}

function primaryBtn(disabled: boolean, color = '#7c3aed'): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: disabled ? 'var(--border)' : color, color: disabled ? 'var(--muted)' : '#fff',
    borderRadius: 12, padding: '11px 22px', fontWeight: 700, fontSize: 13,
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function outlineBtn(disabled: boolean, color = '#7c3aed'): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: disabled ? 'var(--muted)' : color,
    borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 12,
    border: `1.5px solid ${disabled ? 'var(--border)' : color}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
    border: '1.5px solid var(--border)', background: 'transparent',
    color: 'var(--text)', cursor: 'pointer', flexShrink: 0,
  };
}
