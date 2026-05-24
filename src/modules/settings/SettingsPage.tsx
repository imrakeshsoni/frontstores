import { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { updateAppConfig } from '@/lib/db/config';
import { changePassword, changeUsername, getAuthUsername, getExportLogs, logExport } from '@/lib/db/auth';
import { exportBackup } from '@/lib/db/backup';
import { PageIntro } from '@/components/ui/PageIntro';
import { useTheme } from '@/lib/theme/useTheme';

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

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) { setUpdateStatus('up-to-date'); return; }
      setUpdateVersion(update.version);
      setUpdateStatus('found');
      toast.info(`Update v${update.version} found — installing…`, { duration: 6000 });
      setUpdateStatus('installing');
      await update.downloadAndInstall();
      toast.success('Update installed! Relaunching…', { duration: 3000 });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      setUpdateStatus('idle');
      toast.error('Update check failed. Please try again later.');
    }
  }, []);

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

  useEffect(() => {
    if (config) {
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
  }, [config]);

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
    onSuccess: () => toast.success('Settings saved'),
    onError: (err: any) => toast.error(err.message ?? 'Unable to save settings'),
  });

  const set = (key: keyof SettingsForm, value: any) => setForm((c) => ({ ...c, [key]: value }));

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Settings"
        title="Your store, your way."
        description="Update shop details, invoice template, and billing preferences."
        actions={
          <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        }
      />

      {/* Appearance */}
      <div className="card p-6">
        <p className="section-label mb-4">Appearance</p>
        <div className="flex items-center gap-4">
          <p className="text-sm font-medium text-slate-700">Theme</p>
          <button onClick={toggleTheme} className="btn-secondary flex items-center gap-2">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>

      {/* App Updates */}
      <div className="card p-6">
        <p className="section-label mb-1">App Updates</p>
        <p className="text-xs text-slate-400 mb-4">Updates only replace the app — your data, bills, and products are never touched.</p>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleCheckUpdate}
            disabled={updateStatus === 'checking' || updateStatus === 'installing'}
            className="btn-secondary disabled:opacity-50"
          >
            {updateStatus === 'checking' && '⏳ Checking…'}
            {updateStatus === 'installing' && '⬇️ Installing…'}
            {(updateStatus === 'idle' || updateStatus === 'found') && '🔄 Check for Updates'}
            {updateStatus === 'up-to-date' && '✅ You\'re up to date'}
          </button>
          {updateStatus === 'up-to-date' && (
            <p className="text-sm text-emerald-400">FrontStores is up to date.</p>
          )}
          {updateStatus === 'found' && (
            <p className="text-sm text-indigo-400">v{updateVersion} found — installing…</p>
          )}
        </div>
      </div>

      {/* Shop details */}
      <div className="card p-6">
        <p className="section-label mb-4">Shop Details</p>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Shop Name *', key: 'shop_name' as const },
            { label: 'Owner Name', key: 'owner_name' as const },
            { label: 'Phone', key: 'phone' as const },
            { label: 'Email', key: 'email' as const },
            { label: 'GSTIN', key: 'gstin' as const },
            { label: 'Drug License No', key: 'drug_license_no' as const },
            { label: 'Address Line 1', key: 'address_line1' as const },
            { label: 'City', key: 'city' as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
              <input className="input" value={form[key] as string} onChange={(e) => set(key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Invoice template */}
      <div className="card p-6">
        <p className="section-label mb-4">Invoice Template</p>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Store Display Name', key: 'invoiceStoreDisplayName' as const },
            { label: 'Address Line (on invoice)', key: 'invoiceAddressLine' as const },
            { label: 'WhatsApp Number', key: 'invoiceWhatsappNumber' as const, hint: 'Used on invoice header' },
            { label: 'Header Left', key: 'invoiceHeaderLeft' as const },
            { label: 'Header Right', key: 'invoiceHeaderRight' as const },
            { label: 'Footer Note', key: 'invoiceFooterNote' as const },
            { label: 'Signature Label', key: 'invoiceSignatureLabel' as const },
          ].map(({ label, key, hint }) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
              <input className="input" value={form[key] as string} onChange={(e) => set(key, e.target.value)} />
              {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Billing preferences */}
      <div className="card p-6">
        <p className="section-label mb-4">Billing Preferences</p>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Keyboard Billing Mode</p>
            <p className="text-xs text-slate-500 mt-0.5">Navigate POS entirely with keyboard — ideal for fast-paced counters</p>
          </div>
          <button
            type="button"
            onClick={() => set('enableKeyboardBillingMode', !form.enableKeyboardBillingMode)}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${form.enableKeyboardBillingMode ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.enableKeyboardBillingMode ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Data Backup */}
      <div className="card p-6">
        <p className="section-label mb-1">Data Backup</p>
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
        </div>
        <p className="text-xs text-slate-500 mt-3">💡 Tip: Take a backup weekly and store it somewhere safe. Your data is only on this computer.</p>
      </div>

      {/* Switch to New Computer */}
      <div className="card p-6 border border-amber-500/20">
        <p className="section-label mb-1">🖥️ Switch to New Computer</p>
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
      <div className="card p-6">
        <p className="section-label mb-1">Security — Auto-Lock & Login Protection</p>
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
      <div className="card p-6">
        <p className="section-label mb-1">Security — Login & Password</p>
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
      <div className="card p-6">
        <p className="section-label mb-1">Export Audit Log</p>
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

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
