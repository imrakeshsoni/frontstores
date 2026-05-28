// [gym] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, LogIn, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listMembers, checkIn, checkOut, getTodayCheckins } from '@/lib/db/gym';

function timeStr(iso: string) { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
function daysLeft(end: string | null) {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
}

export function CheckInPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [justCheckedIn, setJustCheckedIn] = useState<string | null>(null);

  const { data: members = [] } = useQuery({ queryKey: ['gym-members-active', tenantId], queryFn: () => listMembers(tenantId, true), enabled: !!tenantId });
  const { data: todayCheckins = [] } = useQuery({ queryKey: ['gym-checkins-today', tenantId], queryFn: () => getTodayCheckins(tenantId), enabled: !!tenantId, refetchInterval: 15000 });

  const checkinMut = useMutation({
    mutationFn: (m: { id: string; name: string }) => checkIn(tenantId, m.id, m.name),
    onSuccess: (_, m) => {
      qc.invalidateQueries({ queryKey: ['gym-checkins-today'] });
      qc.invalidateQueries({ queryKey: ['gym-stats'] });
      setJustCheckedIn(m.name);
      setSearch('');
      setTimeout(() => setJustCheckedIn(null), 3000);
    },
  });

  const checkoutMut = useMutation({
    mutationFn: (id: string) => checkOut(tenantId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gym-checkins-today'] }),
  });

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return q && (m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q));
  });

  const alreadyCheckedIn = new Set(todayCheckins.filter(c => !c.checked_out_at).map(c => c.member_id));

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Member Check-In</h1>

      {justCheckedIn && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800">Welcome, {justCheckedIn}!</p>
            <p className="text-sm text-green-600">Checked in successfully</p>
          </div>
        </div>
      )}

      {/* Search and quick check-in */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search member by name or phone to check in…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoFocus
          />
        </div>

        {filtered.length > 0 && (
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            {filtered.slice(0, 8).map(m => {
              const days = daysLeft(m.membership_end);
              const checkedIn = alreadyCheckedIn.has(m.id!);
              const isExpired = days !== null && days < 0;
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      {m.phone && <span className="text-xs text-slate-400">{m.phone}</span>}
                      {m.plan_name && <span className="text-xs text-slate-400">· {m.plan_name}</span>}
                      {isExpired && <span className="text-xs font-medium text-red-500">· EXPIRED</span>}
                      {days !== null && days >= 0 && days <= 7 && <span className="text-xs font-medium text-orange-500">· {days}d left</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => checkinMut.mutate({ id: m.id!, name: m.name })}
                    disabled={checkedIn || checkinMut.isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      checkedIn ? 'bg-green-50 text-green-600 cursor-default' :
                      'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                    }`}
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    {checkedIn ? 'Already In' : 'Check In'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Today's log */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Today's Log</h2>
          <span className="text-xs text-slate-400">{todayCheckins.length} total</span>
        </div>
        {todayCheckins.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-3xl mb-2">🏋️</p>
            <p className="text-sm">No check-ins yet today</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {todayCheckins.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{c.member_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />In: {timeStr(c.checked_in_at)}</span>
                    {c.checked_out_at && <span className="text-xs text-slate-400">· Out: {timeStr(c.checked_out_at)}</span>}
                  </div>
                </div>
                {!c.checked_out_at && (
                  <button onClick={() => checkoutMut.mutate(c.id)} className="text-xs font-medium text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                    Check Out
                  </button>
                )}
                {c.checked_out_at && <span className="text-xs text-green-600 font-medium">Checked Out</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
