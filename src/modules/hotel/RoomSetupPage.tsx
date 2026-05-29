// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getRooms, saveRoom, deleteRoom, type HotelRoom } from '@/lib/db/hotel';
import { toast } from 'sonner';

const AMENITY_LIST = ['AC', 'TV', 'WiFi', 'Hot Water', 'Mini Bar', 'Balcony', 'Room Service', 'Safe'];
const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Super Deluxe', 'Executive', 'Single', 'Double', 'Twin', 'Family'];

const EMPTY: Partial<HotelRoom> & { number: string; type: string } = {
  number: '', type: 'Standard', floor: 1, capacity: 2,
  rate_weekday: 0, rate_weekend: 0, amenities: '', notes: '',
};

export function RoomSetupPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [amenityCheck, setAmenityCheck] = useState<string[]>([]);

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveRoom(tenantId, { ...data, amenities: amenityCheck.join(',') }),
    onSuccess: () => { toast.success('Room saved'); qc.invalidateQueries({ queryKey: ['hotel-rooms'] }); setForm(null); },
    onError: () => toast.error('Failed to save room'),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRoom(tenantId, id),
    onSuccess: () => { toast.success('Room deleted'); qc.invalidateQueries({ queryKey: ['hotel-rooms'] }); },
    onError: () => toast.error('Failed to delete room'),
  });

  function openForm(room?: HotelRoom) {
    if (room) {
      setForm({ ...room });
      setAmenityCheck(room.amenities ? room.amenities.split(',').map(s => s.trim()).filter(Boolean) : []);
    } else {
      setForm({ ...EMPTY });
      setAmenityCheck([]);
    }
  }

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  const toggleAmenity = (a: string) => setAmenityCheck(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  // Group by floor
  const floors = [...new Set(rooms.map(r => r.floor ?? 1))].sort();

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Room Setup</h1>
        <button onClick={() => openForm()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🏨</p>
          <p className="font-medium">No rooms added yet</p>
          <p className="text-sm mt-1">Add your first room to get started</p>
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map(floor => (
            <div key={floor}>
              <h2 className="text-sm font-semibold text-slate-500 mb-3">Floor {floor}</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {rooms.filter(r => (r.floor ?? 1) === floor).map(room => (
                    <div key={room.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {room.number}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{room.type}</p>
                          <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-slate-500">
                            <span>Capacity: {room.capacity}</span>
                            <span>Weekday: ₹{room.rate_weekday}/night</span>
                            <span>Weekend: ₹{room.rate_weekend}/night</span>
                          </div>
                          {room.amenities && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {room.amenities.split(',').filter(Boolean).map(a => (
                                <span key={a} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{a.trim()}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          room.status === 'available' ? 'bg-green-100 text-green-700' :
                          room.status === 'occupied' ? 'bg-red-100 text-red-700' :
                          room.status === 'cleaning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{room.status}</span>
                        <button onClick={() => openForm(room)} className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm(`Delete Room ${room.number}?`)) del.mutate(room.id); }} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Room' : 'Add Room'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Room Number *</label><input className="input w-full" value={form.number} onChange={e => up('number', e.target.value)} placeholder="e.g. 101" autoFocus /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Room Type *</label>
                <select className="input w-full" value={form.type ?? 'Standard'} onChange={e => up('type', e.target.value)}>
                  {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Floor</label><input type="number" min={1} className="input w-full" value={form.floor ?? 1} onChange={e => up('floor', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Capacity (persons)</label><input type="number" min={1} className="input w-full" value={form.capacity ?? 2} onChange={e => up('capacity', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Weekday Rate (₹/night)</label><input type="number" min={0} className="input w-full" value={form.rate_weekday ?? 0} onChange={e => up('rate_weekday', Number(e.target.value))} /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Weekend Rate (₹/night)</label><input type="number" min={0} className="input w-full" value={form.rate_weekend ?? 0} onChange={e => up('rate_weekend', Number(e.target.value))} /></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {AMENITY_LIST.map(a => (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${amenityCheck.includes(a) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label><textarea className="input w-full" rows={2} value={form.notes ?? ''} onChange={e => up('notes', e.target.value)} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.number.trim() || !form.type.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
