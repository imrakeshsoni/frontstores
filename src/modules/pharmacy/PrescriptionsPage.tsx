// [medical] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, X, Search } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getPrescriptions, savePrescription, updatePrescription, deletePrescription, type RxPrescription } from '@/lib/db/pharmacy';
import { listCustomers, type Customer } from '@/lib/db/customers';

interface PrescriptionForm {
  customer_id: string;
  doctor_name: string;
  doctor_reg_no: string;
  prescription_no: string;
  prescription_date: string;
  notes: string;
}

const EMPTY: PrescriptionForm = {
  customer_id: '', doctor_name: '', doctor_reg_no: '',
  prescription_no: '', prescription_date: '', notes: '',
};

export function PrescriptionsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PrescriptionForm>(EMPTY);
  const [search, setSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');

  const { data: rxList = [], isLoading } = useQuery({
    queryKey: ['rx_prescriptions', tenantId],
    queryFn: () => getPrescriptions(tenantId),
    enabled: !!tenantId,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', tenantId, custSearch],
    queryFn: () => listCustomers(tenantId, { search: custSearch, perPage: 50 }),
    enabled: !!tenantId,
  });
  const customers: Customer[] = customersData?.items ?? [];

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.doctor_name) throw new Error('Doctor name is required');
      if (editId) {
        await updatePrescription(tenantId, editId, form);
      } else {
        await savePrescription(tenantId, { ...form, prescription_date: form.prescription_date || null });
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Prescription updated' : 'Prescription saved');
      qc.invalidateQueries({ queryKey: ['rx_prescriptions'] });
      setShowForm(false); setEditId(null); setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deletePrescription(tenantId, id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['rx_prescriptions'] }); },
  });

  function openEdit(rx: RxPrescription) {
    setEditId(rx.id);
    setForm({ customer_id: rx.customer_id, doctor_name: rx.doctor_name, doctor_reg_no: rx.doctor_reg_no,
      prescription_no: rx.prescription_no, prescription_date: rx.prescription_date ?? '', notes: rx.notes });
    setShowForm(true);
  }

  const getCustomerName = (cid: string) => customers.find(c => c.id === cid)?.name ?? cid;

  const filtered = rxList.filter(rx => {
    if (!search) return true;
    const q = search.toLowerCase();
    return rx.doctor_name.toLowerCase().includes(q) || rx.prescription_no.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#dbeafe' }}>
            <FileText className="h-5 w-5" style={{ color: '#2563eb' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Prescriptions</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{rxList.length} prescription(s) on record</p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Prescription
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by doctor or Rx no…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{editId ? 'Edit Prescription' : 'New Prescription'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Customer search</label>
                <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Type name…"
                  className="w-full px-3 py-2 rounded-xl border text-sm mb-1"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
                <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                  <option value="">No customer linked</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                </select>
              </div>
              {[
                { key: 'doctor_name', label: 'Doctor Name *', type: 'text' },
                { key: 'doctor_reg_no', label: 'Doctor Reg No', type: 'text' },
                { key: 'prescription_no', label: 'Prescription No', type: 'text' },
                { key: 'prescription_date', label: 'Date', type: 'date' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border text-sm"
                    style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 rounded-xl border text-sm resize-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
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

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No prescriptions yet</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Patient', 'Doctor', 'Reg No', 'Rx No', 'Date', 'Notes', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(rx => (
                <tr key={rx.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td className="px-4 py-3 font-medium">{rx.customer_id ? getCustomerName(rx.customer_id) : '—'}</td>
                  <td className="px-4 py-3">{rx.doctor_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{rx.doctor_reg_no || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{rx.prescription_no || '—'}</td>
                  <td className="px-4 py-3 text-xs">{rx.prescription_date ?? '—'}</td>
                  <td className="px-4 py-3 text-xs max-w-[150px] truncate" style={{ color: 'var(--text-tertiary)' }}>{rx.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(rx)} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Edit</button>
                      <button onClick={() => { if (confirm('Delete?')) delMut.mutate(rx.id); }}
                        className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
