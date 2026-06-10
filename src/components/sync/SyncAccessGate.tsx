// [core] [all tenants] — Multi-device consistency gate. Exactly one designated
// "billing device" (settings.billing_user) may always work, online or offline.
// Every other device must be online and fully synced before it can do anything,
// so additions made elsewhere are never based on stale data.
import { useEffect, useState } from 'react';
import { CloudOff, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getSyncState, setSyncStateHandler, removeSyncStateHandler, type SyncState } from '@/lib/autoSync';

export function SyncAccessGate({ children }: { children: React.ReactNode }) {
  const { config } = useAppStore();
  const [syncState, setSyncState] = useState<SyncState>(() => getSyncState());

  useEffect(() => {
    setSyncStateHandler(setSyncState);
    return () => removeSyncStateHandler(setSyncState);
  }, []);

  const settings = config?.settings as any ?? {};
  const cloudSyncEnabled = !!settings.cloud_sync_enabled;
  const billingUser = (settings.billing_user as string) || 'owner';
  const currentUsername = sessionStorage.getItem('fs_logged_in_username') || 'owner';
  const isBillingDevice = currentUsername === billingUser;

  // Only the designated billing device may work without being synced.
  // Cloud Sync must be active for this rule to apply at all.
  if (cloudSyncEnabled && !isBillingDevice && syncState.status !== 'synced') {
    return <LockScreen status={syncState.status} />;
  }

  return <>{children}</>;
}

function LockScreen({ status }: { status: SyncState['status'] }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}>
      {status === 'syncing' ? (
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'var(--accent)' }} />
      ) : status === 'error' ? (
        <AlertCircle className="h-12 w-12" style={{ color: '#ef4444' }} />
      ) : (
        <CloudOff className="h-12 w-12" style={{ color: '#f59e0b' }} />
      )}
      <h2 className="text-lg font-semibold">
        {status === 'syncing' ? 'Connecting to cloud…' : 'Waiting for connection'}
      </h2>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {status === 'syncing'
          ? "Getting the latest data before you can start working."
          : "This device needs to be online and synced with the cloud before you can add or change anything. Please check your internet connection."}
      </p>
    </div>
  );
}
