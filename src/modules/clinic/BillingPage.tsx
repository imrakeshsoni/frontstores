// [clinic] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import {
  listBills, createBill, searchPatients, listDoctors, type ClinicBill,
} from '@/lib/db/clinic';
import { toast } from 'sonner';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { appCacheDir } from '@tauri-apps/api/path';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { open as shellOpen } from '@tauri-apps/plugin-shell';

type BillItem = { description: string; quantity: string; unit_price: string; gst_rate: string };

const emptyItem = (): BillItem => ({ description: '', quantity: '1', unit_price: '0', gst_rate: '0' });

const COMMON_ITEMS = [
  { description: 'Consultation Fee', unit_price: '500', gst_rate: '0' },
  { description: 'OPD Consultation', unit_price: '300', gst_rate: '0' },
  { description: 'Dressing Charges', unit_price: '100', gst_rate: '18' },
  { description: 'Injection Administration', unit_price: '50', gst_rate: '18' },
  { description: 'ECG', unit_price: '200', gst_rate: '18' },
];

export function BillingPage() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(today);
  const [modal, setModal] = useState(false);
  const [items, setItems] = useState<BillItem[]>([emptyItem()]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [billForm, setBillForm] = useState({
    doctor_id: '', bill_type: 'consultation', payment_method: 'cash', discount: '0', notes: '',
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['clinic-bills', tid, dateFilter],
    queryFn: () => listBills(tid, { date: dateFilter }),
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ['clinic-doctors', tid],
    queryFn: () => listDoctors(tid),
  });
  const { data: patientResults = [] } = useQuery({
    queryKey: ['clinic-patients-search', tid, patientSearch],
    queryFn: () => searchPatients(tid, patientSearch, 6),
    enabled: patientSearch.length >= 2,
  });

  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const gstTotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0) * Number(i.gst_rate || 0) / 100, 0);
  const discount = Number(billForm.discount || 0);
  const total = Math.max(0, subtotal + gstTotal - discount);

  const createMut = useMutation({
    mutationFn: () => {
      const doc = doctors.find(d => d.id === billForm.doctor_id);
      return createBill(tid, {
        patient_id: selectedPatient?.id,
        patient_name: selectedPatient?.name ?? '',
        patient_phone: selectedPatient?.phone ?? '',
        doctor_id: doc?.id,
        doctor_name: doc?.name,
        bill_type: billForm.bill_type,
        payment_method: billForm.payment_method,
        discount,
        items: items.filter(i => i.description.trim()).map(i => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          gst_rate: Number(i.gst_rate),
        })),
        notes: billForm.notes || undefined,
      });
    },
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: ['clinic-bills', tid] });
      toast.success(`Bill #${bill.bill_number} created`);
      handlePrint(bill);
      setModal(false);
      setItems([emptyItem()]);
      setSelectedPatient(null);
      setPatientSearch('');
      setBillForm({ doctor_id: '', bill_type: 'consultation', payment_method: 'cash', discount: '0', notes: '' });
    },
    onError: (e) => toast.error(String(e)),
  });

  async function handlePrint(bill: ClinicBill) {
    const doc = doctors.find(d => d.id === bill.doctor_id);
    const itemRows = (bill.items ?? items.filter(i => i.description.trim())).map((i: any, idx: number) => {
      const desc = i.description ?? '';
      const qty = i.quantity ?? 1;
      const price = i.unit_price ?? Number((i as BillItem).unit_price ?? 0);
      const gst = i.gst_rate ?? 0;
      const lineTotal = qty * price;
      return `<tr><td>${idx + 1}</td><td>${desc}</td><td>${qty}</td><td>₹${price}</td><td>${gst}%</td><td>₹${lineTotal.toFixed(2)}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><title>Bill</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; max-width: 600px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th { background: #1d4ed8; color: white; padding: 5px 8px; text-align: left; font-size: 11px; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  .totals { float: right; width: 200px; margin-top: 10px; }
  .totals td { padding: 2px 8px; }
  .total-row { font-weight: bold; font-size: 14px; background: #f0f9ff; }
  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #555; }
  .paid-stamp { border: 3px solid #16a34a; color: #16a34a; display: inline-block; padding: 4px 12px; font-weight: bold; font-size: 18px; transform: rotate(-15deg); margin: 10px; }
  @media print { body { padding: 5px; } }
</style></head><body onload="window.print()">
<div class="header">
  <h2>${config?.shop_name ?? 'Clinic'}</h2>
  ${doc ? `<p>Dr. ${doc.name}${doc.specialization ? `, ${doc.specialization}` : ''}</p>` : ''}
  ${config?.phone ? `<p>${config.phone}</p>` : ''}
  ${config?.address_line1 ? `<p>${config.address_line1}</p>` : ''}
  <h3>BILL / RECEIPT</h3>
</div>
<table style="margin-bottom:8px;width:100%">
  <tr><td><strong>Bill No:</strong> ${bill.bill_number}</td><td><strong>Date:</strong> ${new Date(bill.created_at).toLocaleDateString('en-IN')}</td></tr>
  <tr><td><strong>Patient:</strong> ${bill.patient_name ?? 'Walk-in'}</td><td><strong>Type:</strong> ${bill.bill_type}</td></tr>
  ${bill.patient_phone ? `<tr><td colspan="2"><strong>Phone:</strong> ${bill.patient_phone}</td></tr>` : ''}
</table>
<table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
<tbody>${itemRows}</tbody></table>
<table class="totals">
  <tr><td>Subtotal:</td><td style="text-align:right">₹${bill.subtotal.toFixed(2)}</td></tr>
  ${bill.gst_amount ? `<tr><td>GST:</td><td style="text-align:right">₹${bill.gst_amount.toFixed(2)}</td></tr>` : ''}
  ${bill.discount ? `<tr><td>Discount:</td><td style="text-align:right">-₹${bill.discount.toFixed(2)}</td></tr>` : ''}
  <tr class="total-row"><td>TOTAL:</td><td style="text-align:right">₹${bill.total.toFixed(2)}</td></tr>
  <tr><td>Payment:</td><td style="text-align:right">${bill.payment_method.toUpperCase()}</td></tr>
</table>
<div style="text-align:center;margin-top:20px"><div class="paid-stamp">PAID</div></div>
${bill.notes ? `<p style="margin-top:10px;font-size:11px">Notes: ${bill.notes}</p>` : ''}
<div class="footer"><p>Thank you for visiting us. Get well soon!</p></div>
</body></html>`;
    try {
      const dir = await appCacheDir();
      const path = `${dir}/clinic_bill_${Date.now()}.html`;
      await writeTextFile(path, html);
      await shellOpen(path);
    } catch {}
  }

  const todayRevenue = bills.filter(b => b.payment_status === 'paid').reduce((s, b) => s + b.total, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Billing</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {bills.length} bills · ₹{todayRevenue.toLocaleString('en-IN')} collected
          </p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> Create Bill
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
        <button onClick={() => setDateFilter(today)} className="px-3 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--accent)' }}>Today</button>
      </div>

      {/* Bills list */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
        {bills.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>No bills for this date</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-2)' }}>
                {['Bill No', 'Patient', 'Type', 'Payment', 'Total', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--surface-border)' }}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>{b.bill_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{b.patient_name ?? 'Walk-in'}</p>
                    {b.doctor_name && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Dr. {b.doctor_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{b.bill_type}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dbeafe', color: '#2563eb' }}>
                      {b.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: '#059669' }}>₹{b.total.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handlePrint(b)} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                      <Printer className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Bill Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create Bill</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Patient */}
              <div className="col-span-2">
                {selectedPatient ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedPatient.name}</p>
                    <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input placeholder="Search patient (optional)…" value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                    {patientResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl overflow-hidden"
                        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                        {patientResults.map(p => (
                          <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-b-0"
                            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
                            {p.name} <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.patient_no}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <select value={billForm.doctor_id} onChange={e => setBillForm(f => ({ ...f, doctor_id: e.target.value }))}
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <option value="">Doctor (optional)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
              </select>
              <select value={billForm.bill_type} onChange={e => setBillForm(f => ({ ...f, bill_type: e.target.value }))}
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <option>consultation</option><option>pharmacy</option><option>lab</option><option>ipd</option><option>procedure</option><option>other</option>
              </select>
              <select value={billForm.payment_method} onChange={e => setBillForm(f => ({ ...f, payment_method: e.target.value }))}
                className="rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                <option>cash</option><option>upi</option><option>card</option><option>insurance</option>
              </select>
            </div>

            {/* Quick add common items */}
            <div className="flex gap-2 flex-wrap mb-3">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Quick add:</span>
              {COMMON_ITEMS.map(c => (
                <button key={c.description} onClick={() => setItems(ii => [...ii, { description: c.description, quantity: '1', unit_price: c.unit_price, gst_rate: c.gst_rate }])}
                  className="text-xs px-2 py-1 rounded-lg" style={{ background: '#dbeafe', color: '#2563eb' }}>
                  {c.description}
                </button>
              ))}
            </div>

            {/* Items */}
            <div className="space-y-2 mb-4">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <input placeholder="Description" value={item.description}
                      onChange={e => setItems(ii => ii.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" placeholder="Qty" value={item.quantity}
                      onChange={e => setItems(ii => ii.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" placeholder="Price" value={item.unit_price}
                      onChange={e => setItems(ii => ii.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" placeholder="GST%" value={item.gst_rate}
                      onChange={e => setItems(ii => ii.map((x, j) => j === i ? { ...x, gst_rate: e.target.value } : x))}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div className="col-span-1">
                    <button onClick={() => setItems(ii => ii.filter((_, j) => j !== i))}
                      className="w-full h-full rounded-xl flex items-center justify-center" style={{ background: '#fee2e2', color: '#dc2626' }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => setItems(ii => [...ii, emptyItem()])}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                <Plus className="h-3 w-3" /> Add Row
              </button>
            </div>

            {/* Totals */}
            <div className="flex gap-4 items-end justify-between">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Discount (₹)</label>
                <input type="number" value={billForm.discount} onChange={e => setBillForm(f => ({ ...f, discount: e.target.value }))} min={0}
                  className="w-32 rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Subtotal: ₹{subtotal.toFixed(2)}</p>
                {gstTotal > 0 && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>GST: ₹{gstTotal.toFixed(2)}</p>}
                {discount > 0 && <p className="text-xs" style={{ color: '#dc2626' }}>Discount: -₹{discount.toFixed(2)}</p>}
                <p className="text-xl font-bold" style={{ color: '#059669' }}>₹{total.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => createMut.mutate()}
                disabled={items.filter(i => i.description.trim()).length === 0 || createMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                {createMut.isPending ? 'Saving…' : 'Create & Print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
