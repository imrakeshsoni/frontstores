import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sun, Moon, Cloud } from 'lucide-react';
import { shareWhatsApp, testWaCredentials } from '@/lib/whatsapp';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { useAppStore } from '@/app/store/app.store';
import { updateAppConfig } from '@/lib/db/config';
import { changePassword, changeUsername, getAuthUsername, getExportLogs, logExport } from '@/lib/db/auth';
import { listStaffUsers, requestStaffUser, removeStaffUser, refreshStaffUserApprovals, type StaffUser } from '@/lib/db/staffUsers';
import { exportBackup } from '@/lib/db/backup';
import { PageIntro } from '@/components/ui/PageIntro';
import { useTheme } from '@/lib/theme/useTheme';
import { reportError } from '@/lib/errorReporter';
import { getCloudSyncStatus, refreshCloudSyncStatus, requestCloudSync } from '@/lib/db/cloudSync';

type SettingsForm = {
  shop_name: string;
  owner_name: string;
  phone: string;
  email: string;
  gstin: string;
  drug_license_no: string;
  address_line1: string;
  city: string;
  invoiceHeaderLeft: string;
  invoiceHeaderRight: string;
  invoiceWhatsappNumber: string;
  invoiceStoreDisplayName: string;
  invoiceAddressLine: string;
  invoiceFooterNote: string;
  invoiceSignatureLabel: string;
  enableKeyboardBillingMode: boolean;
  idleTimeoutMinutes: number;
  maxLoginAttempts: number;
};

export function SettingsPage() {
  const config = useAppStore((s) => s.config);
  const { refreshConfig } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const tenantId = config?.tenant_id ?? '';

  // Update check state
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'found' | 'installing' | 'up-to-date'>('idle');
  const [updateVersion, setUpdateVersion] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [dlTotal, setDlTotal] = useState(0);
  const [dlDone, setDlDone] = useState(0);

  // On mount, pick up any update found silently at startup + load current version
  useEffect(() => {
    const stored = (window as any).__pendingUpdate;
    if (stored) {
      setUpdateVersion(stored.version);
      setPendingUpdate(stored);
      setUpdateStatus('found');
    }
    import('@tauri-apps/api/app').then(({ getVersion }) => getVersion().then(setCurrentVersion).catch(() => {}));
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) { setUpdateStatus('up-to-date'); return; }
      setUpdateVersion(update.version);
      setPendingUpdate(update);
      (window as any).__pendingUpdate = update;
      setUpdateStatus('found');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('up to date') || msg.includes('UpToDate') || msg.includes('204') ||
        msg.includes('release JSON') || msg.includes('valid release') || msg.includes('fetch')
      ) {
        setUpdateStatus('up-to-date');
      } else {
        setUpdateStatus('idle');
        reportError(msg, undefined, 'update-check');
      }
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    if (!pendingUpdate) return;
    const confirmed = confirm(
      `Install update v${updateVersion}?\n\nThe app will close and relaunch automatically.\n\nDo this when you are not billing a customer.`
    );
    if (!confirmed) return;
    setUpdateStatus('installing');
    setDlDone(0);
    setDlTotal(0);
    try {
      await pendingUpdate.downloadAndInstall((progress: any) => {
        if (progress.event === 'Started') {
          setDlTotal(progress.data.contentLength ?? 0);
        } else if (progress.event === 'Progress') {
          setDlDone(d => d + (progress.data.chunkLength ?? 0));
        }
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      setUpdateStatus('found');
      setDlDone(0);
      setDlTotal(0);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Install failed: ${msg}`);
      reportError(msg, undefined, 'update-install');
    }
  }, [pendingUpdate, updateVersion]);

  // Password change state
  const [currentUsername, setCurrentUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  // Switch to new computer — export
  const [exportPass, setExportPass] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const exportPassRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenantId) getAuthUsername(tenantId).then(u => { if (u) setCurrentUsername(u); });
  }, [tenantId]);

  async function handleChangePassword() {
    if (!newPass || newPass.length < 4) { toast.error('New password must be at least 4 characters'); return; }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return; }
    const result = await changePassword(tenantId, currentPass, newPass);
    if (result.ok) {
      toast.success('Password changed successfully');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } else {
      toast.error(result.error ?? 'Failed to change password');
    }
  }

  async function handleChangeUsername() {
    if (!newUsername.trim() || newUsername.trim().length < 3) { toast.error('Username must be at least 3 characters'); return; }
    await changeUsername(tenantId, newUsername.trim());
    setCurrentUsername(newUsername.trim().toLowerCase());
    setNewUsername('');
    toast.success('Username changed successfully');
  }
  const { data: exportLogs } = useQuery({
    queryKey: ['export-logs', tenantId],
    queryFn: () => getExportLogs(tenantId),
    enabled: !!tenantId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const closePanel = () => setActivePanel(null);
  const [form, setForm] = useState<SettingsForm>({
    shop_name: '', owner_name: '', phone: '', email: '', gstin: '', drug_license_no: '',
    address_line1: '', city: '',
    invoiceHeaderLeft: 'Chemist & Druggist', invoiceHeaderRight: 'Cash/Credit Memo',
    invoiceWhatsappNumber: '', invoiceStoreDisplayName: '', invoiceAddressLine: '',
    invoiceFooterNote: 'Thanks for your visit', invoiceSignatureLabel: 'Authorised Signature',
    enableKeyboardBillingMode: false,
    idleTimeoutMinutes: 15,
    maxLoginAttempts: 5,
  });

  // Only reset form from config when NOT editing — prevents typing from being wiped
  useEffect(() => {
    if (config && !isEditing) {
      const s = (config.settings ?? {}) as any;
      setForm({
        shop_name: config.shop_name ?? '',
        owner_name: config.owner_name ?? '',
        phone: config.phone ?? '',
        email: config.email ?? '',
        gstin: config.gstin ?? '',
        drug_license_no: config.drug_license_no ?? '',
        address_line1: config.address_line1 ?? '',
        city: config.city ?? '',
        invoiceHeaderLeft: s.invoiceHeaderLeft ?? 'Chemist & Druggist',
        invoiceHeaderRight: s.invoiceHeaderRight ?? 'Cash/Credit Memo',
        invoiceWhatsappNumber: s.invoiceWhatsappNumber ?? '',
        invoiceStoreDisplayName: s.invoiceStoreDisplayName ?? config.shop_name ?? '',
        invoiceAddressLine: s.invoiceAddressLine ?? '',
        invoiceFooterNote: s.invoiceFooterNote ?? 'Thanks for your visit',
        invoiceSignatureLabel: s.invoiceSignatureLabel ?? 'Authorised Signature',
        enableKeyboardBillingMode: s.enableKeyboardBillingMode === true,
        idleTimeoutMinutes: (s.idleTimeoutMinutes as number) ?? 15,
        maxLoginAttempts: (s.maxLoginAttempts as number) ?? 5,
      });
    }
  }, [config, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.shop_name.trim()) throw new Error('Shop name is required');
      await updateAppConfig({
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        gstin: form.gstin.trim() || null,
        drug_license_no: form.drug_license_no.trim() || null,
        address_line1: form.address_line1.trim() || null,
        city: form.city.trim() || null,
        settings: {
          ...(config?.settings ?? {}),
          invoiceHeaderLeft: form.invoiceHeaderLeft.trim(),
          invoiceHeaderRight: form.invoiceHeaderRight.trim(),
          invoiceWhatsappNumber: form.invoiceWhatsappNumber.trim(),
          invoiceStoreDisplayName: form.invoiceStoreDisplayName.trim() || form.shop_name.trim(),
          invoiceAddressLine: form.invoiceAddressLine.trim(),
          invoiceFooterNote: form.invoiceFooterNote.trim(),
          invoiceSignatureLabel: form.invoiceSignatureLabel.trim(),
          enableKeyboardBillingMode: form.enableKeyboardBillingMode,
          idleTimeoutMinutes: form.idleTimeoutMinutes,
          maxLoginAttempts: form.maxLoginAttempts,
        } as Record<string, unknown>,
      });
      await refreshConfig();
    },
    onSuccess: () => { toast.success('Settings saved'); setIsEditing(false); closePanel(); },
    onError: (err: any) => toast.error(err.message ?? 'Unable to save settings'),
  });

  const set = (key: keyof SettingsForm, value: any) => setForm((c) => ({ ...c, [key]: value }));

  const fieldClass = 'input text-sm py-1.5';

  // ── Row + Group render helpers ────────────────────────────────────────────────
  const renderRow = (id: string, icon: string, title: string, sub?: string, badge?: React.ReactNode, last = false) => (
    <button key={id} onClick={() => setActivePanel(id)} style={{
      display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
      padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
      borderBottom: last ? 'none' : '1px solid var(--surface-border)', textAlign: 'left' as const,
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.04))')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <span style={{ fontSize: '19px', width: '26px', textAlign: 'center' as const, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{title}</p>
        {sub && <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '1px 0 0' }}>{sub}</p>}
      </div>
      {badge}
      <span style={{ color: 'var(--text-tertiary)', fontSize: '17px', flexShrink: 0, marginLeft: '4px' }}>›</span>
    </button>
  );

  const renderGroup = (label: string, rows: React.ReactNode) => (
    <div className="card" style={{ overflow: 'hidden', padding: 0, borderRadius: '12px' }}>
      <p style={{ padding: '8px 16px 5px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: 'var(--text-tertiary)' }}>{label}</p>
      {rows}
    </div>
  );

  const badge = (text: string, color: string) => (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: color === 'green' ? '#dcfce7' : color === 'amber' ? '#fef3c7' : color === 'blue' ? '#dbeafe' : '#f1f5f9', color: color === 'green' ? '#15803d' : color === 'amber' ? '#92400e' : color === 'blue' ? '#1d4ed8' : '#64748b', flexShrink: 0 }}>{text}</span>
  );

  // ── Panel content ─────────────────────────────────────────────────────────────
  const renderPanelContent = () => {
    switch (activePanel) {

      case 'updates': return (
        <div className="space-y-3 p-5">
          {currentVersion && <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>Current version: v{currentVersion}</p>}
          {updateStatus === 'found' && (
            <div className="rounded-xl p-3" style={{ background: '#1e1b4b', border: '1px solid #4338ca' }}>
              <p className="text-indigo-200 font-semibold text-sm">🎉 New version v{updateVersion} is available!</p>
              <p className="text-indigo-400 text-xs mt-0.5">⚠️ App will close and relaunch. Do this when not billing a customer.</p>
            </div>
          )}
          {updateStatus === 'up-to-date' && (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#052e16', border: '1px solid #166534' }}>
              <span className="text-emerald-400">✅</span>
              <p className="text-emerald-300 text-sm font-medium">You're on the latest version.</p>
            </div>
          )}
          {updateStatus === 'installing' && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#1e1b4b', border: '1px solid #4338ca' }}>
              <div className="flex items-center justify-between">
                <p className="text-indigo-200 text-sm font-semibold">⬇️ Downloading v{updateVersion}…</p>
                {dlTotal > 0 && <span className="text-indigo-400 text-xs font-mono">{(dlDone/1024/1024).toFixed(1)} / {(dlTotal/1024/1024).toFixed(1)} MB</span>}
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.2)' }}>
                <div className="h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#6366f1,#818cf8)', width: dlTotal > 0 ? `${Math.min(100,(dlDone/dlTotal)*100).toFixed(1)}%` : '100%' }} />
              </div>
              <p className="text-indigo-400 text-xs">App will relaunch automatically when done.</p>
            </div>
          )}
          {updateStatus === 'found'
            ? <button onClick={handleInstallUpdate} className="btn-primary w-full">⬇️ Update & Relaunch</button>
            : <button onClick={handleCheckUpdate} disabled={updateStatus === 'checking' || updateStatus === 'installing'} className="btn-secondary w-full disabled:opacity-50">
                {updateStatus === 'checking' ? '⏳ Checking…' : '🔄 Check for Updates'}
              </button>
          }
        </div>
      );

      case 'cloudsync': return <div className="p-5"><CloudSyncSection /></div>;

      case 'appearance': return (
        <div className="p-5 space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{theme === 'dark' ? 'Switch to light for bright environments' : 'Switch to dark for low-light environments'}</p>
            </div>
            <button onClick={toggleTheme} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm" style={{ background: 'var(--accent)', color: '#111' }}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      );

      case 'shop': return (
        <div className="p-5 space-y-4">
          <div className="grid gap-3 grid-cols-2">
            {([
              { label: 'Shop Name *', key: 'shop_name' },
              { label: 'Owner Name', key: 'owner_name' },
              { label: 'Phone', key: 'phone' },
              { label: 'Email', key: 'email' },
              { label: 'GSTIN', key: 'gstin' },
              { label: 'Drug License No', key: 'drug_license_no' },
              { label: 'Address', key: 'address_line1' },
              { label: 'City', key: 'city' },
            ] as { label: string; key: keyof SettingsForm }[]).map(({ label, key }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <input className={fieldClass} value={form[key] as string} onChange={e => set(key, e.target.value)} />
              </div>
            ))}
          </div>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary w-full">
            {saveMutation.isPending ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      );

      case 'logo': return (
        <div className="p-5 space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Logo appears on invoices, salary slips, and printed documents.</p>
          {(config?.settings as any)?.logo_base64 ? (
            <div className="flex items-center gap-4">
              <img src={(config?.settings as any)?.logo_base64} alt="Logo" className="h-20 w-auto max-w-40 object-contain rounded-xl" style={{ background: 'var(--surface-2)', padding: '6px' }} />
              <button onClick={async () => { const s = { ...(config?.settings ?? {})}; delete (s as any).logo_base64; await updateAppConfig({ settings: s }); window.location.reload(); }}
                className="text-sm px-4 py-2 rounded-xl font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>Remove Logo</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer btn-secondary w-fit">
              📁 Upload Logo (PNG/JPG — max 200KB)
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                if (file.size > 200 * 1024) { toast.error('Image too large — max 200KB'); return; }
                const reader = new FileReader();
                reader.onload = async ev => { await updateAppConfig({ settings: { ...(config?.settings ?? {}), logo_base64: ev.target?.result } }); toast.success('Logo saved!'); window.location.reload(); };
                reader.readAsDataURL(file);
              }} />
            </label>
          )}
        </div>
      );

      case 'invoice': return (
        <div className="p-5 space-y-4">
          <div className="grid gap-3 grid-cols-2">
            {([
              { label: 'Store Display Name', key: 'invoiceStoreDisplayName' },
              { label: 'Address on Invoice', key: 'invoiceAddressLine' },
              { label: 'WhatsApp Number', key: 'invoiceWhatsappNumber' },
              { label: 'Header Left', key: 'invoiceHeaderLeft' },
              { label: 'Header Right', key: 'invoiceHeaderRight' },
              { label: 'Footer Note', key: 'invoiceFooterNote' },
              { label: 'Signature Label', key: 'invoiceSignatureLabel' },
            ] as { label: string; key: keyof SettingsForm }[]).map(({ label, key }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <input className={fieldClass} value={form[key] as string} onChange={e => set(key, e.target.value)} />
              </div>
            ))}
          </div>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary w-full">
            {saveMutation.isPending ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      );

      case 'billing': return (
        <div className="p-5 space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Keyboard Billing Mode</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Navigate POS entirely with keyboard — ideal for fast-paced counters</p>
            </div>
            <button type="button" onClick={() => set('enableKeyboardBillingMode', !form.enableKeyboardBillingMode)}
              style={{ width: '44px', height: '24px', borderRadius: '999px', background: form.enableKeyboardBillingMode ? '#16a34a' : '#94a3b8', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '3px', left: form.enableKeyboardBillingMode ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary w-full">
            {saveMutation.isPending ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      );

      case 'gst': return (
        <div className="p-5 space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{config?.settings?.enable_gst !== false ? '✅ GST Enabled' : '❌ GST Disabled'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{config?.settings?.enable_gst !== false ? 'GST is applied to all services and shown on bills' : 'All GST calculations are hidden from bills and totals'}</p>
            </div>
            <button onClick={async () => { const cur = config?.settings?.enable_gst !== false; await updateAppConfig({ settings: { ...(config?.settings ?? {}), enable_gst: !cur } }); await refreshConfig(); }}
              className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--accent)', color: 'var(--on-accent, #fff)' }}>
              {config?.settings?.enable_gst !== false ? 'Disable GST' : 'Enable GST'}
            </button>
          </div>
        </div>
      );

      case 'whatsapp': return <div className="p-5"><WhatsAppBusinessSection /></div>;

      case 'pinlock': return <div className="p-5"><SectionPinLockSection /></div>;

      case 'autolock': return (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Auto-lock after idle</p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>App will lock itself after this much inactivity. 0 = disabled.</p>
              <select className="input w-full" value={form.idleTimeoutMinutes} onChange={e => set('idleTimeoutMinutes', Number(e.target.value))}>
                <option value={0}>Disabled</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Max login attempts</p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Account locks for 30 min after this many wrong passwords.</p>
              <select className="input w-full" value={form.maxLoginAttempts} onChange={e => set('maxLoginAttempts', Number(e.target.value))}>
                <option value={3}>3 attempts</option>
                <option value={5}>5 attempts</option>
                <option value={10}>10 attempts</option>
              </select>
            </div>
          </div>
          <p className="text-xs rounded-xl p-3" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>🔒 When locked: app shows login screen. Your data stays safe on disk and is never deleted. If locked out, contact FrontStores support.</p>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary w-full">
            {saveMutation.isPending ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      );

      case 'password': return (
        <div className="p-5 space-y-5">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Current username: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{currentUsername || '—'}</span></p>
          <div className="space-y-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Change Username</p>
            <input className="input w-full" placeholder="New username (min 3 chars)" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
            <button onClick={handleChangeUsername} disabled={newUsername.trim().length < 3} className="btn-secondary w-full disabled:opacity-40">Update Username</button>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Change Password</p>
            <input className="input w-full" type="password" placeholder="Current password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <input className="input w-full" type="password" placeholder="New password (min 4 chars)" value={newPass} onChange={e => setNewPass(e.target.value)} />
            <input className="input w-full" type="password" placeholder="Confirm new password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
            <button onClick={handleChangePassword} disabled={!currentPass || !newPass || !confirmPass} className="btn-secondary w-full disabled:opacity-40">Change Password</button>
          </div>
        </div>
      );

      case 'staff': return <div className="p-5"><StaffLoginsSection tenantId={tenantId} /></div>;

      case 'backup': return (
        <div className="p-5 space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Export all your data. Store it on a USB drive or Google Drive.</p>
          <div className="grid grid-cols-1 gap-2">
            <button className="btn-secondary text-left" onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index'); const db = await getDb();
                const products  = await db.select('SELECT * FROM products WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const orders    = await db.select('SELECT * FROM orders WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const customers = await db.select('SELECT * FROM customers WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const expenses  = await db.select('SELECT * FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const khata     = await db.select('SELECT * FROM khata_entries WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const backup = { exported_at: new Date().toISOString(), shop: config?.shop_name, products, orders, customers, expenses, khata };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `frontstores_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
                await logExport(tenantId, 'full_backup_json', (orders as any[]).length);
                toast.success('Backup downloaded');
              } catch (e: any) { toast.error('Backup failed: ' + e?.message); }
            }}>↓ Download Backup (JSON)</button>
            <button className="btn-secondary text-left" onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index'); const db = await getDb();
                const orders = await db.select<any[]>('SELECT o.*, GROUP_CONCAT(oi.product_name || " x" || oi.quantity, "; ") as items FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.tenant_id = ? AND o.deleted_at IS NULL GROUP BY o.id ORDER BY o.order_date DESC', [tenantId]);
                const rows = [['Bill No','Date','Customer','Items','Total','Payment'], ...orders.map((o: any) => [o.bill_number, o.order_date?.slice(0,10), o.customer_name||'', o.items||'', o.total, o.payment_method])];
                const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`; a.click();
                await logExport(tenantId, 'orders_csv', orders.length); toast.success('Orders CSV downloaded');
              } catch (e: any) { toast.error('Export failed: ' + e?.message); }
            }}>↓ Export Orders (CSV)</button>
            <button className="btn-secondary text-left" onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index'); const db = await getDb();
                const today = new Date().toISOString().slice(0,10);
                const orders = await db.select<any[]>('SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE tenant_id = ? AND date(order_date,\'localtime\') = ? AND deleted_at IS NULL', [tenantId, today]);
                const o = orders[0];
                const msg = `📊 *Daily Report - ${config?.shop_name}*\n📅 ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}\n💰 Sales: ₹${Number(o?.revenue??0).toFixed(0)}\n🧾 Orders: ${o?.count??0}\n\n_Sent from FrontStores_`;
                await shareWhatsApp(msg);
              } catch (e: any) { toast.error('Could not open WhatsApp: ' + e?.message); }
            }}>📱 Share Report on WhatsApp</button>
            <button className="btn-secondary text-left" onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index'); const db = await getDb();
                const today = new Date().toISOString().slice(0,10);
                const orders = await db.select<any[]>('SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE tenant_id = ? AND date(order_date,\'localtime\') = ? AND deleted_at IS NULL', [tenantId, today]);
                const o = orders[0];
                const subject = encodeURIComponent(`Daily Report - ${config?.shop_name} - ${today}`);
                const body = encodeURIComponent(`Daily Report for ${config?.shop_name}\nDate: ${today}\nSales: ₹${Number(o?.revenue??0).toFixed(0)}\nOrders: ${o?.count??0}\n\nSent from FrontStores`);
                await shellOpen(`mailto:?subject=${subject}&body=${body}`);
              } catch (e: any) { toast.error('Could not open email: ' + e?.message); }
            }}>📧 Send Report via Email</button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>💡 Take a backup weekly. Your data is only on this computer.</p>
        </div>
      );

      case 'migrate': return (
        <div className="p-5 space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Moving to a new computer? Download a secure backup file (.fsbak) and copy it to your new machine. When you install FrontStores there, choose <strong>"Restore from backup"</strong> — all data will be restored instantly.</p>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Enter your login password to secure the file</label>
            <input ref={exportPassRef} type="password" value={exportPass} onChange={e => setExportPass(e.target.value)} placeholder="Your current login password" className="input w-full" />
          </div>
          <button className="btn-secondary w-full" disabled={exportPass.length < 4 || exportLoading} onClick={async () => {
            if (!tenantId || exportPass.length < 4) return;
            setExportLoading(true);
            try {
              const blob = await exportBackup(tenantId, exportPass); const a = document.createElement('a');
              a.href = URL.createObjectURL(blob); a.download = `frontstores_${config?.shop_name?.replace(/\s+/g,'_') ?? 'backup'}_${new Date().toISOString().slice(0,10)}.fsbak`; a.click();
              await logExport(tenantId, 'full_encrypted_backup', 1); toast.success('Backup file downloaded.'); setExportPass('');
            } catch (e: any) { toast.error('Export failed: ' + (e?.message ?? String(e))); } finally { setExportLoading(false); }
          }}>{exportLoading ? '⏳ Creating backup…' : '↓ Download Encrypted Backup (.fsbak)'}</button>
          <p className="text-xs rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24' }}>⚠ This file contains all your shop data. Keep it safe.</p>
        </div>
      );

      case 'audit': return (
        <div className="p-5">
          {(exportLogs?.length ?? 0) === 0
            ? <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No exports yet.</p>
            : <div className="space-y-2">
                {exportLogs?.map(log => (
                  <div key={log.id} className="card-strong flex items-center justify-between gap-4 p-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.export_type.replace(/_/g,' ')}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{log.row_count} rows</p>
                    </div>
                    <p className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>{new Date(log.exported_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                ))}
              </div>
          }
        </div>
      );

      default: return null;
    }
  };

  const panelTitles: Record<string, string> = {
    updates: '🔄 App Updates', cloudsync: '☁️ Cloud Sync', appearance: '🎨 Appearance',
    shop: '🏪 Shop Details', logo: '🖼️ Business Logo', invoice: '🧾 Invoice Template',
    billing: '⌨️ Billing Preferences', gst: '🧾 Tax / GST', whatsapp: '📱 WhatsApp Business',
    pinlock: '🔐 Section PIN Lock', autolock: '🔒 Auto-Lock', password: '🔑 Login & Password',
    staff: '👥 Staff Logins', backup: '💾 Data Backup', migrate: '🖥️ Switch Computer', audit: '📋 Export Audit Log',
  };

  // ── Inline status values for row subtitles ────────────────────────────────────
  const gstEnabled = config?.settings?.enable_gst !== false;
  const hasLogo = !!(config?.settings as any)?.logo_base64;
  const hasWaCreds = !!(config?.settings?.wa_phone_id && config?.settings?.wa_token);
  const isOwner = (sessionStorage.getItem('fs_logged_in_username') || 'owner') === 'owner';
  const idleLabel = form.idleTimeoutMinutes === 0 ? 'Auto-lock off' : `Lock after ${form.idleTimeoutMinutes} min`;

  return (
    <div className="page-shell page-stack">
      <PageIntro eyebrow="Settings" title="Settings" description="Tap any row to open and edit." />


      {/* ── Compact Apple-style grouped rows ───────────────────────────────────── */}
      {renderGroup('General', <>
        {renderRow('updates', '🔄', 'App Updates', currentVersion ? `v${currentVersion}${updateStatus === 'found' ? ' · Update available' : ''}` : 'Check for updates',
          updateStatus === 'found' ? badge('Update', 'blue') : undefined)}
        {renderRow('cloudsync', '☁️', 'Cloud Sync', undefined, undefined)}
        {renderRow('appearance', '🎨', 'Appearance', theme === 'dark' ? 'Dark Mode' : 'Light Mode', undefined, true)}
      </>)}

      {renderGroup('Shop', <>
        {renderRow('shop', '🏪', 'Shop Details', config?.shop_name || 'Not set')}
        {renderRow('logo', '🖼️', 'Business Logo', hasLogo ? 'Logo uploaded' : 'No logo')}
        {renderRow('invoice', '🧾', 'Invoice Template', 'Headers, footer, signature')}
        {renderRow('billing', '⌨️', 'Billing Preferences', form.enableKeyboardBillingMode ? 'Keyboard mode on' : 'Standard mode')}
        {renderRow('gst', '🏷️', 'Tax / GST', gstEnabled ? 'GST enabled' : 'GST disabled', undefined, true)}
      </>)}

      {renderGroup('Integrations', <>
        {renderRow('whatsapp', '📱', 'WhatsApp Business', hasWaCreds ? 'Connected' : 'Not set up',
          hasWaCreds ? badge('Connected', 'green') : undefined, true)}
      </>)}

      {renderGroup('Security', <>
        {renderRow('autolock', '🔒', 'Auto-Lock', idleLabel)}
        {renderRow('password', '🔑', 'Login & Password', `User: ${currentUsername || 'owner'}`)}
        {isOwner && renderRow('staff', '👥', 'Staff Logins', 'Manage staff accounts')}
        {config?.shop_type === 'carwash' && renderRow('pinlock', '🔐', 'Section PIN Lock', 'Restrict sections with PIN', undefined, true)}
      </>)}

      {renderGroup('Data', <>
        {renderRow('backup', '💾', 'Data Backup', 'JSON, CSV, WhatsApp report')}
        {renderRow('migrate', '🖥️', 'Switch Computer', 'Encrypted .fsbak file')}
        {renderRow('audit', '📋', 'Export Audit Log', `${exportLogs?.length ?? 0} export${exportLogs?.length === 1 ? '' : 's'}`, undefined, true)}
      </>)}

      {/* ── Slide-over panel ─────────────────────────────────────────────────── */}
      {activePanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <div onClick={closePanel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
          {/* Panel */}
          <div style={{ position: 'relative', width: '660px', maxWidth: '90vw', height: '100%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.4)' }}>
            {/* Sticky header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{panelTitles[activePanel] ?? 'Settings'}</h2>
              <button onClick={closePanel} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'var(--surface-2)', cursor: 'pointer', fontSize: '16px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {renderPanelContent()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// [all apps] [all tenants] — WhatsApp Business API settings section
function WhatsAppBusinessSection() {
  const { config, refreshConfig } = useAppStore();
  const [phoneId, setPhoneId] = useState((config?.settings?.wa_phone_id as string) ?? '');
  const [token, setToken]     = useState((config?.settings?.wa_token as string) ?? '');
  const [testing, setTesting] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [errMsg, setErrMsg]   = useState('');
  const hasCredentials = !!(config?.settings?.wa_phone_id && config?.settings?.wa_token);

  const handleSave = async () => {
    if (!phoneId.trim() || !token.trim()) { toast.error('Both fields are required'); return; }
    await updateAppConfig({ settings: { ...(config?.settings ?? {}), wa_phone_id: phoneId.trim(), wa_token: token.trim() } });
    await refreshConfig();
    toast.success('WhatsApp Business API credentials saved');
    setStatus('idle');
  };

  const handleTest = async () => {
    if (!phoneId.trim() || !token.trim()) { toast.error('Enter credentials first'); return; }
    setTesting(true); setStatus('idle');
    const result = await testWaCredentials(phoneId.trim(), token.trim());
    setTesting(false);
    if (result.ok) { setStatus('ok'); toast.success('✅ Connected! WhatsApp Business API is working'); }
    else { setStatus('error'); setErrMsg(result.error ?? 'Unknown error'); toast.error(`Connection failed: ${result.error}`); }
  };

  const handleRemove = async () => {
    if (!confirm('Remove WhatsApp Business API credentials? The app will fall back to WhatsApp Desktop.')) return;
    const s = { ...(config?.settings ?? {}) };
    delete s.wa_phone_id; delete s.wa_token;
    await updateAppConfig({ settings: s });
    await refreshConfig();
    setPhoneId(''); setToken(''); setStatus('idle');
    toast.success('Credentials removed');
  };

  return (
    <div className="card p-5" style={{ borderLeft: '4px solid #25d366' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="section-label">💬 WhatsApp Business API</p>
        {hasCredentials && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
            ✓ Connected
          </span>
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        When configured, bills are sent automatically after payment and broadcast messages work with one click.
        Get credentials from <strong>Meta Business → WhatsApp → API Setup</strong>.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone Number ID</label>
          <input value={phoneId} onChange={e => { setPhoneId(e.target.value); setStatus('idle'); }}
            placeholder="e.g. 123456789012345"
            className="input font-mono text-sm" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Found in Meta Business → WhatsApp → Getting Started</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Permanent Access Token</label>
          <input value={token} onChange={e => { setToken(e.target.value); setStatus('idle'); }}
            placeholder="EAAxxxxxxxxxxxxxxx…"
            type="password"
            className="input font-mono text-sm" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Generate a permanent token in Meta Business → System Users</p>
        </div>

        {status === 'error' && (
          <p className="text-xs font-medium" style={{ color: '#f87171' }}>❌ {errMsg}</p>
        )}
        {status === 'ok' && (
          <p className="text-xs font-medium" style={{ color: '#4ade80' }}>✅ API connection verified</p>
        )}

        <div className="flex gap-3 flex-wrap pt-1">
          <button onClick={handleTest} disabled={testing}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50">
            {testing ? 'Testing…' : '🔌 Test Connection'}
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save Credentials
          </button>
          {hasCredentials && (
            <button onClick={handleRemove}
              className="btn text-sm font-medium" style={{ color: '#f87171' }}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// [core] [all apps] [all tenants] — Owner adds staff logins (e.g. a biller); each
// request needs admin approval before that username/password can sign in. The
// password is hashed locally and never sent anywhere — only the username + a
// request id go up for approval.
function StaffLoginsSection({ tenantId }: { tenantId: string }) {
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffConfirm, setStaffConfirm]   = useState('');
  const [submitting, setSubmitting]       = useState(false);

  const queryClient = useQueryClient();
  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users', tenantId],
    queryFn: () => listStaffUsers(tenantId),
    enabled: !!tenantId,
  });
  const { data: cloudSync } = useQuery({
    queryKey: ['cloud-sync-status', tenantId],
    queryFn: () => getCloudSyncStatus(),
    enabled: !!tenantId,
  });
  const cloudSyncEnabled = !!cloudSync?.enabled;

  // Poll for approval status while this section is visible — so "⏳ Pending"
  // flips to "✓ Active" without the owner needing to reload.
  useEffect(() => {
    if (!tenantId) return;
    const refresh = () => refreshStaffUserApprovals(tenantId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['staff-users', tenantId] });
    });
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [tenantId, queryClient]);

  async function handleAddStaffUser() {
    if (staffPassword !== staffConfirm) { toast.error('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      const result = await requestStaffUser(tenantId, staffUsername, staffPassword);
      if (result.ok) {
        if (result.queued) {
          toast.success('Request saved — the server was unreachable but it will be sent automatically once available');
        } else {
          toast.success('✅ Request sent to admin — the login will work once approved');
        }
        setStaffUsername(''); setStaffPassword(''); setStaffConfirm('');
        queryClient.invalidateQueries({ queryKey: ['staff-users', tenantId] });
      } else {
        toast.error(result.error ?? 'Could not create staff login request');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(staff: StaffUser) {
    if (!confirm(`Remove staff login "${staff.username}"? They won't be able to sign in anymore.`)) return;
    await removeStaffUser(tenantId, staff.id);
    queryClient.invalidateQueries({ queryKey: ['staff-users', tenantId] });
    toast.success('Staff login removed');
  }

  function statusPill(status: StaffUser['status']) {
    if (status === 'approved') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">✓ Active</span>;
    if (status === 'rejected') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">✕ Rejected</span>;
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">⏳ Pending approval</span>;
  }

  return (
    <div className="card p-4 border-l-4 border-l-violet-500">
      <p className="section-label mb-1 text-violet-300">👥 Staff Logins</p>
      <p className="text-xs text-slate-400 mb-4">
        Add a username + password for staff (e.g. a biller). Each request is sent to FrontStores for approval —
        once approved, that person can sign in with their own credentials, including on a brand-new device
        (their login travels there via Cloud Sync). Their password stays local, just like yours.
      </p>

      {!cloudSyncEnabled && (
        <div className="card-strong border border-amber-800/50 bg-amber-950/30 p-3 mb-4 text-xs text-amber-300">
          ⚠️ Enable <span className="font-semibold">Cloud Sync</span> first (in the Cloud Sync card below) so staff logins
          can also work on other devices — that's how their credentials travel safely from this device to a new one.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <input className="input" placeholder="Username (min 3 chars)" value={staffUsername} onChange={e => setStaffUsername(e.target.value)} disabled={!cloudSyncEnabled} />
        <input className="input" type="password" placeholder="Password (min 4 chars)" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} disabled={!cloudSyncEnabled} />
        <input className="input" type="password" placeholder="Confirm password" value={staffConfirm} onChange={e => setStaffConfirm(e.target.value)} disabled={!cloudSyncEnabled} />
      </div>
      <button
        onClick={handleAddStaffUser}
        disabled={!cloudSyncEnabled || submitting || staffUsername.trim().length < 3 || staffPassword.length < 4}
        className="btn-secondary disabled:opacity-40"
      >
        {submitting ? 'Sending request…' : '➕ Request Staff Login'}
      </button>

      {(staffUsers?.length ?? 0) > 0 && (
        <div className="space-y-2 mt-5">
          {staffUsers!.map(staff => (
            <div key={staff.id} className="card-strong flex items-center justify-between gap-4 p-3 text-sm">
              <div>
                <p className="font-medium text-slate-200">{staff.username}</p>
                <p className="text-xs text-slate-500">
                  Requested {new Date(staff.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {staff.approved_at ? ` · approved ${new Date(staff.approved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {statusPill(staff.status)}
                {staff.status !== 'rejected' && (
                  <button onClick={() => handleRemove(staff)} className="text-xs text-rose-400 hover:text-rose-300">Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section PIN Lock ─────────────────────────────────────────────────────────
// [carwash] [all tenants] — lock individual sections behind a 6-digit PIN
// [carwash] [all tenants] — matches CARWASH_NAV_ITEMS exactly
const PIN_SECTIONS = [
  { key: 'pin_lock_dashboard',    label: 'Dashboard' },
  { key: 'pin_lock_jobs',         label: 'Job Cards' },
  { key: 'pin_lock_appointments', label: 'Appointments' },
  { key: 'pin_lock_inventory',    label: 'Inventory' },
  { key: 'pin_lock_customers',    label: 'Customers' },
  { key: 'pin_lock_reports',      label: 'Reports' },
  { key: 'pin_lock_broadcast',    label: 'Broadcast' },
  { key: 'pin_lock_attendance',   label: 'Attendance' },
  { key: 'pin_lock_setup',        label: 'Setup' },
];

function SectionPinLockSection() {
  // [carwash] [all tenants] — use refreshConfig (no isLoading flash) so page doesn't scroll to top on toggle
  const { config, refreshConfig } = useAppStore();
  const settings = config?.settings ?? {};
  const savedPin = (settings['pin_lock_code'] as string) ?? '';
  const hasPin = savedPin.length === 6;

  const [pinInput, setPinInput]       = useState('');
  const [pinConfirm, setPinConfirm]   = useState('');
  const [showSet, setShowSet]         = useState(false);
  const [pinError, setPinError]       = useState('');

  const anyLocked = PIN_SECTIONS.some(s => !!(settings[s.key] as boolean));

  const saveSettings = async (updates: Record<string, unknown>) => {
    await updateAppConfig({ settings: { ...settings, ...updates } });
    await refreshConfig();
  };

  const handleToggle = async (key: string, value: boolean) => {
    if (value && !hasPin) { toast.error('Set a PIN first before locking a section'); return; }
    await saveSettings({ [key]: value });
  };

  const handleSavePin = async () => {
    if (!/^\d{6}$/.test(pinInput)) { setPinError('PIN must be exactly 6 digits'); return; }
    if (pinInput !== pinConfirm) { setPinError('PINs do not match'); return; }
    await saveSettings({ pin_lock_code: pinInput });
    setPinInput(''); setPinConfirm(''); setPinError(''); setShowSet(false);
    toast.success('PIN saved');
  };

  const handleRemovePin = async () => {
    if (!confirm('Remove PIN? All section locks will be disabled.')) return;
    const updated: Record<string, unknown> = { pin_lock_code: '' };
    PIN_SECTIONS.forEach(s => { updated[s.key] = false; });
    await saveSettings(updated);
    toast.success('PIN removed');
  };

  return (
    <div className="card p-5" style={{ borderLeft: '4px solid #6366f1' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="section-label">🔒 Section PIN Lock</p>
        {hasPin && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#ede9fe', color: '#6d28d9' }}>PIN Set</span>}
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        Set a 6-digit PIN and choose which sections require it to open.
      </p>

      {/* PIN setup */}
      <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}>
        {!showSet ? (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {hasPin ? '●●●●●● (PIN is set)' : 'No PIN configured'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowSet(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#6366f1' }}>
                {hasPin ? 'Change PIN' : 'Set PIN'}
              </button>
              {hasPin && (
                <button onClick={handleRemovePin}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: '#dc2626' }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>New PIN (6 digits)</label>
                <input type="password" inputMode="numeric" maxLength={6} value={pinInput}
                  onChange={e => { setPinInput(e.target.value.replace(/\D/g,'')); setPinError(''); }}
                  placeholder="······" className="w-full rounded-lg border px-3 py-2 text-sm outline-none tracking-widest"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Confirm PIN</label>
                <input type="password" inputMode="numeric" maxLength={6} value={pinConfirm}
                  onChange={e => { setPinConfirm(e.target.value.replace(/\D/g,'')); setPinError(''); }}
                  placeholder="······" className="w-full rounded-lg border px-3 py-2 text-sm outline-none tracking-widest"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            {pinError && <p className="text-xs" style={{ color: '#dc2626' }}>{pinError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSavePin}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: '#6366f1' }}>Save PIN</button>
              <button onClick={() => { setShowSet(false); setPinInput(''); setPinConfirm(''); setPinError(''); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Section toggles */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Lock Sections</p>
        {PIN_SECTIONS.map(({ key, label }) => {
          const on = !!(settings[key] as boolean);
          return (
            <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: on ? 'rgba(99,102,241,0.07)' : 'var(--surface-2)' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: on ? '#6d28d9' : 'var(--text-secondary)' }}>🔒</span>
                <span className="text-sm font-medium" style={{ color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
              </div>
              <button onClick={() => handleToggle(key, !on)}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ background: on ? '#6366f1' : 'var(--surface-border)' }}>
                <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>
          );
        })}
      </div>

      {!hasPin && anyLocked && (
        <p className="text-xs mt-3" style={{ color: '#dc2626' }}>⚠️ Set a PIN above to activate the locks</p>
      )}
    </div>
  );
}

// ── Cloud Sync Section ────────────────────────────────────────────────────────
// [all apps] [all tenants] — simple Cloud Sync toggle: request → admin approval → silent auto-sync
function CloudSyncSection() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [requesting, setRequesting] = useState(false);

  const { data: syncStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['cloud-sync-status', tenantId],
    queryFn: () => refreshCloudSyncStatus(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  const enabled  = !!syncStatus?.enabled;
  const pending  = syncStatus?.requestStatus === 'pending';
  const rejected = syncStatus?.requestStatus === 'rejected';

  const lastSynced = syncStatus?.lastSyncedAt
    ? (() => {
        const diff = Math.round((Date.now() - new Date(syncStatus.lastSyncedAt).getTime()) / 60000);
        if (diff < 1) return 'just now';
        if (diff < 60) return `${diff} min ago`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
        return `${Math.floor(diff / 1440)}d ago`;
      })()
    : null;

  const handleToggle = async () => {
    if (enabled || requesting || pending) return;
    setRequesting(true);
    try {
      const result = await requestCloudSync(tenantId);
      if (!result.ok) { toast.error(result.error ?? 'Could not send request'); return; }
      toast.success('Request sent — we\'ll enable Cloud Sync for you shortly.');
      refetchStatus();
    } finally { setRequesting(false); }
  };

  // Toggle appearance
  const toggleOn = enabled || pending;
  const toggleColor = enabled ? '#16a34a' : pending ? '#d97706' : '#cbd5e1';

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: enabled ? 'rgba(22,163,74,0.12)' : 'rgba(14,165,233,0.10)' }}>
            <Cloud className="h-4 w-4" style={{ color: enabled ? '#16a34a' : '#0ea5e9' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              ☁️ Cloud Sync
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {enabled
                ? lastSynced ? `Active · last synced ${lastSynced}` : 'Active · syncing your data'
                : pending
                  ? 'Pending approval — we\'ll enable it shortly'
                  : rejected
                    ? 'Request not approved — tap to try again'
                    : 'Enable to sync data across all devices seamlessly'}
            </p>
          </div>
        </div>
        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={enabled || requesting}
          style={{
            width: '44px', height: '24px', borderRadius: '999px',
            background: toggleColor,
            border: 'none', cursor: enabled ? 'default' : 'pointer',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            opacity: requesting ? 0.6 : 1,
          }}>
          <span style={{
            position: 'absolute', top: '3px',
            left: toggleOn ? '23px' : '3px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {!enabled && !pending && (
        <p className="text-xs mt-3 pt-3" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--surface-border)' }}>
          Your data stays on your device at all times. Cloud Sync adds a silent background backup — if the internet or server goes down, your app keeps working locally and syncs automatically when the connection comes back.
        </p>
      )}
    </div>
  );
}
