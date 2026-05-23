import { enqueue } from './syncQueue';

const APP_VERSION = '1.0.0';

let cachedTenantId = '';
export function setReporterTenantId(id: string) { cachedTenantId = id; }

let lastError = '';
let lastErrorTime = 0;

export function reportError(message: string, stack?: string, context?: string) {
  if (!cachedTenantId) return;
  // Deduplicate within 10 seconds
  const key = message + context;
  if (key === lastError && Date.now() - lastErrorTime < 10000) return;
  lastError = key;
  lastErrorTime = Date.now();

  // Queue locally first — will sync when online
  enqueue('error', cachedTenantId, {
    tenant_id: cachedTenantId,
    message,
    stack: stack || '',
    context: context || '',
    app_version: APP_VERSION,
  }).catch(() => {});
}
