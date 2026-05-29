import { useAppStore } from '@/app/store/app.store';

export type ShopType = 'medical' | 'restaurant' | 'grocery' | 'carwash' | 'clinic' | 'beauty' | 'study' | 'coaching' | 'gym' | 'jewellery' | 'realestate' | 'hotel' | 'tailor' | 'hardware' | 'repair' | 'drivingschool' | 'laundry' | 'catering' | 'pestcontrol' | 'clothing' | 'bakery' | 'optician' | 'petrolpump' | 'furniture' | 'printing' | 'ca' | 'events' | 'travel' | 'insurance' | 'homeservice';

const SHOP_TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Store / Pharmacy', // [medical] [all tenants]
  restaurant: 'Restaurant',
  grocery: 'Grocery Store',
  carwash: 'Car Wash',
  clinic: 'Hospital / Clinic',
  beauty: 'Beauty Parlor',
  study: 'StudyMate',
  coaching: 'Coaching Institute',
  gym: 'Gym / Fitness',
  jewellery: 'Jewellery Shop',
  realestate: 'Real Estate / PropMate',
  hotel: 'Hotel / Lodge', // [hotel] [all tenants]
  repair: 'Mobile / Electronics Repair',
  drivingschool: 'Driving School',
  tailor: 'Tailor / Boutique',
  hardware: 'Hardware Store',
  laundry: 'Laundry / Dry Clean',
  catering: 'Catering Business',
  pestcontrol: 'Pest Control',
  clothing: 'Clothing / Footwear Store',
  bakery: 'Bakery / Sweets Shop',
  optician: 'Optician / Eye Care',
  petrolpump: 'Petrol Pump',
  furniture: 'Furniture Store',
  printing: 'Printing / Stationery',
  ca: 'CA / Tax Consultant',
  events: 'Event Planner',
  travel: 'Travel Agency',
  insurance: 'Insurance Agent',
  homeservice: 'Home Service / Electrician',
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
    type: 'grocery',
    label: 'Grocery Store',
    icon: '🛒',
    description: 'POS, stock management, suppliers',
    color: '#16a34a',
    bgColor: '#dcfce7',
    dashboardRoute: '/grocery/dashboard',
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
  {
    type: 'clinic',
    label: 'Hospital / Clinic',
    icon: '🏥',
    description: 'Patients, appointments, lab, billing',
    color: '#0891b2',
    bgColor: '#cffafe',
    dashboardRoute: '/clinic/dashboard',
  },
  {
    type: 'beauty',
    label: 'Beauty Parlor / Salon',
    icon: '💅',
    description: 'Appointments, staff, memberships',
    color: '#db2777',
    bgColor: '#fce7f3',
    dashboardRoute: '/beauty/dashboard',
  },
  {
    type: 'study',
    label: 'StudyMate',
    icon: '📚',
    description: 'AI study tools for school & college students',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    dashboardRoute: '/study/dashboard',
  },
  {
    type: 'coaching',
    label: 'Coaching Institute',
    icon: '🎓',
    description: 'Students, batches, attendance, fees, exams',
    color: '#2563eb',
    bgColor: '#dbeafe',
    dashboardRoute: '/coaching/dashboard',
  },
  {
    type: 'gym',
    label: 'Gym / Fitness Center',
    icon: '💪',
    description: 'Members, memberships, check-in, renewals, PT',
    color: '#16a34a',
    bgColor: '#dcfce7',
    dashboardRoute: '/gym/dashboard',
  },
  {
    type: 'jewellery',
    label: 'Jewellery Shop',
    icon: '💍',
    description: 'Gold rates, inventory, billing, custom orders, repair',
    color: '#d97706',
    bgColor: '#fef3c7',
    dashboardRoute: '/jewellery/dashboard',
  },
  {
    type: 'realestate',
    label: 'Real Estate / PropMate',
    icon: '🏠',
    description: 'Leads, deals, commissions, site visits, builder projects',
    color: '#15803d',
    bgColor: '#dcfce7',
    dashboardRoute: '/realestate/dashboard',
  },
  {
    type: 'hotel',
    label: 'Hotel / Lodge',
    icon: '🏨',
    description: 'Room bookings, check-in/out, billing, housekeeping',
    color: '#2563eb',
    bgColor: '#dbeafe',
    dashboardRoute: '/hotel/dashboard',
  }, // [hotel] [all tenants]
  {
    type: 'repair',
    label: 'Mobile/Electronics Repair',
    icon: '🔧',
    description: 'Repair jobs, parts inventory, technicians, warranty tracking',
    color: '#dc2626',
    bgColor: '#fee2e2',
    dashboardRoute: '/repair/dashboard',
  }, // [repair] [all tenants]
  {
    type: 'drivingschool',
    label: 'Driving School',
    icon: '🚗',
    description: 'Students, sessions, vehicles, instructors, LL/DL test tracking',
    color: '#2563eb',
    bgColor: '#dbeafe',
    dashboardRoute: '/drivingschool/dashboard',
  }, // [drivingschool] [all tenants]
  { type: 'tailor',      label: 'Tailor / Boutique',           icon: '🧵', description: 'Orders, measurements, delivery tracking', color: '#7c3aed', bgColor: '#ede9fe', dashboardRoute: '/tailor/dashboard' },
  { type: 'hardware',    label: 'Hardware Store',               icon: '🔧', description: 'Billing, stock, credit accounts (udhar khata)', color: '#d97706', bgColor: '#fef3c7', dashboardRoute: '/hardware/dashboard' },
  { type: 'laundry',     label: 'Laundry / Dry Clean',          icon: '👕', description: 'Order tracking, price list, delivery management', color: '#0891b2', bgColor: '#cffafe', dashboardRoute: '/laundry/dashboard' },
  { type: 'catering',    label: 'Catering Business',            icon: '🍱', description: 'Events, menu, guest count, staff assignments', color: '#dc2626', bgColor: '#fee2e2', dashboardRoute: '/catering/dashboard' },
  { type: 'pestcontrol', label: 'Pest Control',                 icon: '🐛', description: 'Job cards, AMC contracts, chemical stock', color: '#16a34a', bgColor: '#dcfce7', dashboardRoute: '/pestcontrol/dashboard' },
  { type: 'clothing',    label: 'Clothing / Footwear Store',    icon: '👗', description: 'Size+color variants, POS, exchange tracking', color: '#db2777', bgColor: '#fce7f3', dashboardRoute: '/clothing/dashboard' },
  { type: 'bakery',      label: 'Bakery / Sweets Shop',         icon: '🎂', description: 'Production log, expiry alerts, bulk orders', color: '#d97706', bgColor: '#fef3c7', dashboardRoute: '/bakery/dashboard' },
  { type: 'optician',    label: 'Optician / Eye Care',          icon: '👓', description: 'Prescriptions, lens orders, frame inventory', color: '#0891b2', bgColor: '#cffafe', dashboardRoute: '/optician/dashboard' },
  { type: 'petrolpump',  label: 'Petrol Pump',                  icon: '⛽', description: 'Shift management, fuel rates, fleet credit accounts', color: '#d97706', bgColor: '#fef3c7', dashboardRoute: '/petrolpump/dashboard' },
  { type: 'furniture',   label: 'Furniture Store',              icon: '🪑', description: 'Regular + custom orders, delivery, carpenter tracking', color: '#92400e', bgColor: '#fef3c7', dashboardRoute: '/furniture/dashboard' },
  { type: 'printing',    label: 'Printing / Stationery',        icon: '🖨️', description: 'Print jobs, stationery counter billing', color: '#2563eb', bgColor: '#dbeafe', dashboardRoute: '/printing/dashboard' },
  { type: 'ca',          label: 'CA / Tax Consultant',          icon: '📊', description: 'Clients, ITR/GST tasks, documents, invoices', color: '#2563eb', bgColor: '#dbeafe', dashboardRoute: '/ca/dashboard' },
  { type: 'events',      label: 'Event Planner',                icon: '🎪', description: 'Events, vendors, task checklists, expenses', color: '#db2777', bgColor: '#fce7f3', dashboardRoute: '/events/dashboard' },
  { type: 'travel',      label: 'Travel Agency',                icon: '✈️', description: 'Trip bookings, itinerary, visa tracking', color: '#0891b2', bgColor: '#cffafe', dashboardRoute: '/travel/dashboard' },
  { type: 'insurance',   label: 'Insurance Agent',              icon: '🛡️', description: 'Policies, renewals, claims, commission tracking', color: '#16a34a', bgColor: '#dcfce7', dashboardRoute: '/insurance/dashboard' },
  { type: 'homeservice', label: 'Home Service / Electrician',   icon: '🔌', description: 'Job cards, technicians, materials, AMC contracts', color: '#d97706', bgColor: '#fef3c7', dashboardRoute: '/homeservice/dashboard' },
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
