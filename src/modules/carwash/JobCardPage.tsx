// [carwash] [all tenants]
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { Car, Plus, Trash2, CheckCircle, Printer, MessageSquare, ArrowLeft, Clock, User } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listJobs, createJob, updateJobStatus, settleJob,
  listServices, listCarwashStaff, findVehicleByReg, findActiveMembership,
  type CarwashJob, type VehicleType, type JobStatus,
} from '@/lib/db/carwash';

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: 'hatchback', label: 'Hatchback', icon: '🚗' },
  { value: 'sedan',     label: 'Sedan',     icon: '🚙' },
  { value: 'suv',       label: 'SUV',       icon: '🚐' },
  { value: 'luxury',    label: 'Luxury',    icon: '🏎️' },
];

const STATUS_FLOW: Record<JobStatus, { next: JobStatus | null; label: string; color: string; bg: string }> = {
  waiting:     { next: 'in_progress', label: 'Start Washing',   color: '#2563eb', bg: '#eff6ff' },
  in_progress: { next: 'ready',       label: 'Mark Ready',      color: '#16a34a', bg: '#d1fae5' },
  ready:       { next: 'delivered',   label: 'Deliver & Settle',color: '#7c3aed', bg: '#ede9fe' },
  delivered:   { next: null,          label: 'Delivered',        color: '#6b7280', bg: '#f3f4f6' },
};

type SelectedService = { service_id: string; service_name: string; price: number; gst_rate: number };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

export function JobCardPage() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === 'new';
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const regRef = useRef<HTMLInputElement>(null);

  // Form state for new job
  const [regNumber, setRegNumber]       = useState('');
  const [vehicleType, setVehicleType]   = useState<VehicleType>('sedan');
  const [make, setMake]                 = useState('');
  const [model, setModel]               = useState('');
  const [color, setColor]               = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedStaffId, setSelectedStaffId]   = useState('');
  const [selectedStaffName, setSelectedStaffName] = useState('');
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [discount, setDiscount]         = useState('');
  const [notes, setNotes]               = useState('');
  const [activeMembership, setActiveMembership] = useState<any>(null);
  const [useMembership, setUseMembership]       = useState(false);
  const [settlePayment, setSettlePayment]       = useState('cash');
  const [showSettle, setShowSettle]             = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['carwash-services', tenantId],
    queryFn: () => listServices(tenantId),
    enabled: !!tenantId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['carwash-staff', tenantId],
    queryFn: () => listCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const { data: job, isLoading: loadingJob } = useQuery({
    queryKey: ['carwash-job', id],
    queryFn: () => {
      if (isNew) return null;
      return listJobs(tenantId, { date: todayISO() }).then(jobs => jobs.find(j => j.id === id) ?? null);
    },
    enabled: !!tenantId && !isNew,
    refetchInterval: 5000,
  });

  // Auto-fill vehicle info from history
  const lookupVehicle = async (reg: string) => {
    if (!reg || reg.length < 4) return;
    const v = await findVehicleByReg(tenantId, reg);
    if (v) {
      setVehicleType(v.vehicle_type);
      setMake(v.make ?? '');
      setModel(v.model ?? '');
      setColor(v.color ?? '');
      setCustomerName(v.customer_name ?? '');
      setCustomerPhone(v.customer_phone ?? '');
      toast.success(`Vehicle found: ${v.make ?? ''} ${v.model ?? ''}`);
    }
    const membership = await findActiveMembership(tenantId, reg);
    if (membership) {
      setActiveMembership(membership);
      toast.success(`Membership: ${membership.package_name} — ${membership.total_washes - membership.used_washes} washes left`);
    } else {
      setActiveMembership(null);
      setUseMembership(false);
    }
  };

  const getPriceForType = (svc: any): number => {
    const key = `price_${vehicleType}` as keyof typeof svc;
    return Number(svc[key] ?? svc.price_sedan ?? 0);
  };

  const toggleService = (svc: any) => {
    const price = getPriceForType(svc);
    const already = selectedServices.find(s => s.service_id === svc.id);
    if (already) {
      setSelectedServices(prev => prev.filter(s => s.service_id !== svc.id));
    } else {
      setSelectedServices(prev => [...prev, { service_id: svc.id, service_name: svc.name, price, gst_rate: svc.gst_rate }]);
    }
  };

  // Re-price services when vehicle type changes
  useEffect(() => {
    setSelectedServices(prev =>
      prev.map(s => {
        const svc = services.find(sv => sv.id === s.service_id);
        if (!svc) return s;
        return { ...s, price: getPriceForType(svc) };
      })
    );
  }, [vehicleType]);

  const subtotal = selectedServices.reduce((s, i) => s + i.price, 0);
  const discountAmt = Number(discount) || 0;
  const gstAmt = selectedServices.reduce((s, i) => s + i.price * i.gst_rate / 100, 0);
  const total = Math.max(0, subtotal - discountAmt + gstAmt);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!regNumber.trim()) throw new Error('Enter vehicle registration number');
      if (selectedServices.length === 0) throw new Error('Select at least one service');
      return createJob(tenantId, {
        reg_number: regNumber.trim().toUpperCase(),
        vehicle_type: vehicleType,
        make: make || undefined,
        model: model || undefined,
        color: color || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        staff_id: selectedStaffId || undefined,
        staff_name: selectedStaffName || undefined,
        items: selectedServices,
        discount: discountAmt || undefined,
        notes: notes || undefined,
        membership_id: useMembership && activeMembership ? activeMembership.id : undefined,
      });
    },
    onSuccess: (newJob) => {
      toast.success(`Job ${newJob?.job_number ?? ''} created!`);
      qc.invalidateQueries({ queryKey: ['carwash-active-jobs'] });
      qc.invalidateQueries({ queryKey: ['carwash-stats'] });
      navigate('/carwash/jobs');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create job'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: JobStatus }) => updateJobStatus(tenantId, jobId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carwash-active-jobs'] });
      qc.invalidateQueries({ queryKey: ['carwash-stats'] });
      qc.invalidateQueries({ queryKey: ['carwash-job', id] });
    },
  });

  const settleMutation = useMutation({
    mutationFn: () => settleJob(tenantId, id!, settlePayment),
    onSuccess: () => {
      toast.success('Payment collected — car delivered!');
      setShowSettle(false);
      qc.invalidateQueries({ queryKey: ['carwash-active-jobs'] });
      qc.invalidateQueries({ queryKey: ['carwash-stats'] });
      qc.invalidateQueries({ queryKey: ['carwash-job', id] });
    },
  });

  const handleWhatsApp = () => {
    if (!job) return;
    const phone = String(job.customer_phone ?? '').replace(/\D/g, '');
    const msg = `Hi ${job.customer_name || 'there'} 👋\n\nYour car *${job.reg_number}* is ready for pickup! 🚗✨\n\nServices done:\n${(job.items ?? []).map(i => `• ${i.service_name}`).join('\n')}\n\nTotal: *${fmt(job.total)}*\n\nThank you for visiting ${config?.shop_name ?? 'our car wash'}! 😊`;
    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handlePrint = async () => {
    if (!job) return;
    const shopName = config?.shop_name ?? 'Car Wash';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:'Courier New',monospace;max-width:300px;margin:0 auto;padding:12px;font-size:12px}
      .center{text-align:center} .bold{font-weight:700} .line{border-top:1px dashed #000;margin:6px 0}
      .row{display:flex;justify-content:space-between;margin:2px 0}
      .big{font-size:16px;font-weight:700}
    </style></head><body>
    <div class="center bold" style="font-size:15px">${shopName}</div>
    <div class="center" style="font-size:10px">${config?.address_line1 ?? ''} ${config?.city ?? ''}</div>
    <div class="line"></div>
    <div class="center bold big">JOB CARD</div>
    <div class="row"><span>Job #</span><span class="bold">${job.job_number}</span></div>
    <div class="row"><span>Date</span><span>${new Date(job.created_at).toLocaleDateString('en-IN')}</span></div>
    <div class="row"><span>Vehicle</span><span class="bold">${job.reg_number}</span></div>
    ${job.make || job.model ? `<div class="row"><span>Model</span><span>${[job.make, job.model].filter(Boolean).join(' ')}</span></div>` : ''}
    ${job.customer_name ? `<div class="row"><span>Customer</span><span>${job.customer_name}</span></div>` : ''}
    ${job.staff_name ? `<div class="row"><span>Staff</span><span>${job.staff_name}</span></div>` : ''}
    <div class="line"></div>
    <div class="bold" style="margin-bottom:4px">Services</div>
    ${(job.items ?? []).map(i => `<div class="row"><span>${i.service_name}</span><span>${fmt(i.price)}</span></div>`).join('')}
    <div class="line"></div>
    ${job.discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(job.discount)}</span></div>` : ''}
    <div class="row bold big"><span>TOTAL</span><span>${fmt(job.total)}</span></div>
    <div class="line"></div>
    <div class="center" style="font-size:10px;margin-top:6px">Thank you! Come again 🚗</div>
    </body></html>`;
    const finalHtml = html.replace('</body>', `<script>window.addEventListener('load',function(){setTimeout(window.print,400);})<\/script></body>`);
    try {
      const cacheDir = await appCacheDir();
      const filePath = `${cacheDir}carwash-job-${Date.now()}.html`;
      await writeTextFile(filePath, finalHtml);
      await shellOpen(filePath);
    } catch (e: any) {
      toast.error('Print failed: ' + (e?.message ?? e));
    }
  };

  // ── Existing job view ──────────────────────────────────────────────────────
  if (!isNew) {
    if (loadingJob || !job) {
      return (
        <div className="p-8 text-center">
          <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{loadingJob ? 'Loading…' : 'Job not found'}</div>
          <button onClick={() => navigate('/carwash/jobs')} className="mt-4 btn-secondary">Back to Jobs</button>
        </div>
      );
    }

    const statusInfo = STATUS_FLOW[job.status as JobStatus];
    const canAdvance = job.status !== 'delivered';

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/carwash/jobs')} className="p-2 rounded-xl hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{job.job_number}</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Created {new Date(job.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {timeSince(job.created_at)} ago
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="rounded-2xl p-5" style={{ background: statusInfo.bg, border: `2px solid ${statusInfo.color}40` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: statusInfo.color }}>Status</p>
              <p className="text-xl font-bold" style={{ color: statusInfo.color }}>
                {job.status === 'waiting' ? '⏳' : job.status === 'in_progress' ? '🔄' : job.status === 'ready' ? '✅' : '🚗'} {' '}
                {statusInfo.label}
              </p>
            </div>
            {job.status === 'in_progress' && job.started_at && (
              <div className="text-right">
                <p className="text-xs" style={{ color: statusInfo.color }}>Time elapsed</p>
                <p className="text-lg font-bold" style={{ color: statusInfo.color }}>{timeSince(job.started_at)}</p>
              </div>
            )}
          </div>
          {canAdvance && (
            <div className="mt-4 flex gap-3">
              {job.status === 'ready' ? (
                <button
                  onClick={() => setShowSettle(true)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
                  style={{ background: statusInfo.color }}
                >
                  💰 Collect Payment & Deliver
                </button>
              ) : (
                <button
                  onClick={() => statusMutation.mutate({ jobId: job.id, status: statusInfo.next! })}
                  disabled={statusMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                  style={{ background: statusInfo.color }}
                >
                  {statusInfo.label}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Vehicle + Customer */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Vehicle & Customer</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Reg Number</p>
              <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{job.reg_number}</p></div>
            <div><p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Vehicle Type</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{job.vehicle_type}</p></div>
            {(job.make || job.model) && <div className="col-span-2"><p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Model</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{[job.make, job.model, job.color].filter(Boolean).join(' · ')}</p></div>}
            {job.customer_name && <div><p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Customer</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{job.customer_name}</p></div>}
            {job.customer_phone && <div><p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Phone</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{job.customer_phone}</p></div>}
            {job.staff_name && <div><p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Staff</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>👤 {job.staff_name}</p></div>}
          </div>
        </div>

        {/* Services */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Services</h2>
          {(job.items ?? []).map(item => (
            <div key={item.id} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.service_name}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{fmt(item.price)}</span>
            </div>
          ))}
          {job.discount > 0 && (
            <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-sm" style={{ color: '#dc2626' }}>Discount</span>
              <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>-{fmt(job.discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-3">
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Total</span>
            <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{fmt(job.total)}</span>
          </div>
          {job.membership_id && (
            <p className="mt-2 text-xs font-medium" style={{ color: '#7c3aed' }}>⭐ Membership applied</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {job.status === 'ready' && job.customer_phone && (
            <button onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: '#25d366' }}>
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </button>
          )}
          <button onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm btn-secondary">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>

        {/* Settle modal */}
        {showSettle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: 'var(--surface)' }}>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Collect Payment</h2>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{fmt(job.total)}</p>
              <div className="flex gap-2">
                {['cash', 'upi', 'card'].map(m => (
                  <button key={m} onClick={() => setSettlePayment(m)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize ${settlePayment === m ? 'text-white' : 'btn-secondary'}`}
                    style={settlePayment === m ? { background: 'var(--accent)' } : {}}>
                    {m === 'cash' ? '💵' : m === 'upi' ? '📱' : '💳'} {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSettle(false)} className="flex-1 btn-secondary">Cancel</button>
                <button onClick={() => { settleMutation.mutate(); handlePrint(); }}
                  disabled={settleMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}>
                  Print & Collect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── New job form ───────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/carwash/jobs')} className="p-2 rounded-xl hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Car Wash</p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Job Card</h1>
        </div>
      </div>

      {/* Vehicle */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Vehicle Details</h2>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Registration Number *</label>
          <input
            ref={regRef}
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
            onBlur={() => lookupVehicle(regNumber)}
            placeholder="e.g. MH12AB1234"
            className="w-full rounded-xl border px-3 py-3 text-base font-bold tracking-widest outline-none focus:ring-2"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
          />
          {activeMembership && (
            <div className="mt-2 rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: '#f3e8ff', border: '1px solid #e9d5ff' }}>
              <p className="text-sm font-semibold" style={{ color: '#7c3aed' }}>
                ⭐ Membership: {activeMembership.package_name} — {activeMembership.total_washes - activeMembership.used_washes} washes left
              </p>
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer" style={{ color: '#7c3aed' }}>
                <input type="checkbox" checked={useMembership} onChange={(e) => setUseMembership(e.target.checked)} />
                Apply
              </label>
            </div>
          )}
        </div>

        {/* Vehicle type */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Vehicle Type</label>
          <div className="grid grid-cols-4 gap-2">
            {VEHICLE_TYPES.map(vt => (
              <button key={vt.value} onClick={() => setVehicleType(vt.value)}
                className={`py-2.5 rounded-xl text-sm font-semibold flex flex-col items-center gap-1 transition-all ${vehicleType === vt.value ? 'text-white shadow-md' : 'btn-secondary'}`}
                style={vehicleType === vt.value ? { background: 'var(--accent)' } : {}}>
                <span className="text-lg">{vt.icon}</span>
                <span className="text-xs">{vt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Make</label>
            <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Maruti"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Model</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Swift"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Color</label>
            <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="White"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>

      {/* Customer */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Customer (optional)</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (for WhatsApp)"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {/* Services */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
          Services — {vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)} pricing
        </h2>
        {services.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No services yet. Add them in Services page.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {services.map(svc => {
            const price = getPriceForType(svc);
            const selected = !!selectedServices.find(s => s.service_id === svc.id);
            return (
              <button key={svc.id} onClick={() => toggleService(svc)}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${selected ? 'text-white shadow-md' : ''}`}
                style={selected ? { background: 'var(--accent)' } : { background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <div>
                  <p className="font-semibold">{svc.name}</p>
                  <p className="text-xs opacity-70">{svc.duration_minutes} min</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{fmt(price)}</p>
                  {selected && <CheckCircle className="h-4 w-4 ml-auto mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Staff + notes + discount */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Assign Staff</label>
            <select value={selectedStaffId}
              onChange={(e) => {
                setSelectedStaffId(e.target.value);
                setSelectedStaffName(staff.find(s => s.id === e.target.value)?.name ?? '');
              }}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
              <option value="">— No staff —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Discount (₹)</label>
            <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions…"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {/* Total + Create */}
      {selectedServices.length > 0 && (
        <div className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: 'var(--surface)', border: '2px solid var(--accent)' }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selectedServices.length} services selected</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{fmt(total)}</p>
            {discountAmt > 0 && <p className="text-xs" style={{ color: '#dc2626' }}>Discount: -{fmt(discountAmt)}</p>}
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="px-6 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60 shadow-lg"
            style={{ background: 'var(--accent)' }}
          >
            {createMutation.isPending ? 'Creating…' : '✓ Create Job Card'}
          </button>
        </div>
      )}
    </div>
  );
}
