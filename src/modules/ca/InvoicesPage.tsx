// [ca] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listCAInvoices, listCAClients, createCAInvoice, updateCAInvoice } from '@/lib/db/ca';
import { toast } from 'sonner';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

interface ServiceLine { description: string; amount: number; }

export function CAInvoicesPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName  = useAppStore(s => s.config?.shop_name ?? 'CA Office');
  const qc = useQueryClient();
  const [filterClient, setFilterClient] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    client_id: '', invoice_no: '', invoice_date: today,
    services: [{ description: '', amount: 0 }] as ServiceLine[],
    paid: '0',
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['ca-invoices', tenantId, filterClient],
    queryFn: () => listCAInvoices(tenantId, filterClient || undefined),
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['ca-clients', tenantId, ''],
    queryFn: () => listCAClients(tenantId),
    enabled: !!tenantId,
  });

  const total = form.services.reduce((s, l) => s + (l.amount || 0), 0);

  const add = useMutation({
    mutationFn: () => createCAInvoice(tenantId, {
      client_id: form.client_id,
      invoice_no: form.invoice_no,
      invoice_date: form.invoice_date,
      services: JSON.stringify(form.services.filter(l => l.description.trim())),
      total,
      paid: parseFloat(form.paid) || 0,
      status: parseFloat(form.paid) >= total ? 'paid' : parseFloat(form.paid) > 0 ? 'partial' : 'unpaid',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ca-invoices'] });
      setShowAdd(false);
      setForm({ client_id: '', invoice_no: '', invoice_date: today, services: [{ description: '', amount: 0 }], paid: '0' });
      toast.success('Invoice created');
    },
    onError: (e) => toast.error(String(e)),
  });

  const markPaid = useMutation({
    mutationFn: ({ id, total }: { id: string; total: number }) =>
      updateCAInvoice(tenantId, id, { paid: total, status: 'paid' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ca-invoices'] }); toast.success('Marked as paid'); },
  });

  function clientName(id: string) { return clients.find(c => c.id === id)?.name ?? '—'; }

  function addLine() { setForm(p => ({ ...p, services: [...p.services, { description: '', amount: 0 }] })); }
  function removeLine(i: number) { setForm(p => ({ ...p, services: p.services.filter((_, j) => j !== i) })); }
  function updateLine(i: number, field: keyof ServiceLine, value: string | number) {
    setForm(p => { const s = [...p.services]; s[i] = { ...s[i], [field]: field === 'amount' ? parseFloat(String(value)) || 0 : value }; return { ...p, services: s }; });
  }

  const statusColor = (s: string) => s === 'paid' ? 'text-green-700 bg-green-100' : s === 'partial' ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 mr-2">Filter by client:</label>
        <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? <p className="text-slate-400 text-sm text-center py-8">Loading…</p> : (
        <div className="space-y-2">
          {invoices.map(inv => {
            const services: ServiceLine[] = (() => { try { return JSON.parse(inv.services); } catch { return []; } })();
            return (
              <div key={inv.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                      <Receipt className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800">{inv.invoice_no || `INV-${inv.id.slice(0, 6).toUpperCase()}`}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inv.status)}`}>{inv.status}</span>
                      </div>
                      <p className="text-xs text-slate-400">{clientName(inv.client_id)} · {new Date(inv.invoice_date).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{fmt(inv.total)}</p>
                      {inv.paid < inv.total && <p className="text-xs text-red-500">Due: {fmt(inv.total - inv.paid)}</p>}
                    </div>
                    {inv.status !== 'paid' && (
                      <button onClick={() => markPaid.mutate({ id: inv.id, total: inv.total })}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Mark Paid
                      </button>
                    )}
                  </div>
                </div>
                {services.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-50 space-y-1">
                    {services.map((s, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-500">
                        <span>{s.description}</span>
                        <span>{fmt(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {invoices.length === 0 && (
            <div className="text-center py-16">
              <Clock className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No invoices yet</p>
              <p className="text-slate-300 text-xs mt-1">Create your first invoice for a client</p>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">New Invoice — {shopName}</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Invoice No.</label>
                <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="INV-001" value={form.invoice_no} onChange={e => setForm(p => ({ ...p, invoice_no: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-600">Services</label>
                <button onClick={addLine} className="text-xs text-blue-600 hover:underline">+ Add line</button>
              </div>
              <div className="space-y-2">
                {form.services.map((line, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      placeholder="Service description" value={line.description}
                      onChange={e => updateLine(i, 'description', e.target.value)} />
                    <input type="number" className="w-28 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none text-right"
                      placeholder="0" value={line.amount || ''}
                      onChange={e => updateLine(i, 'amount', e.target.value)} />
                    {form.services.length > 1 && (
                      <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-red-500 text-lg leading-none">×</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2 pr-8">
                <span className="text-sm font-bold text-slate-800">Total: {fmt(total)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount Received (₹)</label>
              <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0" value={form.paid} onChange={e => setForm(p => ({ ...p, paid: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={() => add.mutate()} disabled={!form.client_id || total === 0 || add.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                {add.isPending ? 'Saving…' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
