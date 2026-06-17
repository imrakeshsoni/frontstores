// [core] [all apps] [all tenants]
// One-time notice shown on the first launch after cloud-by-default rolled out. Tells the
// owner their data is now backed up to the cloud and offers an immediate opt-out to
// Local-only. Gated on settings.cloud_notice_shown so it appears exactly once.
import { useState } from 'react';
import { toast } from 'sonner';
import { Cloud } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { updateAppConfig } from '@/lib/db/config';
import { setLocalOnly } from '@/lib/db/cloudSync';

export function CloudBackupNotice() {
  const config = useAppStore(s => s.config);
  const refreshConfig = useAppStore(s => s.refreshConfig);
  const settings = (config?.settings as any) ?? {};
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const tenantId = config?.tenant_id ?? '';
  const shopType = config?.shop_type ?? '';
  const show =
    !dismissed &&
    !!config?.is_setup_complete &&
    shopType !== 'admin' &&
    !settings.cloud_notice_shown &&
    !settings.local_only;

  if (!show) return null;

  const markShown = async () => {
    const s = (config?.settings as any) ?? {};
    await updateAppConfig({ settings: { ...s, cloud_notice_shown: true } });
    await refreshConfig();
  };

  const handleGotIt = async () => {
    if (busy) return;
    setBusy(true);
    try { await markShown(); setDismissed(true); } finally { setBusy(false); }
  };

  const handleLocalOnly = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await setLocalOnly(tenantId, true);
      if (!r.ok) { toast.error(r.error ?? 'Could not change setting'); return; }
      await markShown();
      await refreshConfig();
      setDismissed(true);
      toast.success('Local only is ON — your data stays on this computer.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(22,163,74,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Cloud size={24} color="#16a34a" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>Your data is now backed up</div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
          FrontStores now automatically backs up your shop data to the cloud and keeps it in
          sync across your devices — so you never lose anything if your computer fails.
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Prefer to keep everything on this computer only? You can switch to <b style={{ color: 'var(--text)' }}>Local only</b> any
          time under <b style={{ color: 'var(--text)' }}>Data &amp; Cloud</b> in the sidebar.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleGotIt} disabled={busy}
            style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 800, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            Got it — keep my data backed up
          </button>
          <button
            onClick={handleLocalOnly} disabled={busy}
            style={{ background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '11px', fontWeight: 700, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            No thanks — keep data on this computer only
          </button>
        </div>
      </div>
    </div>
  );
}
