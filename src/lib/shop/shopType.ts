import { useAppStore } from '@/app/store/app.store';

export type ShopType = 'medical' | 'restaurant' | 'carwash' | 'hardware' | 'admin';

const SHOP_TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Store / Pharmacy', // [medical] [all tenants]
  restaurant: 'Restaurant',
  carwash: 'Car Wash',
  hardware: 'Hardware Store',
};

// ── APP_REGISTRY ─────────────────────────────────────────────────────────────
// Single source of truth for all apps in FrontStores.
// Adding a new app here = it automatically appears in the Switch App modal.
// [core] [all tenants]
export interface AppRegistryEntry {
  type: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
  dashboardRoute: string;
}

export const APP_REGISTRY: AppRegistryEntry[] = [
  {
    type: 'medical',
    label: 'Medical Store / Pharmacy', // [medical] [all tenants]
    icon: '💊',
    description: 'Billing, inventory, expiry tracking, Khata, batch manager, prescriptions',
    color: '#2563eb',
    bgColor: '#dbeafe',
    dashboardRoute: '/dashboard',
  },
  {
    type: 'restaurant',
    label: 'Restaurant / Café',
    icon: '🍽️',
    description: 'Tables, menu, kitchen orders, staff',
    color: '#dc2626',
    bgColor: '#fee2e2',
    dashboardRoute: '/restaurant/dashboard',
  },
  {
    type: 'carwash',
    label: 'Car Wash / Detailing',
    icon: '🚗',
    description: 'Appointments, services, billing',
    color: '#d97706',
    bgColor: '#fef3c7',
    dashboardRoute: '/carwash/dashboard',
  },
  { type: 'hardware',    label: 'Hardware Store',               icon: '🔧', description: 'Billing, stock, credit accounts (udhar khata)', color: '#d97706', bgColor: '#fef3c7', dashboardRoute: '/hardware/dashboard' },
  // ➕ Add new apps here — they appear automatically in the Switch App modal
];

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

export function isBeautyShopType(shopType?: string | null): boolean {
  return shopType === 'beauty';
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
