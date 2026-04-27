import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronRight, Store, X, MessageSquare, ShoppingCart, Package, Users, Receipt, Truck, Radio } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/app/store/auth.store';
import { decodeToken } from '@/lib/auth/token';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Minimum 6 characters'),
  tenantSlug: z.string().min(1, 'Required'),
});

const enquirySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  businessType: z.string().optional(),
  message: z.string().optional(),
});

type LoginData = z.infer<typeof loginSchema>;
type EnquiryData = z.infer<typeof enquirySchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setTokens, setUser } = useAuthStore();
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [enquiryDone, setEnquiryDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenantSlug: searchParams.get('slug') ?? '' },
  });

  const {
    register: regE,
    handleSubmit: handleEnquiry,
    reset: resetEnquiry,
    formState: { errors: eErrors, isSubmitting: eSubmitting },
  } = useForm<EnquiryData>({ resolver: zodResolver(enquirySchema) });

  const onSubmit = async (data: LoginData) => {
    try {
      const res = await apiClient.post('/api/auth/login', data);
      const { accessToken, refreshToken, user } = res.data.data;
      const payload = decodeToken(accessToken);
      setTokens(accessToken, refreshToken);
      setUser({
        ...user,
        id: user.id ?? payload?.sub ?? '',
        tenantId: user.tenantId ?? payload?.tenantId ?? '',
        permissions: payload?.permissions ?? {},
      });
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Login failed');
    }
  };

  const onEnquirySubmit = async (data: EnquiryData) => {
    try {
      await apiClient.post('/api/core/enquiries', data);
      setEnquiryDone(true);
      resetEnquiry();
      toast.success('Thanks! We will contact you shortly.');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Unable to submit enquiry');
    }
  };

  return (
    <div className="app-noise relative flex min-h-screen items-center justify-center px-4 py-8 md:px-8">
      <div className="absolute left-6 top-6 md:left-10 md:top-8">
        <span className="text-4xl font-bold tracking-tight text-slate-900">Front<span style={{ color: 'var(--accent)' }}>Stores</span><span style={{ color: 'var(--accent)' }}>.</span></span>
      </div>
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">

        {/* ── Left hero panel ── */}
        <section className="hero-panel hidden min-h-[720px] lg:flex">
          <div className="flex flex-col gap-6">
            {/* Brand + hero card */}
            <div className="space-y-5">
              <span className="chip">Premium control surface</span>
              <div className="rounded-2xl p-7 text-white" style={{ background: 'var(--text-primary)' }}>
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-tight">frontstore</p>
                    <p className="text-xs text-white/50">Run every counter with calm precision.</p>
                  </div>
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-white">
                  Retail software with hardware-level clarity.
                </h1>
                <p className="mt-4 text-sm leading-7 text-white/65">
                  One refined workspace for selling faster, tracking stock, and reviewing
                  daily performance — with polished, low-friction workflows.
                </p>
              </div>
            </div>

            {/* Capability grid */}
            <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ShoppingCart, color: 'text-blue-500', title: 'Live POS', desc: 'Barcode checkout, hold & resume bills, multi-item cart.' },
              { icon: Package,      color: 'text-violet-500', title: 'Smart Inventory', desc: 'Real-time stock, low-stock alerts, batch & expiry tracking.' },
              { icon: Users,        color: 'text-emerald-500', title: 'Customers', desc: 'Purchase history, loyalty notes, contact management.' },
              { icon: Receipt,      color: 'text-amber-500', title: 'GST Billing', desc: 'Auto GST-compliant bills, print or share receipts instantly.' },
              { icon: Truck,        color: 'text-rose-500', title: 'Suppliers', desc: 'Manage vendors, raise purchase orders, track deliveries.' },
              { icon: Radio,        color: 'text-sky-500', title: 'Broadcasts', desc: 'Send offers and updates to customers via WhatsApp.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card p-4">
                <Icon className={`mb-3 h-4 w-4 ${color}`} />
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{desc}</p>
              </div>
            ))}
            </div>
          </div>
        </section>

        {/* ── Right login card ── */}
        <section className="card-strong flex items-center rounded-[2rem] p-6 md:p-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-7">
              <div
                className="mb-4 inline-flex items-center justify-center rounded-xl p-2.5 text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Store className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">Welcome back</h2>
              <p className="mt-1.5 text-sm text-slate-500">Sign in to your frontstore account.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Shop ID</label>
                <input {...register('tenantSlug')} placeholder="your-shop-id" className="input" />
                {errors.tenantSlug && (
                  <p className="mt-1 text-xs text-rose-500">{errors.tenantSlug.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input {...register('email')} type="email" placeholder="owner@example.com" className="input" />
                {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <input {...register('password')} type="password" placeholder="••••••••" className="input" />
                {errors.password && (
                  <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>
                )}
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary mt-1 w-full py-3">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
                {!isSubmitting && <ChevronRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              New to frontstore?{' '}
              <button
                type="button"
                onClick={() => { setShowEnquiry(true); setEnquiryDone(false); }}
                className="font-semibold text-slate-600 hover:text-slate-900"
              >
                Get in touch
              </button>
            </p>
          </div>
        </section>
      </div>

      {showEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="card-strong w-full max-w-md rounded-[2rem] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="section-label">Get in touch</p>
                <h3 className="mt-1 text-xl">We'd love to hear from you</h3>
              </div>
              <button onClick={() => setShowEnquiry(false)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {enquiryDone ? (
              <div className="rounded-2xl bg-emerald-50 px-5 py-8 text-center">
                <p className="text-2xl">✓</p>
                <p className="mt-3 font-semibold text-emerald-800">Enquiry submitted!</p>
                <p className="mt-2 text-sm text-emerald-700">Our team will contact you shortly.</p>
                <button className="btn-secondary mt-5" onClick={() => setShowEnquiry(false)}>Close</button>
              </div>
            ) : (
              <form onSubmit={handleEnquiry(onEnquirySubmit)} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Full Name *</label>
                  <input {...regE('name')} placeholder="Your name" className="input" />
                  {eErrors.name && <p className="mt-1 text-xs text-rose-500">{eErrors.name.message}</p>}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Email *</label>
                  <input {...regE('email')} type="email" placeholder="you@example.com" className="input" />
                  {eErrors.email && <p className="mt-1 text-xs text-rose-500">{eErrors.email.message}</p>}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
                  <input {...regE('phone')} type="tel" placeholder="9876543210" className="input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Business Type</label>
                  <select {...regE('businessType')} className="input">
                    <option value="">Select type</option>
                    <option value="medical">Medical / Pharmacy</option>
                    <option value="grocery">Grocery / Kirana</option>
                    <option value="retail">General Retail</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Message</label>
                  <textarea {...regE('message')} rows={3} placeholder="Tell us about your shop..." className="input resize-none" />
                </div>
                <button type="submit" disabled={eSubmitting} className="btn-primary w-full py-3">
                  {eSubmitting ? 'Submitting…' : 'Submit Enquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
