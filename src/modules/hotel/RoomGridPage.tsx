// [hotel] [all tenants]
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store/app.store';
import { getRooms, getOccupiedRooms, updateRoomStatus, type HotelRoom } from '@/lib/db/hotel';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available:   { label: 'Available',   color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  occupied:    { label: 'Occupied',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  cleaning:    { label: 'Cleaning',    color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  maintenance: { label: 'Maintenance', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
};

export function RoomGridPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const { data: occupiedBookings = [] } = useQuery({
    queryKey: ['hotel-occupied', tenantId],
    queryFn: () => getOccupiedRooms(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateRoomStatus(tenantId, id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hotel-rooms'] }); qc.invalidateQueries({ queryKey: ['hotel-stats'] }); },
    onError: () => toast.error('Failed to update room status'),
  });

  const occupiedMap = new Map(occupiedBookings.map(b => [b.room_id, b]));

  const grouped = rooms.reduce<Record<number, HotelRoom[]>>((acc, r) => {
    const f = r.floor ?? 1;
    if (!acc[f]) acc[f] = [];
    acc[f].push(r);
    return acc;
  }, {});

  const floors = Object.keys(grouped).map(Number).sort();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Room Grid</h1>
        <button onClick={() => navigate('/hotel/setup/rooms')} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          Manage Rooms
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: v.color }}>
            <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: v.bg, border: `1px solid ${v.border}` }} />
            {v.label}
          </div>
        ))}
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🏨</p>
          <p className="font-medium">No rooms added yet</p>
          <button onClick={() => navigate('/hotel/setup/rooms')} className="mt-3 text-blue-600 text-sm hover:underline">Add rooms →</button>
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map(floor => (
            <div key={floor}>
              <h2 className="text-sm font-semibold text-slate-500 mb-3">Floor {floor}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {grouped[floor].map(room => {
                  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.available;
                  const booking = occupiedMap.get(room.id);
                  return (
                    <div
                      key={room.id}
                      className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md transition-all"
                      style={{ background: cfg.bg, borderColor: cfg.border }}
                    >
                      <p className="font-bold text-slate-900">{room.number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{room.type}</p>
                      {booking && <p className="text-xs font-medium mt-1 truncate" style={{ color: cfg.color }}>{booking.guest_name}</p>}
                      <span className="mt-1.5 inline-block text-xs font-semibold rounded-full px-1.5 py-0.5" style={{ color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                      {/* Quick actions */}
                      <div className="mt-2 flex flex-col gap-1">
                        {room.status === 'available' && (
                          <button onClick={() => navigate(`/hotel/checkin?room=${room.id}`)} className="text-xs text-green-700 hover:underline">Check In</button>
                        )}
                        {room.status === 'occupied' && (
                          <button onClick={() => navigate(`/hotel/checkout?room=${room.id}`)} className="text-xs text-red-600 hover:underline">Check Out</button>
                        )}
                        {room.status === 'occupied' && (
                          <button onClick={() => navigate(`/hotel/bookings?room=${room.id}`)} className="text-xs text-blue-600 hover:underline">View Folio</button>
                        )}
                        {(room.status === 'occupied' || room.status === 'available') && (
                          <button onClick={() => setStatus.mutate({ id: room.id, status: 'cleaning' })} className="text-xs text-amber-600 hover:underline">Mark Cleaning</button>
                        )}
                        {room.status === 'cleaning' && (
                          <button onClick={() => setStatus.mutate({ id: room.id, status: 'available' })} className="text-xs text-green-700 hover:underline">Mark Clean</button>
                        )}
                        {room.status !== 'maintenance' && (
                          <button onClick={() => navigate(`/hotel/maintenance?room=${room.id}`)} className="text-xs text-slate-500 hover:underline">Maintenance</button>
                        )}
                        {room.status === 'maintenance' && (
                          <button onClick={() => setStatus.mutate({ id: room.id, status: 'available' })} className="text-xs text-green-700 hover:underline">Mark Fixed</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
