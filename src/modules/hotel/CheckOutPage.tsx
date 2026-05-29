// [hotel] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Plus, Printer, Trash2 } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getBookings, getFolio, getFolioItems, addFolioItem, updateFolioPayment, updateBookingStatus, updateRoomStatus, deleteFolioItem } from '@/lib/db/hotel';
import { toast } from 'sonner';

function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

export function CheckOutPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const shopName = useAppStore(s => s.config?.shop_name ?? 'Hotel');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();

  const preselect = params.get('booking') ?? '';
  const [selectedBookingId, setSelectedBookingId] = useState(preselect);
  const [payMode, setPayMode] = useState('cash');
  const [payAmount, setPayAmount] = useState(0);
  const [addForm, setAddForm] = useState({ description: '', category: 'food', quantity: 1, rate: 0 });
  const [showAddCharge, setShowAddCharge] = useState(false);

  const { data: activeBookings = [] } = useQuery({
    queryKey: ['hotel-bookings-active', tenantId],
    queryFn: () => getBookings(tenantId, { status: 'checked_in' }),
    enabled: !!tenantId,
  });

  const selectedBooking = activeBookings.find(b => b.id === selectedBookingId);

  const { data: folio, refetch: refetchFolio } = useQuery({
    queryKey: ['hotel-folio', tenantId, selectedBookingId],
    queryFn: () => getFolio(tenantId, selectedBookingId),
    enabled: !!selectedBookingId,
  });

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['hotel-folio-items', tenantId, folio?.id],
    queryFn: () => getFolioItems(tenantId, folio!.id),
    enabled: !!folio?.id,
  });

  const addCharge = useMutation({
    mutationFn: () => addFolioItem(tenantId, folio!.id, { ...addForm }),
    onSuccess: () => {
      toast.success('Charge added');
      setAddForm({ description: '', category: 'food', quantity: 1, rate: 0 });
      setShowAddCharge(false);
      refetchFolio();
      refetchItems();
    },
    onError: () => toast.error('Failed to add charge'),
  });

  const removeCharge = useMutation({
    mutationFn: (itemId: string) => deleteFolioItem(tenantId, itemId, folio!.id),
    onSuccess: () => { refetchFolio(); refetchItems(); },
    onError: () => toast.error('Failed to remove charge'),
  });

  const recordPayment = useMutation({
    mutationFn: () => updateFolioPayment(tenantId, folio!.id, payAmount, payMode),
    onSuccess: () => {
      toast.success('Payment recorded');
      setPayAmount(0);
      refetchFolio();
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const doCheckOut = useMutation({
    mutationFn: async () => {
      if (!selectedBooking || !folio) throw new Error('No booking selected');
      await updateBookingStatus(tenantId, selectedBooking.id, 'checked_out');
      await updateRoomStatus(tenantId, selectedBooking.room_id, 'cleaning');
    },
    onSuccess: () => {
      toast.success('Guest checked out. Room marked for cleaning.');
      qc.invalidateQueries({ queryKey: ['hotel-bookings'] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-stats'] });
      setSelectedBookingId('');
    },
    onError: () => toast.error('Check-out failed'),
  });

  const balance = folio ? folio.total_amount - folio.paid_amount : 0;

  const handlePrint = () => {
    if (!selectedBooking || !folio) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = items.map(i => `<tr><td>${i.description}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">₹${i.rate.toLocaleString('en-IN')}</td><td style="text-align:right">₹${i.amount.toLocaleString('en-IN')}</td></tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Bill</title>
    <style>body{font-family:Arial,sans-serif;margin:20px;color:#111}h2{margin:0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}th{background:#f5f5f5}.total{font-weight:bold;font-size:15px}</style>
    </head><body>
    <h2>${shopName}</h2>
    <p><b>Guest:</b> ${selectedBooking.guest_name} | <b>Room:</b> ${selectedBooking.room_number} | <b>Ref:</b> ${selectedBooking.booking_ref}</p>
    <p><b>Check-in:</b> ${fmtDate(selectedBooking.check_in)} | <b>Check-out:</b> ${fmtDate(selectedBooking.check_out)}</p>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total"><td colspan="3">Total</td><td>₹${folio.total_amount.toLocaleString('en-IN')}</td></tr>
    <tr><td colspan="3">Paid</td><td>₹${folio.paid_amount.toLocaleString('en-IN')}</td></tr>
    <tr class="total"><td colspan="3">Balance Due</td><td>₹${balance.toLocaleString('en-IN')}</td></tr>
    </tfoot></table>
    <p style="margin-top:16px;font-size:12px;color:#666">Thank you for staying with us!</p>
    </body></html>`);
    win.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <LogOut className="h-6 w-6 text-orange-600" />
        <h1 className="text-xl font-bold text-slate-900">Check-Out</h1>
      </div>

      {/* Booking selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">Select Guest (In-House)</label>
        <select className="input w-full" value={selectedBookingId} onChange={e => setSelectedBookingId(e.target.value)}>
          <option value="">Select guest…</option>
          {activeBookings.map(b => (
            <option key={b.id} value={b.id}>Room {b.room_number} — {b.guest_name} (until {fmtDate(b.check_out)})</option>
          ))}
        </select>
      </div>

      {selectedBooking && folio && (
        <div className="space-y-5">
          {/* Booking summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Booking Details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Guest:</span> <b>{selectedBooking.guest_name}</b></div>
              <div><span className="text-slate-500">Room:</span> <b>{selectedBooking.room_number} ({selectedBooking.room_type})</b></div>
              <div><span className="text-slate-500">Check-in:</span> {fmtDate(selectedBooking.check_in)}</div>
              <div><span className="text-slate-500">Check-out:</span> {fmtDate(selectedBooking.check_out)}</div>
              <div><span className="text-slate-500">Guests:</span> {selectedBooking.adults} adults{selectedBooking.children > 0 ? `, ${selectedBooking.children} children` : ''}</div>
              <div><span className="text-slate-500">Booking Ref:</span> <span className="font-mono">{selectedBooking.booking_ref}</span></div>
            </div>
          </div>

          {/* Folio */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Bill / Folio</h2>
              <button onClick={() => setShowAddCharge(!showAddCharge)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <Plus className="h-4 w-4" /> Add Charge
              </button>
            </div>

            {showAddCharge && (
              <div className="mb-4 border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Description</label><input className="input w-full" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Room service, Laundry…" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                    <select className="input w-full" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="food">Food & Beverage</option>
                      <option value="laundry">Laundry</option>
                      <option value="transport">Transport</option>
                      <option value="extra_bed">Extra Bed</option>
                      <option value="room">Room Charge</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label><input type="number" min={1} className="input w-full" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Rate (₹)</label><input type="number" min={0} className="input w-full" value={addForm.rate} onChange={e => setAddForm(f => ({ ...f, rate: Number(e.target.value) }))} /></div>
                  <div className="flex items-end"><p className="text-sm font-semibold text-slate-900">₹{(addForm.quantity * addForm.rate).toLocaleString('en-IN')}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddCharge(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-white">Cancel</button>
                  <button onClick={() => addCharge.mutate()} disabled={!addForm.description || addCharge.isPending} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Add</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{item.description}</p>
                    <p className="text-xs text-slate-400">{item.quantity} × ₹{item.rate.toLocaleString('en-IN')} · {item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${item.amount < 0 ? 'text-green-600' : 'text-slate-900'}`}>₹{item.amount.toLocaleString('en-IN')}</p>
                    <button onClick={() => removeCharge.mutate(item.id)} className="p-1 rounded text-slate-300 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{folio.total_amount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-slate-600"><span>Paid</span><span className="text-green-600">₹{folio.paid_amount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-200 pt-2 mt-2">
                <span>Balance Due</span><span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>₹{balance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          {balance > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Collect Payment</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
                  <input type="number" min={0} max={balance} className="input w-full" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} placeholder={`Max ₹${balance}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
                  <select className="input w-full" value={payMode} onChange={e => setPayMode(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="net_banking">Net Banking</option>
                  </select>
                </div>
              </div>
              <button onClick={() => recordPayment.mutate()} disabled={payAmount <= 0 || recordPayment.isPending} className="mt-3 w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {recordPayment.isPending ? 'Recording…' : `Record ₹${payAmount.toLocaleString('en-IN')} Payment`}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              <Printer className="h-4 w-4" /> Print Bill
            </button>
            <button
              onClick={() => { if (confirm('Confirm check-out? Room will be marked for cleaning.')) doCheckOut.mutate(); }}
              disabled={doCheckOut.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              <LogOut className="h-4 w-4" /> {doCheckOut.isPending ? 'Processing…' : 'Confirm Check-Out'}
            </button>
          </div>
        </div>
      )}

      {activeBookings.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🚪</p>
          <p className="font-medium">No guests currently checked in</p>
        </div>
      )}
    </div>
  );
}
