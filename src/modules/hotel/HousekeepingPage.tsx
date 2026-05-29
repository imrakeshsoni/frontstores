// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getHousekeepingTasks, saveHousekeepingTask, getRooms, updateRoomStatus, type HotelHousekeeping } from '@/lib/db/hotel';
import { toast } from 'sonner';

const STATUS_ORDER = ['dirty', 'cleaning', 'clean', 'inspected'];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; next: string; nextLabel: string }> = {
  dirty:     { label: '🔴 Dirty',     color: '#dc2626', bg: '#fef2f2', next: 'cleaning',  nextLabel: 'Start Cleaning' },
  cleaning:  { label: '🟡 Cleaning',  color: '#d97706', bg: '#fffbeb', next: 'clean',     nextLabel: 'Mark Clean' },
  clean:     { label: '🟢 Clean',     color: '#16a34a', bg: '#f0fdf4', next: 'inspected', nextLabel: 'Mark Inspected' },
  inspected: { label: '✅ Inspected', color: '#2563eb', bg: '#eff6ff', next: '',          nextLabel: '' },
};

export function HousekeepingPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<Partial<HotelHousekeeping> | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ['hotel-housekeeping', tenantId, date],
    queryFn: () => getHousekeepingTasks(tenantId, date),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: (data: Partial<HotelHousekeeping>) => saveHousekeepingTask(tenantId, data as any),
    onSuccess: () => {
      toast.success('Task saved');
      qc.invalidateQueries({ queryKey: ['hotel-housekeeping'] });
      setForm(null);
    },
    onError: () => toast.error('Failed to save task'),
  });

  const advance = useMutation({
    mutationFn: async (task: HotelHousekeeping) => {
      const cfg = STATUS_CONFIG[task.status];
      if (!cfg.next) return;
      await saveHousekeepingTask(tenantId, { ...task, status: cfg.next });
      if (cfg.next === 'clean' || cfg.next === 'inspected') {
        await updateRoomStatus(tenantId, task.room_id, 'available');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hotel-housekeeping'] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-stats'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const grouped = STATUS_ORDER.reduce<Record<string, HotelHousekeeping[]>>((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {});

  const up = (k: keyof HotelHousekeeping, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Housekeeping</h1>
        <button onClick={() => setForm({ room_id: '', assigned_to: '', status: 'dirty', date, notes: '' })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-600">Date:</label>
        <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        <span className="text-xs text-slate-400">{tasks.length} tasks</span>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🧹</p>
          <p className="font-medium">No housekeeping tasks for this date</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_ORDER.map(status => {
          const cfg = STATUS_CONFIG[status];
          const statusTasks = grouped[status] ?? [];
          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700">{cfg.label}</h2>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{statusTasks.length}</span>
              </div>
              <div className="space-y-2">
                {statusTasks.map(task => (
                  <div key={task.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4" style={{ borderLeft: `3px solid ${cfg.color}` }}>
                    <p className="font-semibold text-slate-900 text-sm">Room {task.room_number}</p>
                    {task.assigned_to && <p className="text-xs text-slate-400 mt-0.5">👤 {task.assigned_to}</p>}
                    {task.notes && <p className="text-xs text-slate-500 mt-1">{task.notes}</p>}
                    <div className="mt-2 flex gap-1.5">
                      {cfg.next && (
                        <button onClick={() => advance.mutate(task)} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white transition-colors" style={{ background: cfg.color }}>
                          {cfg.nextLabel}
                        </button>
                      )}
                      <button onClick={() => setForm({ ...task })} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Housekeeping Task</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Room *</label>
                <select className="input w-full" value={form.room_id ?? ''} onChange={e => up('room_id', e.target.value)}>
                  <option value="">Select room…</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number} — Floor {r.floor} ({r.status})</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label><input className="input w-full" value={form.assigned_to ?? ''} onChange={e => up('assigned_to', e.target.value)} placeholder="Staff name" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select className="input w-full" value={form.status ?? 'dirty'} onChange={e => up('status', e.target.value)}>
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label><textarea className="input w-full" rows={2} value={form.notes ?? ''} onChange={e => up('notes', e.target.value)} /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate({ ...form, date } as any)} disabled={!form.room_id || save.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
