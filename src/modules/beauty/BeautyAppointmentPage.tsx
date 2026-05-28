// [beauty] [all tenants]
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Check, ArrowLeft, Printer } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import {
  listActiveServices, listActiveStaff, createAppointment, getAppointmentWithItems,
  updateAppointmentStatus, updateAppointmentPayment, deleteAppointment,
  type BeautyService, type BeautyAppointmentItem,
} from '@/lib/db/beauty';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

const STATUS_STEPS = ['scheduled', 'walk_in', 'in_progress', 'completed'];
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', walk_in: 'Walk-in', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};

type CartItem = { service_id: string | null; service_name: string; price: number; gst_rate: number };

export function BeautyAppointmentListPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ['beauty-appts', tenantId, date],
    queryFn:  () => import('@/lib/db/beauty').then(m => m.listAppointments(tenantId, { date })),
    enabled:  !!tenantId,
    refetchInterval: 15000,
  });

  const filtered = statusFilter === 'all' ? appts : appts.filter(a => a.status === statusFilter);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => updateAppointmentStatus(tenantId, id, 'cancelled'),
    onSuccess: () => { toast.success('Appointment cancelled'); qc.invalidateQueries({ queryKey: ['beauty-appts'] }); },
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Beauty Parlor</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Appointments</h1>
        </div>
        <button onClick={() => navigate('/beauty/appointments/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        {['all', 'scheduled', 'walk_in', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all`}
            style={statusFilter === s ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {STATUS_LABEL[s] ?? 'All'} {s === 'all' ? `(${appts.length})` : `(${appts.filter(a => a.status === s).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 m-3 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-4xl mb-3">💇</p>
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No appointments for this date</p>
            <button onClick={() => navigate('/beauty/appointments/new')}
              className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
              Create Appointment
            </button>
          </div>
        )}
        {filtered.map((a, idx) => {
          const statusColor: Record<string, string> = { scheduled: '#f59e0b', walk_in: '#8b5cf6', in_progress: '#3b82f6', completed: '#10b981', cancelled: '#6b7280' };
          const color = statusColor[a.status] ?? '#6b7280';
          return (
            <div key={a.id} className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--surface-border)' : 'none' }}
              onClick={() => navigate(`/beauty/appointments/${a.id}`)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{a.customer_name || 'Walk-in'}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + '20', color }}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {a.appointment_number} · {a.staff_name || 'Unassigned'} {a.time_slot ? `· ⏰ ${a.time_slot}` : ''}
                </p>
                {a.items && a.items.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {a.items.slice(0, 3).map((i: any) => i.service_name).join(', ')}{a.items.length > 3 ? ` +${a.items.length - 3}` : ''}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{fmt(a.total)}</p>
                <p className="text-xs" style={{ color: a.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                  {a.payment_status === 'paid' ? 'Paid' : 'Pending'}
                </p>
              </div>
              {a.status !== 'completed' && a.status !== 'cancelled' && (
                <button onClick={e => { e.stopPropagation(); cancelMutation.mutate(a.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BeautyNewAppointmentPage() {
  const tenantId  = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName  = useAppStore((s) => s.config?.shop_name ?? 'Beauty Parlor');
  const navigate  = useNavigate();
  const qc        = useQueryClient();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [staffId, setStaffId] = useState('');
  const [staffName, setStaffName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [timeSlot, setTimeSlot] = useState('');
  const [status, setStatus] = useState<'walk_in' | 'scheduled'>('walk_in');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [svcSearch, setSvcSearch] = useState('');

  const { data: services = [] } = useQuery({ queryKey: ['beauty-services', tenantId], queryFn: () => listActiveServices(tenantId), enabled: !!tenantId });
  const { data: staff = [] }    = useQuery({ queryKey: ['beauty-staff', tenantId],    queryFn: () => listActiveStaff(tenantId),    enabled: !!tenantId });

  const filteredSvcs = services.filter(s => s.name.toLowerCase().includes(svcSearch.toLowerCase()));

  const subtotal   = cart.reduce((sum, i) => sum + i.price, 0);
  const gstAmount  = cart.reduce((sum, i) => sum + (i.price * i.gst_rate) / 100, 0);
  const total      = Math.max(0, subtotal + gstAmount - discount);

  const addService = (svc: BeautyService) => {
    setCart(c => [...c, { service_id: svc.id, service_name: svc.name, price: svc.price, gst_rate: svc.gst_rate }]);
  };

  const removeItem = (idx: number) => setCart(c => c.filter((_, i) => i !== idx));

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!cart.length) throw new Error('Add at least one service');
      const selStaff = staff.find(s => s.id === staffId);
      return createAppointment(tenantId, {
        customer_name: customerName || null, customer_phone: customerPhone || null, customer_id: null,
        staff_id: staffId || null, staff_name: selStaff?.name ?? (staffName || null),
        appointment_date: date, time_slot: timeSlot || null, status,
        payment_method: paymentMethod, payment_status: paymentMethod !== 'pending' ? 'paid' : 'pending',
        subtotal, discount, gst_amount: gstAmount, total,
        membership_id: null, notes: notes || null, started_at: null, completed_at: null,
      }, cart);
    },
    onSuccess: (id) => {
      toast.success('Appointment created!');
      qc.invalidateQueries({ queryKey: ['beauty-appts'] });
      qc.invalidateQueries({ queryKey: ['beauty-stats'] });
      navigate(`/beauty/appointments/${id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/beauty/appointments')} className="p-2 rounded-xl hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Beauty Parlor</p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>New Appointment</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Customer & Service selection */}
        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(['walk_in', 'scheduled'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                style={status === s ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                {s === 'walk_in' ? '🚶 Walk-in' : '📅 Scheduled'}
              </button>
            ))}
          </div>

          {/* Customer info */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Customer Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Name</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Phone</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone number"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          </div>

          {/* Staff & Time */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Staff & Timing</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Stylist</label>
                <select value={staffId} onChange={e => setStaffId(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
              </div>
              {status === 'scheduled' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>Time Slot</label>
                  <input type="time" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
              )}
            </div>
          </div>

          {/* Service picker */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Add Services</p>
            <input value={svcSearch} onChange={e => setSvcSearch(e.target.value)} placeholder="Search services…"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredSvcs.map(svc => (
                <button key={svc.id} onClick={() => addService(svc)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors border"
                  style={{ borderColor: 'var(--surface-border)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{svc.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{svc.duration_minutes}min</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(svc.price)}</span>
                    <Plus className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  </div>
                </button>
              ))}
              {filteredSvcs.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No services found</p>
              )}
            </div>
          </div>
        </div>

        {/* Right — Bill */}
        <div className="space-y-4">
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Bill</p>
            {cart.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Add services from the left</p>
            )}
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.service_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>GST {item.gst_rate}%</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{fmt(item.price)}</span>
                  <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span style={{ color: 'var(--text-primary)' }}>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>GST</span>
                  <span style={{ color: 'var(--text-primary)' }}>{fmt(gstAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                  <input type="number" value={discount || ''} onChange={e => setDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 rounded-lg border px-2 py-1 text-sm text-right outline-none"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                </div>
                <div className="flex justify-between font-bold pt-1" style={{ borderTop: '2px solid var(--surface-border)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Total</span>
                  <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{fmt(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Payment</p>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'upi', 'card'].map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className="py-2 rounded-xl text-sm font-semibold border transition-all capitalize"
                  style={paymentMethod === m ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : { borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Special instructions, product used…"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
              style={{ borderColor: 'var(--surface-border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
          </div>

          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || cart.length === 0}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
            style={{ background: 'var(--accent)' }}>
            {saveMutation.isPending ? 'Saving…' : `Create Appointment · ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BeautyAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const shopName  = useAppStore((s) => s.config?.shop_name ?? 'Beauty Parlor');
  const navigate  = useNavigate();
  const qc        = useQueryClient();

  const { data: appt, isLoading } = useQuery({
    queryKey: ['beauty-appt', tenantId, id],
    queryFn:  () => getAppointmentWithItems(tenantId, id!),
    enabled:  !!tenantId && !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (s: string) => updateAppointmentStatus(tenantId, id!, s),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['beauty-appt', tenantId, id] }); qc.invalidateQueries({ queryKey: ['beauty-stats'] }); qc.invalidateQueries({ queryKey: ['beauty-appts'] }); },
  });

  const payMutation = useMutation({
    mutationFn: (pm: string) => updateAppointmentPayment(tenantId, id!, pm, 'paid'),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['beauty-appt', tenantId, id] }); },
  });

  const handlePrint = () => {
    if (!appt) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const lines = appt.items?.map(i => `<tr><td>${i.service_name}</td><td style="text-align:right">₹${i.price}</td></tr>`).join('') ?? '';
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;width:300px;margin:0 auto}table{width:100%}th,td{padding:4px}hr{border-top:1px dashed #000}</style></head><body>
      <h3 style="text-align:center">${shopName}</h3>
      <p style="text-align:center">${appt.appointment_number}</p>
      <p>${appt.customer_name || 'Walk-in'} ${appt.customer_phone ? '· ' + appt.customer_phone : ''}</p>
      <p>Staff: ${appt.staff_name || 'N/A'} · Date: ${appt.appointment_date}</p>
      <hr/><table><tbody>${lines}</tbody></table><hr/>
      <p>Subtotal: ₹${appt.subtotal}</p>
      <p>GST: ₹${appt.gst_amount}</p>
      ${appt.discount ? `<p>Discount: -₹${appt.discount}</p>` : ''}
      <p><strong>Total: ₹${appt.total}</strong></p>
      <p>Payment: ${appt.payment_method?.toUpperCase()} · ${appt.payment_status}</p>
      <p style="text-align:center;margin-top:12px">Thank you!</p>
    </body></html>`);
    w.print();
  };

  if (isLoading) return <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>;
  if (!appt) return <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>Appointment not found</div>;

  const statusColor: Record<string, string> = { scheduled: '#f59e0b', walk_in: '#8b5cf6', in_progress: '#3b82f6', completed: '#10b981', cancelled: '#6b7280' };
  const color = statusColor[appt.status] ?? '#6b7280';

  const nextStatus: Record<string, string> = { scheduled: 'in_progress', walk_in: 'in_progress', in_progress: 'completed' };
  const nextLabel: Record<string, string> = { scheduled: 'Start Service', walk_in: 'Start Service', in_progress: 'Mark Complete' };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/beauty/appointments')} className="p-2 rounded-xl hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex-1">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{appt.appointment_number}</p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{appt.customer_name || 'Walk-in'}</h1>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ background: color + '20', color }}>
          {STATUS_LABEL[appt.status] ?? appt.status}
        </span>
        <button onClick={handlePrint} className="p-2 rounded-xl hover:bg-slate-100">
          <Printer className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Details */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Details</p>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Customer', value: appt.customer_name || 'Walk-in' },
              { label: 'Phone', value: appt.customer_phone || '—' },
              { label: 'Staff', value: appt.staff_name || 'Unassigned' },
              { label: 'Date', value: appt.appointment_date },
              { label: 'Time', value: appt.time_slot || '—' },
              { label: 'Notes', value: appt.notes || '—' },
            ].map(r => (
              <div key={r.label} className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{r.label}</span>
                <span style={{ color: 'var(--text-primary)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bill */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Services & Bill</p>
          {appt.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{item.service_name}</span>
              <span style={{ color: 'var(--accent)' }} className="font-semibold">₹{item.price}</span>
            </div>
          ))}
          <div className="space-y-1 pt-1 text-sm">
            <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span>₹{appt.subtotal}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>GST</span><span>₹{appt.gst_amount}</span></div>
            {appt.discount > 0 && <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Discount</span><span>-₹{appt.discount}</span></div>}
            <div className="flex justify-between font-bold text-base pt-1" style={{ borderTop: '2px solid var(--surface-border)' }}>
              <span>Total</span><span style={{ color: 'var(--accent)' }}>₹{appt.total}</span>
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span style={{ color: 'var(--text-tertiary)' }}>Payment</span>
              <span className="font-medium" style={{ color: appt.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                {appt.payment_method?.toUpperCase()} · {appt.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {appt.status !== 'completed' && appt.status !== 'cancelled' && (
        <div className="flex flex-wrap gap-3">
          {nextStatus[appt.status] && (
            <button onClick={() => statusMutation.mutate(nextStatus[appt.status])} disabled={statusMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: 'var(--accent)' }}>
              <Check className="h-4 w-4" /> {nextLabel[appt.status]}
            </button>
          )}
          {appt.payment_status !== 'paid' && (
            <div className="flex gap-2">
              {['cash', 'upi', 'card'].map(m => (
                <button key={m} onClick={() => payMutation.mutate(m)} disabled={payMutation.isPending}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
                  style={{ borderColor: '#10b981', color: '#10b981', background: '#f0fdf4' }}>
                  Collect {m.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => statusMutation.mutate('cancelled')}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
            style={{ borderColor: '#ef4444', color: '#ef4444', background: '#fef2f2' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
