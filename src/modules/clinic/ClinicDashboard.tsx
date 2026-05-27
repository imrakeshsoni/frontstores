// [clinic] [all tenants]
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import {
  getTodayStats, getTodayTokens, listUpcomingAppointments,
  issueToken, updateTokenStatus,
} from '@/lib/db/clinic';
import { listDoctors } from '@/lib/db/clinic';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  waiting:     { label: 'Waiting',     bg: '#fef9c3', color: '#ca8a04', dot: '#fbbf24' },
  in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#2563eb', dot: '#3b82f6' },
  done:        { label: 'Done',        bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
  skipped:     { label: 'Skipped',     bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
};

export function ClinicDashboard() {
  const { config } = useAppStore();
  const tid = config?.tenant_id ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showIssueToken, setShowIssueToken] = useState(false);
  const [tokenForm, setTokenForm] = useState({ patient_name: '', doctor_id: '', doctor_name: '' });

  const { data: stats } = useQuery({
    queryKey: ['clinic-stats', tid],
    queryFn: () => getTodayStats(tid),
    refetchInterval: 15000,
  });
  const { data: tokens = [] } = useQuery({
    queryKey: ['clinic-tokens', tid],
    queryFn: () => getTodayTokens(tid),
    refetchInterval: 10000,
  });
  const { data: upcoming = [] } = useQuery({
    queryKey: ['clinic-appointments-upcoming', tid],
    queryFn: () => listUpcomingAppointments(tid, 8),
    refetchInterval: 60000,
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ['clinic-doctors', tid],
    queryFn: () => listDoctors(tid),
  });

  const issueMut = useMutation({
    mutationFn: () => issueToken(tid, {
      patient_name: tokenForm.patient_name || undefined,
      doctor_id: tokenForm.doctor_id || undefined,
      doctor_name: tokenForm.doctor_name || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-tokens', tid] });
      qc.invalidateQueries({ queryKey: ['clinic-stats', tid] });
      setShowIssueToken(false);
      setTokenForm({ patient_name: '', doctor_id: '', doctor_name: '' });
      toast.success('Token issued!');
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ tokenId, status }: { tokenId: string; status: string }) =>
      updateTokenStatus(tid, tokenId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-tokens', tid] });
      qc.invalidateQueries({ queryKey: ['clinic-stats', tid] });
    },
  });

  const waiting     = tokens.filter(t => t.status === 'waiting');
  const inProgress  = tokens.filter(t => t.status === 'in_progress');
  const done        = tokens.filter(t => t.status === 'done' || t.status === 'skipped');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>OPD Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/clinic/patients')}
            className="px-4 py-2 rounded-xl text-sm font-medium border"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
          >
            Register Patient
          </button>
          <button
            onClick={() => setShowIssueToken(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            + Issue Token
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Today', value: stats?.totalPatients ?? 0, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Waiting',     value: stats?.waiting ?? 0,       bg: '#fef9c3', color: '#ca8a04' },
          { label: 'In Progress', value: stats?.inProgress ?? 0,    bg: '#e0f2fe', color: '#0891b2' },
          { label: "Today's Revenue", value: `₹${(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}`, bg: '#dcfce7', color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: s.bg }}>
            <p className="text-xs font-medium" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Token Queue Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TokenColumn title="Waiting" tokens={waiting} config={STATUS_CONFIG.waiting}
          onStart={id => statusMut.mutate({ tokenId: id, status: 'in_progress' })}
          onSkip={id => statusMut.mutate({ tokenId: id, status: 'skipped' })}
          onVisit={id => navigate(`/clinic/visits/new?token=${id}`)}
          showStart showVisit showSkip
        />
        <TokenColumn title="In Progress" tokens={inProgress} config={STATUS_CONFIG.in_progress}
          onDone={id => statusMut.mutate({ tokenId: id, status: 'done' })}
          onVisit={id => navigate(`/clinic/visits/new?token=${id}`)}
          showDone showVisit
        />
        <TokenColumn title="Done / Skipped" tokens={done} config={STATUS_CONFIG.done} />
      </div>

      {/* Upcoming Appointments */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Upcoming Appointments</h2>
          <div className="space-y-2">
            {upcoming.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-b-0"
                style={{ borderColor: 'var(--surface-border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.patient_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {a.appointment_date} {a.appointment_time && `at ${a.appointment_time}`}
                    {a.doctor_name && ` · Dr. ${a.doctor_name}`}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#dbeafe', color: '#2563eb' }}>
                  {a.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issue Token Modal */}
      {showIssueToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Issue OPD Token</h2>
            <div className="space-y-3">
              <input
                placeholder="Patient name (optional)"
                value={tokenForm.patient_name}
                onChange={e => setTokenForm(f => ({ ...f, patient_name: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
              />
              <select
                value={tokenForm.doctor_id}
                onChange={e => {
                  const doc = doctors.find(d => d.id === e.target.value);
                  setTokenForm(f => ({ ...f, doctor_id: e.target.value, doctor_name: doc?.name ?? '' }));
                }}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
              >
                <option value="">Select doctor (optional)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowIssueToken(false)}
                className="flex-1 py-2 rounded-xl text-sm border"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={() => issueMut.mutate()}
                disabled={issueMut.isPending}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}>
                Issue Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenColumn({ title, tokens, config, onStart, onSkip, onVisit, onDone, showStart, showSkip, showVisit, showDone }: {
  title: string;
  tokens: any[];
  config: { label: string; bg: string; color: string; dot: string };
  onStart?: (id: string) => void;
  onSkip?: (id: string) => void;
  onVisit?: (id: string) => void;
  onDone?: (id: string) => void;
  showStart?: boolean; showSkip?: boolean; showVisit?: boolean; showDone?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', minHeight: 200 }}>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: config.dot }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: config.bg, color: config.color }}>
          {tokens.length}
        </span>
      </div>
      {tokens.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>Empty</p>
      )}
      {tokens.map(t => (
        <div key={t.id} className="rounded-xl p-3 space-y-2" style={{ background: config.bg }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold" style={{ color: config.color }}>#{t.token_no}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{t.patient_name || 'Walk-in'}</p>
              {t.doctor_name && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Dr. {t.doctor_name}</p>}
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {showStart && <button onClick={() => onStart?.(t.id)}
              className="text-xs px-2 py-1 rounded-lg text-white" style={{ background: '#2563eb' }}>Start</button>}
            {showVisit && <button onClick={() => onVisit?.(t.id)}
              className="text-xs px-2 py-1 rounded-lg text-white" style={{ background: '#059669' }}>Open Visit</button>}
            {showDone && <button onClick={() => onDone?.(t.id)}
              className="text-xs px-2 py-1 rounded-lg text-white" style={{ background: '#16a34a' }}>Done</button>}
            {showSkip && <button onClick={() => onSkip?.(t.id)}
              className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}>Skip</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
