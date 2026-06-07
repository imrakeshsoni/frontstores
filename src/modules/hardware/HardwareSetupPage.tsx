// [hardware] [all tenants]
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, X, Settings2, Tags, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { updateAppConfig } from '@/lib/db/config';

const ACCENT = '#d97706';
const GST_RATES = [0, 5, 12, 18, 28];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'credit'];

type Tab = 'catalog' | 'billing';

interface HwSettings {
  categories?: string[];
  brands?: string[];
  hsn_suggestions?: string[];
  default_gst_rate?: number;
  default_payment_mode?: string;
}

function TagListEditor({ label, placeholder, values, onChange }: { label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  function add() {
    const v = input.trim();
    if (!v || values.includes(v)) { setInput(''); return; }
    onChange([...values, v]);
    setInput('');
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
        />
        <button onClick={add} className="px-3 rounded-xl text-white" style={{ background: ACCENT }}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.length === 0 && <p className="text-xs text-slate-400">No entries yet — these appear as quick-suggestions in Products and Billing.</p>}
        {values.map(v => (
          <span key={v} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-100">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-red-500">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function HardwareSetupPage() {
  const config = useAppStore(s => s.config);
  const refreshConfig = useAppStore(s => s.refreshConfig);
  const tenantId = config?.tenant_id ?? '';

  const initial = (config?.settings?.hardware ?? {}) as HwSettings;
  const [tab, setTab] = useState<Tab>('catalog');
  const [categories, setCategories] = useState<string[]>(initial.categories ?? []);
  const [brands, setBrands] = useState<string[]>(initial.brands ?? []);
  const [hsnSuggestions, setHsnSuggestions] = useState<string[]>(initial.hsn_suggestions ?? []);
  const [defaultGst, setDefaultGst] = useState<number>(initial.default_gst_rate ?? 18);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<string>(initial.default_payment_mode ?? 'cash');

  useEffect(() => {
    const hw = (config?.settings?.hardware ?? {}) as HwSettings;
    setCategories(hw.categories ?? []);
    setBrands(hw.brands ?? []);
    setHsnSuggestions(hw.hsn_suggestions ?? []);
    setDefaultGst(hw.default_gst_rate ?? 18);
    setDefaultPaymentMode(hw.default_payment_mode ?? 'cash');
  }, [tenantId]);

  const save = useMutation({
    mutationFn: async () => {
      const hw: HwSettings = {
        categories, brands, hsn_suggestions: hsnSuggestions,
        default_gst_rate: defaultGst, default_payment_mode: defaultPaymentMode,
      };
      await updateAppConfig({ settings: { ...(config?.settings ?? {}), hardware: hw } as Record<string, unknown> });
      await refreshConfig();
    },
    onSuccess: () => toast.success('Setup saved'),
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const TABS: { key: Tab; label: string; icon: typeof Tags }[] = [
    { key: 'catalog', label: 'Categories & Brands', icon: Tags },
    { key: 'billing', label: 'Billing & GST', icon: Receipt },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-amber-600" />
        <h1 className="text-xl font-bold text-slate-900">Setup</h1>
      </div>

      <div className="flex gap-2 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === t.key ? { background: 'white', color: ACCENT, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#64748b' }}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-6 max-w-2xl">
          <p className="text-xs text-slate-400">Build quick-pick suggestion lists for the Products and Billing pages — handy for paint shades, hardware categories, and common brands you stock.</p>
          <TagListEditor label="Categories" placeholder="e.g. Paint, Tools, Plumbing, Electrical" values={categories} onChange={setCategories} />
          <TagListEditor label="Brands" placeholder="e.g. Asian Paints, Berger, Stanley, Havells" values={brands} onChange={setBrands} />
          <TagListEditor label="HSN Code Suggestions" placeholder="e.g. 3209, 8205, 7318" values={hsnSuggestions} onChange={setHsnSuggestions} />
        </div>
      )}

      {tab === 'billing' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5 max-w-2xl">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Bill Number Prefix</label>
            <input value="HW" disabled className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-400" />
            <p className="text-xs text-slate-400 mt-1">Bills are numbered sequentially as HW000001, HW000002, … — this keeps every invoice traceable for GST filing.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Default GST Rate</label>
              <select value={defaultGst} onChange={e => setDefaultGst(parseFloat(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">Applied to new products by default. Each product's rate can still be changed individually.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Default Payment Mode</label>
              <select value={defaultPaymentMode} onChange={e => setDefaultPaymentMode(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">Pre-selected at the billing counter to speed up checkout.</p>
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <p className="text-sm font-medium text-amber-900">Shop GSTIN: {config?.gstin || '— not set —'}</p>
            <p className="text-xs text-amber-700 mt-1">GSTIN, shop name, address and phone are managed under <span className="font-semibold">Settings → Shop Details</span> and appear automatically on every printed bill and quotation.</p>
          </div>
        </div>
      )}

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: ACCENT }}
      >
        {save.isPending ? 'Saving…' : 'Save Setup'}
      </button>
    </div>
  );
}
