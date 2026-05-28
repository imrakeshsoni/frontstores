// [study] [all tenants] — 50 unique StudyMate themes, instant apply via CSS vars

export interface StudyTheme {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  surface: string;
  surface2: string;
  accent: string;
  category: string;
}

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Derive a readable text color on a given surface
function textOn(bg: string): string {
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#111827' : '#ffffff';
}

// Slightly darken a hex color for hover states
function darken(hex: string, pct = 15): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * pct / 100));
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * pct / 100));
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * pct / 100));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Raw theme definitions: [id, name, emoji, bg, surface, surface2, accent, category]
const RAW: [string, string, string, string, string, string, string, string][] = [
  // 🌊 Ocean & Sky
  ['sky-blue',        'Sky Blue',         '🌤️',  '#0c1e35', '#183356', '#1f4068', '#7dd3fc', 'Ocean & Sky'],
  ['deep-ocean',      'Deep Ocean',       '🌊',  '#071428', '#0f2040', '#163050', '#22d3ee', 'Ocean & Sky'],
  ['midnight-blue',   'Midnight Blue',    '🌙',  '#0d1b2a', '#162a3d', '#1e3852', '#60a5fa', 'Ocean & Sky'],
  ['arctic',          'Arctic',           '🧊',  '#0a1c30', '#133048', '#1a3e5e', '#bae6fd', 'Ocean & Sky'],
  ['cobalt',          'Cobalt',           '💎',  '#0a1628', '#132238', '#1a2e4a', '#3b82f6', 'Ocean & Sky'],
  ['pacific',         'Pacific',          '🐬',  '#082030', '#102e40', '#183c50', '#06b6d4', 'Ocean & Sky'],
  ['storm',           'Storm',            '⛈️',  '#111827', '#1f2d3d', '#273a4d', '#818cf8', 'Ocean & Sky'],
  ['lagoon',          'Lagoon',           '🏝️',  '#0a2030', '#123040', '#1a3e50', '#2dd4bf', 'Ocean & Sky'],
  ['sapphire',        'Sapphire',         '💠',  '#0e1a2e', '#192840', '#213654', '#38bdf8', 'Ocean & Sky'],
  ['northern-lights', 'Northern Lights',  '🌌',  '#061515', '#0e2020', '#162c2c', '#5eead4', 'Ocean & Sky'],

  // 🌿 Nature & Green
  ['forest',          'Forest',           '🌲',  '#0f1f17', '#162b1e', '#1d3826', '#34d399', 'Nature & Green'],
  ['jungle',          'Jungle',           '🌴',  '#0d1f12', '#142a18', '#1c3620', '#4ade80', 'Nature & Green'],
  ['mint',            'Mint',             '🍃',  '#0d1f1a', '#142a22', '#1c362a', '#6ee7b7', 'Nature & Green'],
  ['sage',            'Sage',             '🌿',  '#131a15', '#1c251e', '#253026', '#86efac', 'Nature & Green'],
  ['pine',            'Pine',             '🌱',  '#0a1810', '#112216', '#18301e', '#22c55e', 'Nature & Green'],
  ['emerald',         'Emerald',          '🪴',  '#0c1e14', '#142a1c', '#1c3826', '#10b981', 'Nature & Green'],
  ['moss',            'Moss',             '🍀',  '#141a0f', '#1e2415', '#283020', '#84cc16', 'Nature & Green'],
  ['olive',           'Olive',            '🫒',  '#171a0d', '#212413', '#2a2e1a', '#a3e635', 'Nature & Green'],

  // 🔥 Warm & Sunset
  ['amber',           'Amber',            '🍯',  '#1a1200', '#261c00', '#322600', '#fbbf24', 'Warm & Sunset'],
  ['sunset',          'Sunset',           '🌅',  '#1f1005', '#2d1a08', '#3a2410', '#fb923c', 'Warm & Sunset'],
  ['saffron',         'Saffron',          '🌸',  '#1a1000', '#261800', '#322200', '#f59e0b', 'Warm & Sunset'],
  ['gold',            'Gold',             '✨',  '#181400', '#241e00', '#302800', '#eab308', 'Warm & Sunset'],
  ['peach',           'Peach',            '🍑',  '#1f1208', '#2d1c10', '#3a2618', '#fdba74', 'Warm & Sunset'],
  ['coral',           'Coral',            '🪸',  '#1f0d08', '#2d1610', '#3a2018', '#f97316', 'Warm & Sunset'],
  ['bronze',          'Bronze',           '🏆',  '#1a1005', '#26180d', '#322015', '#d97706', 'Warm & Sunset'],
  ['crimson',         'Crimson',          '🔴',  '#1f0808', '#2d1010', '#3a1818', '#f87171', 'Warm & Sunset'],

  // 💜 Purple & Cosmic
  ['galaxy',          'Galaxy',           '🌌',  '#0f0a1f', '#18122e', '#221b3d', '#818cf8', 'Purple & Cosmic'],
  ['cosmic',          'Cosmic',           '🚀',  '#080820', '#101030', '#181840', '#c4b5fd', 'Purple & Cosmic'],
  ['amethyst',        'Amethyst',         '💜',  '#1a0f28', '#261838', '#322248', '#a855f7', 'Purple & Cosmic'],
  ['indigo-night',    'Indigo Night',     '🌠',  '#0f0f28', '#181838', '#222248', '#6366f1', 'Purple & Cosmic'],
  ['violet',          'Violet',           '🔮',  '#180d28', '#231638', '#2e2048', '#7c3aed', 'Purple & Cosmic'],
  ['lavender',        'Lavender',         '🫐',  '#160f2e', '#211840', '#2c2252', '#c084fc', 'Purple & Cosmic'],
  ['cyberpunk',       'Cyberpunk',        '🤖',  '#050012', '#0d0820', '#150e30', '#f0abfc', 'Purple & Cosmic'],
  ['plum',            'Plum',             '🍇',  '#1a0f22', '#261832', '#322242', '#c026d3', 'Purple & Cosmic'],

  // 🌸 Pink & Rose
  ['rose-pink',       'Rose Pink',        '🌹',  '#1f0f18', '#2e1525', '#3a1d30', '#f472b6', 'Pink & Rose'],
  ['cherry',          'Cherry',           '🍒',  '#1a0808', '#261010', '#321818', '#fb7185', 'Pink & Rose'],
  ['flamingo',        'Flamingo',         '🦩',  '#1f0812', '#2d1020', '#3a1a2e', '#fb7185', 'Pink & Rose'],
  ['magenta',         'Magenta',          '🌺',  '#1f0520', '#2d0d2e', '#3a163a', '#e879f9', 'Pink & Rose'],
  ['orchid',          'Orchid',           '🌸',  '#1e0f28', '#2c1836', '#3a2244', '#e879f9', 'Pink & Rose'],
  ['bubblegum',       'Bubblegum',        '🍬',  '#1a0818', '#281228', '#342038', '#f9a8d4', 'Pink & Rose'],

  // ⚫ Dark & Minimal
  ['obsidian',        'Obsidian',         '🖤',  '#0a0a10', '#141420', '#1e1e2c', '#a1a1aa', 'Dark & Minimal'],
  ['slate',           'Slate',            '🪨',  '#111318', '#1e2130', '#262e3e', '#94a3b8', 'Dark & Minimal'],
  ['charcoal',        'Charcoal',         '⚫',  '#111111', '#1c1c1c', '#262626', '#9ca3af', 'Dark & Minimal'],
  ['graphite',        'Graphite',         '🔘',  '#111214', '#1c1e22', '#252830', '#6b7280', 'Dark & Minimal'],
  ['noir',            'Noir',             '🎬',  '#080808', '#141414', '#202020', '#d4d4d8', 'Dark & Minimal'],

  // ✨ Special
  ['neon-green',      'Neon Green',       '💚',  '#050f05', '#0d180d', '#152215', '#4ade80', 'Special'],
  ['electric',        'Electric',         '⚡',  '#050a1f', '#0e162e', '#16203d', '#facc15', 'Special'],
  ['deep-red',        'Deep Red',         '🔥',  '#1a0505', '#260d0d', '#321616', '#fca5a5', 'Special'],
  ['matrix',          'Matrix',           '💻',  '#010f01', '#03180a', '#052212', '#22c55e', 'Special'],
  ['aurora',          'Aurora',           '🌈',  '#0a0f1a', '#121a28', '#1a2538', '#34d399', 'Special'],
];

export const STUDY_THEMES: StudyTheme[] = RAW.map(([id, name, emoji, bg, surface, surface2, accent, category]) => ({
  id, name, emoji, bg, surface, surface2, accent, category,
}));

export const THEME_CATEGORIES = [...new Set(STUDY_THEMES.map(t => t.category))];

const STORAGE_KEY = 'studymate_theme_id';

export function getSavedThemeId(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'sky-blue';
}

export function applyStudyTheme(theme: StudyTheme) {
  const el = document.documentElement;
  el.classList.add('study-theme');

  const accentText = textOn(theme.accent);

  el.style.setProperty('--bg',             theme.bg);
  el.style.setProperty('--surface',        theme.surface);
  el.style.setProperty('--surface-2',      theme.surface2);
  el.style.setProperty('--surface-border', rgba(theme.accent, 0.22));
  el.style.setProperty('--text-primary',   '#ffffff');
  el.style.setProperty('--text-secondary', rgba(theme.accent, 0.85));
  el.style.setProperty('--text-tertiary',  rgba(theme.accent, 0.55));
  el.style.setProperty('--accent',         theme.accent);
  el.style.setProperty('--accent-hover',   darken(theme.accent, 12));
  el.style.setProperty('--accent-soft',    rgba(theme.accent, 0.15));
  el.style.setProperty('--accent-ring',    rgba(theme.accent, 0.32));
  el.style.setProperty('--accent-text',    accentText);

  // Sidebar gradient
  el.style.setProperty('--study-sidebar-from', theme.surface2);
  el.style.setProperty('--study-sidebar-to',   theme.surface);

  // Hover states — ensure visibility on all surfaces
  el.style.setProperty('--hover-bg',       rgba(theme.accent, 0.12));
  el.style.setProperty('--hover-text',     '#ffffff');

  localStorage.setItem(STORAGE_KEY, theme.id);
}

export function applyStudyThemeById(id: string) {
  const theme = STUDY_THEMES.find(t => t.id === id) ?? STUDY_THEMES[0];
  applyStudyTheme(theme);
}

export function removeStudyTheme() {
  document.documentElement.classList.remove('study-theme');
  const el = document.documentElement;
  const vars = ['--bg','--surface','--surface-2','--surface-border','--text-primary',
    '--text-secondary','--text-tertiary','--accent','--accent-hover','--accent-soft',
    '--accent-ring','--accent-text','--study-sidebar-from','--study-sidebar-to',
    '--hover-bg','--hover-text'];
  vars.forEach(v => el.style.removeProperty(v));
}
