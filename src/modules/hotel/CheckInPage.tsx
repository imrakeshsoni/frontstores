// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getBookings, updateBookingStatus, updateRoomStatus, getFolio, addFolioItem, getRooms } from '@/lib/db/hotel';
import { toast } from 'sonner';

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CheckInPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const { data: bookings = [] } = useQuery({
    queryKey: ['hotel-bookings-confirmed', tenantId],
    queryFn: () => getBookings(tenantId, { status: 'confirmed' }),
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const doCheckIn = useMutation({
    mutationFn: async (bookingId: string) => {
      setProcessing(bookingId);
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) throw new Error('Booking not found');
      await updateBookingStatus(tenantId, bookingId, 'checked_in');
      await updateRoomStatus(tenantId, booking.room_id, 'occupied');
      const folio = await getFolio(tenantId, bookingId);
      const room = rooms.find(r => r.id === booking.room_id);
      if (room) {
        const days = Math.max(1, Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000));
        await addFolioItem(tenantId, folio.id, {
          description: `Room ${room.number} — ${days} night(s)`,
          category: 'room',
          quantity: days,
          rate: room.rate_weekday,
        });
        if (booking.advance_paid > 0) {
          await addFolioItem(tenantId, folio.id, {
            description: 'Advance received',
            category: 'payment',
            quantity: 1,
            rate: -booking.advance_paid,
          });
        }
      }
    },
    onSuccess: (_, bookingId) => {
      toast.success('Guest checked in successfully');
      setProcessing(null);
      qc.invalidateQueries({ queryKey: ['hotel-bookings'] });
      qc.invalidateQueries({ queryKey: ['hotel-bookings-confirmed'] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-stats'] });
    },
    onError: () => { toast.error('Check-in failed'); setProcessing(null); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter(b => b.check_in === today);
  const upcomingBookings = bookings.filter(b => b.check_in > today);

  const filteredToday = todayBookings.filter(b => {
    const q = search.toLowerCase();
    return !q || (b.guest_name ?? '').toLowerCase().includes(q) || (b.room_number ?? '').includes(q);
  });

  const filteredUpcoming = upcomingBookings.filter(b => {
    const q = search.toLowerCase();
    return !q || (b.guest_name ?? '').toLowerCase().includes(q) || (b.room_number ?? '').includes(q);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LogIn className="h-6 w-6 text-green-600" />
          <h1 className="text-xl font-bold text-slate-900">Check-In</h1>
        </div>
        <button onClick={() => navigate('/hotel/bookings/new')} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          New Booking
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest or room…" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />

      {/* Today arrivals */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">Today's Arrivals ({filteredToday.length})</h2>
        {filteredToday.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-sm">No arrivals today</div>
        ) : (
          <div className="space-y-3">
            {filteredToday.map(b => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{b.guest_name}</p>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Today</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{b.guest_phone}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>Room <b>{b.room_number}</b> ({b.room_type})</span>
                      <span>{b.adults} adult{b.adults > 1 ? 's' : ''}{b.children > 0 ? `, ${b.children} child` : ''}</span>
                      <span>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
                      <span>Advance: ₹{b.advance_paid}</span>
                    </div>
                    {b.special_requests && <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">📝 {b.special_requests}</p>}
                    <p className="mt-1 text-xs font-mono text-slate-400">{b.booking_ref} · via {b.source}</p>
                  </div>
                  <button
                    onClick={() => doCheckIn.mutate(b.id)}
                    disabled={processing === b.id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    <LogIn className="h-4 w-4" />
                    {processing === b.id ? 'Processing…' : 'Check In'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {filteredUpcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">Upcoming ({filteredUpcoming.length})</h2>
          <div className="space-y-2">
            {filteredUpcoming.slice(0, 5).map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-slate-100 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{b.guest_name}</p>
                  <p className="text-xs text-slate-400">Room {b.room_number} · {fmtDate(b.check_in)}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{b.booking_ref}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
