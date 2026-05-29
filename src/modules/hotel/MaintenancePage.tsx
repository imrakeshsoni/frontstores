// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Wrench } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getMaintenanceLog, saveMaintenanceItem, getRooms, type HotelMaintenance } from '@/lib/db/hotel';
import { toast } from 'sonner';

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  low:    { color: '#64748b', bg: '#f1f5f9' },
  normal: { color: '#2563eb', bg: '#dbeafe' },
  high:   { color: '#d97706', bg: '#fef3c7' },
  urgent: { color: '#dc2626', bg: '#fee2e2' },
};

const EMPTY: Partial<HotelMaintenance> & { room_id: string; issue: string } = {
  room_id: '', issue: '', status: 'open', priority: 'normal', reported_by: '',
};

export function MaintenancePage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const { data: issues = [] } = useQuery({
    queryKey: ['hotel-maintenance', tenantId, filter],
    queryFn: () => getMaintenanceLog(tenantId, filter === 'all' ? undefined : filter),
    enabled: !!tenantId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['hotel-rooms', tenantId],
    queryFn: () => getRooms(tenantId),
    enabled: !!tenantId,
  });

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => saveMaintenanceItem(tenantId, data as any),
    onSuccess: () => {
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['hotel-maintenance'] });
      setForm(null);
    },
    onError: () => toast.error('Failed to save'),
  });

  const resolve = useMutation({
    mutationFn: (issue: HotelMaintenance) => saveMaintenanceItem(tenantId, { ...issue, status: 'resolved', resolved_at: new Date().toISOString() }),
    onSuccess: () => { toast.success('Marked resolved'); qc.invalidateQueries({ queryKey: ['hotel-maintenance'] }); },
    onError: () => toast.error('Failed to update'),
  });

  const up = (k: keyof typeof EMPTY, v: any) => setForm(f => f ? { ...f, [k]: v } : f);

  function fmtDate(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-slate-600" />
          <h1 className="text-xl font-bold text-slate-900">Maintenance</h1>
        </div>
        <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Log Issue
        </button>
      </div>

      <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium w-fit">
        {(['open', 'resolved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {issues.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-2">🔧</p>
            <p className="font-medium">{filter === 'open' ? 'No open issues' : 'No issues found'}</p>
          </div>
        ) : issues.map(issue => {
          const pc = PRIORITY_CONFIG[issue.priority] ?? PRIORITY_CONFIG.normal;
          return (
            <div key={issue.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">Room {issue.room_number}</p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: pc.color, background: pc.bg }}>
                      {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
                    </span>
                    {issue.status === 'resolved' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Resolved</span>
                    )}
                  </div>
                  <p className="text-slate-700 mt-1">{issue.issue}</p>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-400">
                    {issue.reported_by && <span>Reported by: {issue.reported_by}</span>}
                    <span>Logged: {fmtDate(issue.updated_at)}</span>
                    {issue.resolved_at && <span>Resolved: {fmtDate(issue.resolved_at)}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setForm({ ...issue })} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Edit</button>
                  {issue.status === 'open' && (
                    <button onClick={() => resolve.mutate(issue)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {form !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{form.id ? 'Edit Issue' : 'Log Issue'}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Room *</label>
                <select className="input w-full" value={form.room_id} onChange={e => up('room_id', e.target.value)}>
                  <option value="">Select room…</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number} — Floor {r.floor}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Issue *</label><textarea className="input w-full" rows={3} value={form.issue} onChange={e => up('issue', e.target.value)} placeholder="Describe the issue…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                  <select className="input w-full" value={form.priority ?? 'normal'} onChange={e => up('priority', e.target.value)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select className="input w-full" value={form.status ?? 'open'} onChange={e => up('status', e.target.value)}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Reported By</label><input className="input w-full" value={form.reported_by ?? ''} onChange={e => up('reported_by', e.target.value)} placeholder="Staff name" /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save.mutate(form as any)} disabled={!form.room_id || !form.issue.trim() || save.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
