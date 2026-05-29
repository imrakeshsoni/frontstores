// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getRooms, getGuests, saveBooking, saveGuest } from '@/lib/db/hotel';
import { toast } from 'sonner';

const EMPTY_BOOKING = {
  room_id: '', guest_id: '', check_in: '', check_out: '',
  adults: 1, children: 0, source: 'direct', advance_paid: 0, special_requests: '',
};

const EMPTY_GUEST = { name: '', phone: '', email: '', id_proof_type: 'aadhaar', id_proof_no: '', address: '', city: '', nationality: 'Indian' };

export function NewBookingPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_BOOKING });
  const [guestSearch, setGuestSearch] = useState('');
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [guestForm, setGuestForm] = useState({ ...EMPTY_GUEST });
  const [selectedGuest, setSelectedGuest] = useState<{ id: string; name: string; phone: string } | null>(null);

  const up = (k: keyof typeof EMPTY_BOOKING, v: any) => setForm(f => ({ ...f, [k]: v }));
  const ug = (k: keyof typeof EMPTY_GUEST, v: any) => setGuestForm(f => ({ ...f, [k]: v }));

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const { data: guests = [] } = useQuery({
    queryKey: ['hotel-guests', tenantId, guestSearch],
    queryFn: () => getGuests(tenantId, guestSearch || undefined),
    enabled: !!tenantId,
  });

  const availableRooms = rooms.filter(r => r.status === 'available');

  const selectedRoom = rooms.find(r => r.id === form.room_id);
  const nights = form.check_in && form.check_out
    ? Math.max(0, Math.ceil((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000))
    : 0;
  const estimatedAmount = selectedRoom ? nights * selectedRoom.rate_weekday : 0;

  const saveGuestMut = useMutation({
    mutationFn: () => saveGuest(tenantId, guestForm),
    onSuccess: async (id) => {
      toast.success('Guest added');
      const g = { id, name: guestForm.name, phone: guestForm.phone };
      setSelectedGuest(g);
      setForm(f => ({ ...f, guest_id: id }));
      setShowNewGuest(false);
      setGuestForm({ ...EMPTY_GUEST });
      qc.invalidateQueries({ queryKey: ['hotel-guests'] });
    },
    onError: () => toast.error('Failed to save guest'),
  });

  const saveBookingMut = useMutation({
    mutationFn: () => saveBooking(tenantId, { ...form, guest_id: selectedGuest?.id ?? form.guest_id }),
    onSuccess: () => {
      toast.success('Booking created');
      qc.invalidateQueries({ queryKey: ['hotel-bookings'] });
      navigate('/hotel/bookings');
    },
    onError: () => toast.error('Failed to create booking'),
  });

  const canSave = form.room_id && (selectedGuest || form.guest_id) && form.check_in && form.check_out && nights > 0;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/hotel/bookings')} className="text-slate-400 hover:text-slate-600 text-lg">←</button>
        <h1 className="text-xl font-bold text-slate-900">New Booking</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        {/* Guest selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Guest *</label>
          {selectedGuest ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-200">
              <div>
                <p className="font-medium text-slate-900">{selectedGuest.name}</p>
                <p className="text-xs text-slate-500">{selectedGuest.phone}</p>
              </div>
              <button onClick={() => { setSelectedGuest(null); setForm(f => ({ ...f, guest_id: '' })); }} className="text-xs text-red-500 hover:underline">Change</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input value={guestSearch} onChange={e => setGuestSearch(e.target.value)} placeholder="Search existing guest by name or phone…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              {guestSearch.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {guests.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">No guests found</p>
                  ) : guests.map(g => (
                    <button key={g.id} onClick={() => { setSelectedGuest({ id: g.id, name: g.name, phone: g.phone }); setForm(f => ({ ...f, guest_id: g.id })); setGuestSearch(''); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 text-sm">
                      <p className="font-medium text-slate-800">{g.name}</p>
                      <p className="text-xs text-slate-400">{g.phone} · {g.city}</p>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowNewGuest(!showNewGuest)} className="text-sm text-blue-600 hover:underline">+ Add new guest</button>
            </div>
          )}
        </div>

        {/* New guest form */}
        {showNewGuest && (
          <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50">
            <h3 className="text-sm font-semibold text-blue-800">New Guest Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label><input className="input w-full" value={guestForm.name} onChange={e => ug('name', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={guestForm.phone} onChange={e => ug('phone', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Email</label><input className="input w-full" value={guestForm.email} onChange={e => ug('email', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">ID Proof Type</label>
                <select className="input w-full" value={guestForm.id_proof_type} onChange={e => ug('id_proof_type', e.target.value)}>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="pan">PAN Card</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">ID Number</label><input className="input w-full" value={guestForm.id_proof_no} onChange={e => ug('id_proof_no', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">City</label><input className="input w-full" value={guestForm.city} onChange={e => ug('city', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Nationality</label><input className="input w-full" value={guestForm.nationality} onChange={e => ug('nationality', e.target.value)} /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowNewGuest(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-white">Cancel</button>
              <button onClick={() => saveGuestMut.mutate()} disabled={!guestForm.name.trim() || saveGuestMut.isPending} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saveGuestMut.isPending ? 'Saving…' : 'Save Guest'}
              </button>
            </div>
          </div>
        )}

        {/* Room picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Room *</label>
          <select className="input w-full" value={form.room_id} onChange={e => up('room_id', e.target.value)}>
            <option value="">Select available room…</option>
            {availableRooms.map(r => (
              <option key={r.id} value={r.id}>Room {r.number} — {r.type} — Floor {r.floor} — ₹{r.rate_weekday}/night (cap {r.capacity})</option>
            ))}
          </select>
          {rooms.length > 0 && availableRooms.length === 0 && <p className="text-xs text-red-500 mt-1">No rooms available. Check room status.</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Check-in Date *</label>
            <input type="date" className="input w-full" value={form.check_in} onChange={e => up('check_in', e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Check-out Date *</label>
            <input type="date" className="input w-full" value={form.check_out} onChange={e => up('check_out', e.target.value)} min={form.check_in || new Date().toISOString().slice(0, 10)} />
          </div>
        </div>

        {/* Summary */}
        {nights > 0 && selectedRoom && (
          <div className="bg-blue-50 rounded-xl p-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>Nights</span><span className="font-semibold text-slate-900">{nights}</span></div>
            <div className="flex justify-between text-slate-600 mt-1"><span>Rate / night</span><span>₹{selectedRoom.rate_weekday.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between font-semibold text-blue-800 mt-1 border-t border-blue-200 pt-1"><span>Estimated Total</span><span>₹{estimatedAmount.toLocaleString('en-IN')}</span></div>
          </div>
        )}

        {/* Guests count */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Adults</label>
            <input type="number" min={1} className="input w-full" value={form.adults} onChange={e => up('adults', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Children</label>
            <input type="number" min={0} className="input w-full" value={form.children} onChange={e => up('children', Number(e.target.value))} />
          </div>
        </div>

        {/* Source + advance */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Booking Source</label>
            <select className="input w-full" value={form.source} onChange={e => up('source', e.target.value)}>
              <option value="direct">Direct / Walk-in</option>
              <option value="phone">Phone</option>
              <option value="makemytrip">MakeMyTrip</option>
              <option value="oyo">OYO</option>
              <option value="goibibo">Goibibo</option>
              <option value="booking_com">Booking.com</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Advance Paid (₹)</label>
            <input type="number" min={0} className="input w-full" value={form.advance_paid} onChange={e => up('advance_paid', Number(e.target.value))} />
          </div>
        </div>

        {/* Special requests */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Special Requests</label>
          <textarea className="input w-full" rows={2} value={form.special_requests} onChange={e => up('special_requests', e.target.value)} placeholder="e.g. Early check-in, extra bed, vegetarian food…" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => navigate('/hotel/bookings')} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => saveBookingMut.mutate()} disabled={!canSave || saveBookingMut.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saveBookingMut.isPending ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
