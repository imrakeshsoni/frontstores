// [crm] [all tenants] — CRM design kit v2 "Aurora": futuristic glassmorphism + neon gradients, light & dark
// [crm] [tenant: FrontStores.com] — adds the "Designpro" brand: Salesforce Lightning skin
// (gray canvas, white cards, SLDS blue, rectangular buttons) — applied only for that tenant.
import { useEffect, useMemo, type ReactNode, type CSSProperties } from 'react';
import { Search, X, Check } from 'lucide-react';
import { useTheme } from '@/lib/theme/useTheme';
import { useAppStore } from '@/app/store/app.store';
import { SF_TENANT_ID } from './lightning';

// ── Design tokens — Aurora Dark (glass over dark aurora) ─────────────────────
const DARK = {
  bg: '#0a0c14',
  nav: '#0e1019',
  surface: 'rgba(255,255,255,0.045)',
  surface2: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.09)',
  text: '#eef0f6',
  muted: 'rgba(238,240,246,0.55)',
  faint: 'rgba(238,240,246,0.32)',
  accent: '#6366f1',
  accent2: '#a855f7',
  accent3: '#22d3ee',
  accentSoft: 'rgba(99,102,241,0.15)',
  green: '#34d399',
  greenBg: 'rgba(52,211,153,0.14)',
  red: '#f87171',
  redBg: 'rgba(248,113,113,0.14)',
  blue: '#60a5fa',
  blueBg: 'rgba(96,165,250,0.14)',
  amber: '#fbbf24',
  amberBg: 'rgba(251,191,36,0.14)',
  violet: '#a78bfa',
  violetBg: 'rgba(167,139,250,0.14)',
  pink: '#f472b6',
  pinkBg: 'rgba(244,114,182,0.14)',
  slate: '#94a3b8',
  slateBg: 'rgba(148,163,184,0.14)',
  shadow: '0 4px 24px rgba(0,0,0,0.35)',
  shadowLg: '0 32px 80px rgba(0,0,0,0.6)',
  glow: '0 0 24px rgba(99,102,241,0.35)',
  chevronDoneText: '#06281c',
  panel: 'rgba(20,23,34,0.93)',
  btnRadius: '10px',
};

// ── Aurora Light — same design language on a bright glass canvas ─────────────
const LIGHT: typeof DARK = {
  bg: '#f2f3fa',
  nav: '#ffffff',
  surface: 'rgba(255,255,255,0.72)',
  surface2: 'rgba(18,21,38,0.05)',
  border: 'rgba(18,21,38,0.10)',
  text: '#181b27',
  muted: 'rgba(24,27,39,0.58)',
  faint: 'rgba(24,27,39,0.34)',
  accent: '#6366f1',
  accent2: '#a855f7',
  accent3: '#0891b2',
  accentSoft: 'rgba(99,102,241,0.12)',
  green: '#059669',
  greenBg: 'rgba(5,150,105,0.11)',
  red: '#dc2626',
  redBg: 'rgba(220,38,38,0.10)',
  blue: '#2563eb',
  blueBg: 'rgba(37,99,235,0.10)',
  amber: '#b45309',
  amberBg: 'rgba(180,83,9,0.11)',
  violet: '#7c3aed',
  violetBg: 'rgba(124,58,237,0.10)',
  pink: '#db2777',
  pinkBg: 'rgba(219,39,119,0.10)',
  slate: '#64748b',
  slateBg: 'rgba(100,116,139,0.11)',
  shadow: '0 2px 8px rgba(24,27,39,0.06), 0 8px 28px rgba(24,27,39,0.07)',
  shadowLg: '0 32px 80px rgba(24,27,39,0.25)',
  glow: '0 0 24px rgba(99,102,241,0.22)',
  chevronDoneText: '#ffffff',
  panel: 'rgba(255,255,255,0.94)',
  btnRadius: '10px',
};

// ── "Designpro" brand — "Aria" skin: pastel blue→mint canvas, ink mono type,
// royal-blue #4a7df0 + violet #8b5cf6 accents (per the user's reference template)
// [crm] [tenant: FrontStores.com]
const DP_LIGHT: typeof DARK = {
  bg: '#edf1f8',
  nav: '#ffffff',
  surface: '#ffffff',
  surface2: 'rgba(29,31,36,0.04)',
  border: 'rgba(29,31,36,0.10)',
  text: '#23252b',
  muted: 'rgba(29,31,36,0.58)',
  faint: 'rgba(29,31,36,0.34)',
  accent: '#4a7df0',
  accent2: '#8b5cf6',
  accent3: '#4a7df0',
  accentSoft: 'rgba(74,125,240,0.12)',
  green: '#2e844a',
  greenBg: 'rgba(46,132,74,0.10)',
  red: '#c0392b',
  redBg: 'rgba(192,57,43,0.09)',
  blue: '#4a7df0',
  blueBg: 'rgba(74,125,240,0.10)',
  amber: '#8c5e02',
  amberBg: 'rgba(193,135,15,0.13)',
  violet: '#8b5cf6',
  violetBg: 'rgba(139,92,246,0.10)',
  pink: '#c2417e',
  pinkBg: 'rgba(194,65,126,0.10)',
  slate: '#646a78',
  slateBg: 'rgba(100,106,120,0.12)',
  shadow: '0 2px 8px rgba(29,31,36,0.06)',
  shadowLg: '0 16px 48px rgba(29,31,36,0.26)',
  glow: '0 4px 14px rgba(74,125,240,0.30)',
  chevronDoneText: '#ffffff',
  panel: '#ffffff',
  btnRadius: '8px',
};

const DP_DARK: typeof DARK = {
  bg: '#15171e',
  nav: '#1e212b',
  surface: 'rgba(255,255,255,0.05)',
  surface2: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.10)',
  text: '#e7e9f0',
  muted: 'rgba(231,233,240,0.60)',
  faint: 'rgba(231,233,240,0.35)',
  accent: '#7c9bff',
  accent2: '#a78bfa',
  accent3: '#7c9bff',
  accentSoft: 'rgba(124,155,255,0.16)',
  green: '#4bbf73',
  greenBg: 'rgba(75,191,115,0.14)',
  red: '#f0705f',
  redBg: 'rgba(240,112,95,0.14)',
  blue: '#7c9bff',
  blueBg: 'rgba(124,155,255,0.14)',
  amber: '#e0b34c',
  amberBg: 'rgba(224,179,76,0.14)',
  violet: '#a78bfa',
  violetBg: 'rgba(167,139,250,0.14)',
  pink: '#e07aab',
  pinkBg: 'rgba(224,122,171,0.14)',
  slate: '#94a0b8',
  slateBg: 'rgba(148,160,184,0.14)',
  shadow: '0 4px 20px rgba(0,0,0,0.35)',
  shadowLg: '0 32px 80px rgba(0,0,0,0.6)',
  glow: '0 4px 14px rgba(124,155,255,0.30)',
  chevronDoneText: '#ffffff',
  panel: 'rgba(30,33,43,0.97)',
  btnRadius: '8px',
};

// Mutable token object — pages read C at render time; CRMPage swaps it per theme + tenant brand
export const C = { ...DARK };

export type CRMBrand = 'aurora' | 'designpro';

export let GRADIENT = `linear-gradient(135deg, #6366f1 0%, #a855f7 55%, #22d3ee 120%)`;
const AURORA_GRADIENT = `linear-gradient(135deg, #6366f1 0%, #a855f7 55%, #22d3ee 120%)`;
const DP_GRADIENT = `linear-gradient(135deg, #4a7df0 0%, #8b5cf6 100%)`;

export function applyCRMTokens(mode: 'light' | 'dark', brand: CRMBrand = 'aurora') {
  const sets = brand === 'designpro' ? { dark: DP_DARK, light: DP_LIGHT } : { dark: DARK, light: LIGHT };
  Object.assign(C, mode === 'dark' ? sets.dark : sets.light);
  GRADIENT = brand === 'designpro' ? DP_GRADIENT : AURORA_GRADIENT;
}

// ── Formatters ────────────────────────────────────────────────────────────────
export const fmtINR = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const daysUntil = (d?: string | null) => {
  if (!d) return null;
  const dt = new Date(d.slice(0, 10) + 'T00:00:00');
  if (isNaN(dt.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - today.getTime()) / 86400000);
};
export const timeAgo = (d?: string | null) => {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
};

// ── One-time global styles (animations + glass utilities) ─────────────────────
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes crmFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes crmSlideIn { from { transform: translateX(48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes crmPop { 0% { transform: scale(0.92) translateY(6px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
    @keyframes crmConfettiFall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.6; } }
    @keyframes crmAurora1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,-40px) scale(1.15); } }
    @keyframes crmAurora2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-70px,50px) scale(1.1); } }
    @keyframes crmAurora3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,60px) scale(1.2); } }
    @keyframes crmShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    .crm-fade-up { animation: crmFadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both; }
    .crm-pop { animation: crmPop 0.22s cubic-bezier(0.16,1,0.3,1) both; }
    .crm-slide-in { animation: crmSlideIn 0.26s cubic-bezier(0.16,1,0.3,1) both; }
    .crm-hover-lift { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
    .crm-row { transition: background 0.12s ease; }
    .crm-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .crm-scroll::-webkit-scrollbar-track { background: transparent; }
    input.crm-inp:focus, textarea.crm-inp:focus, select.crm-inp:focus { border-color: rgba(99,102,241,0.6) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }

    /* light (default) */
    .crm-hover-lift:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(24,27,39,0.16), 0 0 0 1px rgba(99,102,241,0.30); }
    .crm-row:hover { background: rgba(18,21,38,0.04); }
    .crm-glass { background: rgba(255,255,255,0.72); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(18,21,38,0.10); }
    .crm-grad-text { background: linear-gradient(95deg, #181b27 20%, #4338ca 60%, #7c3aed 90%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .crm-scroll::-webkit-scrollbar-thumb { background: rgba(18,21,38,0.18); border-radius: 8px; }
    select.crm-inp option { background: #ffffff; color: #181b27; }
    input.crm-inp::placeholder, textarea.crm-inp::placeholder { color: rgba(24,27,39,0.32); }

    /* dark */
    html.dark .crm-hover-lift:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.35); }
    html.dark .crm-row:hover { background: rgba(255,255,255,0.04); }
    html.dark .crm-glass { background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.09); }
    html.dark .crm-grad-text { background: linear-gradient(95deg, #fff 20%, #c7d2fe 55%, #a5b4fc 80%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    html.dark .crm-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }
    html.dark select.crm-inp option { background: #141722; color: #eef0f6; }
    html.dark input.crm-inp::placeholder, html.dark textarea.crm-inp::placeholder { color: rgba(238,240,246,0.3); }

    /* [crm] [tenant: FrontStores.com] — "Designpro" brand overrides ("Aria" template:
       mono type, ink headings, royal-blue→violet gradient accents) */
    .crm-dp { font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, 'Cascadia Mono', 'Roboto Mono', Menlo, Consolas, monospace; }
    /* note: the background shorthand resets background-clip, so re-declare clip + fill
       here or the heading characters render transparent (invisible) */
    .crm-dp .crm-grad-text { background: linear-gradient(95deg, #1d1f24 15%, #4a7df0 60%, #8b5cf6 90%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    html.dark .crm-dp .crm-grad-text { background: linear-gradient(95deg, #f1f2f7 15%, #9db4ff 60%, #c4b5fd 90%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .crm-dp .crm-glass { background: #ffffff; border: 1px solid rgba(29,31,36,0.10); backdrop-filter: none; -webkit-backdrop-filter: none; }
    html.dark .crm-dp .crm-glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); }
    .crm-dp .crm-row:hover { background: rgba(74,125,240,0.06); }
    html.dark .crm-dp .crm-row:hover { background: rgba(124,155,255,0.09); }
    .crm-dp .crm-hover-lift:hover { box-shadow: 0 6px 16px rgba(29,31,36,0.12), 0 0 0 1px rgba(74,125,240,0.35); }
    html.dark .crm-dp .crm-hover-lift:hover { box-shadow: 0 14px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,155,255,0.4); }
    .crm-dp input.crm-inp:focus, .crm-dp textarea.crm-inp:focus, .crm-dp select.crm-inp:focus { border-color: #4a7df0 !important; box-shadow: 0 0 0 2px rgba(74,125,240,0.18); }
  `;
  document.head.appendChild(s);
}

/** Call once at the top of each CRM page component. */
export function useCRMStyles() {
  useEffect(() => { injectStyles(); }, []);
}

// ── Aurora background (fixed, behind everything) ─────────────────────────────
export function AuroraBG() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none', background: C.bg }}>
      <div style={{ position: 'absolute', top: '-220px', left: '-160px', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.32), transparent 65%)', filter: 'blur(60px)', animation: 'crmAurora1 16s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-260px', right: '-180px', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.26), transparent 65%)', filter: 'blur(70px)', animation: 'crmAurora2 20s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '35%', left: '45%', width: '520px', height: '520px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.16), transparent 65%)', filter: 'blur(70px)', animation: 'crmAurora3 24s ease-in-out infinite' }} />
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'subtle' | 'success';
export function Btn({ children, onClick, variant = 'primary', small, disabled, style, type }: {
  children: ReactNode; onClick?: () => void; variant?: BtnVariant; small?: boolean;
  disabled?: boolean; style?: CSSProperties; type?: 'button' | 'submit';
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
    padding: small ? '6px 13px' : '9px 19px', borderRadius: C.btnRadius,
    fontSize: small ? '12px' : '13px', fontWeight: 700, fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    border: '1px solid transparent', transition: 'all 0.14s ease', whiteSpace: 'nowrap',
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: GRADIENT, color: '#fff', boxShadow: `${C.glow}, inset 0 1px 0 rgba(255,255,255,0.25)` },
    success: { background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#06281c', boxShadow: '0 6px 20px rgba(52,211,153,0.35), inset 0 1px 0 rgba(255,255,255,0.3)' },
    danger:  { background: C.redBg, color: C.red, border: '1px solid rgba(248,113,113,0.35)' },
    ghost:   { background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    subtle:  { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, backdropFilter: 'blur(12px)' },
  };
  return (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <span style={{ background: bg, color, padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block', border: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </span>
  );
}

// ── Avatar (initials, deterministic neon tint) ────────────────────────────────
// Mid-tone 500-weight colors — readable on both light and dark glass
const AVATAR_COLORS = [
  ['rgba(245,158,11,0.16)', '#f59e0b'], ['rgba(59,130,246,0.16)', '#3b82f6'], ['rgba(16,185,129,0.16)', '#10b981'],
  ['rgba(239,68,68,0.16)', '#ef4444'], ['rgba(139,92,246,0.16)', '#8b5cf6'], ['rgba(6,182,212,0.16)', '#06b6d4'],
  ['rgba(236,72,153,0.16)', '#ec4899'], ['rgba(99,102,241,0.16)', '#6366f1'],
];
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, color] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="crm-fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '22px', gap: '12px', flexWrap: 'wrap' }}>
      <div>
        <h1 className="crm-grad-text" style={{ fontSize: '26px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '13px', color: C.muted, margin: '5px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon, tint, tintBg, sub, onClick }: {
  label: string; value: ReactNode; icon?: ReactNode; tint?: string; tintBg?: string; sub?: ReactNode; onClick?: () => void;
}) {
  return (
    <div className="crm-hover-lift crm-glass" onClick={onClick}
      style={{ borderRadius: '16px', padding: '17px 19px', boxShadow: C.shadow, cursor: onClick ? 'pointer' : 'default', minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      {/* top neon hairline */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: tint ? `linear-gradient(90deg, transparent, ${tint}, transparent)` : GRADIENT, opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '11px' }}>
        {icon && (
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: tintBg ?? C.accentSoft, color: tint ?? C.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: tint ? `0 0 18px ${tint}40` : C.glow, border: `1px solid ${(tint ?? C.accent)}30` }}>
            {icon}
          </div>
        )}
        <div style={{ fontSize: '10.5px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>{label}</div>
      </div>
      <div style={{ fontSize: '25px', fontWeight: 800, color: C.text, letterSpacing: '-0.02em', lineHeight: 1, textShadow: '0 2px 16px rgba(0,0,0,0.4)' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: C.muted, marginTop: '7px' }}>{sub}</div>}
    </div>
  );
}

// ── Segments (pill tabs) ──────────────────────────────────────────────────────
export function Segments({ options, value, onChange }: {
  options: { key: string; label: string; count?: number }[];
  value: string; onChange: (key: string) => void;
}) {
  return (
    <div className="crm-glass" style={{ display: 'inline-flex', borderRadius: '12px', padding: '4px', gap: '2px', boxShadow: C.shadow }}>
      {options.map(o => {
        const active = o.key === value;
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            style={{
              padding: '7px 15px', borderRadius: C.btnRadius === '999px' ? '999px' : '9px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '12px', fontWeight: 700, transition: 'all 0.14s ease',
              background: active ? GRADIENT : 'transparent', color: active ? '#fff' : C.muted,
              boxShadow: active ? C.glow : 'none',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            {o.label}
            {o.count !== undefined && (
              <span style={{ background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)', color: active ? '#fff' : C.muted, borderRadius: '999px', padding: '1px 7px', fontSize: '10px', fontWeight: 800 }}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Search input ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', flex: '0 1 280px' }}>
      <Search size={14} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: C.faint }} />
      <input className="crm-inp" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Search…'}
        style={{ width: '100%', padding: '9px 12px 9px 35px', borderRadius: '11px', border: `1px solid ${C.border}`, background: C.surface, backdropFilter: 'blur(16px)', fontSize: '13px', fontFamily: 'inherit', color: C.text, outline: 'none', boxShadow: C.shadow }} />
    </div>
  );
}

// ── Form fields ───────────────────────────────────────────────────────────────
export const inp = (extra?: CSSProperties): CSSProperties => ({
  width: '100%', padding: '9px 13px', borderRadius: '10px', border: `1px solid ${C.border}`,
  background: 'rgba(255,255,255,0.05)', fontSize: '13px', fontFamily: 'inherit', color: C.text,
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.14s, box-shadow 0.14s', ...extra,
});

export function Field({ label, children, span2 }: { label: string; children: ReactNode; span2?: boolean }) {
  return (
    <div style={span2 ? { gridColumn: 'span 2' } : undefined}>
      <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px' }}>{children}</div>;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, width = 520 }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(5,6,12,0.7)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="crm-pop" onClick={e => e.stopPropagation()}
        style={{ background: C.panel, backdropFilter: 'blur(32px)', border: `1px solid ${C.border}`, borderRadius: '18px', width: '100%', maxWidth: width, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: `${C.shadowLg}, inset 0 1px 0 rgba(255,255,255,0.08)`, overflow: 'hidden' }}>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '17px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: GRADIENT, opacity: 0.8 }} />
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: C.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '9px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted }}>
            <X size={14} />
          </button>
        </div>
        <div className="crm-scroll" style={{ padding: '22px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '15px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: 'rgba(255,255,255,0.03)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Drawer (right slide-over for record details) ─────────────────────────────
export function Drawer({ title, eyebrow, onClose, children, footer, width = 440 }: {
  title: ReactNode; eyebrow?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(5,6,12,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div className="crm-slide-in" onClick={e => e.stopPropagation()}
        style={{ background: C.panel, backdropFilter: 'blur(32px)', borderLeft: `1px solid ${C.border}`, width: '100%', maxWidth: width, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg }}>
        <div style={{ position: 'relative', padding: '19px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: GRADIENT, opacity: 0.8 }} />
          <div>
            {eyebrow && <div style={{ fontSize: '10px', color: C.accent3, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: '4px' }}>{eyebrow}</div>}
            <div className="crm-grad-text" style={{ fontSize: '18px', fontWeight: 800 }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '9px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
        <div className="crm-scroll" style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '15px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', flexShrink: 0, background: 'rgba(255,255,255,0.03)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ emoji, title, hint, action }: { emoji: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="crm-fade-up" style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
      <div style={{ fontSize: '44px', marginBottom: '14px', filter: 'drop-shadow(0 6px 18px rgba(99,102,241,0.35))' }}>{emoji}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '5px' }}>{title}</div>
      {hint && <div style={{ fontSize: '13px', maxWidth: '340px', margin: '0 auto 16px' }}>{hint}</div>}
      {action}
    </div>
  );
}

// ── Panel / table helpers ─────────────────────────────────────────────────────
export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="crm-glass" style={{ borderRadius: '16px', boxShadow: C.shadow, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ padding: '13px 19px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '11px', fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
      {action}
    </div>
  );
}

export const th: CSSProperties = { textAlign: 'left', padding: '11px 17px', fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', whiteSpace: 'nowrap' };
export const td: CSSProperties = { padding: '13px 17px', fontSize: '13px', color: C.text, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' };

// ── Stage chevrons (Salesforce-style progress) ───────────────────────────────
export function StageChevrons({ stages, current, onSelect, doneColor = C.green }: {
  stages: { key: string; label: string }[]; current: string; onSelect?: (key: string) => void; doneColor?: string;
}) {
  const currentIdx = stages.findIndex(s => s.key === current);
  return (
    <div style={{ display: 'flex', width: '100%', height: '34px' }}>
      {stages.map((s, i) => {
        const done = currentIdx >= 0 && i <= currentIdx;
        const isLast = i === stages.length - 1;
        return (
          <div key={s.key} onClick={() => onSelect?.(s.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? `linear-gradient(135deg, ${doneColor}cc, ${doneColor})` : 'rgba(255,255,255,0.07)',
              color: done ? C.chevronDoneText : C.muted,
              fontSize: '11px', fontWeight: 800, cursor: onSelect ? 'pointer' : 'default',
              marginRight: isLast ? 0 : '3px', transition: 'all 0.15s ease',
              boxShadow: done ? `0 0 16px ${doneColor}40` : 'none',
              clipPath: i === 0
                ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                : isLast
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)'
                  : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
            }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {done && <Check size={11} />}
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Confetti (celebration on wins) ───────────────────────────────────────────
const CONFETTI_COLORS = ['#6366f1', '#a855f7', '#22d3ee', '#34d399', '#fbbf24', '#f472b6'];
export function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.1 + Math.random() * 0.9,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 7,
    rotate: Math.random() * 360,
  })), []);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, left: `${p.left}%`, width: p.size, height: p.size * 0.6,
          background: p.color, borderRadius: '2px', transform: `rotate(${p.rotate}deg)`,
          boxShadow: `0 0 8px ${p.color}`,
          animation: `crmConfettiFall ${p.duration}s ease-in ${p.delay}s both`,
        }} />
      ))}
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────
export function CRMPage({ children }: { children: ReactNode }) {
  useCRMStyles();
  // Swap tokens before children render — pages read C at render time
  const { theme } = useTheme();
  const tenantId = useAppStore(s => s.config?.tenant_id ?? '');
  const brand: CRMBrand = tenantId === SF_TENANT_ID ? 'designpro' : 'aurora'; // [crm] [tenant: FrontStores.com]
  applyCRMTokens(theme, brand);
  return (
    <div className={brand === 'designpro' ? 'crm-dp' : undefined}
      style={{ maxWidth: '1280px', margin: '0 auto', padding: '4px 4px 48px', position: 'relative', zIndex: 1 }}>
      {children}
    </div>
  );
}
