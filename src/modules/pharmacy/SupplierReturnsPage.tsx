// [medical] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackagePlus, Plus, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getSupplierReturns, saveSupplierReturn, deleteSupplierReturn, type RxSupplierReturn } from '@/lib/db/pharmacy';

interface ReturnForm {
  supplier_id: string;
  batch_id: string;
  product_name: string;
  batch_no: string;
  quantity: number;
  reason: string;
  return_date: string;
  amount: number;
}

const EMPTY: ReturnForm = {
  supplier_id: '', batch_id: '', product_name: '', batch_no: '',
  quantity: 1, reason: '', return_date: new Date().toISOString().substring(0, 10), amount: 0,
};

export function SupplierReturnsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ReturnForm>(EMPTY);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['rx_supplier_returns', tenantId],
    queryFn: () => getSupplierReturns(tenantId),
    enabled: !!tenantId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.product_name) throw new Error('Product name required');
      await saveSupplierReturn(tenantId, form);
    },
    onSuccess: () => {
      toast.success('Return logged');
      qc.invalidateQueries({ queryKey: ['rx_supplier_returns'] });
      setShowForm(false); setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteSupplierReturn(tenantId, id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['rx_supplier_returns'] }); },
  });

  const totalAmount = returns.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6 space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#fef3c7' }}>
            <PackagePlus className="h-5 w-5" style={{ color: '#d97706' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Supplier Returns</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Total ₹{totalAmount.toLocaleString('en-IN')} returned</p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setForm(EMPTY); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Add Return
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Log Supplier Return</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'product_name', label: 'Product Name *', type: 'text', span: true },
                { key: 'batch_no', label: 'Batch No', type: 'text', span: false },
                { key: 'quantity', label: 'Quantity', type: 'number', span: false },
                { key: 'amount', label: 'Amount ₹', type: 'number', span: false },
                { key: 'return_date', label: 'Return Date', type: 'date', span: false },
              ].map(({ key, label, type, span }) => (
                <div key={key} className={span ? 'col-span-2' : ''}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border text-sm"
                    style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Reason</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2}
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
      ) : returns.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <PackagePlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No returns yet</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Product', 'Batch No', 'Qty', 'Amount', 'Reason', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(returns as RxSupplierReturn[]).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td className="px-4 py-3 font-medium">{r.product_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.batch_no || '—'}</td>
                  <td className="px-4 py-3">{r.quantity}</td>
                  <td className="px-4 py-3 font-semibold">₹{r.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs max-w-[150px] truncate" style={{ color: 'var(--text-tertiary)' }}>{r.reason || '—'}</td>
                  <td className="px-4 py-3 text-xs">{r.return_date}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm('Delete this return?')) delMut.mutate(r.id); }}
                      className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>Del</button>
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
