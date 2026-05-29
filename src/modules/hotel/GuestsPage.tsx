// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Phone, User } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getGuests, saveGuest, getBookings, type HotelGuest } from '@/lib/db/hotel';
import { toast } from 'sonner';

const EMPTY: Partial<HotelGuest> & { name: string } = {
  name: '', phone: '', email: '', id_proof_type: 'aadhaar', id_proof_no: '',
  address: '', city: '', nationality: 'Indian',
};

export function GuestsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [detailGuest, setDetailGuest] = useState<HotelGuest | null>(null);

  const { data: guests = [] } = useQuery({
    queryKey: ['hotel-guests', tenantId, search],
    queryFn: () => getGuests(tenantId, search || undefined),
    enabled: !!tenantId,
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['hotel-bookings', tenantId],
    queryFn: () => getBookings(tenantId),
    enabled: !!tenantId && !!detailGuest,
  });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveGuest(tenantId, data as any),
    onSuccess: () => { toast.success('Guest saved'); qc.invalidateQueries({ queryKey: ['hotel-guests'] }); setForm(null); },
    onError: () => toast.error('Failed to save guest'),
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const guestBookings = detailGuest ? allBookings.filter(b => b.guest_id === detailGuest.id) : [];

  function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Guests</h1>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Guest
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests by name or phone…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {guests.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-2">👥</p>
            <p className="font-medium">No guests found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {guests.map(g => (
              <div key={g.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
                    {g.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{g.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {g.phone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" />{g.phone}</span>}
                      {g.city && <span className="text-xs text-slate-400">{g.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{g.total_stays} stay{g.total_stays !== 1 ? 's' : ''}</span>
                  <button onClick={() => setDetailGuest(g)} className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><User className="h-4 w-4" /></button>
                  <button onClick={() => setForm({ ...g })} className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Guest Modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Guest' : 'Add Guest'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Name *</label><input className="input w-full" value={form.name} onChange={e => up('name', e.target.value)} autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Phone</label><input className="input w-full" value={form.phone ?? ''} onChange={e => up('phone', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Email</label><input type="email" className="input w-full" value={form.email ?? ''} onChange={e => up('email', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">ID Proof Type</label>
                <select className="input w-full" value={form.id_proof_type ?? 'aadhaar'} onChange={e => up('id_proof_type', e.target.value)}>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="pan">PAN Card</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">ID Number</label><input className="input w-full" value={form.id_proof_no ?? ''} onChange={e => up('id_proof_no', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">City</label><input className="input w-full" value={form.city ?? ''} onChange={e => up('city', e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Nationality</label><input className="input w-full" value={form.nationality ?? 'Indian'} onChange={e => up('nationality', e.target.value)} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Address</label><textarea className="input w-full" rows={2} value={form.address ?? ''} onChange={e => up('address', e.target.value)} /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.name.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Guest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Detail Modal */}
      {detailGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{detailGuest.name}</h2>
                <p className="text-sm text-slate-500">{detailGuest.phone} · {detailGuest.city}</p>
              </div>
              <button onClick={() => setDetailGuest(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">ID Proof:</span> <span className="font-medium capitalize">{detailGuest.id_proof_type?.replace('_', ' ')}</span></div>
              <div><span className="text-slate-500">ID No:</span> <span className="font-medium">{detailGuest.id_proof_no || '—'}</span></div>
              <div><span className="text-slate-500">Nationality:</span> <span className="font-medium">{detailGuest.nationality}</span></div>
              <div><span className="text-slate-500">Email:</span> <span className="font-medium">{detailGuest.email || '—'}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Address:</span> <span className="font-medium">{detailGuest.address || '—'}</span></div>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Stay History ({guestBookings.length})</h3>
            {guestBookings.length === 0 ? (
              <p className="text-sm text-slate-400">No stays recorded</p>
            ) : (
              <div className="space-y-2">
                {guestBookings.map(b => (
                  <div key={b.id} className="flex justify-between items-center text-sm bg-slate-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">Room {b.room_number}</p>
                      <p className="text-xs text-slate-400">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.status === 'checked_out' ? 'bg-slate-100 text-slate-600' : b.status === 'checked_in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { setDetailGuest(null); setForm({ ...detailGuest }); }} className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Edit Guest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
