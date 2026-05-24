import { enqueue } from './syncQueue';

const APP_VERSION = '1.0.0';

// Accept a getter instead of caching a value — always reads the live tenant_id
// from wherever the caller holds it, so stale values can never be used.
let getTenantId: (() => string) | null = null;
export function setReporterTenantId(getter: (() => string) | string) {
  getTenantId = typeof getter === 'function' ? getter : () => getter;
}

let lastError = '';
let lastErrorTime = 0;

export function reportError(message: string, stack?: string, context?: string) {
  const tenantId = getTenantId?.();
  if (!tenantId) return;
  // Deduplicate within 10 seconds
  const key = message + context;
  if (key === lastError && Date.now() - lastErrorTime < 10000) return;
  lastError = key;
  lastErrorTime = Date.now();

  enqueue('error', tenantId, {
    tenant_id: tenantId,
    message,
    stack: stack || '',
    context: context || '',
    app_version: APP_VERSION,
  }).catch(() => {});
}
