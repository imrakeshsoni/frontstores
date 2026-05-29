// [petrolpump] [all tenants]
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listShifts, createShift, closeShift, getOpenShift } from '@/lib/db/petrolpump';
import { now } from '@/lib/db/index';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

export function ShiftPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();

  const { data: openShift } = useQuery({
    queryKey: ['pp-open-shift', tenantId],
    queryFn: () => getOpenShift(tenantId),
    enabled: !!tenantId,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['pp-shifts', tenantId],
    queryFn: () => listShifts(tenantId, 20),
    enabled: !!tenantId,
  });

  const [openForm, setOpenForm] = useState({ staff_name: '', shift_type: 'day', opening_reading: '' });
  const [closeForm, setCloseForm] = useState({
    closing_reading: '', petrol_sold: '', diesel_sold: '',
    cash_collected: '', card_collected: '', upi_collected: '', credit_sales: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleOpenShift() {
    if (!openForm.staff_name || !openForm.opening_reading) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    try {
      const shiftCount = shifts.length + 1;
      await createShift(tenantId, {
        shift_no: `S${String(shiftCount).padStart(3, '0')}`,
        shift_date: new Date().toISOString().slice(0, 10),
        shift_type: openForm.shift_type,
        staff_name: openForm.staff_name,
        opening_reading: parseFloat(openForm.opening_reading) || 0,
        closing_reading: 0,
        petrol_sold: 0, diesel_sold: 0,
        cash_collected: 0, card_collected: 0,
        upi_collected: 0, credit_sales: 0,
        status: 'open', notes: '',
      });
      toast.success('Shift opened successfully');
      setOpenForm({ staff_name: '', shift_type: 'day', opening_reading: '' });
      qc.invalidateQueries({ queryKey: ['pp-open-shift', tenantId] });
      qc.invalidateQueries({ queryKey: ['pp-shifts', tenantId] });
      qc.invalidateQueries({ queryKey: ['pp-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  async function handleCloseShift() {
    if (!openShift) return;
    setSaving(true);
    try {
      await closeShift(tenantId, openShift.id, {
        closing_reading: parseFloat(closeForm.closing_reading) || 0,
        petrol_sold: parseFloat(closeForm.petrol_sold) || 0,
        diesel_sold: parseFloat(closeForm.diesel_sold) || 0,
        cash_collected: parseFloat(closeForm.cash_collected) || 0,
        card_collected: parseFloat(closeForm.card_collected) || 0,
        upi_collected: parseFloat(closeForm.upi_collected) || 0,
        credit_sales: parseFloat(closeForm.credit_sales) || 0,
        notes: closeForm.notes,
      });
      toast.success('Shift closed');
      setCloseForm({ closing_reading: '', petrol_sold: '', diesel_sold: '', cash_collected: '', card_collected: '', upi_collected: '', credit_sales: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['pp-open-shift', tenantId] });
      qc.invalidateQueries({ queryKey: ['pp-shifts', tenantId] });
      qc.invalidateQueries({ queryKey: ['pp-stats', tenantId] });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Shift Management</h1>

      {openShift ? (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <h2 className="font-semibold text-green-800">Shift Open — {openShift.shift_no} ({openShift.staff_name})</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Closing Reading (km/litre)', 'closing_reading'],
              ['Petrol Sold (litres)', 'petrol_sold'],
              ['Diesel Sold (litres)', 'diesel_sold'],
              ['Cash Collected', 'cash_collected'],
              ['Card Collected', 'card_collected'],
              ['UPI Collected', 'upi_collected'],
              ['Credit Sales', 'credit_sales'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type="number" min="0" step="0.01"
                  value={(closeForm as any)[key]}
                  onChange={e => setCloseForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="0"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <button onClick={handleCloseShift} disabled={saving}
            className="mt-4 w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors disabled:opacity-40">
            {saving ? 'Closing…' : 'Close Shift'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Open New Shift</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Name *</label>
              <input value={openForm.staff_name} onChange={e => setOpenForm(f => ({ ...f, staff_name: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Staff on duty"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Shift Type</label>
              <select value={openForm.shift_type} onChange={e => setOpenForm(f => ({ ...f, shift_type: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="day">Day</option>
                <option value="night">Night</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Opening Meter Reading *</label>
              <input type="number" min="0" step="0.01" value={openForm.opening_reading}
                onChange={e => setOpenForm(f => ({ ...f, opening_reading: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="0.00"
              />
            </div>
          </div>
          <button onClick={handleOpenShift} disabled={saving}
            className="mt-4 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors disabled:opacity-40">
            {saving ? 'Opening…' : 'Open Shift'}
          </button>
        </div>
      )}

      {/* Shift history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Shift History</h2>
        {shifts.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No shifts yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Shift</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Staff</th>
                  <th className="pb-2 font-medium">Petrol (L)</th>
                  <th className="pb-2 font-medium">Diesel (L)</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium">{s.shift_no}</td>
                    <td className="py-2 text-slate-600">{s.shift_date}</td>
                    <td className="py-2 text-slate-600">{s.staff_name}</td>
                    <td className="py-2">{s.petrol_sold.toFixed(1)}</td>
                    <td className="py-2">{s.diesel_sold.toFixed(1)}</td>
                    <td className="py-2 font-medium">{fmt(s.cash_collected + s.card_collected + s.upi_collected + s.credit_sales)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
