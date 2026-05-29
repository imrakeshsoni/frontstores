// [travel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listVisas, createVisa, updateVisa, deleteVisa, listBookings } from '@/lib/db/travel';
import { toast } from 'sonner';

const VISA_STATUSES = ['applied', 'approved', 'rejected', 'expired'];
const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-600',
};

export function VisaPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    booking_id: '', customer_name: '', passport_no: '', visa_type: '',
    applied_date: new Date().toISOString().slice(0, 10), status: 'applied',
    approved_date: '', expiry_date: '',
  });

  const { data: visas = [], isLoading } = useQuery({
    queryKey: ['tr-visa', tenantId],
    queryFn: () => listVisas(tenantId),
    enabled: !!tenantId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['tr-bookings', tenantId, ''],
    queryFn: () => listBookings(tenantId),
    enabled: !!tenantId,
  });

  const add = useMutation({
    mutationFn: () => createVisa(tenantId, {
      booking_id: form.booking_id, customer_name: form.customer_name, passport_no: form.passport_no,
      visa_type: form.visa_type, applied_date: form.applied_date || null, status: form.status,
      approved_date: form.approved_date || null, expiry_date: form.expiry_date || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tr-visa'] }); setShowAdd(false); toast.success('Visa entry added'); },
    onError: (e) => toast.error(String(e)),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, approved_date, expiry_date }: { id: string; status: string; approved_date?: string; expiry_date?: string }) =>
      updateVisa(tenantId, id, { status, ...(approved_date ? { approved_date } : {}), ...(expiry_date ? { expiry_date } : {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tr-visa'] }); toast.success('Status updated'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteVisa(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tr-visa'] }); toast.success('Visa entry removed'); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Visa Tracker</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-500">
          <Plus className="h-4 w-4" /> Add Visa
        </button>
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {visas.map(v => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{v.customer_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[v.status] ?? 'bg-slate-100 text-slate-600'}`}>{v.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Passport: {v.passport_no || '—'} · {v.visa_type || '—'}</p>
                  <p className="text-xs text-slate-400">Applied: {v.applied_date ? new Date(v.applied_date).toLocaleDateString('en-IN') : '—'} · Approved: {v.approved_date ? new Date(v.approved_date).toLocaleDateString('en-IN') : '—'} · Expiry: {v.expiry_date ? new Date(v.expiry_date).toLocaleDateString('en-IN') : '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={v.status} onChange={ev => updateStatus.mutate({ id: v.id, status: ev.target.value })}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
                    {VISA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => { if (confirm('Remove?')) del.mutate(v.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {visas.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No visa entries</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800">Add Visa Entry</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Booking</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.booking_id} onChange={e => setForm(p => ({ ...p, booking_id: e.target.value }))}>
                <option value="">— Select booking (optional) —</option>
                {bookings.map(b => <option key={b.id} value={b.id}>{b.customer_name} – {b.destination}</option>)}
              </select>
            </div>
            {[
              { key: 'customer_name', label: 'Passenger Name *', placeholder: 'Full name' },
              { key: 'passport_no', label: 'Passport Number', placeholder: 'A1234567' },
              { key: 'visa_type', label: 'Visa Type', placeholder: 'Tourist / Business' },
              { key: 'applied_date', label: 'Applied Date', type: 'date' },
              { key: 'approved_date', label: 'Approved Date', type: 'date' },
              { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                <input type={f.type ?? 'text'} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {VISA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.customer_name || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Add Visa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
