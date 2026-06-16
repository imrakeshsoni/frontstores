import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import App from './App';
import './index.css';
import { reportError } from './lib/errorReporter';
import { flushQueue } from './lib/syncQueue';

// Check for updates silently on startup — only notify if this release affects the user's app.
// Release notes contain app tags like [medical] [all apps] — user only gets update if their
// shop type is tagged, or if [all apps] / [all tenants] / [core] is present. [core] [all tenants]
async function checkForUpdate() {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return;

    // Read current shop type from Zustand store
    const { useAppStore } = await import('./app/store/app.store');
    const shopType = useAppStore.getState().config?.shop_type ?? '';

    // Parse release notes for app tags
    const notes = (update.body ?? '').toLowerCase();
    const isAllApps = notes.includes('[all apps]') || notes.includes('[all tenants]') || notes.includes('[core]');
    const isThisApp = shopType && notes.includes(`[${shopType}]`);

    if (!isAllApps && !isThisApp) return; // This release doesn't affect this user's app

    // Keep a handle for the manual "Install" button in Settings (fallback if the
    // silent install below fails, e.g. the internet drops mid-download).
    (window as any).__pendingUpdate = update;

    // [core] [all apps] [all tenants] — silent auto-update: download + install in the
    // background so the shopkeeper never has to click anything. We do NOT call relaunch()
    // ourselves, so the running session is not torn down by us — the new version applies
    // the next time they open the app. (macOS stages it for next launch; Windows applies
    // it via the installer.) The manual Settings button still works for an instant update.
    try {
      await update.downloadAndInstall();
      (window as any).__updateReady = true; // Settings can show "Update installed — restart to apply"
    } catch {
      // Offline or interrupted — leave __pendingUpdate so the manual button can retry.
    }
  } catch {
    // Non-fatal — ignore silently
  }
}
// Wait until the app has settled (and the shopkeeper is unlikely to be mid-bill at the
// very first seconds after launch) before doing any background update work.
setTimeout(checkForUpdate, 8000);

// Flush queued sync items on start and whenever internet comes back
flushQueue();
window.addEventListener('online', () => flushQueue());
// Also retry every 5 minutes while app is open
setInterval(() => flushQueue(), 5 * 60 * 1000);

// Global error capture — sends unhandled errors to admin server
window.onerror = (message, _source, _line, _col, error) => {
  reportError(String(message), error?.stack, 'window.onerror');
};
window.onunhandledrejection = (event) => {
  reportError(String(event.reason?.message || event.reason), event.reason?.stack, 'unhandledrejection');
};

// Apply saved theme before first render to avoid flash — default is dark
const savedTheme = localStorage.getItem('theme') ?? 'dark';
if (savedTheme !== 'light') document.documentElement.classList.add('dark');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,              // data is always considered stale
      gcTime: 1000 * 60 * 5,    // keep cache 5 min so navigating back is instant
      refetchOnMount: true,      // refetch every time a page mounts / user navigates to it
      refetchOnWindowFocus: true, // refetch when user clicks back into the app
      refetchOnReconnect: true,  // refetch when internet comes back
      refetchInterval: 30_000,   // background auto-refresh every 30 seconds on any open page
      retry: 1,
    },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
