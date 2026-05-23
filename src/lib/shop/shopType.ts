import { useAppStore } from '@/app/store/app.store';

export type ShopType = 'medical' | 'grocery' | 'retail' | 'restaurant' | 'vehicle' | 'roaster';

const SHOP_TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Store',
  grocery: 'Grocery Store',
  retail: 'General Retail',
  restaurant: 'Restaurant',
  vehicle: 'Vehicle Showroom',
  roaster: 'Coffee Roaster',
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
