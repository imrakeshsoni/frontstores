import { useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { createAppConfig } from '@/lib/db/config';
import { createAuth } from '@/lib/db/auth';
import { enqueue } from '@/lib/syncQueue';
import { toast } from 'sonner';

const SHOP_TYPES = [
  { value: 'medical',    label: 'Medical / Pharmacy',     icon: '💊', desc: 'Medicines, prescriptions, drug inventory' },
  { value: 'restaurant', label: 'Restaurant / Café',      icon: '🍽️', desc: 'Food orders, tables, kitchen management' },
];

interface FormData {
  shop_type: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  email: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  drug_license_no: string;
}

export function SetupWizard() {
  const { setConfig, setAuthenticated } = useAppStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [tcAgreed, setTcAgreed] = useState(false);
  const [form, setForm] = useState<FormData>({
    shop_type: '', shop_name: '', owner_name: '', phone: '',
    email: '', address_line1: '', city: '', state: '',
    pincode: '', gstin: '', drug_license_no: '',
  });

  // Step 5 — password setup
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const update = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canProceedStep1 = form.shop_type !== '';
  const canProceedStep2 = form.shop_name.trim() !== '' && form.owner_name.trim() !== '';
  const canProceedStep5 =
    username.trim().length >= 3 &&
    password.length >= 4 &&
    password === confirmPassword;

  const handleFinish = async () => {
    setSaving(true);
    try {
      const config = await createAppConfig({
        shop_type: form.shop_type,
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        address_line1: form.address_line1 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        gstin: form.gstin || undefined,
        drug_license_no: form.drug_license_no || undefined,
      });
      await createAuth(config.tenant_id, username.trim(), password);
      setConfig(config);
      setAuthenticated(true);
      toast.success('Setup complete! Welcome to FrontStores.');
      enqueue('register', config.tenant_id, {
        tenant_id: config.tenant_id,
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name.trim(),
        shop_type: form.shop_type,
        phone: form.phone || '',
        email: form.email || '',
        city: form.city || '',
        gstin: form.gstin || '',
      }).catch(() => {});
    } catch (e: unknown) {
      toast.error(String((e as Error)?.message ?? e ?? 'Setup failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">FrontStores</h1>
          <p className="text-slate-400 mt-2">Set up your shop — takes 2 minutes</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className={`h-2 rounded-full transition-all ${s === step ? 'w-8 bg-indigo-500' : s < step ? 'w-4 bg-indigo-400' : 'w-4 bg-slate-600'}`} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* Step 1: Shop Type */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">What kind of shop do you run?</h2>
              <p className="text-slate-500 text-sm mb-6">We'll set up the right features for your business.</p>
              <div className="grid grid-cols-2 gap-3">
                {SHOP_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => update('shop_type', t.value)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${
                      form.shop_type === t.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{t.icon}</div>
                    <div className="font-medium text-slate-800 text-sm">{t.label}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)} disabled={!canProceedStep1}
                className="mt-6 w-full btn-primary py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed">
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Shop Details */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Tell us about your shop</h2>
              <p className="text-slate-500 text-sm mb-6">This appears on your bills and reports.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shop name *</label>
                  <input className="input" placeholder="e.g. Roshan Medical Store" value={form.shop_name} onChange={(e) => update('shop_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner name *</label>
                  <input className="input" placeholder="Your full name" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input className="input" placeholder="9876543210" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input className="input" type="email" placeholder="shop@email.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input className="input" placeholder="Shop address" value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input className="input" placeholder="City" value={form.city} onChange={(e) => update('city', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                    <input className="input" placeholder="State" value={form.state} onChange={(e) => update('state', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
                    <input className="input" placeholder="400001" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="btn-secondary py-3 flex-1">← Back</button>
                <button onClick={() => setStep(3)} disabled={!canProceedStep2} className="btn-primary py-3 flex-1 text-base disabled:opacity-40">Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3: Tax / License details */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Tax & License details</h2>
              <p className="text-slate-500 text-sm mb-6">Optional — used on GST invoices. You can add these later in Settings.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                  <input className="input" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} />
                </div>
                {form.shop_type === 'medical' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Drug License Number</label>
                    <input className="input" placeholder="DL-MH-000000" value={form.drug_license_no} onChange={(e) => update('drug_license_no', e.target.value)} />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(2)} className="btn-secondary py-3 flex-1">← Back</button>
                <button onClick={() => setStep(4)} className="btn-primary py-3 flex-1 text-base">Continue →</button>
              </div>
            </div>
          )}

          {/* Step 4: T&C + Subscription */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Terms & Subscription</h2>
              <p className="text-slate-500 text-sm mb-4">Please read and agree to continue.</p>
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎁</span>
                  <span className="font-semibold text-indigo-800">30-Day Free Trial</span>
                </div>
                <p className="text-sm text-indigo-700">You get full access to all features for 30 days — completely free. After your trial ends, a subscription of <strong>₹999/month</strong> is required to continue using FrontStores.</p>
                <div className="mt-3 pt-3 border-t border-indigo-200 text-sm text-indigo-700">
                  <p>💳 <strong>How to subscribe:</strong> Contact us on WhatsApp or email after your trial.</p>
                  <p className="mt-1">📱 <strong>WhatsApp:</strong> +91 99999 99999</p>
                  <p>📧 <strong>Email:</strong> support@frontstores.com</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-36 overflow-y-auto text-xs text-slate-600 leading-relaxed mb-4">
                <p className="font-semibold text-slate-800 mb-2">Terms & Conditions — FrontStores</p>
                <p><strong>1. License:</strong> FrontStores grants you a non-transferable license to use this software for your shop.</p>
                <p className="mt-1"><strong>2. Data:</strong> All your shop data is stored locally on your computer. FrontStores does not access, collect, or transmit your business data.</p>
                <p className="mt-1"><strong>3. Subscription:</strong> After the 30-day free trial, ₹999/month is required.</p>
                <p className="mt-1"><strong>4. Updates:</strong> Updates will never modify, delete, or alter your existing data.</p>
                <p className="mt-1"><strong>5. Cancellation:</strong> Your data remains on your computer and is never deleted remotely.</p>
                <p className="mt-1"><strong>6. Liability:</strong> FrontStores is not liable for any business losses. Always maintain your own data backups.</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={tcAgreed} onChange={(e) => setTcAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                <span className="text-sm text-slate-700">I have read and agree to the Terms & Conditions.</span>
              </label>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(3)} className="btn-secondary py-3 flex-1">← Back</button>
                <button onClick={() => setStep(5)} disabled={!tcAgreed}
                  className="btn-primary py-3 flex-1 text-base disabled:opacity-40 disabled:cursor-not-allowed">
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Set username + password */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Set your login password</h2>
              <p className="text-slate-500 text-sm mb-6">
                This protects your shop data. Only you will know this password — it is stored on your computer only and never sent anywhere.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
                  <input
                    className="input"
                    placeholder="e.g. rakesh"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-1">Minimum 3 characters. Lowercase only.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      className="input pr-16"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Create a password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700">
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Minimum 4 characters.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password *</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 text-xs text-amber-700">
                🔒 Your password is stored only on this device. If you forget it, contact FrontStores support to reset it.
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(4)} className="btn-secondary py-3 flex-1">← Back</button>
                <button onClick={handleFinish} disabled={saving || !canProceedStep5}
                  className="btn-primary py-3 flex-1 text-base disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving ? 'Setting up…' : '✓ Start Free Trial'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
