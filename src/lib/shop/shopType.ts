import { useAppStore } from '@/app/store/app.store';

export type ShopType = 'medical' | 'restaurant';

const SHOP_TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Store',
  restaurant: 'Restaurant',
};

export function isMedicalShopType(shopType?: string | null): boolean {
  return shopType === 'medical';
}

export function getShopTypeLabel(shopType?: string | null): string {
  if (!shopType) return 'Store';
  return SHOP_TYPE_LABELS[shopType] ?? 'Store';
}

export function useActiveShop() {
  return useAppStore((s) => s.config);
}

export function useActiveShopType() {
  return useAppStore((s) => s.config?.shop_type ?? null);
}
