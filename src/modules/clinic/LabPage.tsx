// [clinic] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { updateLabResult } from '@/lib/db/clinic';
import { getDb } from '@/lib/db/index';
import { toast } from 'sonner';
import { FlaskConical, CheckCircle } from 'lucide-react';

interface LabOrder {
  id: string; visit_id: string; patient_id: string; test_name: string;
  test_category: string | null; status: string; result_value: string | null;
  result_unit: string | null; reference_range: string | null; is_abnormal: number;
  notes: string | null; ordered_at: string; resulted_at: string | null;
  patient_name?: string;
}

export function LabPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'ordered' | 'resulted' | 'all'>('ordered');
  const [selected, setSelected] = useState<LabOrder | null>(null);
  const [resultForm, setResultForm] = useState({ value: '', unit: '', range: '', is_abnormal: false, notes: '' });

  const { data: orders = [] } = useQuery({
    queryKey: ['clinic-lab-orders', tid, filter],
    queryFn: async () => {
      const db = await getDb();
      const cond = filter === 'all' ? '' : `AND lo.status = '${filter}'`;
      return db.select<LabOrder[]>(
        `SELECT lo.*, v.patient_name FROM clinic_lab_orders lo
         LEFT JOIN clinic_visits v ON lo.visit_id = v.id
         WHERE lo.tenant_id = ? AND lo.deleted_at IS NULL ${cond}
         ORDER BY lo.ordered_at DESC LIMIT 100`,
        [tid]
      );
    },
    refetchInterval: 30000,
  });

  const resultMut = useMutation({
    mutationFn: () => updateLabResult(tid, selected!.id, {
      result_value: resultForm.value,
      result_unit: resultForm.unit || undefined,
      reference_range: resultForm.range || undefined,
      is_abnormal: resultForm.is_abnormal,
      notes: resultForm.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-lab-orders', tid] });
      toast.success('Result entered');
      setSelected(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Lab / Investigations</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['ordered', 'resulted', 'all'] as const).map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={filter === tab
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            {tab === 'ordered' ? 'Pending Results' : tab === 'resulted' ? 'Results Ready' : 'All'}
          </button>
        ))}
        <span className="ml-auto text-sm" style={{ color: 'var(--text-tertiary)' }}>{orders.length} tests</span>
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
        {orders.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>No lab orders</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Test', 'Patient', 'Ordered At', 'Status', 'Result', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--surface-border)' }}>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{o.test_name}</p>
                    {o.test_category && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{o.test_category}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{o.patient_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(o.ordered_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={o.status === 'ordered'
                        ? { background: '#fef9c3', color: '#ca8a04' }
                        : { background: '#dcfce7', color: '#16a34a' }}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {o.result_value ? (
                      <span style={{ color: o.is_abnormal ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {o.result_value} {o.result_unit ?? ''}
                        {o.is_abnormal ? ' ⚠' : ' ✓'}
                      </span>
                    ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {o.status === 'ordered' && (
                      <button onClick={() => {
                        setSelected(o);
                        setResultForm({ value: '', unit: '', range: '', is_abnormal: false, notes: '' });
                      }} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
                        <FlaskConical className="h-3 w-3" /> Enter Result
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Enter Result Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Enter Lab Result</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--accent)' }}>{selected.test_name}</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Result Value *</label>
                  <input placeholder="e.g. 12.5" value={resultForm.value}
                    onChange={e => setResultForm(f => ({ ...f, value: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Unit</label>
                  <input placeholder="g/dL" value={resultForm.unit}
                    onChange={e => setResultForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Reference Range</label>
                <input placeholder="e.g. 11.5–15.5 g/dL" value={resultForm.range}
                  onChange={e => setResultForm(f => ({ ...f, range: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <input placeholder="Additional notes" value={resultForm.notes}
                  onChange={e => setResultForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={resultForm.is_abnormal}
                  onChange={e => setResultForm(f => ({ ...f, is_abnormal: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-red-600 font-medium">Mark as Abnormal</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelected(null)} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => resultMut.mutate()} disabled={!resultForm.value || resultMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                Save Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
