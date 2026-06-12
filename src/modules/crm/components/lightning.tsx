// [crm] [tenant: FrontStores.com] — "Lightning" design kit: authentic Salesforce look (SLDS blue/gray)
// Used only by the Salesforce-style Sales/Service pages, gated to the FrontStores.com tenant.
import { useEffect, type ReactNode, type CSSProperties } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/theme/useTheme';

// Tenant that gets the Salesforce-style experience
export const SF_TENANT_ID = '78610b1e-5e6e-4093-a548-1cdeee9c580e'; // FrontStores.com — Rakesh Soni, Pune

// Monospace stack — the reference template ("Aria") sets all type in a coding mono font
export const SF_FONT = "'JetBrains Mono', 'SF Mono', ui-monospace, 'Cascadia Mono', 'Roboto Mono', Menlo, Consolas, monospace";

// ── Design tokens — Salesforce structure, "Aria" skin ─────────────────────────
// Pastel blue→mint gradient canvas, ink headings, royal-blue #4a7df0 + violet #8b5cf6
// accents (per the user's reference template)
const LIGHT = {
  bg: '#edf1f8',
  bgGrad: 'linear-gradient(135deg, #e3e9f8 0%, #edf3ee 55%, #e2efe7 100%)',
  card: '#ffffff',
  cardHead: '#f6f8fc',
  border: 'rgba(29,31,36,0.10)',
  borderStrong: 'rgba(29,31,36,0.24)',
  text: '#23252b',
  heading: '#1d1f24',
  muted: 'rgba(29,31,36,0.58)',
  faint: 'rgba(29,31,36,0.34)',
  brand: '#4a7df0',
  brandDark: '#3b5fd9',
  purple: '#8b5cf6',
  brandSoft: 'rgba(74,125,240,0.10)',
  green: '#2e844a',
  greenSoft: 'rgba(46,132,74,0.10)',
  red: '#c0392b',
  redSoft: 'rgba(192,57,43,0.09)',
  amber: '#8c5e02',
  amberSoft: 'rgba(193,135,15,0.13)',
  teal: '#0b827c',
  tealSoft: 'rgba(11,130,124,0.10)',
  pathIncomplete: '#e4e8f3',
  pathIncompleteText: '#565b66',
  pathDone: '#4338ca',
  pathCurrent: '#4a7df0',
  shadow: '0 2px 8px rgba(29,31,36,0.06)',
  shadowLg: '0 16px 48px rgba(29,31,36,0.26)',
  inputBg: '#ffffff',
};

// Dark variant — same language on a dark blue-tinted canvas (app supports dark mode)
const DARK: typeof LIGHT = {
  bg: '#15171e',
  bgGrad: 'linear-gradient(135deg, #14161e 0%, #171b1d 60%, #151a18 100%)',
  card: '#1e212b',
  cardHead: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.24)',
  text: '#e7e9f0',
  heading: '#f1f2f7',
  muted: 'rgba(231,233,240,0.62)',
  faint: 'rgba(231,233,240,0.36)',
  brand: '#7c9bff',
  brandDark: '#a5bbff',
  purple: '#a78bfa',
  brandSoft: 'rgba(124,155,255,0.16)',
  green: '#4bbf73',
  greenSoft: 'rgba(75,191,115,0.16)',
  red: '#f0705f',
  redSoft: 'rgba(240,112,95,0.14)',
  amber: '#e0b34c',
  amberSoft: 'rgba(224,179,76,0.15)',
  teal: '#3fb3ad',
  tealSoft: 'rgba(63,179,173,0.15)',
  pathIncomplete: 'rgba(255,255,255,0.09)',
  pathIncompleteText: 'rgba(231,233,240,0.7)',
  pathDone: '#6d5fd0',
  pathCurrent: '#7c9bff',
  shadow: '0 2px 6px rgba(0,0,0,0.35)',
  shadowLg: '0 12px 48px rgba(0,0,0,0.6)',
  inputBg: 'rgba(255,255,255,0.05)',
};

// Mutable token object — pages read SF at render time; SFPage swaps it per theme
export const SF = { ...LIGHT };

// Object icon tile colors — standard Salesforce (SLDS) object set (same in both themes)
export const SF_ICONS = {
  home: '#0176d3',
  lead: '#f88962',
  account: '#7f8de1',
  contact: '#a094ed',
  opportunity: '#fcb95b',
  quote: '#06a59a',
  order: '#769ed9',
  invoice: '#2e844a',
  product: '#7f8de1',
  case: '#f2cf5b',
  contract: '#96d35f',
  task: '#4bc076',
  call: '#48c3cc',
  email: '#95aec5',
};

// ── One-time global styles ────────────────────────────────────────────────────
let injected = false;
function injectStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes sfFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes sfSlide { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .sf-fade { animation: sfFade 0.2s ease both; }
    .sf-slide { animation: sfSlide 0.22s ease both; }
    .sf-row { transition: background 0.1s ease; cursor: pointer; }
    .sf-row:hover { background: rgba(74,125,240,0.06); }
    html.dark .sf-row:hover { background: rgba(124,155,255,0.10); }
    .sf-link { color: #4a7df0; font-weight: 600; }
    html.dark .sf-link { color: #7c9bff; }
    .sf-card-hover { transition: box-shadow 0.12s ease, border-color 0.12s ease; }
    .sf-card-hover:hover { box-shadow: 0 6px 16px rgba(29,31,36,0.12); border-color: rgba(74,125,240,0.45); }
    html.dark .sf-card-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.5); border-color: rgba(124,155,255,0.5); }
    input.sf-inp:focus, textarea.sf-inp:focus, select.sf-inp:focus { border-color: #4a7df0 !important; box-shadow: 0 0 0 1px #4a7df0; }
    html.dark input.sf-inp:focus, html.dark textarea.sf-inp:focus, html.dark select.sf-inp:focus { border-color: #7c9bff !important; box-shadow: 0 0 0 1px #7c9bff; }
    html.dark select.sf-inp option { background: #1e212b; color: #e7e9f0; }
    .sf-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .sf-scroll::-webkit-scrollbar-track { background: transparent; }
    .sf-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 8px; }
    html.dark .sf-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); }
  `;
  document.head.appendChild(s);
}

// ── Page wrapper — paints the Lightning gray canvas behind content ────────────
export function SFPage({ children }: { children: ReactNode }) {
  useEffect(() => { injectStyles(); }, []);
  const { theme } = useTheme();
  Object.assign(SF, theme === 'dark' ? DARK : LIGHT);
  return (
    <div style={{ position: 'relative', fontFamily: SF_FONT }}>
      <div style={{ position: 'fixed', inset: 0, background: SF.bgGrad, zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1320px', margin: '0 auto', padding: '0 0 48px' }}>{children}</div>
    </div>
  );
}

// ── Object icon tile (the colored rounded square Salesforce puts on headers) ──
export function SFIconTile({ color, children, size = 36 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '8px', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
      {children}
    </div>
  );
}

// ── Object page header (icon + object label + title + actions) ────────────────
export function SFObjectHeader({ icon, iconColor, objectLabel, title, sub, actions }: {
  icon: ReactNode; iconColor: string; objectLabel: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="sf-fade" style={{ background: SF.card, border: `1px solid ${SF.border}`, borderRadius: '8px', padding: '14px 18px', marginBottom: '14px', boxShadow: SF.shadow, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <SFIconTile color={iconColor}>{icon}</SFIconTile>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ fontSize: '12px', color: SF.muted, fontWeight: 600 }}>{objectLabel}</div>
        <div style={{ fontSize: '19px', fontWeight: 700, color: SF.heading, lineHeight: 1.25, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {title}
          <ChevronDown size={14} style={{ color: SF.muted }} />
        </div>
        {sub && <div style={{ fontSize: '12px', color: SF.muted, marginTop: '2px' }}>{sub}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

// ── Highlights panel field (compact label-over-value, Salesforce record top) ──
export function SFHL({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '11px', color: SF.muted, marginBottom: '2px', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: SF.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</div>
    </div>
  );
}

export function SFHighlights({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '14px 20px', padding: '12px 16px', background: SF.cardHead, border: `1px solid ${SF.border}`, borderRadius: '8px', marginBottom: '14px' }}>
      {children}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function SFCard({ title, icon, iconColor, actions, children, noPad, style }: {
  title?: ReactNode; icon?: ReactNode; iconColor?: string; actions?: ReactNode; children: ReactNode; noPad?: boolean; style?: CSSProperties;
}) {
  return (
    <div className="sf-fade" style={{ background: SF.card, border: `1px solid ${SF.border}`, borderRadius: '8px', boxShadow: SF.shadow, overflow: 'hidden', ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 16px', borderBottom: `1px solid ${SF.border}`, background: SF.cardHead }}>
          {icon && <SFIconTile color={iconColor ?? SF.brand} size={24}>{icon}</SFIconTile>}
          <span style={{ fontSize: '13px', fontWeight: 700, color: SF.heading }}>{title}</span>
          <div style={{ flex: 1 }} />
          {actions}
        </div>
      )}
      <div style={noPad ? undefined : { padding: '16px' }}>{children}</div>
    </div>
  );
}

// ── Buttons (SLDS variants) ───────────────────────────────────────────────────
type SFBtnVariant = 'brand' | 'neutral' | 'success' | 'destructive' | 'text';
export function SFBtn({ children, onClick, variant = 'neutral', small, disabled, style }: {
  children: ReactNode; onClick?: () => void; variant?: SFBtnVariant; small?: boolean; disabled?: boolean; style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: small ? '4px 14px' : '7px 18px', borderRadius: '8px',
    fontSize: small ? '12px' : '13px', fontWeight: 600, fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    transition: 'all 0.12s ease', whiteSpace: 'nowrap', lineHeight: 1.4,
  };
  const variants: Record<SFBtnVariant, CSSProperties> = {
    brand:       { background: SF.brand, color: '#fff', border: `1px solid ${SF.brand}` },
    neutral:     { background: SF.card, color: SF.brand, border: `1px solid ${SF.borderStrong}` },
    success:     { background: SF.green, color: '#fff', border: `1px solid ${SF.green}` },
    destructive: { background: SF.card, color: SF.red, border: `1px solid ${SF.borderStrong}` },
    text:        { background: 'transparent', color: SF.brand, border: '1px solid transparent' },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export type SFTone = 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'teal';
export function SFBadge({ tone = 'gray', children }: { tone?: SFTone; children: ReactNode }) {
  const tones: Record<SFTone, [string, string]> = {
    gray:  [SF.cardHead, SF.muted],
    blue:  [SF.brandSoft, SF.brand],
    green: [SF.greenSoft, SF.green],
    red:   [SF.redSoft, SF.red],
    amber: [SF.amberSoft, SF.amber],
    teal:  [SF.tealSoft, SF.teal],
  };
  const [bg, color] = tones[tone];
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}33`, padding: '2px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
      {children}
    </span>
  );
}

// ── Tabs (Lightning underline tabs) ───────────────────────────────────────────
export function SFTabs({ tabs, active, onChange, style }: {
  tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void; style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: `2px solid ${SF.border}`, ...style }}>
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            style={{
              padding: '10px 16px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '13px', fontWeight: on ? 700 : 600, color: on ? SF.brand : SF.muted,
              borderBottom: `3px solid ${on ? SF.brand : 'transparent'}`, marginBottom: '-2px', transition: 'all 0.12s ease',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            {t.label}
            {t.count !== undefined && (
              <span style={{ background: on ? SF.brandSoft : SF.cardHead, color: on ? SF.brand : SF.muted, borderRadius: '10px', padding: '0 7px', fontSize: '11px', fontWeight: 700 }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Sales/Case Path (the signature Salesforce chevron path) ───────────────────
export function SFPath({ stages, current, selected, onSelect, closedLabel, closedTone }: {
  stages: { key: string; label: string }[];
  current: string;                       // record's actual stage
  selected?: string | null;              // stage the user clicked (path selection)
  onSelect?: (key: string) => void;
  closedLabel?: string;                  // when record is closed, label shown across the path end
  closedTone?: 'green' | 'red';
}) {
  const curIdx = stages.findIndex(s => s.key === current);
  const isClosed = !!closedLabel;
  return (
    <div style={{ display: 'flex', width: '100%', height: '32px', gap: '3px' }}>
      {stages.map((s, i) => {
        const done = isClosed || (curIdx >= 0 && i < curIdx);
        const isCur = !isClosed && i === curIdx;
        const isSel = selected === s.key && !isCur;
        const bgFinal = done ? SF.pathDone : isCur ? SF.pathCurrent : isSel ? SF.brandSoft : SF.pathIncomplete;
        const color = done || isCur ? '#fff' : isSel ? SF.brand : SF.pathIncompleteText;
        const isFirst = i === 0, isLast = i === stages.length - 1;
        return (
          <div key={s.key} onClick={() => onSelect?.(s.key)}
            title={s.label}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: bgFinal, color,
              fontSize: '12px', fontWeight: 700, cursor: onSelect ? 'pointer' : 'default',
              transition: 'all 0.12s ease', overflow: 'hidden', whiteSpace: 'nowrap',
              outline: isSel ? `1px solid ${SF.brand}` : 'none', outlineOffset: '-1px',
              clipPath: isFirst
                ? 'polygon(0 0, calc(100% - 11px) 0, 100% 50%, calc(100% - 11px) 100%, 0 100%)'
                : isLast
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 11px 50%)'
                  : 'polygon(0 0, calc(100% - 11px) 0, 100% 50%, calc(100% - 11px) 100%, 0 100%, 11px 50%)',
            }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 14px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {done && <Check size={12} />}
              {s.label}
            </span>
          </div>
        );
      })}
      {isClosed && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: closedTone === 'red' ? SF.red : SF.green, color: '#fff', fontSize: '12px', fontWeight: 700,
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 11px 50%)', whiteSpace: 'nowrap', padding: '0 14px',
        }}>
          <Check size={12} style={{ marginRight: '5px' }} /> {closedLabel}
        </div>
      )}
    </div>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
export function SFStat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="sf-fade" style={{ background: SF.card, border: `1px solid ${SF.border}`, borderLeft: `4px solid ${accent ?? SF.brand}`, borderRadius: '8px', padding: '12px 16px', boxShadow: SF.shadow, minWidth: 0 }}>
      <div style={{ fontSize: '11px', color: SF.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: SF.heading, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11.5px', color: SF.muted, marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

// ── Forms ─────────────────────────────────────────────────────────────────────
export const sfInp = (extra?: CSSProperties): CSSProperties => ({
  width: '100%', padding: '7px 12px', borderRadius: '6px', border: `1px solid ${SF.borderStrong}`,
  background: SF.inputBg, fontSize: '13px', fontFamily: 'inherit', color: SF.text,
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.12s, box-shadow 0.12s', ...extra,
});

export function SFField({ label, children, span2, required }: { label: string; children: ReactNode; span2?: boolean; required?: boolean }) {
  return (
    <div style={span2 ? { gridColumn: 'span 2' } : undefined}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: SF.muted, marginBottom: '4px' }}>
        {required && <span style={{ color: SF.red, marginRight: '2px' }}>*</span>}{label}
      </label>
      {children}
    </div>
  );
}

export function SFFormGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>{children}</div>;
}

// ── Modal (Lightning modal: centered title, gray footer) ─────────────────────
export function SFModal({ title, onClose, children, footer, width = 540 }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,7,7,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="sf-fade" onClick={e => e.stopPropagation()}
        style={{ background: SF.card, borderRadius: '8px', width: width > 700 ? '96vw' : '100%', maxWidth: width, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: SF.shadowLg, overflow: 'hidden', border: `1px solid ${SF.border}` }}>
        <div style={{ position: 'relative', padding: '15px 48px', borderBottom: `1px solid ${SF.border}`, flexShrink: 0, textAlign: 'center' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: SF.heading, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ position: 'absolute', right: '12px', top: '12px', background: 'transparent', border: 'none', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: SF.muted }}>
            <X size={16} />
          </button>
        </div>
        <div className="sf-scroll" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '12px 24px', borderTop: `1px solid ${SF.border}`, background: SF.cardHead, display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Drawer → wide centered record popup ───────────────────────────────────────
// (was a right slide-over; per user request every record now opens as a wide
// landscape modal in the middle of the screen — same API, so callers unchanged)
export function SFDrawer({ header, onClose, children, footer, width = 1280 }: {
  header: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const w = Math.max(width, 1200); // record popups are always landscape-wide
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,7,7,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="sf-fade" onClick={e => e.stopPropagation()}
        style={{ background: SF.bg, border: `1px solid ${SF.border}`, borderRadius: '10px', width: '96vw', maxWidth: w, height: '92vh', display: 'flex', flexDirection: 'column', boxShadow: SF.shadowLg, overflow: 'hidden' }}>
        <div style={{ background: SF.card, padding: '14px 20px', borderBottom: `1px solid ${SF.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${SF.borderStrong}`, borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: SF.muted, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
        <div className="sf-scroll" style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '12px 20px', borderTop: `1px solid ${SF.border}`, background: SF.card, display: 'flex', gap: '8px', flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Split view — records list on the left, selected record's detail on the right
export function SFSplit({ list, children, listWidth = 320 }: { list: ReactNode; children: ReactNode; listWidth?: number }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <div style={{ width: listWidth, flexShrink: 0, position: 'sticky', top: '8px' }}>{list}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// One record row in the left list panel
export function SFListRow({ icon, iconColor, title, sub, right, selected, onClick }: {
  icon?: ReactNode; iconColor?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode;
  selected?: boolean; onClick: () => void;
}) {
  return (
    <div className="sf-row" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
        borderBottom: `1px solid ${SF.border}`, borderLeft: `3px solid ${selected ? SF.brand : 'transparent'}`,
        background: selected ? SF.brandSoft : 'transparent',
      }}>
      {icon && <SFIconTile color={iconColor ?? SF.brand} size={26}>{icon}</SFIconTile>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: selected ? SF.brand : SF.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontSize: '11px', color: SF.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function SFEmpty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: SF.muted }}>
      <div style={{ fontSize: '15px', fontWeight: 700, color: SF.heading, marginBottom: '5px' }}>{title}</div>
      {hint && <div style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto 16px' }}>{hint}</div>}
      {action}
    </div>
  );
}

// ── List-view table styles ────────────────────────────────────────────────────
export const sfTh: CSSProperties = { textAlign: 'left', padding: '9px 14px', fontSize: '12px', fontWeight: 700, color: SF.muted, borderBottom: `1px solid ${SF.border}`, background: SF.cardHead, whiteSpace: 'nowrap' };
export const sfTd: CSSProperties = { padding: '11px 14px', fontSize: '13px', color: SF.text, borderBottom: `1px solid ${SF.border}`, verticalAlign: 'middle' };
