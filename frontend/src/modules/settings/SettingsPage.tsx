import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sun, Moon, Download, UploadCloud, ShieldAlert, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { NAV_ITEMS } from '@/components/layout/AppLayout';
import { PageIntro } from '@/components/ui/PageIntro';
import { useTheme } from '@/lib/theme/useTheme';

type SettingsForm = {
  tenantName: string;
  logoDataUrl: string;
  plan: string;
  currency: string;
  timezone: string;
  enableMenuPin: boolean;
  menuPin: string;
  protectedMenus: string[];
  shopName: string;
  shopType: string;
  phone: string;
  gstNumber: string;
  addressLine1: string;
  city: string;
  invoiceDlNumbers: string;
  invoiceHeaderLeft: string;
  invoiceHeaderRight: string;
  invoiceWhatsappNumber: string;
  invoiceStoreDisplayName: string;
  invoiceAddressLine: string;
  invoiceFooterNote: string;
  invoiceSignatureLabel: string;
  waPhoneNumberId: string;
  waAccessToken: string;
};

const emptyForm: SettingsForm = {
  tenantName: '',
  logoDataUrl: '',
  plan: 'starter',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  enableMenuPin: false,
  menuPin: '',
  protectedMenus: [],
  shopName: '',
  shopType: '',
  phone: '',
  gstNumber: '',
  addressLine1: '',
  city: '',
  invoiceDlNumbers: '',
  invoiceHeaderLeft: 'Chemist & Druggist',
  invoiceHeaderRight: 'Cash/Credit Memo',
  invoiceWhatsappNumber: '',
  invoiceStoreDisplayName: '',
  invoiceAddressLine: '',
  invoiceFooterNote: 'Thanks',
  invoiceSignatureLabel: 'Signature',
  waPhoneNumberId: '',
  waAccessToken: '',
};

export function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const [isExporting, setIsExporting] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiClient.get('/api/core/backup/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `frontstores-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded successfully');
    } catch {
      toast.error('Failed to generate backup');
    } finally {
      setIsExporting(false);
    }
  };

  const restoreMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/api/core/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      const total = Object.values(data.restored as Record<string, number>).reduce((a, b) => a + b, 0);
      toast.success(`Restore complete — ${total} records restored`);
      setRestoreConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Restore failed');
      setRestoreConfirm(false);
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings-context'],
    queryFn: () => apiClient.get('/api/core/context/settings').then((r) => r.data.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        tenantName: data.tenant?.name ?? '',
        plan: data.tenant?.plan ?? 'starter',
        currency: data.tenant?.settings?.currency ?? 'INR',
        timezone: data.tenant?.settings?.timezone ?? 'Asia/Kolkata',
        enableMenuPin:
          data.tenant?.settings?.enableMenuPin === true ||
          data.tenant?.settings?.enableDashboardPin === true,
        menuPin: data.tenant?.settings?.menuPin ?? data.tenant?.settings?.dashboardPin ?? '',
        protectedMenus: Array.isArray(data.tenant?.settings?.protectedMenus)
          ? data.tenant.settings.protectedMenus
          : data.tenant?.settings?.enableDashboardPin
            ? ['dashboard']
            : [],
        shopName: data.shop?.name ?? '',
        shopType: data.shop?.type ?? '',
        phone: data.shop?.phone ?? '',
        gstNumber: data.shop?.gst_number ?? '',
        addressLine1: data.shop?.address?.line1 ?? '',
        city: data.shop?.address?.city ?? '',
        invoiceDlNumbers: data.shop?.settings?.invoiceTemplate?.dlNumbers ?? '',
        invoiceHeaderLeft:
          data.shop?.settings?.invoiceTemplate?.headerLeft ?? 'Chemist & Druggist',
        invoiceHeaderRight:
          data.shop?.settings?.invoiceTemplate?.headerRight ?? 'Cash/Credit Memo',
        invoiceWhatsappNumber: data.shop?.settings?.invoiceTemplate?.whatsappNumber ?? '',
        invoiceStoreDisplayName:
          data.shop?.settings?.invoiceTemplate?.storeDisplayName ?? data.shop?.name ?? '',
        invoiceAddressLine:
          data.shop?.settings?.invoiceTemplate?.addressLine ??
          [data.shop?.address?.line1, data.shop?.address?.city].filter(Boolean).join(', '),
        invoiceFooterNote: data.shop?.settings?.invoiceTemplate?.footerNote ?? 'Thanks',
        invoiceSignatureLabel:
          data.shop?.settings?.invoiceTemplate?.signatureLabel ?? 'Signature',
        logoDataUrl: data.shop?.settings?.logoDataUrl ?? '',
        waPhoneNumberId: data.shop?.settings?.whatsapp?.phoneNumberId ?? '',
        waAccessToken: data.shop?.settings?.whatsapp?.accessToken ?? '',
      });
      setIsEditing(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (form.enableMenuPin && !/^\d{4}$/.test(form.menuPin.trim())) {
        throw new Error('Menu PIN must be exactly 4 digits');
      }

      if (form.enableMenuPin && form.protectedMenus.length === 0) {
        throw new Error('Select at least one menu to protect');
      }

      return apiClient.put('/api/core/context/settings', {
        tenantName: form.tenantName.trim(),
        plan: form.plan,
        tenantSettings: {
          currency: form.currency.trim(),
          timezone: form.timezone.trim(),
          enableMenuPin: form.enableMenuPin,
          menuPin: form.enableMenuPin ? form.menuPin.trim() : '',
          protectedMenus: form.enableMenuPin ? form.protectedMenus : [],
          enableDashboardPin: false,
          dashboardPin: '',
        },
        shopName: form.shopName.trim(),
        shopType: form.shopType.trim(),
        phone: form.phone.trim(),
        gstNumber: form.gstNumber.trim(),
        address: {
          line1: form.addressLine1.trim(),
          city: form.city.trim(),
        },
        shopSettings: {
          invoiceTemplate: {
            dlNumbers: form.invoiceDlNumbers.trim(),
            headerLeft: form.invoiceHeaderLeft.trim(),
            headerRight: form.invoiceHeaderRight.trim(),
            whatsappNumber: form.invoiceWhatsappNumber.trim(),
            storeDisplayName: form.invoiceStoreDisplayName.trim(),
            addressLine: form.invoiceAddressLine.trim(),
            footerNote: form.invoiceFooterNote.trim(),
            signatureLabel: form.invoiceSignatureLabel.trim(),
          },
          whatsapp: {
            phoneNumberId: form.waPhoneNumberId.trim(),
            accessToken: form.waAccessToken.trim(),
          },
        },
      });
    },
    onSuccess: () => {
      toast.success('Settings updated');
      setIsEditing(false);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Unable to update settings');
    },
  });

  return (
    <div className="page-shell page-stack">
      <PageIntro
        eyebrow="Settings"
        title="Store configuration is now functional."
        description="Update tenant and shop settings without changing the existing page structure, keeping the app ready for real operational use."
      />

      <div className="card p-6 md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="section-label">Tenant</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Business Name</label>
            <input className="input" value={form.tenantName} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, tenantName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Plan</label>
            <select className="input" value={form.plan} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, plan: e.target.value }))}>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Currency</label>
            <input className="input" value={form.currency} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Timezone</label>
            <input className="input" value={form.timezone} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, timezone: e.target.value }))} />
          </div>
          <div className="md:col-span-2 mt-4">
            <p className="section-label">Shop</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Shop Name</label>
            <input className="input" value={form.shopName} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, shopName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Shop Type</label>
            <input className="input" value={form.shopType} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, shopType: e.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
            <input className="input" value={form.phone} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">GST Number</label>
            <input className="input" value={form.gstNumber} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, gstNumber: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Address Line 1</label>
            <input className="input" value={form.addressLine1} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, addressLine1: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">City</label>
            <input className="input" value={form.city} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))} />
          </div>

          <div className="md:col-span-2 mt-4">
            <p className="section-label">Medical Invoice Template</p>
          </div>
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-sm text-slate-500">
              These details are used on the invoice sheet shown after payment for medical stores.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Invoice Shop Name</label>
                <input className="input" value={form.invoiceStoreDisplayName} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceStoreDisplayName: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">WhatsApp Number</label>
                <input className="input" value={form.invoiceWhatsappNumber} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceWhatsappNumber: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">DL Numbers</label>
                <textarea className="input min-h-[96px]" value={form.invoiceDlNumbers} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceDlNumbers: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Invoice Address Line</label>
                <input className="input" value={form.invoiceAddressLine} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceAddressLine: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Header Left Label</label>
                <input className="input" value={form.invoiceHeaderLeft} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceHeaderLeft: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Header Right Label</label>
                <input className="input" value={form.invoiceHeaderRight} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceHeaderRight: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Footer Note</label>
                <input className="input" value={form.invoiceFooterNote} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceFooterNote: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Signature Label</label>
                <input className="input" value={form.invoiceSignatureLabel} disabled={!isEditing} onChange={(e) => setForm((current) => ({ ...current, invoiceSignatureLabel: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* ── WhatsApp Business API ── */}
          <div className="md:col-span-2 mt-4">
            <p className="section-label">WhatsApp Business API</p>
          </div>
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5 space-y-5">
            <div className="flex items-start gap-3">
              {form.waPhoneNumberId && form.waAccessToken ? (
                <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  {form.waPhoneNumberId && form.waAccessToken ? 'WhatsApp is configured — invoice sending is active' : 'WhatsApp not configured'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Get your credentials from <strong>Meta Business Manager → WhatsApp → API Setup</strong>. Each store uses its own WhatsApp Business number.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number ID</label>
                <input
                  className="input font-mono text-sm"
                  placeholder="e.g. 123456789012345"
                  value={form.waPhoneNumberId}
                  disabled={!isEditing}
                  onChange={(e) => setForm((f) => ({ ...f, waPhoneNumberId: e.target.value }))}
                />
                <p className="mt-1 text-xs text-slate-400">Found in Meta Developer Portal → WhatsApp → API Setup</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Access Token</label>
                <div className="relative">
                  <input
                    className="input pr-10 font-mono text-sm"
                    type={showToken ? 'text' : 'password'}
                    placeholder="EAAxxxxxxxx..."
                    value={form.waAccessToken}
                    disabled={!isEditing}
                    onChange={(e) => setForm((f) => ({ ...f, waAccessToken: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowToken((v) => !v)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">Create a permanent token via Business Settings → System Users</p>
              </div>
            </div>
          </div>

          {/* ── Backup & Restore ── */}
          <div className="md:col-span-2 mt-4">
            <p className="section-label">Backup & Restore</p>
          </div>
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5 space-y-5">

            {/* Export */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Export Backup</p>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Download all your data — products, orders, customers, inventory and more — as a ZIP file.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {isExporting ? 'Preparing…' : 'Download ZIP'}
              </button>
            </div>

            <div className="border-t border-slate-200 dark:border-white/10" />

            {/* Restore */}
            <div className="flex items-start gap-3">
              <UploadCloud className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Restore from Backup</p>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Upload a previously exported ZIP file. <strong>Only works if your account has no existing records.</strong>
                </p>
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Restore will be blocked if any data already exists in this account. This prevents accidental overwrites.
                  </p>
                </div>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setRestoreConfirm(true);
                  }}
                />
                {!restoreConfirm ? (
                  <button
                    type="button"
                    onClick={() => restoreInputRef.current?.click()}
                    className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    Choose Backup ZIP…
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-3">
                    <p className="text-sm font-medium text-slate-700">
                      {restoreInputRef.current?.files?.[0]?.name} — ready to restore. Confirm?
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const file = restoreInputRef.current?.files?.[0];
                        if (file) restoreMutation.mutate(file);
                      }}
                      disabled={restoreMutation.isPending}
                      className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                    >
                      {restoreMutation.isPending ? 'Restoring…' : 'Yes, Restore'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRestoreConfirm(false); if (restoreInputRef.current) restoreInputRef.current.value = ''; }}
                      className="text-sm text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Appearance ── */}
          <div className="md:col-span-2 mt-4">
            <p className="section-label">Appearance</p>
          </div>
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="h-5 w-5 text-slate-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Switch between light and dark interface.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                aria-pressed={theme === 'dark'}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ── Menu Locker ── */}
          <div className="md:col-span-2 mt-4">
            <p className="section-label">Security</p>
          </div>
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Menu Locker</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Protect any left-side menu with one shared 4-digit PIN.</p>
              </div>
              <button
                type="button"
                disabled={!isEditing}
                onClick={() => setForm((c) => ({ ...c, enableMenuPin: !c.enableMenuPin }))}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  form.enableMenuPin ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                aria-pressed={form.enableMenuPin}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    form.enableMenuPin ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {form.enableMenuPin && (
              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,220px),1fr]">
                <div className="max-w-xs">
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>4-Digit PIN</label>
                  <input
                    className="input"
                    type="password"
                    disabled={!isEditing}
                    inputMode="numeric"
                    maxLength={4}
                    value={form.menuPin}
                    onChange={(e) => setForm((c) => ({ ...c, menuPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Select Menus</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {NAV_ITEMS.map((item) => {
                      const isChecked = form.protectedMenus.includes(item.lockKey);
                      return (
                        <label
                          key={item.lockKey}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
                        >
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            disabled={!isEditing}
                            checked={isChecked}
                            onChange={() =>
                              setForm((c) => ({
                                ...c,
                                protectedMenus: isChecked
                                  ? c.protectedMenus.filter((m) => m !== item.lockKey)
                                  : [...c.protectedMenus, item.lockKey],
                              }))
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {isEditing ? (
            <>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                onClick={() => {
                  if (data) {
                    setForm({
                      tenantName: data.tenant?.name ?? '',
                      plan: data.tenant?.plan ?? 'starter',
                      currency: data.tenant?.settings?.currency ?? 'INR',
                      timezone: data.tenant?.settings?.timezone ?? 'Asia/Kolkata',
                      enableMenuPin:
                        data.tenant?.settings?.enableMenuPin === true ||
                        data.tenant?.settings?.enableDashboardPin === true,
                      menuPin: data.tenant?.settings?.menuPin ?? data.tenant?.settings?.dashboardPin ?? '',
                      protectedMenus: Array.isArray(data.tenant?.settings?.protectedMenus)
                        ? data.tenant.settings.protectedMenus
                        : data.tenant?.settings?.enableDashboardPin
                          ? ['dashboard']
                          : [],
                      shopName: data.shop?.name ?? '',
                      shopType: data.shop?.type ?? '',
                      phone: data.shop?.phone ?? '',
                      gstNumber: data.shop?.gst_number ?? '',
                      addressLine1: data.shop?.address?.line1 ?? '',
                      city: data.shop?.address?.city ?? '',
                      invoiceDlNumbers: data.shop?.settings?.invoiceTemplate?.dlNumbers ?? '',
                      invoiceHeaderLeft:
                        data.shop?.settings?.invoiceTemplate?.headerLeft ?? 'Chemist & Druggist',
                      invoiceHeaderRight:
                        data.shop?.settings?.invoiceTemplate?.headerRight ?? 'Cash/Credit Memo',
                      invoiceWhatsappNumber: data.shop?.settings?.invoiceTemplate?.whatsappNumber ?? '',
                      invoiceStoreDisplayName:
                        data.shop?.settings?.invoiceTemplate?.storeDisplayName ?? data.shop?.name ?? '',
                      invoiceAddressLine:
                        data.shop?.settings?.invoiceTemplate?.addressLine ??
                        [data.shop?.address?.line1, data.shop?.address?.city].filter(Boolean).join(', '),
                      invoiceFooterNote:
                        data.shop?.settings?.invoiceTemplate?.footerNote ?? 'Thanks',
                      invoiceSignatureLabel:
                        data.shop?.settings?.invoiceTemplate?.signatureLabel ?? 'Signature',
                      logoDataUrl: data.shop?.settings?.logoDataUrl ?? '',
                      waPhoneNumberId: data.shop?.settings?.whatsapp?.phoneNumberId ?? '',
                      waAccessToken: data.shop?.settings?.whatsapp?.accessToken ?? '',
                    });
                  }
                  setIsEditing(false);
                }}
                disabled={saveMutation.isPending}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
                {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              Edit Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
