// [medical] [all tenants]
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getAllPatientHistory, getPatientHistory, type RxPatientHistory } from '@/lib/db/pharmacy';
import { listCustomers, type Customer } from '@/lib/db/customers';

export function PatientHistoryPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [search, setSearch] = useState('');

  const { data: customersData } = useQuery({
    queryKey: ['customers', tenantId, search],
    queryFn: () => listCustomers(tenantId, { search, perPage: 100 }),
    enabled: !!tenantId,
  });
  const customers: Customer[] = customersData?.items ?? [];

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['rx_patient_history', tenantId, selectedCustomerId],
    queryFn: () => selectedCustomerId
      ? getPatientHistory(tenantId, selectedCustomerId)
      : getAllPatientHistory(tenantId),
    enabled: !!tenantId,
  });

  // Group by customer_id when showing all
  const grouped: Record<string, RxPatientHistory[]> = {};
  for (const h of history) {
    if (!grouped[h.customer_id]) grouped[h.customer_id] = [];
    grouped[h.customer_id].push(h);
  }

  const getCustomerName = (cid: string) => customers.find(c => c.id === cid)?.name ?? cid;

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="p-6 space-y-6" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#fce7f3' }}>
          <Users className="h-5 w-5" style={{ color: '#db2777' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">Patient History</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Medicine purchase history by patient</p>
        </div>
      </div>

      {/* Customer search + filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient…"
            className="pl-9 pr-4 py-2 rounded-xl border text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)', minWidth: 200 }} />
        </div>
        <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
          className="px-3 py-2 rounded-xl border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)', minWidth: 220 }}>
          <option value="">All Patients</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
        </select>
        {selectedCustomerId && (
          <button onClick={() => setSelectedCustomerId('')} className="text-sm px-3 py-2 rounded-xl border"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Clear</button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-tertiary)' }}>
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No history found</p>
        </div>
      ) : selectedCustomerId ? (
        // Single patient view
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--surface-2)' }}>
            <span className="font-semibold">{selectedCustomer?.name ?? selectedCustomerId}</span>
            <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{history.length} purchase(s)</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                {['Medicine', 'Qty', 'Date', 'Rx Linked'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td className="px-4 py-3 font-medium">{h.product_name}</td>
                  <td className="px-4 py-3">{h.quantity}</td>
                  <td className="px-4 py-3 text-xs">{h.sale_date}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{h.prescription_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // All patients grouped
        Object.entries(grouped).map(([cid, items]) => (
          <div key={cid} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--surface-border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--surface-2)' }}>
              <span className="font-semibold">{getCustomerName(cid)}</span>
              <button onClick={() => setSelectedCustomerId(cid)} className="text-xs px-2 py-1 rounded-lg"
                style={{ background: 'var(--accent)', color: 'white' }}>View all</button>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
              {items.slice(0, 3).map(h => (
                <div key={h.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span>{h.product_name}</span>
                  <div className="flex gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>Qty: {h.quantity}</span>
                    <span>{h.sale_date}</span>
                  </div>
                </div>
              ))}
              {items.length > 3 && (
                <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  +{items.length - 3} more entries
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
