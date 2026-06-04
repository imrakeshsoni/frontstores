// [carwash] [all tenants]
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { appCacheDir } from '@tauri-apps/api/path';
import { Car, Plus, Trash2, CheckCircle, Printer, MessageSquare, ArrowLeft, Clock, User, Edit2, X, Star, History } from 'lucide-react';
import { NumberPlateScanner } from '@/components/ui/NumberPlateScanner';
import { sendWhatsApp } from '@/lib/whatsapp';
import { useAppStore } from '@/app/store/app.store';
import {
  listJobs, createJob, updateJob, updateJobStatus, settleJob, deleteJob,
  listServices, listCarwashStaff, findVehicleByReg, findVehiclesByPhone, searchVehicles,
  findActiveMembership, getVehicleServiceHistory, getLoyaltyByPhone, listVehicleTypes, validateRegNumber,
  getAllServicePrices, updateAppointmentStatus,
  type CarwashJob, type CarwashVehicleTypeRecord, type JobStatus, type CarwashVehicle,
} from '@/lib/db/carwash';
import { listCustomers } from '@/lib/db/customers';

// VehicleType is now dynamic — driven by carwash_vehicle_types table
type VehicleType = string;

const STATUS_FLOW: Record<JobStatus, { next: JobStatus | null; label: string; color: string; bg: string }> = {
  waiting:     { next: 'in_progress', label: 'Start Washing',    color: '#2563eb', bg: '#eff6ff' },
  in_progress: { next: 'ready',       label: 'Mark Ready',       color: '#16a34a', bg: '#d1fae5' },
  ready:       { next: 'delivered',   label: 'Deliver & Settle', color: '#7c3aed', bg: '#ede9fe' },
  delivered:   { next: null,          label: 'Delivered',         color: '#6b7280', bg: '#f3f4f6' },
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
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function JobCardPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const config = useAppStore((s) => s.config);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const regRef = useRef<HTMLInputElement>(null);
  const prefillDone = useRef(false);

  // Form state for new job
  const [regNumber, setRegNumber]             = useState('');
  const [regError, setRegError]               = useState('');
  const [vehicleType, setVehicleType]         = useState<VehicleType>('sedan');
  const [make, setMake]                       = useState('');
  const [model, setModel]                     = useState('');
  const [color, setColor]                     = useState('');
  const [customerName, setCustomerName]       = useState('');
  const [customerPhone, setCustomerPhone]     = useState('');
  const [selectedStaffId, setSelectedStaffId]     = useState('');
  const [selectedStaffName, setSelectedStaffName] = useState('');
  const [selectedStaffIds, setSelectedStaffIds]   = useState<string[]>([]);
  const [selectedStaffNames, setSelectedStaffNames] = useState<string[]>([]);
  const [selectedServices, setSelectedServices]   = useState<SelectedService[]>([]);
  const [discount, setDiscount]               = useState('');
  const [notes, setNotes]                     = useState('');
  const [activeMembership, setActiveMembership]   = useState<any>(null);
  const [useMembership, setUseMembership]         = useState(false);
  const [settlePayment, setSettlePayment]         = useState('cash');
  const [showSettle, setShowSettle]               = useState(false);
  const [vehicleHistory, setVehicleHistory]       = useState<any>(null);
  const [loyaltyInfo, setLoyaltyInfo]             = useState<any>(null);
  const [showHistory, setShowHistory]             = useState(false);
  const [phoneVehicles, setPhoneVehicles]         = useState<CarwashVehicle[]>([]);
  const [phoneSearching, setPhoneSearching]       = useState(false);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live search dropdowns
  const [phoneResults, setPhoneResults]           = useState<any[]>([]);
  const [phoneResultsIdx, setPhoneResultsIdx]     = useState(-1);
  const [regResults, setRegResults]               = useState<CarwashVehicle[]>([]);
  const [regResultsIdx, setRegResultsIdx]         = useState(-1);
  const regDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit mode for existing job
  const [editMode, setEditMode]               = useState(false);
  const [editName, setEditName]               = useState('');
  const [editPhone, setEditPhone]             = useState('');
  const [editStaffId, setEditStaffId]         = useState('');
  const [editStaffName, setEditStaffName]     = useState('');
  const [editNotes, setEditNotes]             = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['carwash-services', tenantId],
    queryFn: () => listServices(tenantId),
    enabled: !!tenantId,
  });

  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ['carwash-vtypes', tenantId],
    queryFn: () => listVehicleTypes(tenantId),
    enabled: !!tenantId,
  });

  // service_id → vehicle_type_id → price (manual overrides from carwash_service_prices)
  const { data: servicePrices = {} } = useQuery({
    queryKey: ['carwash-service-prices', tenantId],
    queryFn: () => getAllServicePrices(tenantId),
    enabled: !!tenantId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['carwash-staff', tenantId],
    queryFn: () => listCarwashStaff(tenantId),
    enabled: !!tenantId,
  });

  const { data: job, isLoading: loadingJob } = useQuery({
    queryKey: ['carwash-job', id],
    queryFn: async () => {
      if (isNew) return null;
      const jobs = await listJobs(tenantId, { limit: 200 });
      return jobs.find(j => j.id === id) ?? null;
    },
    enabled: !!tenantId && !isNew,
    refetchInterval: 5000,
  });

  // Auto-fill vehicle info from history
  const lookupVehicle = async (reg: string) => {
    if (!reg || reg.length < 4) return;
    const v = await findVehicleByReg(tenantId, reg);
    if (v) {
      // Map legacy vehicle_type values to display names
      const legacyMap: Record<string, string> = { hatchback: 'Hatchback', sedan: 'Sedan', suv: 'SUV', luxury: 'Luxury' };
      const typeName = legacyMap[v.vehicle_type] ?? vehicleTypes.find(vt => vt.name.toLowerCase() === v.vehicle_type.toLowerCase())?.name ?? v.vehicle_type;
      setVehicleType(typeName);
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
    // Load vehicle service history for upsell panel
    const history = await getVehicleServiceHistory(tenantId, reg);
    setVehicleHistory(history.visitCount > 0 ? history : null);
    setShowHistory(history.visitCount > 0);

    // Load loyalty points
    if (v?.customer_phone) {
      const loyalty = await getLoyaltyByPhone(tenantId, v.customer_phone);
      setLoyaltyInfo(loyalty);
    }
  };

  // Phone lookup — debounced, triggers after 10 digits
  const handlePhoneChange = (phone: string) => {
    setCustomerPhone(phone);
    setPhoneVehicles([]);
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return;
    phoneTimerRef.current = setTimeout(async () => {
      setPhoneSearching(true);
      try {
        const vehicles = await findVehiclesByPhone(tenantId, digits);
        setPhoneVehicles(vehicles);
        if (vehicles.length === 1) {
          const v = vehicles[0];
          setCustomerName(v.customer_name ?? '');
          setRegNumber(v.reg_number);
          await lookupVehicle(v.reg_number);
          toast.success(`Found: ${v.customer_name ?? 'Customer'} — ${v.reg_number}`);
        } else if (vehicles.length > 1) {
          setCustomerName(vehicles[0].customer_name ?? '');
          toast.success(`${vehicles.length} vehicles found for this number — tap to select`);
        } else {
          toast(`No records found for this number — new customer`, { icon: '👤' });
        }
      } catch (e: any) {
        toast.error('Lookup failed: ' + (e?.message ?? 'unknown error'));
      } finally {
        setPhoneSearching(false);
      }
    }, 400);
  };

  // Select a vehicle from phone lookup results
  const selectPhoneVehicle = async (v: CarwashVehicle) => {
    setPhoneVehicles([]);
    setRegNumber(v.reg_number);
    setCustomerName(v.customer_name ?? '');
    await lookupVehicle(v.reg_number);
  };

  // ── Live reg search (like appointment page) ───────────────────────────────
  const handleRegInput = (value: string) => {
    setRegNumber(value.toUpperCase());
    setRegResultsIdx(-1);
    if (regDebounceRef.current) clearTimeout(regDebounceRef.current);
    if (value.length < 2) { setRegResults([]); return; }
    regDebounceRef.current = setTimeout(async () => {
      const results = await searchVehicles(tenantId, value);
      setRegResults(results);
    }, 300);
  };

  const selectVehicleFromReg = async (v: CarwashVehicle) => {
    setRegResults([]); setRegResultsIdx(-1);
    setRegNumber(v.reg_number);
    setCustomerName(v.customer_name ?? '');
    setCustomerPhone(v.customer_phone ?? '');
    await lookupVehicle(v.reg_number);
  };

  const handleRegKeyDown = (e: React.KeyboardEvent) => {
    if (!regResults.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setRegResultsIdx(i => Math.min(i + 1, regResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setRegResultsIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && regResultsIdx >= 0) { e.preventDefault(); selectVehicleFromReg(regResults[regResultsIdx]); }
    else if (e.key === 'Escape') { setRegResults([]); setRegResultsIdx(-1); }
  };

  // ── Live phone customer search ────────────────────────────────────────────
  const handlePhoneInput = (value: string) => {
    setCustomerPhone(value);
    setPhoneResults([]); setPhoneResultsIdx(-1);
    if (phoneSearchDebounce.current) clearTimeout(phoneSearchDebounce.current);
    if (value.length < 2) return;
    phoneSearchDebounce.current = setTimeout(async () => {
      const { items } = await listCustomers(tenantId, { search: value, perPage: 8 });
      setPhoneResults(items);
    }, 300);
    // Also trigger existing vehicle phone lookup after 10 digits
    handlePhoneChange(value);
  };

  const selectCustomerResult = async (c: any) => {
    setPhoneResults([]); setPhoneResultsIdx(-1);
    setCustomerName(c.name ?? '');
    setCustomerPhone(c.phone ?? '');
    if (c.phone) handlePhoneChange(c.phone);
  };

  const handlePhoneInputKeyDown = (e: React.KeyboardEvent) => {
    if (!phoneResults.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setPhoneResultsIdx(i => Math.min(i + 1, phoneResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPhoneResultsIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && phoneResultsIdx >= 0) { e.preventDefault(); selectCustomerResult(phoneResults[phoneResultsIdx]); }
    else if (e.key === 'Escape') { setPhoneResults([]); setPhoneResultsIdx(-1); }
  };

  const getPriceForType = (svc: any): number => {
    // 1. Manual price from carwash_service_prices (set in Setup → Services grid)
    const vt = vehicleTypes.find(v => v.name === vehicleType);
    if (vt && servicePrices[svc.id]?.[vt.id] != null) {
      return Number(servicePrices[svc.id][vt.id]);
    }
    // 2. Legacy fixed-column fallback for services created before the new pricing system
    const legacyKey = `price_${vehicleType.toLowerCase()}` as keyof typeof svc;
    if (svc[legacyKey] != null && Number(svc[legacyKey]) > 0) return Number(svc[legacyKey]);
    // 3. No price set — return 0 (user must set prices in Setup → Services)
    return 0;
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

  // Set default vehicle type to first active type once loaded
  useEffect(() => {
    if (vehicleTypes.length > 0 && !vehicleType) {
      setVehicleType(vehicleTypes[0].name);
    }
  }, [vehicleTypes]);

  // Pre-fill from appointment URL params — fires once when services + staff + vehicleTypes all loaded
  useEffect(() => {
    if (!isNew || prefillDone.current) return;
    if (!searchParams.get('reg') && !searchParams.get('name') && !searchParams.get('phone')) return;
    if (services.length === 0 || vehicleTypes.length === 0) return; // wait for data
    prefillDone.current = true;

    const reg        = searchParams.get('reg') ?? '';
    const name       = searchParams.get('name') ?? '';
    const phone      = searchParams.get('phone') ?? '';
    const vtype      = searchParams.get('vtype') ?? '';
    const make       = searchParams.get('make') ?? '';
    const model      = searchParams.get('model') ?? '';
    const staffId    = searchParams.get('staffId') ?? '';
    const staffName  = searchParams.get('staffName') ?? '';
    const svcNote    = searchParams.get('services') ?? '';
    const apptId     = searchParams.get('apptId') ?? '';

    if (reg)   setRegNumber(reg);
    if (name)  setCustomerName(name);
    if (phone) setCustomerPhone(phone);
    if (make)  setMake(make);
    if (model) setModel(model);
    if (staffId)   setSelectedStaffId(staffId);
    if (staffName) setSelectedStaffName(staffName);

    // Match vehicle type
    if (vtype) {
      const match = vehicleTypes.find(vt =>
        vt.name.toLowerCase() === vtype.toLowerCase() ||
        vt.name.toLowerCase().includes(vtype.toLowerCase())
      );
      if (match) setVehicleType(match.name);
    }

    // Match and pre-select services by name
    if (svcNote) {
      const requestedNames = svcNote.split(',').map(s => s.trim().toLowerCase());
      const matched: SelectedService[] = [];
      for (const svc of services) {
        if (requestedNames.some(r => svc.name.toLowerCase().includes(r) || r.includes(svc.name.toLowerCase()))) {
          const vt = vehicleTypes.find(v => v.name === (vtype || vehicleTypes[0]?.name));
          const legacyKey = `price_${(vtype || 'sedan').toLowerCase()}` as keyof typeof svc;
          const customPrice = vt ? servicePrices[svc.id]?.[vt.id] : undefined;
          const price = customPrice != null ? Number(customPrice)
            : (Number((svc as any)[legacyKey] ?? 0) > 0 ? Number((svc as any)[legacyKey]) : 0);
          matched.push({ service_id: svc.id, service_name: svc.name, price, gst_rate: svc.gst_rate });
        }
      }
      if (matched.length > 0) setSelectedServices(matched);
    }

    // Also trigger full vehicle lookup for membership + history
    if (reg) lookupVehicle(reg);
  }, [isNew, searchParams, services, vehicleTypes, staff]);

  // Re-price services when vehicle type changes
  useEffect(() => {
    setSelectedServices(prev =>
      prev.map(s => {
        const svc = services.find(sv => sv.id === s.service_id);
        if (!svc) return s;
        return { ...s, price: getPriceForType(svc) };
      })
    );
  }, [vehicleType, vehicleTypes]);

  const gstEnabled = config?.settings?.enable_gst !== false;
  const subtotal = selectedServices.reduce((s, i) => s + i.price, 0);
  const discountAmt = Math.max(0, Number(discount) || 0);
  const itemCount = Math.max(selectedServices.length, 1);
  const gstAmt = gstEnabled ? Math.round(selectedServices.reduce((s, i) => {
    const share = subtotal > 0 ? i.price / subtotal : 1 / itemCount;
    return s + (i.price - discountAmt * share) * i.gst_rate / 100;
  }, 0) * 100) / 100 : 0;
  const total = Math.max(0, subtotal - discountAmt + gstAmt);

  const createMutation = useMutation({
    mutationFn: () => {
      const regVal = validateRegNumber(regNumber);
      if (!regVal.valid) { setRegError(regVal.error!); throw new Error(regVal.error); }
      setRegError('');
      if (!customerPhone.trim()) throw new Error('Phone number is required');
      if (customerPhone.replace(/\D/g, '').length !== 10) throw new Error('Phone number must be exactly 10 digits');
      if (selectedServices.length === 0) throw new Error('Select at least one service');
      if ((selectedStaffIds.length === 0) && !selectedStaffId) throw new Error('Assign at least one staff member');
      if (discountAmt < 0) throw new Error('Discount cannot be negative');
      if (discountAmt > subtotal) throw new Error(`Discount (₹${discountAmt}) cannot exceed subtotal (₹${subtotal})`);
      return createJob(tenantId, {
        reg_number: regNumber.trim().toUpperCase(),
        vehicle_type: vehicleType as any,
        make: make || undefined,
        model: model || undefined,
        color: color || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        staff_id: selectedStaffIds[0] || selectedStaffId || undefined,
        staff_name: selectedStaffNames.length > 0 ? selectedStaffNames.join(', ') : selectedStaffName || undefined,
        items: gstEnabled ? selectedServices : selectedServices.map(s => ({ ...s, gst_rate: 0 })),
        discount: discountAmt || undefined,
        notes: notes || undefined,
        membership_id: useMembership && activeMembership ? activeMembership.id : undefined,
      });
    },
    onSuccess: async (newJob) => {
      toast.success(`Job Card ${newJob?.job_number ?? ''} created!`);
      qc.invalidateQueries({ queryKey: ['carwash-active-jobs'] });
      qc.invalidateQueries({ queryKey: ['carwash-jobs-list'] });
      qc.invalidateQueries({ queryKey: ['carwash-jobs-count'] });
      qc.invalidateQueries({ queryKey: ['carwash-stats'] });
      import('@/lib/autoSync').then(({ triggerAutoSync }) => triggerAutoSync(true)); // immediate push
      // Mark source appointment as arrived/done
      const apptId = searchParams.get('apptId') ?? '';
      if (apptId) {
        try { await updateAppointmentStatus(tenantId, apptId, 'arrived', newJob?.id); } catch { /* non-critical */ }
        qc.invalidateQueries({ queryKey: ['carwash-appointments'] });
      }
      navigate('/carwash/jobs');
    },
    onError: (e: any) => toast.error(String(e?.message ?? e ?? 'Failed to create job')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: JobStatus }) => updateJobStatus(tenantId, jobId, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['carwash-active-jobs'] });
      qc.invalidateQueries({ queryKey: ['carwash-stats'] });
      qc.invalidateQueries({ queryKey: ['carwash-job', id] });
      import('@/lib/autoSync').then(({ triggerAutoSync }) => triggerAutoSync());
      // [carwash] [all tenants] — auto-send "car is ready" when status becomes ready
      if (status === 'ready' && job?.customer_phone) {
        const phone = job.customer_phone.replace(/\D/g, '');
        if (phone.length >= 10) {
          const msg = `Hi ${job.customer_name ?? 'there'} 👋\n\nYour car *${job.reg_number}* is ready for pickup! 🚗✨\n\nServices done:\n${(job.items ?? []).map((i: any) => `• ${i.service_name}`).join('\n')}\n\nTotal: *${fmt(job.total ?? 0)}*\n\nSee you at *${config?.shop_name ?? 'our car wash'}*! 😊`;
          sendWhatsApp(phone, msg).catch(() => {});
        }
      }
    },
  });

  const settleMutation = useMutation({
    mutationFn: () => settleJob(tenantId, id!, settlePayment),
    onSuccess: async () => {
      toast.success('Payment collected — car delivered! 🚗');
      setShowSettle(false);
      qc.invalidateQueries({ queryKey: ['carwash-active-jobs'] });
      qc.invalidateQueries({ queryKey: ['carwash-stats'] });
      qc.invalidateQueries({ queryKey: ['carwash-job', id] });
      import('@/lib/autoSync').then(({ triggerAutoSync }) => triggerAutoSync(true)); // immediate push
      // Auto-send bill on WhatsApp if customer has a phone number
      if (job?.customer_phone) {
        try {
          const phone = job.customer_phone.replace(/\D/g, '');
          if (phone.length >= 10) {
            const items = job.items ?? [];
            const msg = `Hi ${job.customer_name ?? 'there'} 👋\n\nThank you for visiting *${config?.shop_name ?? 'our car wash'}*! 🚗✨\n\n*Invoice — ${job.job_number}*\nVehicle: ${job.reg_number}\n\n${items.map((i: any) => `• ${i.service_name} — ₹${i.price}`).join('\n')}\n${job.discount > 0 ? `\nDiscount: -₹${job.discount}` : ''}${job.gst_amount > 0 ? `\nGST: ₹${Math.round(job.gst_amount)}` : ''}\n\n*Total Paid: ₹${Math.round(job.total)}*\nPayment: ${settlePayment}\n\nSee you again! 😊`;
            await sendWhatsApp(phone, msg);
          }
        } catch { /* non-fatal — don't block payment */ }
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: () => updateJob(tenantId, id!, {
      customer_name: editName || undefined,
      customer_phone: editPhone || undefined,
      staff_id: editStaffId || undefined,
      staff_name: editStaffName || undefined,
      notes: editNotes || undefined,
    }),
    onSuccess: () => {
      toast.success('Job updated');
      setEditMode(false);
      qc.invalidateQueries({ queryKey: ['carwash-job', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteJob(tenantId, id!),
    onSuccess: () => {
      toast.success('Job deleted');
      qc.invalidateQueries({ queryKey: ['carwash-active-jobs'] });
      qc.invalidateQueries({ queryKey: ['carwash-stats'] });
      navigate('/carwash/jobs');
    },
  });

  const handleWhatsApp = (phone?: string, name?: string, items?: any[], total?: number, regNum?: string) => {
    const jobPhone = phone ?? job?.customer_phone ?? '';
    const jobName = name ?? job?.customer_name ?? 'there';
    const jobItems = items ?? job?.items ?? [];
    const jobTotal = total ?? job?.total ?? 0;
    const jobReg = regNum ?? job?.reg_number ?? '';
    const cleanPhone = String(jobPhone).replace(/\D/g, '');
    if (cleanPhone.length < 10) { toast.error('Invalid phone number'); return; }
    const msg = `Hi ${jobName} 👋\n\nYour car *${jobReg}* is ready for pickup! 🚗✨\n\nServices done:\n${jobItems.map((i: any) => `• ${i.service_name}`).join('\n')}\n\nTotal: *${fmt(jobTotal)}*\n\nThank you for visiting ${config?.shop_name ?? 'our car wash'}! 😊`;
    sendWhatsApp(cleanPhone, msg);
  };

  const handlePrint = async (jobData?: CarwashJob) => {
    const j = jobData ?? job;
    if (!j) return;
    const shopName = config?.shop_name ?? 'Car Wash';
    const logo = (config?.settings as any)?.logo_base64;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:'Courier New',monospace;max-width:300px;margin:0 auto;padding:12px;font-size:12px}
      .center{text-align:center} .bold{font-weight:700} .line{border-top:1px dashed #000;margin:6px 0}
      .row{display:flex;justify-content:space-between;margin:2px 0}
      .big{font-size:16px;font-weight:700}
      .logo{max-height:50px;max-width:120px;object-fit:contain;margin-bottom:4px}
    </style></head><body>
    <div class="center">
      ${logo ? `<img src="${logo}" class="logo" /><br/>` : ''}
      <span class="bold" style="font-size:15px">${shopName}</span>
    </div>
    <div class="center" style="font-size:10px">${[config?.address_line1, config?.city].filter(Boolean).join(', ')}</div>
    ${config?.phone ? `<div class="center" style="font-size:10px">📞 ${config.phone}</div>` : ''}
    <div class="line"></div>
    <div class="center bold big">INVOICE</div>
    <div class="row"><span>Invoice #</span><span class="bold">${j.job_number}</span></div>
    <div class="row"><span>Date</span><span>${new Date(j.created_at).toLocaleDateString('en-IN')}</span></div>
    <div class="row"><span>Reg Number</span><span class="bold">${j.reg_number}</span></div>
    <div class="row"><span>Vehicle Type</span><span>${j.vehicle_type}</span></div>
    ${j.make || j.model ? `<div class="row"><span>Make / Model</span><span>${[j.make, j.model].filter(Boolean).join(' ')}</span></div>` : ''}
    ${j.color ? `<div class="row"><span>Color</span><span>${j.color}</span></div>` : ''}
    ${j.customer_name ? `<div class="row"><span>Customer</span><span>${j.customer_name}</span></div>` : ''}
    ${j.customer_phone ? `<div class="row"><span>Phone</span><span>${j.customer_phone}</span></div>` : ''}
    ${j.staff_name ? `<div class="row"><span>Staff</span><span>${j.staff_name}</span></div>` : ''}
    <div class="line"></div>
    <div class="bold" style="margin-bottom:4px">Services</div>
    ${(j.items ?? []).map(i => `<div class="row"><span>${i.service_name}</span><span>${fmt(i.price)}</span></div>`).join('')}
    <div class="line"></div>
    ${j.discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(j.discount)}</span></div>` : ''}
    ${j.gst_amount > 0 ? `<div class="row"><span>GST</span><span>${fmt(j.gst_amount)}</span></div>` : ''}
    <div class="row bold big"><span>TOTAL</span><span>${fmt(j.total)}</span></div>
    ${j.payment_method ? `<div class="row" style="font-size:10px"><span>Payment</span><span>${j.payment_method.toUpperCase()}</span></div>` : ''}
    <div class="line"></div>
    <div class="center" style="font-size:10px;margin-top:6px">Thank you! Come again 🚗</div>
    </body></html>`;
    const finalHtml = html.replace('</body>', `<script>window.addEventListener('load',function(){setTimeout(window.print,400);})<\/script></body>`);
    try {
      const cacheDir = await appCacheDir();
      const sep = cacheDir.endsWith('/') || cacheDir.endsWith('\\') ? '' : '/';
      const filePath = `${cacheDir}${sep}carwash-job-${Date.now()}.html`;
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
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{job.job_number}</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Created {new Date(job.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {timeSince(job.created_at)} ago
            </p>
          </div>
          {job.status !== 'delivered' && (
            <button onClick={() => {
              if (!confirm('Delete this job? This will restore any membership wash used.')) return;
              deleteMutation.mutate();
            }} className="p-2 rounded-xl" style={{ color: '#dc2626' }}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="rounded-2xl p-5" style={{ background: statusInfo.bg, border: `2px solid ${statusInfo.color}40` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: statusInfo.color }}>Status</p>
              <p className="text-xl font-bold" style={{ color: statusInfo.color }}>
                {job.status === 'waiting' ? '⏳' : job.status === 'in_progress' ? '🔄' : job.status === 'ready' ? '✅' : '🚗'}{' '}
                {job.status === 'waiting' ? 'Waiting' : job.status === 'in_progress' ? 'In Progress' : job.status === 'ready' ? 'Ready for Pickup' : 'Delivered'}
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
                <button onClick={() => setShowSettle(true)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
                  style={{ background: statusInfo.color }}>
                  💰 Collect Payment & Deliver
                </button>
              ) : (
                <button
                  onClick={() => statusMutation.mutate({ jobId: job.id, status: statusInfo.next! })}
                  disabled={statusMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-60"
                  style={{ background: statusInfo.color }}>
                  {statusInfo.label}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Vehicle + Customer */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Vehicle & Customer</h2>
            {job.status !== 'delivered' && !editMode && (
              <button onClick={() => {
                setEditName(job.customer_name ?? '');
                setEditPhone(job.customer_phone ?? '');
                setEditStaffId(job.staff_id ?? '');
                setEditStaffName(job.staff_name ?? '');
                setEditNotes(job.notes ?? '');
                setEditMode(true);
              }} className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg btn-secondary">
                <Edit2 className="h-3 w-3" /> Edit
              </button>
            )}
          </div>

          {editMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Customer Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Staff</label>
                <select value={editStaffId} onChange={e => {
                  setEditStaffId(e.target.value);
                  setEditStaffName(staff.find(s => s.id === e.target.value)?.name ?? '');
                }} className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                  <option value="">— No staff —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="flex-1 btn-secondary py-2 rounded-xl text-sm">Cancel</button>
                <button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}>Save</button>
              </div>
            </div>
          ) : (
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
              {job.notes && <div className="col-span-2"><p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Notes</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{job.notes}</p></div>}
            </div>
          )}
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
          {job.gst_amount > 0 && (
            <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>GST</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(job.gst_amount)}</span>
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
          {job.customer_phone && (
            <button onClick={() => handleWhatsApp()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: '#25d366' }}>
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </button>
          )}
          <button onClick={() => handlePrint()}
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
  // Upsell: services not yet selected that this vehicle has used before
  const upsellServices = vehicleHistory?.serviceHistory
    ?.filter((h: any) => !selectedServices.find(s => s.service_name === h.service_name))
    ?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
        <button onClick={() => navigate('/carwash/jobs')} className="p-1.5 rounded-xl hover:opacity-70">
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Car className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>New Job Card</h1>
          {vehicleHistory && vehicleHistory.visitCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
              ↩ Return · {vehicleHistory.visitCount} visits
            </span>
          )}
          {activeMembership && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
              ⭐ {activeMembership.package_name} · {activeMembership.total_washes - activeMembership.used_washes} left
            </span>
          )}
          {loyaltyInfo?.available_points > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
              ★ {loyaltyInfo.available_points} pts
            </span>
          )}
        </div>
      </div>

      {/* 3-column body — fills remaining height, no scroll on outer */}
      <div className="flex flex-1 overflow-hidden" style={{ gap: 0 }}>

        {/* ── LEFT PANEL: Customer → Vehicle → Staff ── */}
        <div className="flex flex-col overflow-y-auto" style={{ width: '30%', borderRight: '1px solid var(--surface-border)', background: 'var(--bg)' }}>

          {/* ── CUSTOMER ── */}
          <div className="px-5 pt-5 pb-4 space-y-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>👤 Customer</p>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Mobile Number *</label>
              <div className="relative">
                <input value={customerPhone}
                  onChange={e => handlePhoneInput(e.target.value)}
                  onKeyDown={handlePhoneInputKeyDown}
                  onBlur={() => setTimeout(() => setPhoneResults([]), 150)}
                  placeholder="Type to search or enter number" type="tel"
                  className="w-full rounded-xl border px-4 py-3 text-base font-bold outline-none"
                  style={{ borderColor: customerPhone.replace(/\D/g,'').length===10 ? 'var(--accent)' : 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                {phoneSearching && (
                  <svg className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                {phoneResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
                    style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
                    {phoneResults.map((c, i) => (
                      <button key={c.id} type="button" onMouseDown={() => selectCustomerResult(c)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                        style={{ background: i === phoneResultsIdx ? 'var(--accent)' : 'transparent',
                                 color: i === phoneResultsIdx ? '#111' : 'var(--text-primary)',
                                 borderBottom: '1px solid var(--surface-border)' }}>
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: i === phoneResultsIdx ? '#111' : 'var(--accent)', color: i === phoneResultsIdx ? 'var(--accent)' : '#111' }}>
                          {c.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{c.name}</p>
                          <p className="text-xs opacity-60">{c.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Customer Name</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Auto-filled or enter name"
                className="w-full rounded-xl border px-4 py-3 text-base outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>

            {/* Multi-vehicle picker */}
            {phoneVehicles.length > 1 && (
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {phoneVehicles.length} vehicles found — select one:
                </p>
                <div className="space-y-1.5">
                  {phoneVehicles.map(v => (
                    <button key={v.id} onClick={() => selectPhoneVehicle(v)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all"
                      style={{ borderColor: regNumber === v.reg_number ? 'var(--accent)' : 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                      <span className="text-lg">🚗</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm tracking-wider">{v.reg_number}</p>
                        {(v.make || v.model) && <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{[v.make, v.model].filter(Boolean).join(' ')}</p>}
                      </div>
                      {regNumber === v.reg_number && <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── VEHICLE ── */}
          <div className="px-5 pt-4 pb-4 space-y-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>🚗 Vehicle</p>

            {/* Reg number */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Registration Number *</label>
              <div className="flex gap-2 items-start">
                <div className="relative flex-1">
                  <input ref={regRef} value={regNumber}
                    onChange={e => { handleRegInput(e.target.value); setRegError(''); }}
                    onKeyDown={handleRegKeyDown}
                    onBlur={() => {
                      setTimeout(() => setRegResults([]), 150);
                      if (regNumber) { const v = validateRegNumber(regNumber); setRegError(v.valid ? '' : v.error!); }
                    }}
                    placeholder="MH12AB1234 or 22BH0001AA"
                    className="w-full rounded-xl border px-4 py-3 text-base font-bold tracking-widest outline-none"
                    style={{ borderColor: regError ? '#f87171' : regNumber && !regError ? 'var(--accent)' : 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                  {regError && <p className="text-xs mt-1 font-medium" style={{ color: '#f87171' }}>{regError}</p>}
                  {regResults.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
                      style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
                      {regResults.map((v, i) => (
                        <button key={v.id} type="button" onMouseDown={() => selectVehicleFromReg(v)}
                          className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                          style={{ background: i === regResultsIdx ? 'var(--accent)' : 'transparent',
                                   color: i === regResultsIdx ? '#111' : 'var(--text-primary)',
                                   borderBottom: '1px solid var(--surface-border)' }}>
                          <span className="text-lg">🚗</span>
                          <div>
                            <p className="text-sm font-bold tracking-wider">{v.reg_number}</p>
                            <p className="text-xs opacity-60">{v.customer_name}{v.make ? ` · ${v.make}` : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <NumberPlateScanner onDetected={plate => { handleRegInput(plate); lookupVehicle(plate); }} />
              </div>
            </div>

            {/* Vehicle type pills */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Vehicle Type</label>
              <div className="flex flex-wrap gap-2">
                {vehicleTypes.map(vt => (
                  <button key={vt.id} onClick={() => setVehicleType(vt.name)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={vehicleType === vt.name
                      ? { background: 'var(--accent)', color: 'var(--on-accent, #111)' }
                      : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                    <span className="text-base">{vt.icon}</span> {vt.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Make / Model / Color */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Make', val: make, set: setMake, ph: 'Maruti' },
                { label: 'Model', val: model, set: setModel, ph: 'Swift' },
                { label: 'Color', val: color, set: setColor, ph: 'White' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                </div>
              ))}
            </div>

            {/* Return customer history */}
            {showHistory && vehicleHistory && (
              <div className="rounded-xl p-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <p className="text-sm font-bold" style={{ color: '#15803d' }}>
                  ↩ Return customer · {vehicleHistory.visitCount} visits · {fmt(vehicleHistory.totalSpent)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#16a34a' }}>Last visit {daysSince(vehicleHistory.lastVisit)} days ago</p>
                {vehicleHistory.serviceHistory.slice(0, 3).map((h: any) => (
                  <p key={h.service_name} className="text-xs mt-0.5" style={{ color: '#16a34a' }}>• {h.service_name} ({h.count}×)</p>
                ))}
              </div>
            )}

            {/* Membership */}
            {activeMembership && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: '#f3e8ff', border: '1px solid #e9d5ff' }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#7c3aed' }}>⭐ {activeMembership.package_name}</p>
                  <p className="text-xs" style={{ color: '#9333ea' }}>{activeMembership.total_washes - activeMembership.used_washes} washes remaining</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: '#7c3aed' }}>
                  <input type="checkbox" checked={useMembership} onChange={(e) => setUseMembership(e.target.checked)} />
                  Apply
                </label>
              </div>
            )}
          </div>

          {/* ── STAFF & JOB DETAILS ── */}
          <div className="px-5 pt-4 pb-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>⚙️ Job Details</p>

            {/* Staff */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Assign Staff <span className="font-normal text-xs" style={{ color: 'var(--text-tertiary)' }}>(select multiple)</span>
              </label>
              {staff.length === 0
                ? <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No staff added yet — add in Staff page.</p>
                : <div className="flex flex-wrap gap-2">
                    {staff.map(s => {
                      const sel = selectedStaffIds.includes(s.id);
                      return (
                        <button key={s.id} type="button"
                          onClick={() => {
                            const ids = sel ? selectedStaffIds.filter(id => id !== s.id) : [...selectedStaffIds, s.id];
                            const names = sel ? selectedStaffNames.filter(n => n !== s.name) : [...selectedStaffNames, s.name];
                            setSelectedStaffIds(ids); setSelectedStaffNames(names);
                            setSelectedStaffId(ids[0] ?? ''); setSelectedStaffName(names[0] ?? '');
                          }}
                          className="px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={sel
                            ? { background: 'var(--accent)', color: 'var(--on-accent, #111)' }
                            : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                          {sel ? '✓ ' : ''}{s.name}
                        </button>
                      );
                    })}
                  </div>
              }
            </div>

            {/* Discount + Notes */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Discount (₹)</label>
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0"
                className="w-full rounded-xl border px-4 py-3 text-base outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions…"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        </div>

        {/* ── CENTER: Services ── */}
        <div className="flex-1 flex flex-col overflow-hidden p-4" style={{ background: 'var(--bg)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              Services — {vehicleType} pricing
            </p>
            {selectedServices.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#111' }}>
                {selectedServices.length} selected
              </span>
            )}
          </div>

          {/* Upsell bar */}
          {upsellServices.length > 0 && (
            <div className="mb-3 rounded-xl p-2.5 flex flex-wrap gap-1.5" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <span className="text-xs font-bold self-center" style={{ color: '#92400e' }}>⚡ Used before:</span>
              {upsellServices.map((h: any) => {
                const svc = services.find(s => s.name === h.service_name);
                if (!svc) return null;
                return (
                  <button key={h.service_name} onClick={() => toggleService(svc)}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                    + {h.service_name} {fmt(getPriceForType(svc))}
                  </button>
                );
              })}
            </div>
          )}

          {/* Services grid — scrolls if needed */}
          <div className="flex-1 overflow-y-auto">
            {services.length === 0 && (
              <p className="text-sm text-center pt-8" style={{ color: 'var(--text-tertiary)' }}>No services yet — add them in Services page.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {services.map(svc => {
                const price = getPriceForType(svc);
                const selected = !!selectedServices.find(s => s.service_id === svc.id);
                return (
                  <button key={svc.id} onClick={() => toggleService(svc)}
                    className="text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between"
                    style={selected
                      ? { background: 'var(--accent)', color: 'var(--on-accent, #111)' }
                      : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                    <div>
                      <p className="font-semibold text-sm">{svc.name}</p>
                      <p className="text-xs opacity-60">{svc.duration_minutes} min</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{fmt(price)}</p>
                      {selected && <CheckCircle className="h-3.5 w-3.5 ml-auto mt-0.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ── Bottom bar — total + create ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ borderTop: '1px solid var(--surface-border)', background: 'var(--surface)' }}>

        {/* Left — breakdown */}
        <div className="flex items-center gap-6">
          {selectedServices.length === 0
            ? <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select services from the center to start</p>
            : <>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Services</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selectedServices.length} selected</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Subtotal</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(subtotal)}</p>
                </div>
                {discountAmt > 0 && (
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Discount</p>
                    <p className="text-sm font-bold" style={{ color: '#16a34a' }}>− {fmt(discountAmt)}</p>
                  </div>
                )}
                {gstEnabled && gstAmt > 0 && (
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>GST</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(gstAmt)}</p>
                  </div>
                )}
                <div style={{ borderLeft: '2px solid var(--surface-border)', paddingLeft: '1.5rem' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>TOTAL</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{fmt(total)}</p>
                </div>
              </>
          }
        </div>

        {/* Right — create button */}
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || selectedServices.length === 0}
          className="px-8 py-3 rounded-2xl font-bold text-base disabled:opacity-40 transition-all"
          style={{ background: 'var(--accent)', color: 'var(--on-accent, #111)', minWidth: '180px' }}>
          {createMutation.isPending ? 'Creating…' : '✓ Create Job Card'}
        </button>
      </div>

    </div>
  );
}
