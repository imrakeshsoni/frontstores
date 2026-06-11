// [crm] [all tenants]
import type { ReactNode } from 'react';
import { Check, ChevronLeft } from 'lucide-react';

export const RC = {
  bg: '#f0ece4', nav: '#0f1523', surface: '#ffffff', border: '#e5dfd3',
  text: '#111520', muted: '#7c7869', accent: '#b8922a', green: '#16a34a',
};

// ── Stage progress bar (Salesforce-style chevrons) ───────────────────────────

export function StageBar({ stages, current, onSelect, doneColor = RC.green }: {
  stages: { key: string; label: string }[];
  current: string;
  onSelect?: (key: string) => void;
  doneColor?: string;
}) {
  const currentIdx = stages.findIndex(s => s.key === current);
  return (
    <div style={{ display: 'flex', width: '100%', height: '36px', marginBottom: '20px' }}>
      {stages.map((s, i) => {
        const done = currentIdx >= 0 && i <= currentIdx;
        const isLast = i === stages.length - 1;
        return (
          <div key={s.key}
            onClick={() => onSelect?.(s.key)}
            style={{
              flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? doneColor : '#e5dfd3',
              color: done ? '#fff' : RC.muted,
              fontSize: '11px', fontWeight: 700, cursor: onSelect ? 'pointer' : 'default',
              marginRight: isLast ? 0 : '3px',
              clipPath: i === 0
                ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                : isLast
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)'
                  : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
            }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {done && <Check size={12} />}
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Record header (title + key fields + actions) ─────────────────────────────

export function RecordHeader({ icon, eyebrow, title, fields, actions, onBack }: {
  icon?: ReactNode;
  eyebrow: string;
  title: string;
  fields: { label: string; value: ReactNode }[];
  actions?: ReactNode;
  onBack: () => void;
}) {
  return (
    <div style={{ background: RC.surface, border: `1px solid ${RC.border}`, borderRadius: '4px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: RC.accent, fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', padding: 0, marginBottom: '12px' }}>
        <ChevronLeft size={14} /> Back
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {icon && (
            <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {icon}
            </div>
          )}
          <div>
            <div style={{ fontSize: '11px', color: RC.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '2px' }}>{eyebrow}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: RC.text }}>{title}</div>
          </div>
        </div>
        {actions && <div style={{ display: 'flex', gap: '8px' }}>{actions}</div>}
      </div>
      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        {fields.map(f => (
          <div key={f.label}>
            <div style={{ fontSize: '10px', color: RC.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '4px' }}>{f.label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: RC.text }}>{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

export function RecordTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: `2px solid ${RC.border}`, marginBottom: '16px' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)}
          style={{
            padding: '10px 18px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '13px', fontWeight: 700, color: active === t ? RC.text : RC.muted,
            borderBottom: active === t ? `2px solid ${RC.accent}` : '2px solid transparent', marginBottom: '-2px',
          }}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Two-column record body (main + sidebar) ──────────────────────────────────

export function RecordBody({ main, sidebar }: { main: ReactNode; sidebar: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>
      <div>{main}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{sidebar}</div>
    </div>
  );
}

export function SidebarCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: RC.surface, border: `1px solid ${RC.border}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${RC.border}`, background: '#f8f5f0', fontSize: '11px', fontWeight: 800, color: RC.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: RC.surface, border: `1px solid ${RC.border}`, borderRadius: '4px', padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {children}
    </div>
  );
}
