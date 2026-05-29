import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import App from './App';
import './index.css';
import { reportError } from './lib/errorReporter';
import { flushQueue } from './lib/syncQueue';
import { setAIQueryClient } from './lib/voice/aiQueryInvalidator';

// Check for updates silently on startup — store result for Settings page, no notification
async function checkForUpdate() {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return;
    (window as any).__pendingUpdate = update;
  } catch {
    // Non-fatal — ignore silently
  }
}
setTimeout(checkForUpdate, 4000);

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

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') document.documentElement.classList.add('dark');

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
setAIQueryClient(queryClient);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
