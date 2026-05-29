import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { SwitchAppModal } from '@/modules/switch/SwitchAppModal';
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
  { to: '/study/dashboard',    icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/ask',          icon: Brain,           label: 'Ask AI',        iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/mock-tests',   icon: ClipboardList,   label: 'Mock Tests',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/flashcards',   icon: BookOpen,        label: 'Flashcards',    iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/study/resources',    icon: Boxes,           label: 'My Resources',  iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/study/tracker',      icon: FlameIcon,       label: 'Study Tracker', iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/study/timetable',    icon: Calendar,        label: 'Timetable',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/pomodoro',     icon: Timer,           label: 'Pomodoro',      iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/study/exams',        icon: GraduationCap,   label: 'Exams',         iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/study/assignments',  icon: CheckSquare,     label: 'Assignments',   iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/goals',        icon: Target,          label: 'Goals',         iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/formulas',     icon: BookMarked,      label: 'Formula Bank',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/badges',       icon: Trophy,          label: 'Achievements',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/study/mindmaps',     icon: Network,         label: 'Mind Maps',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/pyq',          icon: FileArchive,     label: 'PYQ Papers',    iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/study/chapters',     icon: ListChecks,      label: 'Chapters',      iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/revision',     icon: Map,             label: 'Revision Plan', iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/calendar',     icon: CalendarDays,    label: 'Calendar',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/analytics',    icon: BarChart3,       label: 'Analytics',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/converter',    icon: Ruler,           label: 'Unit Converter',iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/calculator',   icon: Calculator,      label: 'Calculator',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/parents',      icon: GraduationCap,   label: 'Parent View',   iconBg: '#f0fdf4', iconColor: '#16a34a' },
  { to: '/study/notes',        icon: FileText,        label: 'Rich Notes',    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/whiteboard',   icon: PenLine,         label: 'Whiteboard',    iconBg: '#f0fdf4', iconColor: '#16a34a' },
  { to: '/study/doubts',       icon: HelpCircle,      label: 'Doubt Bank',    iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/study/results',      icon: TrendingUp,      label: 'Exam Results',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/attendance',   icon: UserCheck,       label: 'Attendance',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/focus',        icon: CircleDot,       label: "Today's Focus", iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/registrations',icon: ClipboardListIcon, label: 'Exam Regs',   iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/vocabulary',   icon: BookA,           label: 'Vocabulary',    iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/study/periodic',     icon: FlaskConical,    label: 'Periodic Table',iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/videos',       icon: Video,           label: 'Video Links',   iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/study/concepts',     icon: Layers,          label: 'Concept Cards', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/study/sleep',        icon: Moon,            label: 'Sleep Tracker', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/wrapped',      icon: Gift,            label: 'Study Wrapped', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/study/writing',      icon: Edit3,           label: 'Writing',       iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/brain-break',  icon: Gamepad2,        label: 'Brain Break',   iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/study/constants',    icon: Sigma,           label: 'Constants',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/backup',       icon: HardDrive,       label: 'Backup',        iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/study/setup',        icon: Settings,        label: 'Profile',       iconBg: '#f1f5f9', iconColor: '#64748b' },
  { to: '/settings',           icon: Settings,        label: 'Settings',      iconBg: '#f1f5f9', iconColor: '#64748b' }, // [study] [all tenants]
];

// [coaching] [all tenants]
const COACHING_NAV_ITEMS = [
  { to: '/coaching/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/coaching/students',   icon: Users,           label: 'Students',    iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/coaching/batches',    icon: BookOpen,        label: 'Batches',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/coaching/attendance', icon: UserCheck,       label: 'Attendance',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/coaching/fees',       icon: Wallet,          label: 'Fees',        iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/coaching/exams',      icon: ClipboardList,   label: 'Exams',       iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/coaching/teachers',   icon: GraduationCap,   label: 'Teachers',    iconBg: '#f0fdf4', iconColor: '#15803d' },
  { to: '/expenses',            icon: Wallet,          label: 'Expenses',    iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/coaching/reports',    icon: BarChart3,       label: 'Reports',     iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',            icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [gym] [all tenants]
const GYM_NAV_ITEMS = [
  { to: '/gym/dashboard', icon: LayoutDashboard, label: 'Dashboard',    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/gym/members',   icon: Users,           label: 'Members',      iconBg: '#fce7f3', iconColor: '#db2477' },
  { to: '/gym/checkin',   icon: LogIn,           label: 'Check In',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/gym/plans',     icon: Star,            label: 'Plans',        iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/gym/renewals',  icon: RefreshCw,       label: 'Renewals',     iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/gym/staff',     icon: UserCheck,       label: 'Staff',        iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/expenses',      icon: Wallet,          label: 'Expenses',     iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/gym/reports',   icon: BarChart3,       label: 'Reports',      iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',      icon: Settings,        label: 'Settings',     iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [jewellery] [all tenants]
const JEWELLERY_NAV_ITEMS = [
  { to: '/jewellery/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/jewellery/gold-rate',      icon: TrendingUp,      label: 'Gold Rate',      iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/jewellery/products',       icon: Gem,             label: 'Inventory',      iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/jewellery/billing',        icon: Receipt,         label: 'Billing',        iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/jewellery/custom-orders',  icon: Star,            label: 'Custom Orders',  iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/jewellery/repairs',        icon: Wrench,          label: 'Repairs',        iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/customers',                icon: Users,           label: 'Customers',      iconBg: '#fce7f3', iconColor: '#db2477' },
  { to: '/khata',                    icon: BookOpen,        label: 'Khata',          iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/expenses',                 icon: Wallet,          label: 'Expenses',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/jewellery/reports',        icon: BarChart3,       label: 'Reports',        iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',                 icon: Settings,        label: 'Settings',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [hotel] [all tenants]
const HOTEL_NAV_ITEMS = [
  { to: '/hotel/dashboard',    icon: LayoutDashboard, label: 'Dashboard',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/hotel/rooms',        icon: BedDouble,       label: 'Rooms',          iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/hotel/bookings',     icon: CalendarDays,    label: 'Bookings',       iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/hotel/checkin',      icon: LogIn,           label: 'Check-In',       iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/hotel/checkout',     icon: LogOut,          label: 'Check-Out',      iconBg: '#ffedd5', iconColor: '#ea580c' },
  { to: '/hotel/guests',       icon: Users,           label: 'Guests',         iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/hotel/housekeeping', icon: Sparkles,        label: 'Housekeeping',   iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/hotel/maintenance',  icon: Wrench,          label: 'Maintenance',    iconBg: '#f1f5f9', iconColor: '#64748b' },
  { to: '/hotel/reports',      icon: BarChart3,       label: 'Reports',        iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/hotel/setup/rooms',  icon: ClipboardList,   label: 'Room Setup',     iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/settings',           icon: Settings,        label: 'Settings',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [realestate] [all tenants]
const REALESTATE_BASE_NAV = [
  { to: '/realestate/dashboard',   icon: LayoutDashboard, label: 'Dashboard',      iconBg: '#dcfce7', iconColor: '#15803d' },
  { to: '/realestate/leads',       icon: Users,           label: 'Leads / CRM',    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/realestate/properties',  icon: Receipt,         label: 'Properties',     iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/realestate/projects',    icon: BookOpen,        label: 'Projects',       iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/realestate/builders',    icon: Truck,           label: 'Builders',       iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/realestate/deals',       icon: ClipboardCheck,  label: 'Deals',          iconBg: '#dcfce7', iconColor: '#15803d' },
  { to: '/realestate/site-visits', icon: CalendarDays,    label: 'Site Visits',    iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/realestate/commissions', icon: Wallet,          label: 'Commissions',    iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/realestate/documents',   icon: FileText,        label: 'Documents',      iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/expenses',               icon: Wallet,          label: 'Expenses',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/realestate/reports',     icon: BarChart3,       label: 'Reports',        iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',               icon: Settings,        label: 'Settings',       iconBg: '#f1f5f9', iconColor: '#64748b' },
];

function getRealEstateNavItems(role: string) {
  // Individual and rental agents don't need builder directory prominently
  if (role === 'individual' || role === 'rental' || role === 'commercial') {
    return REALESTATE_BASE_NAV.filter(i => i.to !== '/realestate/builders');
  }
  // Builder role — replace properties with projects as first item
  if (role === 'builder') {
    return REALESTATE_BASE_NAV.filter(i => i.to !== '/realestate/properties');
  }
  return REALESTATE_BASE_NAV;
}

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
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  // pick correct nav based on shop type
  const reRole = (config?.settings as any)?.re_role ?? 'resale';
  const activeNavItems =
    config?.shop_type === 'restaurant'  ? RESTAURANT_NAV_ITEMS :
    config?.shop_type === 'grocery'     ? GROCERY_NAV_ITEMS :
    config?.shop_type === 'carwash'     ? CARWASH_NAV_ITEMS :
    config?.shop_type === 'clinic'      ? CLINIC_NAV_ITEMS :
    config?.shop_type === 'beauty'      ? BEAUTY_NAV_ITEMS :
    config?.shop_type === 'study'       ? STUDY_NAV_ITEMS :
    config?.shop_type === 'coaching'    ? COACHING_NAV_ITEMS :
    config?.shop_type === 'gym'         ? GYM_NAV_ITEMS :
    config?.shop_type === 'jewellery'   ? JEWELLERY_NAV_ITEMS :
    config?.shop_type === 'realestate'  ? getRealEstateNavItems(reRole) :
    config?.shop_type === 'hotel'       ? HOTEL_NAV_ITEMS : // [hotel] [all tenants]
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

        {/* Switch App + Owner info — [core] [all tenants] */}
        <div className="px-3 pb-4 space-y-2" style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem' }}>
          {/* Switch App button — clearly visible */}
          <button
            onClick={() => setShowSwitchModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <ArrowLeftRight className="h-4 w-4 flex-shrink-0" />
            Switch App
          </button>

          {/* Owner info row */}
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
          {/* [core] [all tenants] — App Switch button on mobile */}
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

      {/* Voice assistants — shop apps get VoiceAssistant, StudyMate gets StudyVoiceAssistant */}
      {config?.shop_type !== 'study' && <VoiceAssistant />}
      {config?.shop_type === 'study'  && <StudyVoiceAssistant />}
      {/* [core] [all tenants] — Switch App modal */}
      {showSwitchModal && <SwitchAppModal onClose={() => setShowSwitchModal(false)} />}
    </div>
  );
}
