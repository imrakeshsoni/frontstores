import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { SwitchAppModal } from '@/modules/switch/SwitchAppModal';
import { useTheme } from '@/lib/theme/useTheme';
import {
  Car,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Receipt,
  Users,
  Truck,
  BarChart3,
  Settings,
  Settings2,
  Store,
  BookOpen,
  Wallet,
  LogOut,
  ChevronUp,
  Radio,
  ClipboardList,
  UtensilsCrossed,
  ChefHat,
  PackagePlus,
  Droplets,
  ClipboardCheck,
  Wrench,
  UserCheck,
  Megaphone,
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
  Calendar,
  Timer,
  CheckSquare,
  Target,
  BookMarked,
  Trophy,
  Network,
  FileArchive,
  ListChecks,
  Map,
  Ruler,
  Calculator,
  HardDrive,
  PenLine,
  HelpCircle,
  TrendingUp,
  CircleDot,
  ClipboardList as ClipboardListIcon,
  BookA,
  Video,
  Layers,
  Moon,
  Gift,
  Edit3,
  Gamepad2,
  Sigma,
  Dumbbell,
  RefreshCw,
  LogIn,
  Gem,
  Star,
  ArrowLeftRight,
  ShirtIcon,
  Bug,
  UserMinus,
  Eye,
  EyeOff,
  Zap,
  MessageSquare,
  DollarSign,
  UserCog,
  Grip,
  Home,
  ChevronDown,
  Building2,
  Headphones,
  Cloud,
  CloudOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { verifyAuth } from '@/lib/db/auth';
import { getShopTypeLabel } from '@/lib/shop/shopType';
import { AnnouncementPopup } from '@/components/announcements/AnnouncementPopup';
import { pollAnnouncements, getUnreadCount } from '@/lib/db/announcements';
import { setAnnouncementNewHandler, setSyncStateHandler, removeSyncStateHandler, getSyncState, type SyncState } from '@/lib/autoSync';
import { MobileNav } from './MobileNav';

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

// [admin] [all tenants] — FrontStores owner admin panel
export const ADMIN_NAV_ITEMS = [
  { to: '/admin', icon: LayoutDashboard, label: 'Admin Panel', iconBg: '#1c1917', iconColor: '#d97706' },
];

// [medical] [all tenants]
export const MEDICAL_NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/pos',        icon: ShoppingCart,    label: 'POS / Billing', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/products',   icon: Package,         label: 'Products',      iconBg: '#ffedd5', iconColor: '#ea580c' },
  { to: '/inventory',  icon: Boxes,           label: 'Inventory',     iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/orders',     icon: Receipt,         label: 'Orders',        iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/customers',  icon: Users,           label: 'Customers',     iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/suppliers',  icon: Truck,           label: 'Suppliers',     iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/reports',    icon: BarChart3,       label: 'Reports',       iconBg: '#e0f2fe', iconColor: '#0284c7' },
];

// [grocery] [all tenants]

// [restaurant] [all tenants]
export const RESTAURANT_NAV_ITEMS = [
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

// [coaching] [all tenants]

// [gym] [all tenants]

// [jewellery] [all tenants]

// [repair] [all tenants]

// [drivingschool] [all tenants]

// [hotel] [all tenants]

// [clothing] [all tenants]

// [bakery] [all tenants]

// [optician] [all tenants]

// [tailor] [all tenants]

// [hardware] [all tenants]
export const HARDWARE_NAV_ITEMS = [
  { to: '/hardware/dashboard', icon: LayoutDashboard, label: 'Dashboard',    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/hardware/pos',       icon: ShoppingCart,    label: 'Billing',      iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/hardware/products',  icon: Package,         label: 'Products',     iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/hardware/inventory', icon: Boxes,           label: 'Inventory',    iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/hardware/credit',    icon: BookOpen,        label: 'Udhar Khata',  iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/hardware/quotations', icon: FileText,       label: 'Quotations',   iconBg: '#e0e7ff', iconColor: '#4f46e5' },
  { to: '/hardware/broadcast', icon: Radio,           label: 'Broadcast',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/hardware/staff',       icon: UserCheck,       label: 'Staff',        iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/hardware/attendance',  icon: ClipboardCheck,  label: 'Attendance',   iconBg: '#ccfbf1', iconColor: '#0d9488' },
  { to: '/hardware/reports',   icon: BarChart3,       label: 'Reports',      iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/hardware/setup',     icon: Settings2,       label: 'Setup',        iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [laundry] [all tenants]

// [catering] [all tenants]

// [pestcontrol] [all tenants]

// [petrolpump] [all tenants]

// [furniture] [all tenants]

// [printing] [all tenants]

// [ca] [all tenants]

// [crm] [all tenants]

// [events] [all tenants]

// [travel] [all tenants]

// [insurance] [all tenants]

// [homeservice] [all tenants]

// [realestate] [all tenants]


// [beauty] [all tenants]

// [carwash] [all tenants] — use CSS vars so icons are amber in dark mode, blue in light mode
export const CARWASH_NAV_ITEMS = [
  { to: '/carwash/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/jobs',          icon: ClipboardCheck,  label: 'Job Cards',     iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/appointments',  icon: Calendar,        label: 'Appointments',  iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/inventory',     icon: Package,         label: 'Inventory',     iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/customers',             icon: Users,           label: 'Customers',     iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/reports',       icon: BarChart3,       label: 'Reports',       iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/broadcast',     icon: Radio,           label: 'Broadcast',     iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/attendance',    icon: UserCheck,       label: 'Attendance',    iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/setup',         icon: Wrench,          label: 'Setup',         iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
];

// [carwash] [all tenants] — employee mode shows only Job Cards + Appointments
export const CARWASH_EMPLOYEE_NAV_ITEMS = [
  { to: '/carwash/jobs',         icon: ClipboardCheck, label: 'Job Cards',    iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/appointments', icon: Calendar,       label: 'Appointments', iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
];

// [tyrescrap] [all tenants]

// [core] [all tenants] — single source of truth for "which nav items does this
// shop type see", shared between the sidebar (AppLayout) and the staff tab-access
// picker (Settings), so the picker always matches what's actually in the sidebar.
export function getNavItemsForShopType(shopType: string | undefined, settings: any, isEmployeeMode = false) {
  return (
    shopType === 'admin'       ? ADMIN_NAV_ITEMS :
    shopType === 'medical'     ? MEDICAL_NAV_ITEMS :
    shopType === 'restaurant'  ? RESTAURANT_NAV_ITEMS :
    shopType === 'carwash'     ? (isEmployeeMode ? CARWASH_EMPLOYEE_NAV_ITEMS : CARWASH_NAV_ITEMS) :
    shopType === 'hardware'      ? HARDWARE_NAV_ITEMS :
    NAV_ITEMS
  );
}

// [core] [all apps] [all tenants] — the union of every top-level tab path that ANY
// app puts in its sidebar. Used to enforce that a tab hidden from a shop type's nav
// is also unreachable by direct URL: a path is only bounced if it's a real tab
// somewhere AND not in the current shop's nav. Sub-pages (e.g. /pharmacy/*, deep
// /carwash/jobs/:id links) never appear here, so they stay reachable.
const ALL_NAV_ARRAYS = [
  NAV_ITEMS, ADMIN_NAV_ITEMS, MEDICAL_NAV_ITEMS, RESTAURANT_NAV_ITEMS, HARDWARE_NAV_ITEMS,
  CARWASH_NAV_ITEMS, CARWASH_EMPLOYEE_NAV_ITEMS,
];
const navTop = (to: string) => '/' + to.split('/')[1];
export const ALL_NAV_TOPS = new Set(ALL_NAV_ARRAYS.flat().map((item) => navTop(item.to)));
// Pinned destinations that are always reachable even when not in a shop's nav array
// (Settings + the bell live in the header/user menu, not the scrollable nav).
const ALWAYS_ALLOWED_TOPS = ['/settings', '/announcements', '/admin'];

export function AppLayout() {
  const { config, setAuthenticated } = useAppStore();
  const navigate = useNavigate();
  const { theme: crmTheme } = useTheme(); // [crm] [all tenants] — Aurora shell light/dark
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  // [crm] [tenant: FrontStores.com] — "More ▾" overflow dropdown in the Salesforce tab bar
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  // [crm] [tenant: FrontStores.com] — App Launcher (9-dot waffle): switch between the
  // Sales and Service apps (more apps can be added here later)
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [sfApp, setSfApp] = useState<'sales' | 'service'>(() => (localStorage.getItem('fs_sf_app') === 'service' ? 'service' : 'sales'));
  // [carwash] [all tenants] — employee mode
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);
  const [showOwnerLogin, setShowOwnerLogin] = useState(false);
  const [ownerLoginUser, setOwnerLoginUser] = useState('');
  const [ownerLoginPass, setOwnerLoginPass] = useState('');
  const [ownerLoginError, setOwnerLoginError] = useState('');
  const [showOwnerPass, setShowOwnerPass] = useState(false);
  // [core] [all tenants] — display name of the logged-in user (owner or staff) in the bottom sidebar row
  const [loggedInDisplayName, setLoggedInDisplayName] = useState<string | null>(null);
  // [core] [all tenants] — Cloud Sync status indicator (synced / syncing / offline / error / disabled)
  const [syncState, setSyncStateLocal] = useState<SyncState>(() => getSyncState());
  useEffect(() => {
    setSyncStateHandler(setSyncStateLocal);
    return () => removeSyncStateHandler(setSyncStateLocal);
  }, []);
  // [core] [all tenants] — null = owner (sees everything); array = staff login,
  // restricted to only the tabs the owner picked for them in Settings
  const [staffTabAccess, setStaffTabAccess] = useState<string[] | null>(null);
  useEffect(() => {
    const tenantId = config?.tenant_id;
    if (!tenantId) { setStaffTabAccess(null); return; }
    const username = sessionStorage.getItem('fs_logged_in_username') || 'owner';
    import('@/lib/db/staffUsers').then(({ getStaffTabAccess }) => {
      getStaffTabAccess(tenantId, username).then(setStaffTabAccess).catch(() => setStaffTabAccess(null));
    });
  }, [config?.tenant_id]);

  function handleLogout() {
    setShowUserMenu(false);
    setAuthenticated(false);
  }
  useEffect(() => {
    const tenantId = config?.tenant_id;
    if (!tenantId) { setLoggedInDisplayName(null); return; }
    const username = sessionStorage.getItem('fs_logged_in_username');
    if (!username || username === 'owner') {
      // [core] [all tenants] — owner_name can be blank (e.g. devices joined via shop
      // code/PIN before owner_name was carried over). Fall back to the login username
      // so the bottom-left always shows who's logged in, never blank.
      if (config?.owner_name) { setLoggedInDisplayName(null); return; }
      import('@/lib/db/auth').then(({ getAuthUsername }) => {
        getAuthUsername(tenantId).then(u => setLoggedInDisplayName(u || null)).catch(() => setLoggedInDisplayName(null));
      });
      return;
    }
    import('@/lib/db/staffUsers').then(({ listStaffUsers }) => {
      listStaffUsers(tenantId).then(staff => {
        const match = staff.find(s => s.username === username && s.status === 'approved');
        setLoggedInDisplayName(match?.display_name || username);
      }).catch(() => setLoggedInDisplayName(username));
    });
  }, [config?.tenant_id, config?.owner_name]);
  // [carwash] [all tenants] — verify against the real app_auth table (same as main login), not placeholder settings fields
  const attemptOwnerLogin = async () => {
    const tenantId = config?.tenant_id ?? '';
    const result = await verifyAuth(tenantId, ownerLoginUser.trim(), ownerLoginPass);
    if (result.ok) {
      setIsEmployeeMode(false);
      setShowOwnerLogin(false);
    } else if (result.locked) {
      setOwnerLoginError('Too many failed attempts. Try again later.');
    } else {
      setOwnerLoginError('Incorrect username or password');
    }
  };
  // pick correct nav based on shop type
  const allNavItems = getNavItemsForShopType(config?.shop_type, config?.settings, isEmployeeMode);
  // [core] [all tenants] — staff logins only see the tabs the owner picked for them
  // (null staffTabAccess = owner / unrestricted). '/settings' is never offered in
  // the picker — staff get "Check for Update" only, via the bottom user menu.
  const activeNavItems = staffTabAccess
    ? allNavItems.filter(item => staffTabAccess.includes(item.to))
    : allNavItems;

  // [core] [all tenants] — sidebar links are filtered above, but the route Outlet
  // below isn't — without this, a restricted staff login could still reach any
  // page directly (typed URL, browser back/forward, saved link). Bounce them to
  // their first allowed tab (or Announcements, always pinned) if the current
  // page isn't one they're allowed to see.
  const location = useLocation();
  useEffect(() => {
    if (staffTabAccess === null) return; // owner — unrestricted
    const currentTop = '/' + location.pathname.split('/')[1];
    const allowedTops = new Set(activeNavItems.map(item => '/' + item.to.split('/')[1]));
    allowedTops.add('/announcements');
    if (!allowedTops.has(currentTop)) {
      navigate(activeNavItems[0]?.to ?? '/announcements', { replace: true });
    }
  }, [location.pathname, staffTabAccess, activeNavItems, navigate]);

  // [core] [all apps] [all tenants] — tabs hidden from a shop type's sidebar must be
  // fully gone, not just hidden: a hidden tab (e.g. Khata/Expenses/Purchase Orders
  // for medical) should bounce to the dashboard even when reached by direct URL. We
  // only bounce paths that are a real tab in SOME app but not in this shop's nav, so
  // legitimate sub-pages (/pharmacy/*, /carwash/jobs/:id, etc.) are never affected.
  useEffect(() => {
    const currentTop = '/' + location.pathname.split('/')[1];
    const allowedTops = new Set(allNavItems.map((item) => '/' + item.to.split('/')[1]));
    ALWAYS_ALLOWED_TOPS.forEach((t) => allowedTops.add(t));
    if (ALL_NAV_TOPS.has(currentTop) && !allowedTops.has(currentTop)) {
      navigate(allNavItems[0]?.to ?? '/dashboard', { replace: true });
    }
  }, [location.pathname, allNavItems, navigate]);

  // [core] [all apps] [all tenants] — silently poll for new announcements (no manual "update" needed)
  const tenantId = config?.tenant_id ?? '';
  const queryClient = useQueryClient();
  const { data: unreadAnnouncements } = useQuery({
    queryKey: ['announcements-unread-count', tenantId],
    queryFn: () => getUnreadCount(tenantId),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (!tenantId) return;
    const poll = () => pollAnnouncements(tenantId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['announcements-unread-count', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['announcements-unnotified', tenantId] });
    });
    // [all apps] [all tenants] — re-poll immediately when server pushes announcement-new via SSE
    setAnnouncementNewHandler(poll);
    poll();
    const id = setInterval(poll, 5 * 60_000);
    return () => { clearInterval(id); setAnnouncementNewHandler(() => {}); };
  }, [tenantId, queryClient]);

  // [crm] [all tenants] — auto-pull WhatsApp bot leads from the server: each
  // tenant runs the bot on their own WhatsApp Business number. A lead appears
  // the moment a customer messages, keeps updating as they answer the bot's
  // questions, and is assigned to the tenant's owner.
  useEffect(() => {
    if (!tenantId || config?.shop_type !== 'crm') return;
    const ownerName = config?.owner_name ?? '';
    const sync = () => {
      import('@/lib/db/crm')
        .then(async ({ syncWaLeadsFromServer, syncWaChatsFromServer }) => {
          const leadsChanged = await syncWaLeadsFromServer(tenantId, ownerName);
          // [crm] [all tenants] — mirror full bot chat transcripts into the CRM
          const chatsChanged = await syncWaChatsFromServer(tenantId).catch(() => false);
          if (leadsChanged) {
            queryClient.invalidateQueries({ queryKey: ['crm-wa-inbox'] });
            queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
          }
          if (chatsChanged) queryClient.invalidateQueries({ queryKey: ['crm-wa-chat'] });
        })
        .catch(() => { /* offline or db busy — next poll retries */ });
    };
    sync();
    const id = setInterval(sync, 30_000);
    return () => clearInterval(id);
  }, [tenantId, config?.shop_type, config?.owner_name, queryClient]);


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
          {/* [core] [all apps] [all tenants] — pinned Announcements link, glows when there's something unread */}
          <NavLink
            to="/announcements"
            className={({ isActive }) => `sidebar-nav-item relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all ${isActive ? 'active' : ''} ${unreadAnnouncements ? 'fs-announcement-glow' : ''}`}
            style={({ isActive }) => ({
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              ['--nav-tint' as any]: '#ede9fe',
              ['--nav-glow' as any]: '#7c3aed4d',
            })}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon-badge relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: '#ede9fe' }}>
                  <Megaphone className="h-3.5 w-3.5" style={{ color: isActive ? 'var(--accent)' : '#7c3aed' }} />
                  {!!unreadAnnouncements && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: '#ef4444' }}>
                      {unreadAnnouncements > 9 ? '9+' : unreadAnnouncements}
                    </span>
                  )}
                </span>
                <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isActive || unreadAnnouncements ? 600 : 500 }}>
                  Announcements
                </span>
              </>
            )}
          </NavLink>
          <style>{`
            @keyframes fs-announcement-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,.35); } 50% { box-shadow: 0 0 0 6px rgba(124,58,237,0); } }
            .fs-announcement-glow { animation: fs-announcement-pulse 1.8s ease-in-out infinite; }
          `}</style>

          {activeNavItems.map(({ to, icon: Icon, label, iconBg, iconColor }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-nav-item flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                ['--nav-tint' as any]: `${iconBg}`,
                ['--nav-glow' as any]: `${iconColor}4d`,
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="nav-icon-badge flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: iconBg }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: isActive ? 'var(--accent)' : iconColor }} />
                  </span>
                  <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 500 }}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Switch App + Owner info — [core] [all tenants] */}
        {/* Owner row — click to open user menu [core] [all tenants] */}
        <div className="px-3 pb-4 pt-3 relative" style={{ borderTop: '1px solid var(--surface-border)' }}>

          {/* User menu popup */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              {/* Menu */}
              <div className="absolute bottom-full left-0 right-0 mb-2 mx-0 rounded-2xl overflow-hidden shadow-xl z-50"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                {/* [carwash] [all tenants] — employee mode: show only "Login as Owner" */}
                {config?.shop_type === 'carwash' && isEmployeeMode ? (
                  <button onClick={() => { setShowUserMenu(false); setOwnerLoginUser(''); setOwnerLoginPass(''); setOwnerLoginError(''); setShowOwnerLogin(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-primary)' }}>
                    <LogIn className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    Login as Owner
                  </button>
                ) : (
                  <>
                    <NavLink to="/settings" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)' }}>
                      <Settings className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      {staffTabAccess !== null ? 'Check for Update' : 'Settings & Updates'}
                    </NavLink>
                    {/* [core] [all apps] [all tenants] — Switch App for everyone (testers AND clients) */}
                    <button onClick={() => { setShowUserMenu(false); setShowSwitchModal(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)' }}>
                      <ArrowLeftRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      Switch App
                    </button>
                    {/* [carwash] [all tenants] — Login as Employee option */}
                    {config?.shop_type === 'carwash' && (
                      <button onClick={() => { setShowUserMenu(false); setIsEmployeeMode(true); navigate('/carwash/jobs'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
                        style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)' }}>
                        <UserMinus className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                        Login as Employee
                      </button>
                    )}
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: '#f87171' }}>
                      <LogOut className="h-4 w-4 flex-shrink-0" />
                      Logout
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* [core] [all tenants] — Cloud Sync status indicator */}
          {syncState.status !== 'disabled' && (
            <div className="flex items-center gap-1.5 px-3 pb-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {syncState.status === 'synced' && <Cloud className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />}
              {syncState.status === 'syncing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {syncState.status === 'offline' && <CloudOff className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />}
              {syncState.status === 'error' && <AlertCircle className="h-3.5 w-3.5" style={{ color: '#ef4444' }} />}
              <span>
                {syncState.status === 'synced' && 'Synced to cloud'}
                {syncState.status === 'syncing' && 'Syncing…'}
                {syncState.status === 'offline' && 'Offline — saved locally'}
                {syncState.status === 'error' && 'Sync error — retrying'}
              </span>
            </div>
          )}

          {/* Clickable owner row */}
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ background: showUserMenu ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: 'var(--accent)', color: 'var(--on-accent, #111)' }}>
              {((loggedInDisplayName ?? config?.owner_name)?.[0] || 'O').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {loggedInDisplayName ?? config?.owner_name ?? 'Store Owner'}
              </p>
              <p className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {config?.shop_name ?? 'FrontStores'}
              </p>
            </div>
            <ChevronUp className="h-4 w-4 flex-shrink-0 transition-transform"
              style={{ color: 'var(--text-tertiary)', transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>
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
          {/* [core] [all apps] [all tenants] — App Switch button on mobile, for everyone */}
          <button
            onClick={() => setShowSwitchModal(true)}
            title="Switch App"
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-colors"
            style={{ color: 'white', background: 'var(--accent)' }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Switch
          </button>
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

      {/* [core] [all tenants] — Mobile bottom nav (shown only on small screens) */}
      <div className="lg:hidden">
        <MobileNav />
      </div>
      {/* [core] [all tenants] — Switch App modal */}
      {showSwitchModal && <SwitchAppModal onClose={() => setShowSwitchModal(false)} />}
      {/* [core] [all apps] [all tenants] — silent announcement popup, shown once per new message */}
      <AnnouncementPopup />

      {/* [carwash] [all tenants] — Owner login modal (used to exit employee mode) */}
      {showOwnerLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent-soft)' }}>
                <LogIn className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Login as Owner</h2>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Enter your credentials to continue</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Username</label>
                <input
                  type="text"
                  value={ownerLoginUser}
                  onChange={e => { setOwnerLoginUser(e.target.value); setOwnerLoginError(''); }}
                  placeholder="Enter username"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('owner-pass-input')?.focus()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
                <div className="relative">
                  <input
                    id="owner-pass-input"
                    type={showOwnerPass ? 'text' : 'password'}
                    value={ownerLoginPass}
                    onChange={e => { setOwnerLoginPass(e.target.value); setOwnerLoginError(''); }}
                    placeholder="Enter password"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 pr-10"
                    style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') attemptOwnerLogin();
                    }}
                  />
                  <button type="button" onClick={() => setShowOwnerPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-tertiary)' }}>
                    {showOwnerPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {ownerLoginError && (
                <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{ownerLoginError}</p>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowOwnerLogin(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={attemptOwnerLogin}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
                style={{ background: 'var(--accent)' }}>
                Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
