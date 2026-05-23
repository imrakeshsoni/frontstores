const SERVER = 'https://update.frontstores.com';
const APP_VERSION = '1.0.0';

// Set by app store once config loads
let cachedTenantId = '';
export function setReporterTenantId(id: string) { cachedTenantId = id; }

let lastError = '';
let lastErrorTime = 0;

export function reportError(message: string, stack?: string, context?: string) {
  if (!cachedTenantId) return; // Don't report before setup complete
  // Deduplicate — same error within 10 seconds = skip
  const key = message + context;
  if (key === lastError && Date.now() - lastErrorTime < 10000) return;
  lastError = key;
  lastErrorTime = Date.now();

  fetch(`${SERVER}/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: cachedTenantId, message, stack: stack || '', context: context || '', app_version: APP_VERSION }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
