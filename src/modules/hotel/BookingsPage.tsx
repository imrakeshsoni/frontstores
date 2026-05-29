// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, LogIn, LogOut } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getBookings, updateBookingStatus, updateRoomStatus, getFolio, addFolioItem, getRooms } from '@/lib/db/hotel';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  confirmed:   { color: '#2563eb', bg: '#dbeafe' },
  checked_in:  { color: '#16a34a', bg: '#dcfce7' },
  checked_out: { color: '#64748b', bg: '#f1f5f9' },
  cancelled:   { color: '#dc2626', bg: '#fee2e2' },
  no_show:     { color: '#d97706', bg: '#fef3c7' },
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function BookingsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'checked_in'>('all');

  const today = new Date().toISOString().slice(0, 10);

  const { data: bookings = [] } = useQuery({
    queryKey: ['hotel-bookings', tenantId, filter],
    queryFn: () => {
      if (filter === 'today') return getBookings(tenantId, { dateFrom: today, dateTo: today });
      if (filter === 'checked_in') return getBookings(tenantId, { status: 'checked_in' });
      if (filter === 'upcoming') return getBookings(tenantId, { dateFrom: today });
      return getBookings(tenantId);
    },
    enabled: !!tenantId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const checkIn = useMutation({
    mutationFn: async (bookingId: string) => {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return;
      await updateBookingStatus(tenantId, bookingId, 'checked_in');
      await updateRoomStatus(tenantId, booking.room_id, 'occupied');
      // Create folio with room charge
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
      }
    },
    onSuccess: () => {
      toast.success('Guest checked in');
      qc.invalidateQueries({ queryKey: ['hotel-bookings'] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-stats'] });
    },
    onError: () => toast.error('Check-in failed'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => updateBookingStatus(tenantId, id, 'cancelled'),
    onSuccess: () => { toast.success('Booking cancelled'); qc.invalidateQueries({ queryKey: ['hotel-bookings'] }); },
  });

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase();
    return !q || (b.guest_name ?? '').toLowerCase().includes(q) || (b.room_number ?? '').includes(q) || (b.booking_ref ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Bookings</h1>
        <button onClick={() => navigate('/hotel/bookings/new')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> New Booking
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest, room, ref…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
          {(['all', 'today', 'upcoming', 'checked_in'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {f === 'checked_in' ? 'In-House' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-2">📅</p>
            <p className="font-medium">No bookings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Booking Ref</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Guest</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Room</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Check-in</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Check-out</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Source</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(b => {
                  const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.confirmed;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{b.booking_ref}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{b.guest_name}</p>
                        <p className="text-xs text-slate-400">{b.guest_phone}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">Room {b.room_number}</p>
                        <p className="text-xs text-slate-400">{b.room_type}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{fmtDate(b.check_in)}</td>
                      <td className="px-5 py-3 text-slate-700">{fmtDate(b.check_out)}</td>
                      <td className="px-5 py-3 capitalize text-slate-500">{b.source}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>
                          {b.status === 'checked_in' ? 'In-House' : b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/hotel/checkout?booking=${b.id}`)} title="View Folio" className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {b.status === 'confirmed' && (
                            <button onClick={() => checkIn.mutate(b.id)} title="Check In" className="p-1.5 rounded-lg text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors">
                              <LogIn className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {b.status === 'checked_in' && (
                            <button onClick={() => navigate(`/hotel/checkout?booking=${b.id}`)} title="Check Out" className="p-1.5 rounded-lg text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                              <LogOut className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <button onClick={() => { if (confirm('Cancel this booking?')) cancel.mutate(b.id); }} title="Cancel" className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors text-xs font-bold px-2">
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
