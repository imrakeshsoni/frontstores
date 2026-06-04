import { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sun, Moon } from 'lucide-react';
import { shareWhatsApp, testWaCredentials } from '@/lib/whatsapp';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { useAppStore } from '@/app/store/app.store';
import { updateAppConfig } from '@/lib/db/config';
import { changePassword, changeUsername, getAuthUsername, getExportLogs, logExport } from '@/lib/db/auth';
import { exportBackup } from '@/lib/db/backup';
import { PageIntro } from '@/components/ui/PageIntro';
import { useTheme } from '@/lib/theme/useTheme';
import { reportError } from '@/lib/errorReporter';

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
  const { loadConfig } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const tenantId = config?.tenant_id ?? '';

  // Update check state
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'found' | 'installing' | 'up-to-date'>('idle');
  const [updateVersion, setUpdateVersion] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState('');

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
      setUpdateStatus('idle');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('up to date') || msg.includes('UpToDate') || msg.includes('204')) {
        setUpdateStatus('up-to-date');
      } else {
        toast.error(`Update check failed: ${msg}`);
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
    try {
      await pendingUpdate.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      setUpdateStatus('found');
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
      await loadConfig();
    },
    onSuccess: () => { toast.success('Settings saved'); setIsEditing(false); },
    onError: (err: any) => toast.error(err.message ?? 'Unable to save settings'),
  });

  const set = (key: keyof SettingsForm, value: any) => setForm((c) => ({ ...c, [key]: value }));

  const fieldClass = `input text-sm py-1.5 ${!isEditing ? 'opacity-70 cursor-pointer' : ''}`;

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Settings"
        title="Your store, your way."
        description="Update shop details, invoice template, and billing preferences."
        actions={
          <button
            className={isEditing ? 'btn-primary' : 'btn-secondary'}
            onClick={() => isEditing ? saveMutation.mutate() : setIsEditing(true)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : isEditing ? '💾 Save Settings' : '✏️ Edit Settings'}
          </button>
        }
      />

      {/* App Updates — indigo tint */}
      <div className="card p-4 border-l-4 border-l-indigo-500">
        <div className="flex items-center justify-between mb-1">
          <p className="section-label text-indigo-300">🔄 App Updates</p>
          {currentVersion && <span className="text-xs text-slate-500 font-mono">v{currentVersion}</span>}
        </div>
        <p className="text-xs text-slate-400 mb-3">Updates only replace the app — your data, bills, and products are never touched.</p>
        {updateStatus === 'found' && (
          <div className="mb-3 bg-indigo-950 border border-indigo-700 rounded-xl p-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-indigo-200 font-semibold text-sm">🎉 New version v{updateVersion} available</p>
              <p className="text-indigo-400 text-xs mt-0.5">⚠️ App will close and relaunch. Do this when not billing.</p>
            </div>
            <button onClick={handleInstallUpdate} className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors">
              Update & Relaunch
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleCheckUpdate} disabled={updateStatus === 'checking' || updateStatus === 'installing' || updateStatus === 'found'} className="btn-secondary disabled:opacity-50">
            {updateStatus === 'checking' ? '⏳ Checking…' : updateStatus === 'installing' ? '⬇️ Installing…' : updateStatus === 'found' ? '✅ Update found' : updateStatus === 'up-to-date' ? '✅ Up to date' : '🔄 Check for Updates'}
          </button>
          {updateStatus === 'up-to-date' && <p className="text-sm text-emerald-400">FrontStores is up to date.</p>}
        </div>
      </div>

      {/* Shop Details — blue tint */}
      <div className="card p-4 border-l-4 border-l-blue-500">
        <p className="section-label mb-3 text-blue-300">🏪 Shop Details</p>
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
              <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
              <input
                className={fieldClass}
                value={form[key] as string}
                onChange={(e) => set(key, e.target.value)}
                readOnly={!isEditing}
                onClick={() => { if (!isEditing) setIsEditing(true); }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Business Logo */}
      <div className="card p-4 border-l-4 border-l-amber-500">
        <p className="section-label mb-3 text-amber-300">🖼️ Business Logo</p>
        <p className="text-xs text-slate-400 mb-3">Logo appears on invoices, salary slips, and printed documents.</p>
        <div className="flex items-center gap-4">
          {(config?.settings as any)?.logo_base64 ? (
            <div className="flex items-center gap-3">
              <img
                src={(config?.settings as any)?.logo_base64}
                alt="Logo"
                className="h-16 w-auto max-w-32 object-contain rounded-lg"
                style={{ background: 'var(--surface-2)', padding: '4px' }}
              />
              <button
                onClick={async () => {
                  const newSettings = { ...(config?.settings ?? {}), logo_base64: undefined };
                  delete (newSettings as any).logo_base64;
                  await updateAppConfig({ settings: newSettings });
                  window.location.reload();
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#fee2e2', color: '#dc2626' }}>
                Remove Logo
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm cursor-pointer btn-secondary">
              📁 Upload Logo (PNG, JPG — max 200KB)
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 200 * 1024) { toast.error('Image too large — max 200KB'); return; }
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    const base64 = ev.target?.result as string;
                    await updateAppConfig({ settings: { ...(config?.settings ?? {}), logo_base64: base64 } });
                    toast.success('Logo saved!');
                    window.location.reload();
                  };
                  reader.readAsDataURL(file);
                }} />
            </label>
          )}
        </div>
      </div>

      {/* Invoice Template — emerald tint */}
      <div className="card p-4 border-l-4 border-l-emerald-500">
        <p className="section-label mb-3 text-emerald-300">🧾 Invoice Template</p>
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
              <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
              <input
                className={fieldClass}
                value={form[key] as string}
                onChange={(e) => set(key, e.target.value)}
                readOnly={!isEditing}
                onClick={() => { if (!isEditing) setIsEditing(true); }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Billing Preferences — violet tint */}
      <div className="card p-4 border-l-4 border-l-violet-500">
        <p className="section-label mb-3 text-violet-300">⌨️ Billing Preferences</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">Keyboard Billing Mode</p>
            <p className="text-xs text-slate-500 mt-0.5">Navigate POS entirely with keyboard — ideal for fast-paced counters</p>
          </div>
          <button
            type="button"
            onClick={() => set('enableKeyboardBillingMode', !form.enableKeyboardBillingMode)}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${form.enableKeyboardBillingMode ? 'bg-emerald-500' : 'bg-slate-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.enableKeyboardBillingMode ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="card p-5" style={{ borderLeft: '4px solid var(--accent)' }}>
        <p className="section-label mb-4">🎨 Appearance</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {theme === 'dark' ? 'Switch to light for bright environments' : 'Switch to dark for low-light environments'}
            </p>
          </div>
          <button onClick={toggleTheme}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: 'var(--accent)', color: '#111' }}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </div>

      {/* GST Toggle */}
      <div className="card p-5" style={{ borderLeft: '4px solid var(--accent)' }}>
        <p className="section-label mb-4">🧾 Tax / GST Settings</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {config?.settings?.enable_gst !== false ? '✅ GST Enabled' : '❌ GST Disabled'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {config?.settings?.enable_gst !== false
                ? 'GST is applied to all services and shown on bills'
                : 'All GST calculations are hidden from bills and totals'}
            </p>
          </div>
          <button
            onClick={async () => {
              const currentlyEnabled = config?.settings?.enable_gst !== false;
              const newSettings = { ...(config?.settings ?? {}), enable_gst: !currentlyEnabled };
              await updateAppConfig({ settings: newSettings });
              await loadConfig();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: 'var(--accent)', color: 'var(--on-accent, #fff)' }}>
            {config?.settings?.enable_gst !== false ? 'Disable GST' : 'Enable GST'}
          </button>
        </div>
      </div>

      {/* WhatsApp Business API */}
      <WhatsAppBusinessSection />

      {/* Data Backup — amber tint */}
      <div className="card p-4 border-l-4 border-l-amber-500">
        <p className="section-label mb-1 text-amber-300">💾 Data Backup</p>
        <p className="text-xs text-slate-400 mb-4">Export all your data as a backup file. Store it on a USB drive or Google Drive.</p>
        <div className="flex gap-3 flex-wrap">
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index');
                const db = await getDb();
                const products  = await db.select('SELECT * FROM products WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const orders    = await db.select('SELECT * FROM orders WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const customers = await db.select('SELECT * FROM customers WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const expenses  = await db.select('SELECT * FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const khata     = await db.select('SELECT * FROM khata_entries WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
                const backup = { exported_at: new Date().toISOString(), shop: config?.shop_name, products, orders, customers, expenses, khata };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `frontstores_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                await logExport(tenantId, 'full_backup_json', (orders as any[]).length);
                toast.success('Backup downloaded');
              } catch (e: any) {
                toast.error('Backup failed: ' + e?.message);
              }
            }}
          >
            ↓ Download Backup (JSON)
          </button>
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index');
                const db = await getDb();
                const orders = await db.select<any[]>('SELECT o.*, GROUP_CONCAT(oi.product_name || " x" || oi.quantity, "; ") as items FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.tenant_id = ? AND o.deleted_at IS NULL GROUP BY o.id ORDER BY o.order_date DESC', [tenantId]);
                const rows = [['Bill No', 'Date', 'Customer', 'Items', 'Total', 'Payment'], ...orders.map((o: any) => [o.bill_number, o.order_date?.slice(0, 10), o.customer_name || '', o.items || '', o.total, o.payment_method])];
                const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                await logExport(tenantId, 'orders_csv', orders.length);
                toast.success('Orders CSV downloaded');
              } catch (e: any) {
                toast.error('Export failed: ' + e?.message);
              }
            }}
          >
            ↓ Export Orders (CSV)
          </button>
          {/* [platform] [all tenants] — WhatsApp and email share */}
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index');
                const db = await getDb();
                const today = new Date().toISOString().slice(0, 10);
                const orders = await db.select<any[]>(
                  `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE tenant_id = ? AND date(order_date,'localtime') = ? AND deleted_at IS NULL`,
                  [tenantId, today]
                );
                const o = orders[0];
                const msg = `📊 *Daily Report - ${config?.shop_name}*\n📅 ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}\n💰 Sales: ₹${Number(o?.revenue??0).toFixed(0)}\n🧾 Orders: ${o?.count??0}\n\n_Sent from FrontStores_`;
                await shareWhatsApp(msg);
              } catch (e: any) { toast.error('Could not open WhatsApp: ' + e?.message); }
            }}
          >
            📱 Share Report on WhatsApp
          </button>
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                const { getDb } = await import('@/lib/db/index');
                const db = await getDb();
                const today = new Date().toISOString().slice(0, 10);
                const orders = await db.select<any[]>(
                  `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue FROM orders WHERE tenant_id = ? AND date(order_date,'localtime') = ? AND deleted_at IS NULL`,
                  [tenantId, today]
                );
                const o = orders[0];
                const subject = encodeURIComponent(`Daily Report - ${config?.shop_name} - ${today}`);
                const body = encodeURIComponent(`Daily Report for ${config?.shop_name}\nDate: ${today}\nSales: ₹${Number(o?.revenue??0).toFixed(0)}\nOrders: ${o?.count??0}\n\nSent from FrontStores`);
                await shellOpen(`mailto:?subject=${subject}&body=${body}`);
              } catch (e: any) { toast.error('Could not open email: ' + e?.message); }
            }}
          >
            📧 Send Report via Email
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">💡 Tip: Take a backup weekly and store it somewhere safe. Your data is only on this computer.</p>
      </div>

      {/* Switch to New Computer */}
      <div className="card p-4 border-l-4 border-l-orange-500">
        <p className="section-label mb-1 text-orange-300">🖥️ Switch to New Computer</p>
        <p className="text-xs text-slate-400 mb-4">
          Moving to a new computer? Download a secure backup file (.fsbak) and copy it to your new machine.
          When you install FrontStores there, choose <strong className="text-slate-300">"Restore from backup"</strong> — all your data, products, bills, and customers will be restored instantly.
        </p>
        <div className="flex flex-col gap-3 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Enter your login password to secure the file</label>
            <input
              ref={exportPassRef}
              type="password"
              value={exportPass}
              onChange={e => setExportPass(e.target.value)}
              placeholder="Your current login password"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <button
            className="btn-secondary"
            disabled={exportPass.length < 4 || exportLoading}
            onClick={async () => {
              if (!tenantId || exportPass.length < 4) return;
              setExportLoading(true);
              try {
                const blob = await exportBackup(tenantId, exportPass);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `frontstores_${config?.shop_name?.replace(/\s+/g, '_') ?? 'backup'}_${new Date().toISOString().slice(0, 10)}.fsbak`;
                a.click();
                await logExport(tenantId, 'full_encrypted_backup', 1);
                toast.success('Backup file downloaded. Copy it to a USB drive or Google Drive.');
                setExportPass('');
              } catch (e: any) {
                toast.error('Export failed: ' + (e?.message ?? String(e)));
              } finally {
                setExportLoading(false);
              }
            }}
          >
            {exportLoading ? '⏳ Creating backup…' : '↓ Download Encrypted Backup (.fsbak)'}
          </button>
        </div>
        <p className="text-xs text-amber-400/80 mt-3">⚠ This file contains all your shop data. Keep it safe — anyone with this file and your password can access your data.</p>
      </div>

      {/* Security — Lock settings */}
      <div className="card p-4 border-l-4 border-l-red-500">
        <p className="section-label mb-1 text-red-300">🔒 Security — Auto-Lock & Login Protection</p>
        <p className="text-xs text-slate-400 mb-5">Protect your data when you step away from the computer.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Idle timeout */}
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">Auto-lock after idle</p>
            <p className="text-xs text-slate-500 mb-3">App will lock itself after this much inactivity. 0 = disabled.</p>
            <select
              className="input w-full"
              value={form.idleTimeoutMinutes}
              onChange={e => set('idleTimeoutMinutes', Number(e.target.value))}
            >
              <option value={0}>Disabled</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          {/* Max login attempts */}
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">Max login attempts</p>
            <p className="text-xs text-slate-500 mb-3">Account locks for 30 min after this many wrong passwords.</p>
            <select
              className="input w-full"
              value={form.maxLoginAttempts}
              onChange={e => set('maxLoginAttempts', Number(e.target.value))}
            >
              <option value={3}>3 attempts</option>
              <option value={5}>5 attempts</option>
              <option value={10}>10 attempts</option>
            </select>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-800/60 rounded-xl text-xs text-slate-400">
          🔒 When locked: app shows login screen. Your data stays safe on disk and is never deleted.
          If you get locked out, contact FrontStores support to get an unlock code.
        </div>
      </div>

      {/* Security — Login & Password */}
      <div className="card p-4 border-l-4 border-l-pink-500">
        <p className="section-label mb-1 text-pink-300">🔑 Security — Login & Password</p>
        <p className="text-xs text-slate-400 mb-4">Your password is stored only on this device and never sent anywhere.</p>
        <p className="text-xs text-slate-500 mb-5">Current username: <span className="font-semibold text-slate-300">{currentUsername || '—'}</span></p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Change Username</p>
            <input className="input w-full" placeholder="New username (min 3 chars)" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
            <button onClick={handleChangeUsername} disabled={newUsername.trim().length < 3} className="btn-secondary w-full disabled:opacity-40">
              Update Username
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Change Password</p>
            <input className="input w-full" type="password" placeholder="Current password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
            <input className="input w-full" type="password" placeholder="New password (min 4 chars)" value={newPass} onChange={e => setNewPass(e.target.value)} />
            <input className="input w-full" type="password" placeholder="Confirm new password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
            <button onClick={handleChangePassword} disabled={!currentPass || !newPass || !confirmPass} className="btn-secondary w-full disabled:opacity-40">
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Export Audit Log */}
      <div className="card p-4 border-l-4 border-l-teal-500">
        <p className="section-label mb-1 text-teal-300">📋 Export Audit Log</p>
        <p className="text-xs text-slate-400 mb-4">Every backup and CSV export is recorded here with a timestamp.</p>
        {(exportLogs?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">No exports yet.</p>
        ) : (
          <div className="space-y-2">
            {exportLogs?.map(log => (
              <div key={log.id} className="card-strong flex items-center justify-between gap-4 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-200 capitalize">{log.export_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-500">{log.row_count} rows</p>
                </div>
                <p className="text-xs text-slate-400 shrink-0">{new Date(log.exported_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// [all apps] [all tenants] — WhatsApp Business API settings section
function WhatsAppBusinessSection() {
  const { config, loadConfig } = useAppStore();
  const [phoneId, setPhoneId] = useState((config?.settings?.wa_phone_id as string) ?? '');
  const [token, setToken]     = useState((config?.settings?.wa_token as string) ?? '');
  const [testing, setTesting] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [errMsg, setErrMsg]   = useState('');
  const hasCredentials = !!(config?.settings?.wa_phone_id && config?.settings?.wa_token);

  const handleSave = async () => {
    if (!phoneId.trim() || !token.trim()) { toast.error('Both fields are required'); return; }
    await updateAppConfig({ settings: { ...(config?.settings ?? {}), wa_phone_id: phoneId.trim(), wa_token: token.trim() } });
    await loadConfig();
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
    await loadConfig();
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
