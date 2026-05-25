import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import App from './App';
import './index.css';
import { reportError } from './lib/errorReporter';
import { flushQueue } from './lib/syncQueue';

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
      staleTime: 1000 * 60 * 5,  // 5 minutes
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
