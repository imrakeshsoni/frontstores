// [hotel] [all tenants]
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Users, TrendingUp, LogIn, LogOut, Wrench, Sparkles } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getDashboardStats, getTodayArrivals, getTodayDepartures } from '@/lib/db/hotel';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function HotelDashboard() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Hotel');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['hotel-stats', tenantId],
    queryFn: () => getDashboardStats(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: arrivals = [] } = useQuery({
    queryKey: ['hotel-arrivals', tenantId],
    queryFn: () => getTodayArrivals(tenantId),
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const { data: departures = [] } = useQuery({
    queryKey: ['hotel-departures', tenantId],
    queryFn: () => getTodayDepartures(tenantId),
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const cards = [
    { label: 'Total Rooms', value: stats?.totalRooms ?? 0, icon: BedDouble, color: '#2563eb', bg: '#dbeafe', path: '/hotel/rooms' },
    { label: 'Occupied', value: stats?.occupied ?? 0, icon: Users, color: '#dc2626', bg: '#fee2e2', path: '/hotel/rooms' },
    { label: 'Available', value: stats?.available ?? 0, icon: BedDouble, color: '#16a34a', bg: '#dcfce7', path: '/hotel/rooms' },
    { label: "Today's Revenue", value: fmt(stats?.todayRevenue ?? 0), icon: TrendingUp, color: '#7c3aed', bg: '#ede9fe', path: '/hotel/reports' },
  ];

  const occ = stats?.occupancyPct ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{shopName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Hotel Management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.path)} className="text-left p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: c.bg }}>
                <c.icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          </button>
        ))}
      </div>

      {/* Occupancy gauge + room summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Occupancy</h2>
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2563eb" strokeWidth="3"
                  strokeDasharray={`${occ} ${100 - occ}`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-900">{occ}%</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400 flex-shrink-0" /><span className="text-slate-600">Occupied: <b>{stats?.occupied ?? 0}</b></span></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-400 flex-shrink-0" /><span className="text-slate-600">Available: <b>{stats?.available ?? 0}</b></span></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400 flex-shrink-0" /><span className="text-slate-600">Cleaning: <b>{stats?.cleaning ?? 0}</b></span></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400 flex-shrink-0" /><span className="text-slate-600">Maintenance: <b>{stats?.maintenance ?? 0}</b></span></div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'New Booking', icon: '📅', path: '/hotel/bookings/new' },
              { label: 'Check In', icon: '🏨', path: '/hotel/checkin' },
              { label: 'Check Out', icon: '🚪', path: '/hotel/checkout' },
              { label: 'Housekeeping', icon: '🧹', path: '/hotel/housekeeping' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium text-slate-700">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Today arrivals & departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold text-slate-900">Today's Arrivals</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{arrivals.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {arrivals.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No arrivals today</p>
            ) : arrivals.map(b => (
              <div key={b.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-medium text-slate-800">{b.guest_name}</p>
                  <p className="text-xs text-slate-400">Room {b.room_number} · {b.adults} adults</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.status === 'checked_in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {b.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/hotel/checkin')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-green-700 hover:bg-green-50 transition-colors">Process Check-In →</button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-orange-600" />
              <h2 className="font-semibold text-slate-900">Today's Departures</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{departures.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {departures.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No departures today</p>
            ) : departures.map(b => (
              <div key={b.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-medium text-slate-800">{b.guest_name}</p>
                  <p className="text-xs text-slate-400">Room {b.room_number}</p>
                </div>
                <button onClick={() => navigate(`/hotel/checkout?booking=${b.id}`)} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                  Check Out
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/hotel/checkout')} className="mt-3 w-full py-2 rounded-xl text-sm font-medium text-orange-700 hover:bg-orange-50 transition-colors">Process Check-Out →</button>
        </div>
      </div>

      {/* Status summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Today Arrivals', value: stats?.todayArrivals ?? 0, icon: LogIn, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Today Departures', value: stats?.todayDepartures ?? 0, icon: LogOut, color: '#ea580c', bg: '#ffedd5' },
          { label: 'Maintenance Issues', value: stats?.maintenance ?? 0, icon: Wrench, color: '#64748b', bg: '#f1f5f9' },
          { label: 'Rooms Cleaning', value: stats?.cleaning ?? 0, icon: Sparkles, color: '#d97706', bg: '#fef3c7' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0" style={{ background: c.bg }}>
              <c.icon className="h-4 w-4" style={{ color: c.color }} />
            </span>
            <div>
              <p className="text-lg font-bold text-slate-900">{c.value}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
