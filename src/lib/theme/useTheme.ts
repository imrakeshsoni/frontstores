// [all apps] [all tenants] — shared theme store: one source of truth, every subscriber re-renders on toggle
import { create } from 'zustand';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('theme', theme);
}

const initial: Theme = (localStorage.getItem('theme') as Theme | null) ?? 'dark';

const useThemeStore = create<{ theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void }>((set, get) => ({
  theme: initial,
  setTheme: (t) => { applyTheme(t); set({ theme: t }); },
  toggleTheme: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),
}));

export function useTheme() {
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  return { theme, setTheme, toggleTheme };
}
