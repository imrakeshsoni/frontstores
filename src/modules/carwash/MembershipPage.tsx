// [carwash] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Star, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listMemberships, createMembership } from '@/lib/db/carwash';

const PACKAGES = [
  { name: '5-Wash Basic Pack',   washes: 5,  price: 600 },
  { name: '10-Wash Standard Pack', washes: 10, price: 1100 },
  { name: '20-Wash Premium Pack',  washes: 20, price: 2000 },
  { name: 'Monthly Unlimited',     washes: 999, price: 1500 },
];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MembershipPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [selectedPkg, setSelectedPkg] = useState(PACKAGES[1]);
  const [customWashes, setCustomWashes] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['carwash-memberships', tenantId],
    queryFn: () => listMemberships(tenantId),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!customerName.trim()) throw new Error('Customer name required');
      if (customerPhone && !/^\d{10}$/.test(customerPhone.replace(/\D/g, ''))) throw new Error('Phone must be exactly 10 digits');
      const washes = customWashes ? Number(customWashes) : selectedPkg.washes;
      const price = customPrice ? Number(customPrice) : selectedPkg.price;
      return createMembership(tenantId, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone || undefined,
        reg_number: regNumber || undefined,
        package_name: selectedPkg.name,
        total_washes: washes,
        amount_paid: price,
        valid_until: validUntil || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Membership created!');
      setShowForm(false);
      setCustomerName(''); setCustomerPhone(''); setRegNumber('');
      setCustomWashes(''); setCustomPrice(''); setValidUntil('');
      qc.invalidateQueries({ queryKey: ['carwash-memberships'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const active = memberships.filter(m =>
    m.is_active && m.used_washes < m.total_washes &&
    (!m.valid_until || m.valid_until >= todayStr)
  );
  const expired = memberships.filter(m =>
    !m.is_active || m.used_washes >= m.total_washes ||
    (m.valid_until != null && m.valid_until < todayStr)
  );

  return (
    <div className="flex flex-col" style={{ background: '#f5f5f7', height: '100%', overflow: 'hidden' }}>

      {/* Header — floating white plate */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10 }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#86868b', letterSpacing: '0.08em' }}>Car Wash</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.5px' }}>Memberships</h1>
          <p className="text-xs mt-0.5" style={{ color: '#86868b' }}>Prepaid wash packages — lock in loyal customers</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: '#0071e3', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,113,227,0.5), 0 1px 2px rgba(0,0,0,0.15)' }}>
          <Plus className="h-4 w-4" /> Sell Package
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Active memberships */}
      <div>
        <h2 className="font-bold mb-3" style={{ color: '#1d1d1f' }}>Active ({active.length})</h2>
        {isLoading && <div className="h-24 rounded-2xl animate-pulse" style={{ background: '#f2f2f7' }} />}
        {!isLoading && active.length === 0 && (
          <div className="rounded-2xl p-8 flex flex-col items-center gap-2" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Star className="h-8 w-8 opacity-30" />
            <p className="text-sm" style={{ color: '#86868b' }}>No active memberships yet</p>
            <p className="text-xs text-center max-w-xs" style={{ color: '#86868b' }}>
              Sell prepaid wash packages to build loyalty and get cash upfront
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map(m => {
            const remaining = m.total_washes >= 999 ? '∞' : String(m.total_washes - m.used_washes);
            const pct = m.total_washes >= 999 ? 50 : ((m.total_washes - m.used_washes) / m.total_washes) * 100;
            return (
              <div key={m.id} className="rounded-2xl p-5 space-y-3"
                style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '2px solid #7c3aed30' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold" style={{ color: '#1d1d1f' }}>{m.customer_name}</p>
                    {m.customer_phone && <p className="text-xs" style={{ color: '#86868b' }}>{m.customer_phone}</p>}
                    {m.reg_number && <p className="text-xs font-medium" style={{ color: '#0071e3' }}>🚗 {m.reg_number}</p>}
                  </div>
                  <Star className="h-5 w-5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: '#86868b' }}>{m.package_name}</p>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#86868b' }}>{m.used_washes} used</span>
                    <span className="text-sm font-bold" style={{ color: '#7c3aed' }}>{remaining} left</span>
                  </div>
                  {m.total_washes < 999 && (
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f2f2f7' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 50 ? '#7c3aed' : pct > 20 ? '#f59e0b' : '#dc2626' }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: '#86868b' }}>Paid: {fmt(m.amount_paid)}</span>
                  {m.valid_until && <span style={{ color: '#86868b' }}>Until {fmtDate(m.valid_until)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expired */}
      {expired.length > 0 && (
        <div>
          <h2 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#86868b' }}>
            <AlertCircle className="h-4 w-4" /> Exhausted / Expired ({expired.length})
          </h2>
          <div className="space-y-2">
            {expired.map(m => (
              <div key={m.id} className="rounded-xl px-4 py-3 flex items-center justify-between opacity-60"
                style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.09)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>{m.customer_name}</p>
                  <p className="text-xs" style={{ color: '#86868b' }}>{m.package_name} · {m.used_washes}/{m.total_washes} washes used</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>Exhausted</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto"
            style={{ background: '#ffffff' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg" style={{ color: '#1d1d1f' }}>Sell Membership</h2>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Customer Name *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Phone</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="9876543210"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Reg Number</label>
                <input value={regNumber} onChange={(e) => setRegNumber(e.target.value.toUpperCase())} placeholder="MH12AB1234"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#86868b' }}>Package</label>
              <div className="space-y-2">
                {PACKAGES.map(pkg => (
                  <button key={pkg.name} onClick={() => setSelectedPkg(pkg)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 flex justify-between items-center text-sm transition-all`}
                    style={{
                      borderColor: selectedPkg.name === pkg.name ? '#0071e3' : '#e5e5ea',
                      background: selectedPkg.name === pkg.name ? '#ede9fe' : '#f2f2f7',
                      color: '#1d1d1f',
                    }}>
                    <span className="font-medium">{pkg.name}</span>
                    <span className="font-bold" style={{ color: '#0071e3' }}>
                      {pkg.washes >= 999 ? 'Unlimited' : `${pkg.washes} washes`} · {fmt(pkg.price)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#86868b' }}>Custom washes (override)</label>
                  <input type="number" value={customWashes} onChange={(e) => setCustomWashes(e.target.value)} placeholder={String(selectedPkg.washes)}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#86868b' }}>Custom price (override)</label>
                  <input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder={`₹${selectedPkg.price}`}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#86868b' }}>Valid Until (optional)</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#e5e5ea', background: '#f2f2f7', color: '#1d1d1f' }} />
            </div>

            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: '#0071e3' }}>
              {createMutation.isPending ? 'Saving…' : `Sell for ${fmt(customPrice ? Number(customPrice) : selectedPkg.price)}`}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}