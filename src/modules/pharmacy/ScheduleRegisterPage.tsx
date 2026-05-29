// [medical] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Plus, X, Printer } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getScheduleRegister, saveScheduleEntry, deleteScheduleEntry, type RxScheduleEntry } from '@/lib/db/pharmacy';

const SCHEDULE_TYPES = ['H', 'H1', 'X', 'G'];

interface EntryForm {
  medicine_name: string;
  schedule_type: string;
  quantity: number;
  patient_name: string;
  patient_address: string;
  doctor_name: string;
  prescription_no: string;
  sale_date: string;
}

const EMPTY: EntryForm = {
  medicine_name: '', schedule_type: 'H', quantity: 1,
  patient_name: '', patient_address: '', doctor_name: '',
  prescription_no: '', sale_date: new Date().toISOString().substring(0, 10),
};

const SCHEDULE_BADGE: Record<string, { bg: string; text: string }> = {
  H:  { bg: '#fee2e2', text: '#dc2626' },
  H1: { bg: '#fef3c7', text: '#d97706' },
  X:  { bg: '#f3e8ff', text: '#9333ea' },
  G:  { bg: '#dcfce7', text: '#16a34a' },
};

export function ScheduleRegisterPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EntryForm>(EMPTY);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSchedule, setFilterSchedule] = useState('');

  const today = new Date().toISOString().substring(0, 10);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['rx_schedule', tenantId, dateFrom, dateTo],
    queryFn: () => getScheduleRegister(tenantId, dateFrom || undefined, dateTo || undefined),
    enabled: !!tenantId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.medicine_name) throw new Error('Medicine name required');
      if (!form.patient_name) throw new Error('Patient name required');
      await saveScheduleEntry(tenantId, form);
    },
    onSuccess: () => {
      toast.success('Entry added to register');
      qc.invalidateQueries({ queryKey: ['rx_schedule'] });
      setShowForm(false); setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteScheduleEntry(tenantId, id),
    onSuccess: () => { toast.success('Entry deleted'); qc.invalidateQueries({ queryKey: ['rx_schedule'] }); },
  });

  const filtered = filterSchedule ? entries.filter(e => e.schedule_type === filterSchedule) : entries;

  function handlePrint() {
    const rows = filtered.map(e =>
      `<tr><td>${e.sale_date}</td><td>${e.medicine_name}</td><td>${e.schedule_type}</td><td>${e.quantity}</td><td>${e.patient_name}</td><td>${e.patient_address}</td><td>${e.doctor_name}</td><td>${e.prescription_no}</td></tr>`
    ).join('');
    const html = `<html><head><title>Schedule Register</title><style>body{font-family:Arial,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f1f5f9}h2{margin-bottom:12px}</style></head><body><h2>Schedule Drug Register</h2><table><tr><th>Date</th><th>Medicine</th><th>Schedule</th><th>Qty</th><th>Patient</th><th>Address</th><th>Doctor</th><th>Rx No</th></tr>${rows}</table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  return (
    <div className="p-6 space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#fee2e2' }}>
            <ClipboardList className="h-5 w-5" style={{ color: '#dc2626' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Schedule Register</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Schedule H / H1 / X drug sales log</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={() => { setShowForm(true); setForm({ ...EMPTY, sale_date: today }); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            <Plus className="h-4 w-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex gap-1">
          {['', ...SCHEDULE_TYPES].map(s => (
            <button key={s} onClick={() => setFilterSchedule(s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={filterSchedule === s
                ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                : { borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-screen overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">New Schedule Entry</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Medicine Name *</label>
                <input value={form.medicine_name} onChange={e => setForm(f => ({ ...f, medicine_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Schedule Type</label>
                <select value={form.schedule_type} onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                  {SCHEDULE_TYPES.map(s => <option key={s} value={s}>Schedule {s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Quantity</label>
                <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              {[
                { key: 'patient_name', label: 'Patient Name *', type: 'text', span: true },
                { key: 'patient_address', label: 'Patient Address', type: 'text', span: true },
                { key: 'doctor_name', label: 'Doctor Name', type: 'text', span: false },
                { key: 'prescription_no', label: 'Prescription No', type: 'text', span: false },
                { key: 'sale_date', label: 'Sale Date', type: 'date', span: false },
              ].map(({ key, label, type, span }) => (
                <div key={key} className={span ? 'col-span-2' : ''}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border text-sm"
                    style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No entries found</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Date', 'Medicine', 'Sched.', 'Qty', 'Patient', 'Address', 'Doctor', 'Rx No', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const badge = SCHEDULE_BADGE[e.schedule_type] ?? { bg: '#f1f5f9', text: '#334155' };
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td className="px-3 py-3 text-xs">{e.sale_date}</td>
                    <td className="px-3 py-3 font-medium">{e.medicine_name}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: badge.bg, color: badge.text }}>
                        {e.schedule_type}
                      </span>
                    </td>
                    <td className="px-3 py-3">{e.quantity}</td>
                    <td className="px-3 py-3">{e.patient_name}</td>
                    <td className="px-3 py-3 text-xs max-w-[120px] truncate" style={{ color: 'var(--text-tertiary)' }}>{e.patient_address || '—'}</td>
                    <td className="px-3 py-3 text-xs">{e.doctor_name || '—'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{e.prescription_no || '—'}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => { if (confirm('Delete entry?')) delMut.mutate(e.id); }}
                        className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
