// [all apps] [all tenants] — Global query invalidator for AI-driven changes
// Set once in main.tsx, called from aiFlows after every write action.
import type { QueryClient } from '@tanstack/react-query';

let _queryClient: QueryClient | null = null;

export function setAIQueryClient(qc: QueryClient) {
  _queryClient = qc;
}

export type InvalidateScope =
  | 'billing'     // bill created
  | 'product'     // product added / updated
  | 'stock'       // stock adjusted
  | 'khata'       // khata entry added
  | 'expense';    // expense added

export function invalidateAfterAIAction(scope: InvalidateScope) {
  const qc = _queryClient;
  if (!qc) return;

  const keys: string[][] = {
    billing: [
      ['orders'], ['today-orders'], ['sales-summary'], ['recent-orders'],
      ['product-search'], ['inventory'], ['inventory-products'], ['low-stock'],
      ['pos-top-products'], ['daily-closing'],
    ],
    product: [
      ['products'], ['inventory-products'], ['product-search'],
      ['pos-top-products'], ['low-stock'], ['inventory'],
    ],
    stock: [
      ['inventory'], ['inventory-products'], ['low-stock'],
      ['products'], ['product-search'], ['pos-top-products'],
    ],
    khata: [
      ['khata-summary'], ['khata-entries'], ['customers'],
    ],
    expense: [
      ['expenses'], ['expenses-summary'], ['sales-summary'],
    ],
  }[scope];

  keys.forEach(queryKey => qc.invalidateQueries({ queryKey }));
}
