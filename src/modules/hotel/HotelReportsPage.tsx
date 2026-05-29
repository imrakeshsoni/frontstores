// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getBookings, getFolioItems, getRooms, getGuests } from '@/lib/db/hotel';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

export function HotelReportsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [tab, setTab] = useState<'revenue' | 'occupancy' | 'guests' | 'source'>('revenue');
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: bookings = [] } = useQuery({
    queryKey: ['hotel-bookings-report', tenantId, from, to],
    queryFn: () => getBookings(tenantId, { dateFrom: from, dateTo: to }),
    enabled: !!tenantId,
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['hotel-all-bookings', tenantId],
    queryFn: () => getBookings(tenantId),
    enabled: !!tenantId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const { data: guests = [] } = useQuery({
    queryKey: ['hotel-guests', tenantId],
    queryFn: () => getGuests(tenantId),
    enabled: !!tenantId,
  });

  // Revenue calculation from bookings in date range
  const completedBookings = bookings.filter(b => b.status === 'checked_out' || b.status === 'checked_in');
  const totalRevenue = completedBookings.reduce((sum, b) => {
    const nights = Math.max(1, Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000));
    return sum; // Will be from folio, approximate here
  }, 0);

  // Source breakdown
  const sourceMap: Record<string, number> = {};
  allBookings.forEach(b => {
    sourceMap[b.source] = (sourceMap[b.source] ?? 0) + 1;
  });

  // Nationality breakdown
  const natMap: Record<string, number> = {};
  guests.forEach(g => {
    natMap[g.nationality] = (natMap[g.nationality] ?? 0) + 1;
  });

  // Repeat guests (more than 1 stay)
  const guestStayCount = new Map<string, number>();
  allBookings.forEach(b => {
    guestStayCount.set(b.guest_id, (guestStayCount.get(b.guest_id) ?? 0) + 1);
  });
  const repeatGuests = Array.from(guestStayCount.values()).filter(c => c > 1).length;

  const TAX_RATE = 0.12;

  const tabs = ['revenue', 'occupancy', 'guests', 'source'] as const;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">From:</label>
          <input type="date" className="input text-sm" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">To:</label>
          <input type="date" className="input text-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 capitalize transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Revenue */}
      {tab === 'revenue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Bookings', value: bookings.length },
              { label: 'Checked Out', value: bookings.filter(b => b.status === 'checked_out').length },
              { label: 'Currently In-House', value: bookings.filter(b => b.status === 'checked_in').length },
              { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Bookings in Period</h2>
            </div>
            {bookings.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No bookings in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">{['Ref', 'Guest', 'Room', 'Check-in', 'Check-out', 'Source', 'Status'].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {bookings.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{b.booking_ref}</td>
                        <td className="px-5 py-2.5 font-medium text-slate-800">{b.guest_name}</td>
                        <td className="px-5 py-2.5 text-slate-600">Room {b.room_number}</td>
                        <td className="px-5 py-2.5 text-slate-600">{fmtDate(b.check_in)}</td>
                        <td className="px-5 py-2.5 text-slate-600">{fmtDate(b.check_out)}</td>
                        <td className="px-5 py-2.5 capitalize text-slate-500">{b.source}</td>
                        <td className="px-5 py-2.5 capitalize text-slate-500">{b.status.replace('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Occupancy */}
      {tab === 'occupancy' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">Total Rooms</p>
              <p className="text-2xl font-bold text-slate-900">{rooms.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">Currently Occupied</p>
              <p className="text-2xl font-bold text-red-600">{rooms.filter(r => r.status === 'occupied').length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">Occupancy Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {rooms.length > 0 ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100) : 0}%
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Room Status Breakdown</h2>
            {['available', 'occupied', 'cleaning', 'maintenance'].map(status => {
              const count = rooms.filter(r => r.status === status).length;
              const pct = rooms.length > 0 ? Math.round((count / rooms.length) * 100) : 0;
              return (
                <div key={status} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-slate-700">{status}</span>
                    <span className="font-semibold text-slate-900">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Guests */}
      {tab === 'guests' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">Total Guests</p>
              <p className="text-2xl font-bold text-slate-900">{guests.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">Repeat Guests</p>
              <p className="text-2xl font-bold text-green-600">{repeatGuests}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs text-slate-500 mb-1">Nationalities</p>
              <p className="text-2xl font-bold text-blue-600">{Object.keys(natMap).length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Nationality Breakdown</h2>
            <div className="space-y-2">
              {Object.entries(natMap).sort((a, b) => b[1] - a[1]).map(([nat, count]) => (
                <div key={nat} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-700">{nat}</span>
                  <span className="font-semibold text-slate-900">{count} guest{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Source */}
      {tab === 'source' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Booking Source Breakdown (All Time)</h2>
            {Object.keys(sourceMap).length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No bookings yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).map(([source, count]) => {
                  const total = Object.values(sourceMap).reduce((s, v) => s + v, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={source}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-slate-700">{source.replace('_', ' ')}</span>
                        <span className="font-semibold text-slate-900">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-3">GST Summary (12% on Room Charges)</h2>
            <div className="space-y-1 text-sm">
              <p className="text-slate-500 text-xs">Based on bookings in selected period. Room charge revenue estimated from booking data.</p>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-600">Total Bookings</span>
                <span className="font-semibold">{completedBookings.length}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-600">GST Rate</span>
                <span className="font-semibold">12%</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Use revenue report with actual folio data for accurate GST calculation.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
