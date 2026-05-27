import { useAppStore } from '@/app/store/app.store';

export type ShopType = 'medical' | 'restaurant' | 'grocery' | 'carwash' | 'clinic';

const SHOP_TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Store',
  restaurant: 'Restaurant',
  grocery: 'Grocery Store',
  carwash: 'Car Wash',
  clinic: 'Hospital / Clinic',
};

export function isMedicalShopType(shopType?: string | null): boolean {
  return shopType === 'medical';
}

export function isGroceryShopType(shopType?: string | null): boolean {
  return shopType === 'grocery';
}

export function isRestaurantShopType(shopType?: string | null): boolean {
  return shopType === 'restaurant';
}

export function isCarwashShopType(shopType?: string | null): boolean {
  return shopType === 'carwash';
}

export function isClinicShopType(shopType?: string | null): boolean {
  return shopType === 'clinic';
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
