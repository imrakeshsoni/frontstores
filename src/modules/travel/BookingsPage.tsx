// [travel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plane, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listBookings, updateBooking, deleteBooking } from '@/lib/db/travel';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

export function BookingsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['tr-bookings', tenantId, filterStatus],
    queryFn: () => listBookings(tenantId, filterStatus || undefined),
    enabled: !!tenantId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateBooking(tenantId, id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tr-bookings'] }); qc.invalidateQueries({ queryKey: ['travel-stats'] }); toast.success('Status updated'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteBooking(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tr-bookings'] }); toast.success('Booking removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
        <button onClick={() => navigate('/travel/new-booking')} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-500">
          + New Booking
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'confirmed', 'pending', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? 'bg-cyan-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-cyan-300'}`}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {bookings.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 flex-shrink-0">
                    <Plane className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{b.customer_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{b.trip_type}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{b.destination} · {b.pax} pax · {b.customer_phone}</p>
                    <p className="text-xs text-slate-400">Dep: {new Date(b.departure_date).toLocaleDateString('en-IN')} {b.return_date ? `· Ret: ${new Date(b.return_date).toLocaleDateString('en-IN')}` : ''}</p>
                    <p className="text-xs text-slate-500 mt-1">Total: ₹{b.total_amount.toLocaleString('en-IN')} · Paid: ₹{b.advance_paid.toLocaleString('en-IN')} · Due: ₹{(b.total_amount - b.advance_paid).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={b.status} onChange={ev => updateStatus.mutate({ id: b.id, status: ev.target.value })}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
                    {['confirmed', 'pending', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => { if (confirm('Delete booking?')) del.mutate(b.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No bookings found</p>}
        </div>
      )}
    </div>
  );
}
