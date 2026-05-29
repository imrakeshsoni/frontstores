// [events] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Trash2, Edit2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listEvents, updateEvent, deleteEvent } from '@/lib/db/events';
import { toast } from 'sonner';

const STATUSES = ['', 'inquiry', 'confirmed', 'completed', 'cancelled'];
const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function EventsListPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', tenantId, filterStatus],
    queryFn: () => listEvents(tenantId, filterStatus || undefined),
    enabled: !!tenantId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateEvent(tenantId, id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); qc.invalidateQueries({ queryKey: ['event-stats'] }); toast.success('Status updated'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEvent(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); qc.invalidateQueries({ queryKey: ['event-stats'] }); toast.success('Event removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <button onClick={() => navigate('/events/new')} className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-semibold hover:bg-pink-500">
          + New Event
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? 'bg-pink-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-300'}`}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 flex-shrink-0">
                    <CalendarDays className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{e.client_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[e.status] ?? 'bg-slate-100 text-slate-600'}`}>{e.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{e.event_type} · {e.venue}</p>
                    <p className="text-xs text-slate-400">{e.guest_count} guests · {new Date(e.event_date).toLocaleDateString('en-IN')}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Quoted: ₹{e.quoted_amount.toLocaleString('en-IN')} · Advance: ₹{e.advance_paid.toLocaleString('en-IN')} · Balance: ₹{(e.quoted_amount - e.advance_paid).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={e.status} onChange={ev => updateStatus.mutate({ id: e.id, status: ev.target.value })}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
                    {['inquiry', 'confirmed', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => navigate(`/events/${e.id}`)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => { if (confirm('Delete event?')) del.mutate(e.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No events found</p>}
        </div>
      )}
    </div>
  );
}
