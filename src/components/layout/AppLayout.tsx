import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { setAINavigator } from '@/lib/voice/aiNavigator';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Receipt,
  Users,
  Truck,
  BarChart3,
  Settings,
  Store,
  BookOpen,
  Wallet,
  LogOut,
  ClipboardList,
  UtensilsCrossed,
  ChefHat,
  PackagePlus,
  Droplets,
  ClipboardCheck,
  Wrench,
  CreditCard,
  UserCheck,
  ShoppingBasket,
  Stethoscope,
  CalendarDays,
  FlaskConical,
  Pill,
  BedDouble,
  FileText,
  Sparkles,
  HeartHandshake,
  Scissors,
  Brain,
  FlameIcon,
  GraduationCap,
} from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getShopTypeLabel } from '@/lib/shop/shopType';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import { StudyVoiceAssistant } from '@/modules/study/StudyVoiceAssistant';

export const NAV_ITEMS = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard',       iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/pos',             icon: ShoppingCart,    label: 'POS / Billing',   iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/products',        icon: Package,         label: 'Products',        iconBg: '#ffedd5', iconColor: '#ea580c' },
  { to: '/inventory',       icon: Boxes,           label: 'Inventory',       iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/orders',          icon: Receipt,         label: 'Orders',          iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/customers',       icon: Users,           label: 'Customers',       iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/khata',           icon: BookOpen,        label: 'Khata',           iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/expenses',        icon: Wallet,          label: 'Expenses',        iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/suppliers',       icon: Truck,           label: 'Suppliers',       iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/purchase-orders', icon: ClipboardList,   label: 'Purchase Orders', iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/reports',         icon: BarChart3,       label: 'Reports',         iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',        icon: Settings,        label: 'Settings',        iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [grocery] [all tenants]
const GROCERY_NAV_ITEMS = [
  { to: '/grocery/dashboard', icon: LayoutDashboard, label: 'Dashboard',      iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/pos',               icon: ShoppingBasket,  label: 'POS / Billing',  iconBg: '#ffedd5', iconColor: '#ea580c' },
  { to: '/products',          icon: Package,         label: 'Products',       iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/inventory',         icon: Boxes,           label: 'Inventory',      iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/orders',            icon: Receipt,         label: 'Orders',         iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/customers',         icon: Users,           label: 'Customers',      iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/khata',             icon: BookOpen,        label: 'Khata',          iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/expenses',          icon: Wallet,          label: 'Expenses',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/suppliers',          icon: Truck,        label: 'Suppliers',      iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/grocery/purchase',   icon: PackagePlus,  label: 'Purchase Entry', iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/grocery/cash',       icon: Wallet,       label: 'Cash Drawer',    iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/reports',            icon: BarChart3,    label: 'Reports',        iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,     label: 'Settings',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [restaurant] [all tenants]
const RESTAURANT_NAV_ITEMS = [
  { to: '/restaurant/dashboard', icon: LayoutDashboard, label: 'Dashboard',      iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/restaurant/tables',    icon: UtensilsCrossed, label: 'Tables & Orders',iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/restaurant/menu',      icon: BookOpen,        label: 'Menu',           iconBg: '#ffedd5', iconColor: '#ea580c' },
  { to: '/restaurant/kitchen',   icon: ChefHat,         label: 'Kitchen',        iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/restaurant/orders',    icon: Receipt,         label: 'Order History',  iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/restaurant/staff',     icon: UserCheck,       label: 'Staff',          iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/expenses',             icon: Wallet,          label: 'Expenses',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/restaurant/reports',   icon: BarChart3,       label: 'Reports',        iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',             icon: Settings,        label: 'Settings',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [clinic] [all tenants]
const CLINIC_NAV_ITEMS = [
  { to: '/clinic/dashboard',    icon: LayoutDashboard, label: 'OPD Dashboard',   iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/clinic/patients',     icon: Users,           label: 'Patients',        iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/clinic/visits/new',   icon: Stethoscope,     label: 'New Visit',       iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/clinic/appointments', icon: CalendarDays,    label: 'Appointments',    iconBg: '#ffedd5', iconColor: '#ea580c' },
  { to: '/clinic/doctors',      icon: UserCheck,       label: 'Doctors',         iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/clinic/pharmacy',     icon: Pill,            label: 'Pharmacy',        iconBg: '#f0fdf4', iconColor: '#15803d' },
  { to: '/clinic/lab',          icon: FlaskConical,    label: 'Lab',             iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/clinic/ipd',          icon: BedDouble,       label: 'IPD / Beds',      iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/clinic/billing',      icon: FileText,        label: 'Billing',         iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/expenses',            icon: Wallet,          label: 'Expenses',        iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/clinic/reports',      icon: BarChart3,       label: 'Reports',         iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',            icon: Settings,        label: 'Settings',        iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [study] [all tenants]
const STUDY_NAV_ITEMS = [
  { to: '/study/dashboard',  icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/ask',        icon: Brain,           label: 'Ask AI',        iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/mock-tests', icon: ClipboardList,   label: 'Mock Tests',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/flashcards', icon: BookOpen,        label: 'Flashcards',    iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/study/resources',  icon: Boxes,           label: 'My Resources',  iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/study/tracker',    icon: FlameIcon,       label: 'Study Tracker', iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/study/parents',    icon: GraduationCap,   label: 'Parent View',   iconBg: '#f0fdf4', iconColor: '#16a34a' },
  { to: '/study/setup',      icon: Settings,        label: 'Profile',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [beauty] [all tenants]
const BEAUTY_NAV_ITEMS = [
  { to: '/beauty/dashboard',     icon: LayoutDashboard, label: 'Dashboard',      iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/beauty/appointments',  icon: Sparkles,        label: 'Appointments',   iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/beauty/services',      icon: Scissors,        label: 'Services',       iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/beauty/memberships',   icon: HeartHandshake,  label: 'Memberships',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/customers',            icon: Users,           label: 'Customers',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/expenses',             icon: Wallet,          label: 'Expenses',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/beauty/staff',         icon: UserCheck,       label: 'Staff',          iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/beauty/reports',       icon: BarChart3,       label: 'Reports',        iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',             icon: Settings,        label: 'Settings',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [carwash] [all tenants]
const CARWASH_NAV_ITEMS = [
  { to: '/carwash/dashboard', icon: LayoutDashboard, label: 'Dashboard',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/carwash/jobs',      icon: ClipboardCheck,  label: 'Job Cards',      iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/carwash/services',  icon: Droplets,        label: 'Services',       iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/carwash/membership',icon: CreditCard,      label: 'Memberships',    iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/customers',         icon: Users,           label: 'Customers',      iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/expenses',          icon: Wallet,          label: 'Expenses',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/carwash/staff',     icon: Wrench,          label: 'Staff',          iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/carwash/reports',   icon: BarChart3,       label: 'Reports',        iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',          icon: Settings,        label: 'Settings',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

export function AppLayout() {
  const { config, setAuthenticated } = useAppStore();
  const navigate = useNavigate();
  // pick correct nav based on shop type
  const activeNavItems =
    config?.shop_type === 'restaurant' ? RESTAURANT_NAV_ITEMS :
    config?.shop_type === 'grocery'    ? GROCERY_NAV_ITEMS :
    config?.shop_type === 'carwash'    ? CARWASH_NAV_ITEMS :
    config?.shop_type === 'clinic'     ? CLINIC_NAV_ITEMS :
    config?.shop_type === 'beauty'     ? BEAUTY_NAV_ITEMS :
    config?.shop_type === 'study'      ? STUDY_NAV_ITEMS :
    NAV_ITEMS;

  useEffect(() => {
    setAINavigator((path) => navigate(path));
  }, [navigate]);

  // [study] [all tenants] — apply saved theme on mount, remove on shop type change
  useEffect(() => {
    if (config?.shop_type === 'study') {
      import('@/lib/study/studyThemes').then(({ applyStudyThemeById, getSavedThemeId }) => {
        applyStudyThemeById(getSavedThemeId());
      });
      return () => {
        import('@/lib/study/studyThemes').then(({ removeStudyTheme }) => removeStudyTheme());
      };
    }
  }, [config?.shop_type]);

  useEffect(() => {
    if (config?.shop_type === 'medical') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#10b981"/>
        <rect x="13" y="6" width="6" height="20" rx="2" fill="white"/>
        <rect x="6" y="13" width="20" height="6" rx="2" fill="white"/>
      </svg>`;
      const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = url;
      document.title = `➕ FrontStores — Medical Store`;
      return () => { document.title = 'FrontStores'; };
    }
  }, [config?.shop_type]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="hidden lg:flex w-64 flex-col"
        style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--surface-border)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {config?.shop_name || 'FrontStores'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {getShopTypeLabel(config?.shop_type)}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {activeNavItems.map(({ to, icon: Icon, label, iconBg, iconColor }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all ${
                  isActive ? 'text-slate-900' : 'text-slate-500 hover:bg-slate-900 hover:text-white'
                }`
              }
              style={({ isActive }) => isActive
                ? { background: config?.shop_type === 'study' ? 'var(--accent-soft)' : iconBg }
                : {}}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: config?.shop_type === 'study' ? 'var(--accent-soft)' : iconBg }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: config?.shop_type === 'study' ? 'var(--accent)' : iconColor }} />
                  </span>
                  <span style={isActive
                    ? { color: config?.shop_type === 'study' ? 'var(--accent)' : iconColor, fontWeight: 600 }
                    : { color: 'var(--text-secondary)' }}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Owner info */}
        <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {(config?.owner_name ?? 'O')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                {config?.owner_name ?? 'Store Owner'}
              </p>
              <p className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {config?.shop_name ?? 'FrontStores'}
              </p>
            </div>
            <button
              onClick={() => setAuthenticated(false)}
              title="Lock / Sign out"
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'; }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3"
          style={{
            background: 'rgba(245,245,247,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--surface-border)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
              <Store className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{config?.shop_name || 'FrontStores'}</span>
          </div>
        </header>

        {/* Mobile horizontal nav */}
        <div
          className="lg:hidden sticky top-[49px] z-10 flex gap-1.5 overflow-x-auto px-4 py-2.5"
          style={{
            background: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--surface-border)',
          }}
        >
          {activeNavItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive ? 'text-white' : 'text-slate-600 bg-white/70 border border-black/[0.06]'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'var(--accent)' } : {}}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Voice assistants — shop apps get VoiceAssistant, StudyMate gets StudyVoiceAssistant */}
      {config?.shop_type !== 'study' && <VoiceAssistant />}
      {config?.shop_type === 'study'  && <StudyVoiceAssistant />}
    </div>
  );
}
