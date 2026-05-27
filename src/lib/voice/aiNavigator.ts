// [all apps] [all tenants] — Global navigate ref so AI tools can change pages
let _navigate: ((path: string) => void) | null = null;

export function setAINavigator(fn: (path: string) => void) {
  _navigate = fn;
}

export function aiNavigate(path: string) {
  _navigate?.(path);
}
