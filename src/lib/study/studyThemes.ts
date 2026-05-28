// [study] [all tenants] — StudyMate themes, diverse colors, instant apply via CSS vars

export interface StudyTheme {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  surface: string;
  surface2: string;
  accent: string;
  dark: boolean;   // false = light theme (white/bright backgrounds)
  category: string;
}

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, pct = 12): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * pct / 100));
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * pct / 100));
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * pct / 100));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Raw: [id, name, emoji, bg, surface, surface2, accent, dark, category]
const RAW: [string,string,string,string,string,string,string,boolean,string][] = [

  // ☀️ Light Themes
  ['white-clean',    'Clean White',    '☀️', '#f8fafc', '#ffffff', '#f1f5f9', '#6366f1', false, 'Light'],
  ['warm-paper',     'Warm Paper',     '📄', '#fdf8f0', '#fffdf8', '#fef3c7', '#d97706', false, 'Light'],
  ['soft-mint',      'Soft Mint',      '🌿', '#f0fdf4', '#ffffff', '#dcfce7', '#16a34a', false, 'Light'],
  ['blush',          'Blush',          '🌸', '#fff0f6', '#ffffff', '#fce7f3', '#db2777', false, 'Light'],
  ['sky-light',      'Sky Light',      '🌤️', '#f0f9ff', '#ffffff', '#e0f2fe', '#0284c7', false, 'Light'],

  // 🌌 Northern Lights — the keeper
  ['northern-lights','Northern Lights','🌌', '#061515', '#0e2020', '#162c2c', '#5eead4', true,  'Night'],

  // 🌃 Night & Dark
  ['midnight-black', 'Midnight Black', '🖤', '#080810', '#101020', '#181830', '#a78bfa', true,  'Night'],
  ['espresso',       'Espresso',       '☕', '#180c00', '#261400', '#342000', '#d97706', true,  'Night'],
  ['galaxy-dark',    'Galaxy Dark',    '🌠', '#060610', '#0e0e22', '#161630', '#c4b5fd', true,  'Night'],
  ['volcanic',       'Volcanic Night', '🌋', '#1e0400', '#2e0800', '#3e1000', '#fca5a5', true,  'Night'],

  // 🔥 Warm & Fire
  ['sunset-orange',  'Sunset Orange',  '🌅', '#1a0900', '#2a1400', '#3a1e00', '#fb923c', true,  'Warm'],
  ['golden-hour',    'Golden Hour',    '🌞', '#1a1100', '#2a1c00', '#382800', '#fcd34d', true,  'Warm'],
  ['crimson',        'Crimson',        '🔴', '#1a0000', '#280000', '#360400', '#f87171', true,  'Warm'],
  ['strawberry',     'Strawberry',     '🍓', '#1a0008', '#2e000e', '#3d0016', '#ff4d6d', true,  'Warm'],
  ['copper',         'Copper',         '🪙', '#1a0e00', '#281800', '#362200', '#fb923c', true,  'Warm'],

  // 🌿 Nature & Earth
  ['forest-deep',    'Deep Forest',    '🌲', '#081a0c', '#0f2614', '#16321c', '#4ade80', true,  'Nature'],
  ['matcha',         'Matcha',         '🍵', '#0e1a08', '#162410', '#1e3018', '#86efac', true,  'Nature'],
  ['olive-earth',    'Olive Earth',    '🫒', '#141a0a', '#1e2612', '#28321a', '#a3e635', true,  'Nature'],
  ['sand-dune',      'Sand Dune',      '🏜️', '#1a140a', '#261e12', '#32281a', '#fde68a', true,  'Nature'],
  ['moss-stone',     'Moss & Stone',   '🪨', '#111510', '#1a2018', '#222c20', '#84cc16', true,  'Nature'],

  // 💜 Bold & Vibrant
  ['deep-plum',      'Deep Plum',      '🍇', '#1a0028', '#280038', '#360048', '#e879f9', true,  'Bold'],
  ['neon-cyan',      'Neon Cyan',      '💡', '#001818', '#002828', '#003838', '#22d3ee', true,  'Bold'],
  ['electric-yellow','Electric',       '⚡', '#1a1800', '#282600', '#363400', '#facc15', true,  'Bold'],
  ['bubblegum',      'Bubblegum',      '🍬', '#200014', '#300020', '#400030', '#f9a8d4', true,  'Bold'],
  ['neon-green',     'Neon Green',     '💚', '#011001', '#031803', '#052405', '#4ade80', true,  'Bold'],

  // 🌸 Soft & Cozy
  ['lavender-night', 'Lavender Night', '💜', '#160f28', '#211840', '#2c2252', '#c084fc', true,  'Soft'],
  ['rose-night',     'Rose Night',     '🌹', '#1f0818', '#2e1025', '#3d1832', '#fda4af', true,  'Soft'],
  ['coral-reef',     'Coral Reef',     '🪸', '#1a0800', '#281200', '#361c00', '#ff7c5c', true,  'Soft'],
  ['cherry-blossom', 'Cherry Blossom', '🌸', '#1f0c18', '#2e1625', '#3d2032', '#fda4af', true,  'Soft'],
  ['peach-fuzz',     'Peach Fuzz',     '🍑', '#1a1008', '#281a10', '#362418', '#fdba74', true,  'Soft'],
];

export const STUDY_THEMES: StudyTheme[] = RAW.map(
  ([id,name,emoji,bg,surface,surface2,accent,dark,category]) =>
    ({ id, name, emoji, bg, surface, surface2, accent, dark, category })
);

export const THEME_CATEGORIES = [...new Set(STUDY_THEMES.map(t => t.category))];

const STORAGE_KEY = 'studymate_theme_id';

export function getSavedThemeId(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'northern-lights';
}

export function applyStudyTheme(theme: StudyTheme) {
  const el = document.documentElement;
  el.classList.add('study-theme');
  if (theme.dark) {
    el.classList.add('study-dark');
    el.classList.remove('study-light');
  } else {
    el.classList.add('study-light');
    el.classList.remove('study-dark');
  }

  const textPrimary   = theme.dark ? '#ffffff' : '#111827';
  const textSecondary = theme.dark ? rgba(theme.accent, 0.85) : '#374151';
  const textTertiary  = theme.dark ? rgba(theme.accent, 0.55) : '#6b7280';
  const accentText    = isLight(theme.accent) ? '#111827' : '#ffffff';
  const hoverBg       = rgba(theme.accent, theme.dark ? 0.14 : 0.10);

  el.style.setProperty('--bg',                theme.bg);
  el.style.setProperty('--surface',           theme.surface);
  el.style.setProperty('--surface-2',         theme.surface2);
  el.style.setProperty('--surface-border',    rgba(theme.accent, 0.22));
  el.style.setProperty('--text-primary',      textPrimary);
  el.style.setProperty('--text-secondary',    textSecondary);
  el.style.setProperty('--text-tertiary',     textTertiary);
  el.style.setProperty('--accent',            theme.accent);
  el.style.setProperty('--accent-hover',      darken(theme.accent));
  el.style.setProperty('--accent-soft',       rgba(theme.accent, 0.15));
  el.style.setProperty('--accent-ring',       rgba(theme.accent, 0.32));
  el.style.setProperty('--accent-text',       accentText);
  el.style.setProperty('--hover-bg',          hoverBg);
  el.style.setProperty('--hover-text',        textPrimary);
  el.style.setProperty('--study-sidebar-from',theme.surface2);
  el.style.setProperty('--study-sidebar-to',  theme.surface);

  localStorage.setItem(STORAGE_KEY, theme.id);
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b)/255 > 0.55;
}

export function applyStudyThemeById(id: string) {
  const theme = STUDY_THEMES.find(t => t.id === id) ?? STUDY_THEMES.find(t => t.id === 'northern-lights')!;
  applyStudyTheme(theme);
}

export function removeStudyTheme() {
  const el = document.documentElement;
  el.classList.remove('study-theme','study-dark','study-light');
  ['--bg','--surface','--surface-2','--surface-border','--text-primary','--text-secondary',
   '--text-tertiary','--accent','--accent-hover','--accent-soft','--accent-ring','--accent-text',
   '--hover-bg','--hover-text','--study-sidebar-from','--study-sidebar-to',
  ].forEach(v => el.style.removeProperty(v));
}
