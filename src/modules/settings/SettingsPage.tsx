import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { updateAppConfig } from '@/lib/db/config';
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
};

export function SettingsPage() {
  const config = useAppStore((s) => s.config);
  const { loadConfig } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState<SettingsForm>({
    shop_name: '', owner_name: '', phone: '', email: '', gstin: '', drug_license_no: '',
    address_line1: '', city: '',
    invoiceHeaderLeft: 'Chemist & Druggist', invoiceHeaderRight: 'Cash/Credit Memo',
    invoiceWhatsappNumber: '', invoiceStoreDisplayName: '', invoiceAddressLine: '',
    invoiceFooterNote: 'Thanks for your visit', invoiceSignatureLabel: 'Authorised Signature',
    enableKeyboardBillingMode: false,
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
                const products = await db.select('SELECT * FROM products WHERE tenant_id = ? AND deleted_at IS NULL', [config?.tenant_id]);
                const orders = await db.select('SELECT * FROM orders WHERE tenant_id = ? AND deleted_at IS NULL', [config?.tenant_id]);
                const customers = await db.select('SELECT * FROM customers WHERE tenant_id = ? AND deleted_at IS NULL', [config?.tenant_id]);
                const expenses = await db.select('SELECT * FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL', [config?.tenant_id]);
                const khata = await db.select('SELECT * FROM khata_entries WHERE tenant_id = ? AND deleted_at IS NULL', [config?.tenant_id]);
                const backup = { exported_at: new Date().toISOString(), shop: config?.shop_name, products, orders, customers, expenses, khata };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `frontstores_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
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
                const orders = await db.select<any[]>('SELECT o.*, GROUP_CONCAT(oi.product_name || " x" || oi.quantity, "; ") as items FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.tenant_id = ? AND o.deleted_at IS NULL GROUP BY o.id ORDER BY o.order_date DESC', [config?.tenant_id]);
                const rows = [['Bill No', 'Date', 'Customer', 'Items', 'Total', 'Payment'], ...orders.map((o: any) => [o.bill_number, o.order_date?.slice(0, 10), o.customer_name || '', o.items || '', o.total, o.payment_method])];
                const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
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

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
