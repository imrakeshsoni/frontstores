import { useRef, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { createAppConfig, recreateConfigWithTenantId } from '@/lib/db/config';
import { createAuth } from '@/lib/db/auth';
import { importBackup } from '@/lib/db/backup';
import { enqueue, flushQueue } from '@/lib/syncQueue';
import { toast } from 'sonner';

const SERVER = 'https://update.frontstores.com';

const SHOP_TYPES = [
  { value: 'medical',     label: 'Medical / Pharmacy',  icon: '💊', desc: 'Medicines, prescriptions, drug inventory' },
  { value: 'grocery',    label: 'Grocery Store',        icon: '🛒', desc: 'Kirana, supermarket, weight-based billing, khata' },
  { value: 'restaurant', label: 'Restaurant / Café',    icon: '🍽️', desc: 'Table orders, KOT, menu, kitchen display' },
  { value: 'carwash',    label: 'Car Wash / Detailing', icon: '🚗', desc: 'Job cards, live queue, memberships, WhatsApp alerts' },
  { value: 'clinic',     label: 'Hospital / Clinic',    icon: '🏥', desc: 'OPD tokens, Rx, lab, IPD beds, pharmacy, billing' },
  { value: 'beauty',     label: 'Beauty Parlor / Salon', icon: '💅', desc: 'Appointments, services, staff, memberships, billing' },
  { value: 'study',      label: 'StudyMate — Student App', icon: '📚', desc: 'AI tutor, mock tests, flashcards, study tracker, parent report' },
  { value: 'coaching',   label: 'Coaching Institute',      icon: '🎓', desc: 'Students, batches, attendance, fee collection, exams, teachers' },
  { value: 'gym',        label: 'Gym / Fitness Center',    icon: '💪', desc: 'Members, memberships, check-in, renewals, PT packages, staff' },
  { value: 'jewellery',  label: 'Jewellery Shop',          icon: '💍', desc: 'Gold rate, inventory, billing, custom orders, repairs' },
  { value: 'realestate', label: 'Real Estate / PropMate',  icon: '🏠', desc: 'Leads, deals, commissions, site visits, builder projects' },
  { value: 'hotel',         label: 'Hotel / Lodge',              icon: '🏨', desc: 'Room bookings, check-in/out, billing, housekeeping, maintenance' },
  { value: 'repair',        label: 'Mobile/Electronics Repair', icon: '🔧', desc: 'Repair jobs, parts inventory, technicians, warranty tracking' }, // [repair] [all tenants]
  { value: 'drivingschool', label: 'Driving School',            icon: '🚗', desc: 'Students, sessions, vehicles, LL/DL test tracking, fees' },
  { value: 'tailor',       label: 'Tailor / Boutique',         icon: '🧵', desc: 'Orders, measurements, delivery tracking, fabric management' },
  { value: 'hardware',     label: 'Hardware Store',            icon: '🔩', desc: 'Billing, stock by kg/meter/piece, credit accounts (udhar khata)' },
  { value: 'laundry',      label: 'Laundry / Dry Clean',       icon: '👕', desc: 'Order tracking, price list, delivery management' },
  { value: 'catering',     label: 'Catering Business',         icon: '🍱', desc: 'Event bookings, menu, guest count, staff assignments' },
  { value: 'pestcontrol',  label: 'Pest Control',              icon: '🐛', desc: 'Job cards, AMC contracts, chemical stock, customer tracking' },
  { value: 'clothing',     label: 'Clothing / Footwear Store', icon: '👗', desc: 'Size+color variants, POS, exchange/return tracking' },
  { value: 'bakery',       label: 'Bakery / Sweets Shop',      icon: '🎂', desc: 'Production log, expiry alerts, counter billing, bulk orders' },
  { value: 'optician',     label: 'Optician / Eye Care',       icon: '👓', desc: 'Rx prescriptions, lens orders, frame inventory' },
  { value: 'petrolpump',   label: 'Petrol Pump',               icon: '⛽', desc: 'Shift management, fuel rates, fleet credit accounts' },
  { value: 'furniture',    label: 'Furniture Store',           icon: '🪑', desc: 'Regular + custom orders, delivery, carpenter assignment' },
  { value: 'printing',     label: 'Printing / Stationery',     icon: '🖨️', desc: 'Print jobs, stationery counter billing, stock management' },
  { value: 'ca',           label: 'CA / Tax Consultant',       icon: '📊', desc: 'Client tasks, ITR/GST filing, document tracker, invoices' },
  { value: 'events',       label: 'Event Planner',             icon: '🎪', desc: 'Weddings, corporate events, vendor management, expenses' },
  { value: 'travel',       label: 'Travel Agency',             icon: '✈️', desc: 'Trip bookings, itinerary, visa tracking, payment collection' },
  { value: 'insurance',    label: 'Insurance Agent',           icon: '🛡️', desc: 'Policies, renewal reminders, claims, commission tracking' },
  { value: 'homeservice',  label: 'Home Service / Electrician',icon: '🔌', desc: 'Job cards, technicians, parts stock, AMC contracts' },
];

const RE_ROLES = [
  { value: 'resale',     label: 'Resale Broker',         icon: '🏘️', desc: 'Buy/sell secondary market properties, manage buyers & sellers' },
  { value: 'channel',    label: 'Channel Partner',        icon: '🤝', desc: 'Tied to builder projects, earn commission on new flat bookings' },
  { value: 'individual', label: 'Individual Agent',       icon: '👤', desc: 'Freelancer — take clients, work independently or under a broker' },
  { value: 'rental',     label: 'Rental Agent',           icon: '🔑', desc: 'Rental leads, agreements, monthly commission tracking' },
  { value: 'commercial', label: 'Commercial Broker',      icon: '🏢', desc: 'Office/shop/warehouse deals, commercial properties' },
  { value: 'builder',    label: 'Builder / Developer',    icon: '🏗️', desc: 'List your own projects, track bookings and agent commissions' },
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
  re_role: string;
}

export function SetupWizard() {
  const { setConfig, setAuthenticated, loadConfig } = useAppStore();
  // step 0 = choose: new setup vs restore from backup
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tcAgreed, setTcAgreed] = useState(false);
  const [form, setForm] = useState<FormData>({
    shop_type: '', shop_name: '', owner_name: '', phone: '',
    email: '', address_line1: '', city: '', state: '',
    pincode: '', gstin: '', drug_license_no: '', re_role: 'resale',
  });

  // Step 5 — password setup
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Restore from backup
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePass, setRestorePass] = useState('');
  const [restoring, setRestoring] = useState(false);

  // [core] [all tenants] — Reinstall flow: DB deleted but account exists on server
  const [reinstallEmail, setReinstallEmail] = useState('');
  const [reinstallLooking, setReinstallLooking] = useState(false);
  const [reinstallError, setReinstallError] = useState('');
  const [showReinstall, setShowReinstall] = useState(false);

  const update = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleRestore() {
    if (!restoreFile || restorePass.length < 4) return;
    setRestoring(true);
    try {
      const result = await importBackup(restoreFile, restorePass);
      if (!result.ok) { toast.error(result.error ?? 'Restore failed'); return; }
      toast.success(`Welcome back, ${result.shop_name ?? 'shop'}! All your data has been restored.`);
      // Reload config from the restored DB then go to login
      await loadConfig();
    } catch (e) {
      toast.error('Restore failed: ' + String(e));
    } finally {
      setRestoring(false);
    }
  }

  const isStudy = form.shop_type === 'study';
  const isRealEstate = form.shop_type === 'realestate';
  const canProceedStep1 = form.shop_type !== '';
  const canProceedStep1b = !isRealEstate || form.re_role !== '';
  const canProceedStep2 = isStudy
    ? form.owner_name.trim() !== ''
    : form.shop_name.trim() !== '' && form.owner_name.trim() !== '';
  const canProceedStep5 =
    username.trim().length >= 3 &&
    password.length >= 4 &&
    password === confirmPassword;

  // [core] [all tenants] — Look up existing account by email, re-create local DB
  async function handleReinstall() {
    const email = reinstallEmail.trim().toLowerCase();
    if (!email) return;
    setReinstallLooking(true);
    setReinstallError('');
    try {
      const res = await fetch(`${SERVER}/lookup-tenant?email=${encodeURIComponent(email)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('Server unreachable');
      const data = await res.json();
      if (!data.found) {
        setReinstallError('No account found with that email. Please sign up as new.');
        return;
      }
      // Re-create local DB with the existing tenant_id
      const config = await recreateConfigWithTenantId(data.tenant_id, {
        shop_type: data.shop_type,
        shop_name: data.shop_name,
        owner_name: data.owner_name,
        phone: data.phone,
        email: data.email,
        city: data.city,
      });
      // Pre-fill password step with this config so createAuth uses the right tenant_id
      await createAuth(config.tenant_id, username.trim() || data.owner_name.toLowerCase().replace(/\s+/g, ''), password);
      toast.success(`Welcome back, ${data.shop_name}! Please set a new password.`);
      await loadConfig();
    } catch (e) {
      setReinstallError('Could not reach server. Make sure you are online and try again.');
    } finally {
      setReinstallLooking(false);
    }
  }

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

      // [realestate] save role in settings
      if (form.shop_type === 'realestate' && form.re_role) {
        const { updateAppConfig } = await import('@/lib/db/config');
        await updateAppConfig({ settings: { re_role: form.re_role } });
      }

      // Queue registration then flush immediately so server knows about this tenant
      await enqueue('register', config.tenant_id, {
        tenant_id: config.tenant_id,
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name.trim(),
        shop_type: form.shop_type,
        phone: form.phone || '',
        email: form.email || '',
        city: form.city || '',
        gstin: form.gstin || '',
      });
      await flushQueue().catch(() => {});

      // Check what the server thinks — it will return 'pending' until admin approves
      let serverStatus = 'pending';
      try {
        const res = await fetch(`${SERVER}/license/${config.tenant_id}`, {
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = await res.json();
          serverStatus = data.active ? 'active' : (data.reason ?? 'pending');
        }
      } catch { /* offline — stay pending */ }

      setConfig(config);
      // Only let user in if server already approved (unlikely on first reg, but handles future cases)
      if (serverStatus === 'active' || serverStatus === 'extended') {
        setAuthenticated(true);
        toast.success('Setup complete! Welcome to FrontStores.');
      } else {
        // pending / offline — load config so SubscriptionGate can show the pending screen
        await loadConfig();
      }
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
          <p className="text-slate-400 mt-2">
            {step === 0 ? 'Welcome' : isStudy ? 'Set up StudyMate — takes 1 minute' : 'Set up your shop — takes 2 minutes'}
          </p>
          {step > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className={`h-2 rounded-full transition-all ${s === step ? 'w-8 bg-indigo-500' : s < step ? 'w-4 bg-indigo-400' : 'w-4 bg-slate-600'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">

          {/* Step 0: New setup vs Restore */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Is this a new setup?</h2>
              <p className="text-slate-500 text-sm mb-6">If you're moving from another computer, restore your backup file instead.</p>
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="text-left p-4 rounded-2xl border-2 border-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-all"
                >
                  <div className="text-2xl mb-1">🆕</div>
                  <div className="font-medium text-slate-800 text-sm">New Setup</div>
                  <div className="text-slate-500 text-xs mt-0.5">First time using FrontStores on this computer</div>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all"
                >
                  <div className="text-2xl mb-1">📦</div>
                  <div className="font-medium text-slate-800 text-sm">Restore from Backup</div>
                  <div className="text-slate-500 text-xs mt-0.5">Moving from another computer — I have a .fsbak file</div>
                </button>
                <button
                  onClick={() => setShowReinstall(r => !r)}
                  className="text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-all"
                >
                  <div className="text-2xl mb-1">🔑</div>
                  <div className="font-medium text-slate-800 text-sm">I already have an account</div>
                  <div className="text-slate-500 text-xs mt-0.5">App was deleted or reinstalled — recover your account</div>
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".fsbak"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setRestoreFile(f);
                }}
              />

              {/* Reinstall form — shown when "I already have an account" is clicked */}
              {showReinstall && (
                <div className="border-t border-slate-100 pt-5 mt-2">
                  <p className="text-sm font-medium text-slate-700 mb-1">Enter the email you registered with</p>
                  <p className="text-xs text-slate-400 mb-3">We'll find your account and restore it. Your old data is gone, but your account and approval remain active.</p>
                  <input
                    type="email"
                    value={reinstallEmail}
                    onChange={e => { setReinstallEmail(e.target.value); setReinstallError(''); }}
                    placeholder="yourname@email.com"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 mb-2"
                  />
                  {reinstallError && <p className="text-xs text-red-500 mb-2">{reinstallError}</p>}
                  <div className="space-y-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Set a new password *</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="New password (min 4 chars)"
                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Confirm password *</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                  </div>
                  <button
                    onClick={handleReinstall}
                    disabled={!reinstallEmail || password.length < 4 || password !== confirmPassword || reinstallLooking}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {reinstallLooking ? '🔍 Looking up your account…' : '🔑 Recover My Account'}
                  </button>
                </div>
              )}

              {/* Restore form — shown once file is picked */}
              {restoreFile && (
                <div className="border-t border-slate-100 pt-5 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-slate-700 font-medium">{restoreFile.name}</span>
                    <button onClick={() => { setRestoreFile(null); setRestorePass(''); }} className="text-xs text-slate-400 hover:text-red-500 ml-auto">Remove</button>
                  </div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Enter your old password to unlock this file</label>
                  <input
                    type="password"
                    value={restorePass}
                    onChange={e => setRestorePass(e.target.value)}
                    placeholder="Password from your old computer"
                    onKeyDown={e => { if (e.key === 'Enter') handleRestore(); }}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
                  />
                  <button
                    onClick={handleRestore}
                    disabled={restorePass.length < 4 || restoring}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {restoring ? '⏳ Restoring your data…' : '📦 Restore & Open App'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Shop Type */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-1">What are you setting up?</h2>
              <p className="text-slate-500 text-sm mb-6">We'll set up the right features for you.</p>
              <div className="grid grid-cols-1 gap-3">
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
              {/* [realestate] Role picker appears when realestate is selected */}
              {isRealEstate && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-sm font-semibold text-slate-700 mb-3">What is your role? *</p>
                  <div className="grid grid-cols-1 gap-2">
                    {RE_ROLES.map(r => (
                      <button key={r.value} onClick={() => update('re_role', r.value)} className={`text-left p-3 rounded-xl border-2 transition-all ${form.re_role === r.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{r.icon}</span>
                          <div>
                            <div className="font-medium text-slate-800 text-sm">{r.label}</div>
                            <div className="text-slate-500 text-xs">{r.desc}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  if (form.shop_type === 'study') update('shop_name', 'StudyMate');
                  if (form.shop_type === 'realestate') update('shop_name', form.shop_name || 'PropMate');
                  setStep(2);
                }}
                disabled={!canProceedStep1 || !canProceedStep1b}
                className="mt-6 w-full btn-primary py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed">
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Details — student fields for study, shop fields for others */}
          {step === 2 && (
            <div>
              {isStudy ? (
                <>
                  <h2 className="text-xl font-semibold text-slate-800 mb-1">Tell us about you 📚</h2>
                  <p className="text-slate-500 text-sm mb-6">Helps personalise your AI tutor and study tracker.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your name *</label>
                      <input className="input" placeholder="e.g. Priya Sharma" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Class / Grade</label>
                        <input className="input" placeholder="e.g. Class 10 / 2nd Year" value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">School / College</label>
                        <input className="input" placeholder="School or college name" value={form.city} onChange={(e) => update('city', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
                        <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email (optional)</label>
                        <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-slate-800 mb-1">Tell us about your shop</h2>
                  <p className="text-slate-500 text-sm mb-6">This appears on your bills and reports.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Shop name *</label>
                      <input className="input" value={form.shop_name} onChange={(e) => update('shop_name', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Owner name *</label>
                      <input className="input" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                        <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                      <input className="input" value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                        <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                        <input className="input" value={form.state} onChange={(e) => update('state', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
                        <input className="input" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="btn-secondary py-3 flex-1">← Back</button>
                <button onClick={() => setStep(isStudy ? 4 : 3)} disabled={!canProceedStep2} className="btn-primary py-3 flex-1 text-base disabled:opacity-40">Continue →</button>
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
                  <input className="input" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} />
                </div>
                {form.shop_type === 'medical' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Drug License Number</label>
                    <input className="input" value={form.drug_license_no} onChange={(e) => update('drug_license_no', e.target.value)} />
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
                  <p>💳 <strong>How to subscribe:</strong> Use the contact form at frontstores.com after your trial to renew.</p>
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
                <button onClick={() => setStep(isStudy ? 2 : 3)} className="btn-secondary py-3 flex-1">← Back</button>
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
                {isStudy
                  ? 'This protects your study data. Stored only on this computer — never sent anywhere.'
                  : 'This protects your shop data. Only you will know this password — it is stored on your computer only and never sent anywhere.'}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
                  <input
                    className="input"
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
