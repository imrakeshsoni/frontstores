// [drivingschool] [all tenants]
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Trash2, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store/app.store';
import { listDSStudents, deleteDSStudent, type DSStudent } from '@/lib/db/drivingschool';

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  active:     { color: '#16a34a', bg: '#dcfce7' },
  completed:  { color: '#2563eb', bg: '#dbeafe' },
  inactive:   { color: '#64748b', bg: '#f1f5f9' },
};

export function StudentsPage() {
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['ds-students', tenantId, statusFilter],
    queryFn: () => listDSStudents(tenantId, { status: statusFilter }),
    enabled: !!tenantId,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDSStudent(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ds-students'] }); qc.invalidateQueries({ queryKey: ['ds-stats'] }); toast.success('Student removed'); },
  });

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.phone.includes(q);
  });

  function feesColor(s: DSStudent) {
    const due = s.fees_total - s.fees_paid;
    if (due <= 0) return { color: '#16a34a', bg: '#dcfce7', label: 'Paid' };
    return { color: '#d97706', bg: '#fef3c7', label: `₹${due.toLocaleString('en-IN')} due` };
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Students</h1>
        <button onClick={() => navigate('/drivingschool/students/new')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#2563eb' }}>
          <Plus className="h-4 w-4" /> Enroll Student
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
          {(['all', 'active', 'completed', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 capitalize transition-colors ${statusFilter === s ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} style={statusFilter === s ? { background: '#2563eb' } : {}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {isLoading ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
            <p className="text-4xl mb-2">🎓</p>
            <p className="font-medium">No students found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
            {filtered.map(s => {
              const sc = STATUS_COLOR[s.status] ?? STATUS_COLOR['active'];
              const fc = feesColor(s);
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ background: '#2563eb' }}>
                      {s.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {s.phone && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}><Phone className="h-3 w-3" />{s.phone}</span>}
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.license_type}</span>
                        {s.ll_passed ? <span className="text-xs text-green-600 font-medium">LL ✓</span> : null}
                        {s.dl_passed ? <span className="text-xs text-blue-600 font-medium">DL ✓</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: fc.color, background: fc.bg }}>{fc.label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ color: sc.color, background: sc.bg }}>{s.status}</span>
                    <div className="flex gap-1">
                      <button onClick={() => navigate(`/drivingschool/students/${s.id}`)} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Remove ${s.name}?`)) del.mutate(s.id); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
