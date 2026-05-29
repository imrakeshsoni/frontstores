// [travel] [all tenants]
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store/app.store';
import { createBooking } from '@/lib/db/travel';
import { toast } from 'sonner';

export function NewBookingPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', pax: '1', trip_type: 'domestic',
    destination: '', departure_date: '', return_date: '',
    total_amount: '', advance_paid: '0', status: 'confirmed', notes: '', booking_no: '',
  });

  const save = useMutation({
    mutationFn: () => createBooking(tenantId, {
      booking_no: form.booking_no, customer_name: form.customer_name, customer_phone: form.customer_phone,
      pax: parseInt(form.pax) || 1, trip_type: form.trip_type, destination: form.destination,
      departure_date: form.departure_date, return_date: form.return_date || null,
      total_amount: parseFloat(form.total_amount) || 0, advance_paid: parseFloat(form.advance_paid) || 0,
      status: form.status, notes: form.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tr-bookings'] });
      qc.invalidateQueries({ queryKey: ['travel-stats'] });
      toast.success('Booking created');
      navigate('/travel/bookings');
    },
    onError: (e) => toast.error(String(e)),
  });

  const up = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/travel/bookings')} className="text-slate-400 hover:text-slate-700 text-sm">← Back</button>
        <h1 className="text-2xl font-bold text-slate-900">New Booking</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        {[
          { key: 'customer_name', label: 'Customer Name *', placeholder: 'Customer full name' },
          { key: 'customer_phone', label: 'Phone', placeholder: '9xxxxxxxxx' },
          { key: 'destination', label: 'Destination *', placeholder: 'e.g. Goa, Dubai, Paris' },
          { key: 'pax', label: 'Pax (passengers)', placeholder: '1', type: 'number' },
          { key: 'departure_date', label: 'Departure Date *', type: 'date' },
          { key: 'return_date', label: 'Return Date', type: 'date' },
          { key: 'total_amount', label: 'Total Amount (₹)', placeholder: '25000', type: 'number' },
          { key: 'advance_paid', label: 'Advance Paid (₹)', placeholder: '5000', type: 'number' },
          { key: 'notes', label: 'Notes', placeholder: 'Hotels, inclusions, etc.' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
            <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
              onChange={e => up(f.key, e.target.value)} />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Trip Type</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.trip_type} onChange={e => up('trip_type', e.target.value)}>
            <option value="domestic">Domestic</option>
            <option value="international">International</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.status} onChange={e => up('status', e.target.value)}>
            {['confirmed', 'pending', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button onClick={() => save.mutate()} disabled={!form.customer_name || !form.destination || !form.departure_date || save.isPending}
          className="w-full py-3 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 disabled:opacity-40 transition-colors">
          {save.isPending ? 'Saving…' : 'Create Booking'}
        </button>
      </div>
    </div>
  );
}
