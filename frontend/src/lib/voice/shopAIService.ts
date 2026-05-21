import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/app/store/auth.store';

const DEFAULT_AI_BACKEND = 'http://localhost:3001';
const AI_BACKEND_KEY = 'shopai_backend_url';

export function getAIBackendURL(): string {
  return localStorage.getItem(AI_BACKEND_KEY) || DEFAULT_AI_BACKEND;
}

export function setAIBackendURL(url: string) {
  const clean = url.replace(/\/$/, '');
  localStorage.setItem(AI_BACKEND_KEY, clean);
}

export function resetAIBackendURL() {
  localStorage.removeItem(AI_BACKEND_KEY);
}

export type AIStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface ShopContext {
  shopName: string;
  productCount: number;
  lowStockCount: number;
  todaySales: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AITurn {
  role: 'user' | 'assistant';
  text: string;
}

// ── Auto URL management ───────────────────────────────────────────────────

// Fetch AI backend URL from cloud settings (works on any device)
export async function fetchCloudAIUrl(): Promise<string | null> {
  try {
    const res = await apiClient.get('/api/core/context/settings');
    return (res.data?.data?.shop?.settings?.aiBackendUrl as string) ?? null;
  } catch { return null; }
}

// Save AI backend URL to cloud settings so all devices pick it up automatically
export async function pushCloudAIUrl(url: string): Promise<void> {
  try {
    const settingsRes = await apiClient.get('/api/core/context/settings');
    const tenantName = settingsRes.data?.data?.tenant?.name ?? 'My Store';
    await apiClient.put('/api/core/context/settings', {
      tenantName,
      shopSettings: { aiBackendUrl: url },
    });
    setAIBackendURL(url);
  } catch { /* non-fatal */ }
}

// On the Mac (server machine): detect localhost tunnel URL and auto-push to cloud
export async function autoSyncTunnelUrl(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:3001/api/tunnel-url', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json() as { url: string | null };
    if (!data.url) return null;
    const current = getAIBackendURL();
    if (current !== data.url) {
      await pushCloudAIUrl(data.url);
    }
    return data.url;
  } catch { return null; }
}

// Bootstrap: figure out which AI URL to use, in priority order:
// 1. localhost tunnel (Mac server) — auto-pushes to cloud
// 2. Cloud-stored URL (all other devices)
// 3. localStorage fallback
export async function bootstrapAIUrl(): Promise<string> {
  const tunnel = await autoSyncTunnelUrl();
  if (tunnel) return tunnel;
  const cloud = await fetchCloudAIUrl();
  if (cloud) { setAIBackendURL(cloud); return cloud; }
  return getAIBackendURL();
}

// ── Shop context ──────────────────────────────────────────────────────────

// Fetch lightweight shop context to send with each AI request
export async function fetchShopContext(): Promise<ShopContext> {
  const shopId = useAuthStore.getState().activeShopId;
  try {
    const [productsRes, inventoryRes] = await Promise.all([
      apiClient.get('/api/core/products?perPage=1').catch(() => null),
      apiClient.get(`/api/core/inventory?shopId=${shopId}`).catch(() => null),
    ]);

    const productCount = productsRes?.data?.total ?? 0;
    const inventoryItems: Array<{ reorderLevel?: number; quantity?: number }> = inventoryRes?.data?.data ?? [];
    const lowStockCount = inventoryItems.filter(
      (i) => typeof i.reorderLevel === 'number' && typeof i.quantity === 'number' && i.quantity <= i.reorderLevel
    ).length;

    const shopName = 'Medical Store';
    return { shopName, productCount, lowStockCount, todaySales: 0 };
  } catch {
    return { shopName: 'Medical Store', productCount: 0, lowStockCount: 0, todaySales: 0 };
  }
}

// Execute a tool call returned by the AI against the real ShopOS APIs
export async function executeToolCall(toolCall: ToolCall): Promise<{ name: string; result: unknown }> {
  const shopId = useAuthStore.getState().activeShopId;
  const { name, args } = toolCall;

  try {
    switch (name) {
      case 'search_product': {
        const res = await apiClient.get(`/api/core/products?search=${encodeURIComponent(String(args.query))}&perPage=5`);
        const items = res.data?.data ?? [];
        return { name, result: items.map((p: { id: string; name: string; mrp: number; unit: string }) => ({ id: p.id, name: p.name, mrp: p.mrp, unit: p.unit })) };
      }

      case 'add_stock': {
        await apiClient.post('/api/core/inventory/adjust', {
          shopId,
          productId: args.productId,
          quantity: Number(args.quantity),
          type: 'purchase',
          batchNo: args.batchNo || undefined,
          expiryDate: args.expiryDate || undefined,
        });
        return { name, result: { success: true, message: `Added ${args.quantity} units of ${args.productName}` } };
      }

      case 'create_sale': {
        const items = (args.items as Array<{ productId: string; quantity: number; unitPrice: number; productName: string }>) ?? [];
        const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        await apiClient.post('/api/orders/orders', {
          shopId,
          customerId: args.customerId || undefined,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discount: 0, gstRate: 0 })),
          globalDiscount: 0,
          loyaltyPointsRedeemed: 0,
          payment: { method: args.paymentMode, amount: total },
        });
        return { name, result: { success: true, total, itemCount: items.length } };
      }

      case 'search_customer': {
        const res = await apiClient.get(`/api/core/customers?search=${encodeURIComponent(String(args.query))}&perPage=5`);
        const items = res.data?.data ?? [];
        return { name, result: items.map((c: { id: string; name: string; phone?: string }) => ({ id: c.id, name: c.name, phone: c.phone })) };
      }

      case 'get_low_stock': {
        const res = await apiClient.get(`/api/core/inventory?shopId=${shopId}`);
        const items = (res.data?.data ?? []) as Array<{ productName?: string; quantity: number; reorderLevel?: number }>;
        const low = items.filter((i) => typeof i.reorderLevel === 'number' && i.quantity <= i.reorderLevel);
        return { name, result: low.map((i) => ({ name: i.productName, qty: i.quantity, reorder: i.reorderLevel })) };
      }

      case 'create_product': {
        await apiClient.post('/api/core/products', {
          shopId,
          name: String(args.name),
          unit: String(args.unit || 'strip'),
          mrp: Number(args.mrp || 0),
          sellingPrice: Number(args.mrp || 0),
          gstRate: Number(args.gstRate || 0),
        });
        return { name, result: { success: true, message: `Product ${args.name} created` } };
      }

      case 'web_search': {
        const res = await fetch(`${getAIBackendURL()}/api/web-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query }),
        });
        const data = await res.json() as { result: string };
        return { name, result: data.result };
      }

      case 'get_sales_summary': {
        const period = String(args.period || 'today');
        const now = new Date();
        let from = new Date();
        if (period === 'week') from.setDate(now.getDate() - 7);
        else if (period === 'month') from.setDate(1);
        else from.setHours(0, 0, 0, 0);
        const res = await apiClient.get(`/api/report/sales?shopId=${shopId}&from=${from.toISOString()}&to=${now.toISOString()}`).catch(() => null);
        return { name, result: res?.data ?? { period, message: 'Sales data unavailable' } };
      }

      default:
        return { name, result: { error: 'Unknown tool' } };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, result: { error: msg } };
  }
}

// One turn: send message to USB AI backend, handle tool calls, return final text
export async function sendToShopAI(
  message: string | null,
  sessionId: string,
  shopContext: ShopContext,
  toolResult?: { name: string; result: unknown },
  signal?: AbortSignal
): Promise<string> {
  const body: Record<string, unknown> = { sessionId, shopContext };
  if (message) body.message = message;
  if (toolResult) body.toolResult = toolResult;

  const res = await fetch(`${getAIBackendURL()}/api/shop-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new Error(`AI backend error ${res.status}`);
  const data = await res.json() as { type: string; text?: string; toolCall?: ToolCall; message?: string };

  if (data.type === 'error') throw new Error(data.message ?? 'AI error');

  if (data.type === 'action' && data.toolCall) {
    // Execute the tool then send result back for continuation
    const toolRes = await executeToolCall(data.toolCall);
    return sendToShopAI(null, sessionId, shopContext, toolRes, signal);
  }

  return data.text ?? '';
}

// Call Kokoro TTS and return a playable audio URL
export async function synthesize(text: string, voice = 'heart', signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${getAIBackendURL()}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, speed: 1.0 }),
    signal,
  });
  if (!res.ok) throw new Error('TTS unavailable');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function clearShopSession(sessionId: string) {
  await fetch(`${getAIBackendURL()}/api/shop-ai/${sessionId}`, { method: 'DELETE' }).catch(() => {});
}
