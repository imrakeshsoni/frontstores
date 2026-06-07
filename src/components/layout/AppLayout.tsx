import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { SwitchAppModal } from '@/modules/switch/SwitchAppModal';
import { setAINavigator } from '@/lib/voice/aiNavigator';
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
} from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { getShopTypeLabel } from '@/lib/shop/shopType';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import { StudyVoiceAssistant } from '@/modules/study/StudyVoiceAssistant';
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
  // [medical] [all tenants] — Pharmacy features
  { to: '/pharmacy/batches',   icon: Boxes,         label: 'Batch Manager',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/pharmacy/rx',        icon: FileText,      label: 'Prescriptions',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/pharmacy/patients',  icon: Users,         label: 'Patient History',   iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/pharmacy/schedule',  icon: ClipboardList, label: 'Schedule Register', iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/pharmacy/returns',   icon: PackagePlus,   label: 'Supplier Returns',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/pharmacy/salt',      icon: FlaskConical,  label: 'Salt Search',       iconBg: '#cffafe', iconColor: '#0891b2' },
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
  { to: '/study/local-ai',     icon: Brain,           label: 'Local AI Setup',iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/study/setup',        icon: Settings,        label: 'Profile',       iconBg: '#f1f5f9', iconColor: '#64748b' },
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

// [repair] [all tenants]
const REPAIR_NAV_ITEMS = [
  { to: '/repair/dashboard', icon: LayoutDashboard, label: 'Dashboard',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/repair/jobs',      icon: ClipboardList,   label: 'Jobs',            iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/repair/jobs/new',  icon: Wrench,          label: 'New Job',         iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/repair/parts',     icon: Package,         label: 'Parts Inventory', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/expenses',         icon: Wallet,          label: 'Expenses',        iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/repair/reports',   icon: BarChart3,       label: 'Reports',         iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',         icon: Settings,        label: 'Settings',        iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [drivingschool] [all tenants]
const DRIVINGSCHOOL_NAV_ITEMS = [
  { to: '/drivingschool/dashboard',   icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/drivingschool/students',    icon: Users,           label: 'Students',    iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/drivingschool/sessions',    icon: CalendarDays,    label: 'Sessions',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/drivingschool/vehicles',    icon: Wrench,          label: 'Vehicles',    iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/drivingschool/instructors', icon: UserCheck,       label: 'Instructors', iconBg: '#d1fae5', iconColor: '#059669' },
  { to: '/expenses',                  icon: Wallet,          label: 'Expenses',    iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/drivingschool/reports',     icon: BarChart3,       label: 'Reports',     iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',                  icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
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

// [clothing] [all tenants]
const CLOTHING_NAV_ITEMS = [
  { to: '/clothing/dashboard', icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/clothing/billing',   icon: ShoppingCart,    label: 'Billing',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/clothing/products',  icon: Package,         label: 'Products',    iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/clothing/exchanges', icon: RefreshCw,       label: 'Exchanges',   iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/clothing/reports',   icon: BarChart3,       label: 'Reports',     iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [bakery] [all tenants]
const BAKERY_NAV_ITEMS = [
  { to: '/bakery/dashboard',   icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/bakery/billing',     icon: ShoppingCart,    label: 'Billing',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/bakery/production',  icon: PackagePlus,     label: 'Production',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/bakery/bulk-orders', icon: CalendarDays,    label: 'Bulk Orders', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/bakery/reports',     icon: BarChart3,       label: 'Reports',     iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [optician] [all tenants]
const OPTICIAN_NAV_ITEMS = [
  { to: '/optician/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/optician/patients',      icon: Users,           label: 'Patients',      iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/optician/prescriptions', icon: FileText,        label: 'Prescriptions', iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/optician/orders',        icon: ClipboardList,   label: 'Orders',        iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/optician/inventory',     icon: Boxes,           label: 'Inventory',     iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/optician/reports',       icon: BarChart3,       label: 'Reports',       iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',               icon: Settings,        label: 'Settings',      iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [tailor] [all tenants]
const TAILOR_NAV_ITEMS = [
  { to: '/tailor/dashboard',    icon: LayoutDashboard, label: 'Dashboard',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/tailor/orders',       icon: ClipboardList,   label: 'Orders',       iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/tailor/orders/new',   icon: Receipt,         label: 'New Order',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/tailor/measurements', icon: Ruler,           label: 'Measurements', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/tailor/reports',      icon: BarChart3,       label: 'Reports',      iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',            icon: Settings,        label: 'Settings',     iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [hardware] [all tenants]
const HARDWARE_NAV_ITEMS = [
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
const LAUNDRY_NAV_ITEMS = [
  { to: '/laundry/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/laundry/orders',     icon: ClipboardList,   label: 'Orders',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/laundry/orders/new', icon: Receipt,         label: 'New Order',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/laundry/services',   icon: Package,         label: 'Price List', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/laundry/reports',    icon: BarChart3,       label: 'Reports',    iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',   iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [catering] [all tenants]
const CATERING_NAV_ITEMS = [
  { to: '/catering/dashboard',  icon: LayoutDashboard, label: 'Dashboard', iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/catering/events',     icon: CalendarDays,    label: 'Events',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/catering/events/new', icon: Receipt,         label: 'New Event', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/catering/menu',       icon: BookOpen,        label: 'Menu',      iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/catering/reports',    icon: BarChart3,       label: 'Reports',   iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',            icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [pestcontrol] [all tenants]
const PESTCONTROL_NAV_ITEMS = [
  { to: '/pestcontrol/dashboard', icon: LayoutDashboard, label: 'Dashboard', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/pestcontrol/jobs',      icon: ClipboardList,   label: 'Jobs',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/pestcontrol/jobs/new',  icon: Receipt,         label: 'New Job',   iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/pestcontrol/customers', icon: Users,           label: 'Customers', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/pestcontrol/contracts', icon: FileText,        label: 'Contracts', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/pestcontrol/reports',   icon: BarChart3,       label: 'Reports',   iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',              icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [petrolpump] [all tenants]
const PETROLPUMP_NAV_ITEMS = [
  { to: '/petrolpump/dashboard', icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/petrolpump/shift',     icon: ClipboardCheck,  label: 'Today\'s Shift',iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/petrolpump/rates',     icon: Receipt,         label: 'Fuel Rates',    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/petrolpump/credit',    icon: BookOpen,        label: 'Credit Accts',  iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/petrolpump/reports',   icon: BarChart3,       label: 'Reports',       iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',             icon: Settings,        label: 'Settings',      iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [furniture] [all tenants]
const FURNITURE_NAV_ITEMS = [
  { to: '/furniture/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#fef3c7', iconColor: '#92400e' },
  { to: '/furniture/orders',        icon: ClipboardList,   label: 'Orders',        iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/furniture/orders/new',    icon: Receipt,         label: 'New Order',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/furniture/custom-orders', icon: Wrench,          label: 'Custom Orders', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/furniture/products',      icon: Package,         label: 'Products',      iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/furniture/reports',       icon: BarChart3,       label: 'Reports',       iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',                icon: Settings,        label: 'Settings',      iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [printing] [all tenants]
const PRINTING_NAV_ITEMS = [
  { to: '/printing/dashboard', icon: LayoutDashboard, label: 'Dashboard',  iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/printing/jobs',      icon: ClipboardList,   label: 'Print Jobs', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/printing/jobs/new',  icon: Receipt,         label: 'New Job',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/printing/stationery',icon: Package,         label: 'Stationery', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/printing/reports',   icon: BarChart3,       label: 'Reports',    iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',   iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [ca] [all tenants]
const CA_NAV_ITEMS = [
  { to: '/ca/dashboard',   icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/ca/clients',     icon: Users,           label: 'Clients',     iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/ca/tasks',       icon: ClipboardList,   label: 'Tasks',       iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/ca/compliance',  icon: CalendarDays,    label: 'Compliance',  iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/ca/documents',   icon: FileText,        label: 'Documents',   iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/ca/invoices',    icon: Receipt,         label: 'Invoices',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/ca/staff',       icon: UserCheck,       label: 'Staff',       iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/ca/reports',     icon: BarChart3,       label: 'Reports',     iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/settings',       icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [events] [all tenants]
const EVENTS_NAV_ITEMS = [
  { to: '/events/dashboard', icon: LayoutDashboard, label: 'Dashboard', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/events/list',      icon: CalendarDays,    label: 'Events',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/events/new',       icon: Receipt,         label: 'New Event', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/events/vendors',   icon: Truck,           label: 'Vendors',   iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/events/reports',   icon: BarChart3,       label: 'Reports',   iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/settings',         icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [travel] [all tenants]
const TRAVEL_NAV_ITEMS = [
  { to: '/travel/dashboard', icon: LayoutDashboard, label: 'Dashboard',    iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/travel/bookings',  icon: ClipboardList,   label: 'Bookings',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/travel/new',       icon: Receipt,         label: 'New Booking',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/travel/visa',      icon: FileText,        label: 'Visa Tracker', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/travel/reports',   icon: BarChart3,       label: 'Reports',      iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/settings',         icon: Settings,        label: 'Settings',     iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [insurance] [all tenants]
const INSURANCE_NAV_ITEMS = [
  { to: '/insurance/dashboard', icon: LayoutDashboard, label: 'Dashboard', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/insurance/clients',   icon: Users,           label: 'Clients',   iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/insurance/policies',  icon: FileText,        label: 'Policies',  iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/insurance/renewals',  icon: CalendarDays,    label: 'Renewals',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/insurance/claims',    icon: ClipboardList,   label: 'Claims',    iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/insurance/reports',   icon: BarChart3,       label: 'Reports',   iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/settings',            icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [homeservice] [all tenants]
const HOMESERVICE_NAV_ITEMS = [
  { to: '/homeservice/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/homeservice/jobs',       icon: ClipboardList,   label: 'Jobs',        iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/homeservice/new-job',    icon: Receipt,         label: 'New Job',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/homeservice/techs',      icon: Users,           label: 'Technicians', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/homeservice/materials',  icon: Boxes,           label: 'Materials',   iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/homeservice/amc',        icon: CalendarDays,    label: 'AMC',         iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/homeservice/reports',    icon: BarChart3,       label: 'Reports',     iconBg: '#f1f5f9', iconColor: '#64748b' },
  { to: '/settings',               icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
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

// [carwash] [all tenants] — use CSS vars so icons are amber in dark mode, blue in light mode
const CARWASH_NAV_ITEMS = [
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
const CARWASH_EMPLOYEE_NAV_ITEMS = [
  { to: '/carwash/jobs',         icon: ClipboardCheck, label: 'Job Cards',    iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
  { to: '/carwash/appointments', icon: Calendar,       label: 'Appointments', iconBg: 'var(--accent-soft)', iconColor: 'var(--accent)' },
];

// [tyrescrap] [all tenants]
const TYRESCRAP_NAV_ITEMS = [
  { to: '/tyrescrap/dashboard', icon: LayoutDashboard, label: 'Dashboard',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/tyrescrap/purchase',  icon: ShoppingCart,    label: 'Purchase',   iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/tyrescrap/sales',     icon: TrendingUp,      label: 'Sales',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/tyrescrap/stock',     icon: Boxes,           label: 'Stock',      iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/tyrescrap/vendors',   icon: Truck,           label: 'Vendors',    iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/tyrescrap/buyers',    icon: Users,           label: 'Buyers',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/tyrescrap/expenses',  icon: Wallet,          label: 'Expenses',   iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/tyrescrap/reports',   icon: BarChart3,       label: 'Reports',    iconBg: '#e0f2fe', iconColor: '#0284c7' },
];

export function AppLayout() {
  const { config, setAuthenticated } = useAppStore();
  const navigate = useNavigate();
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  // [carwash] [all tenants] — employee mode
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);
  const [showOwnerLogin, setShowOwnerLogin] = useState(false);
  const [ownerLoginUser, setOwnerLoginUser] = useState('');
  const [ownerLoginPass, setOwnerLoginPass] = useState('');
  const [ownerLoginError, setOwnerLoginError] = useState('');
  const [showOwnerPass, setShowOwnerPass] = useState(false);
  // pick correct nav based on shop type
  const reRole = (config?.settings as any)?.re_role ?? 'resale';
  const activeNavItems =
    config?.shop_type === 'restaurant'  ? RESTAURANT_NAV_ITEMS :
    config?.shop_type === 'grocery'     ? GROCERY_NAV_ITEMS :
    config?.shop_type === 'carwash'     ? (isEmployeeMode ? CARWASH_EMPLOYEE_NAV_ITEMS : CARWASH_NAV_ITEMS) :
    config?.shop_type === 'clinic'      ? CLINIC_NAV_ITEMS :
    config?.shop_type === 'beauty'      ? BEAUTY_NAV_ITEMS :
    config?.shop_type === 'study'       ? STUDY_NAV_ITEMS :
    config?.shop_type === 'coaching'    ? COACHING_NAV_ITEMS :
    config?.shop_type === 'gym'         ? GYM_NAV_ITEMS :
    config?.shop_type === 'jewellery'   ? JEWELLERY_NAV_ITEMS :
    config?.shop_type === 'realestate'  ? getRealEstateNavItems(reRole) :
    config?.shop_type === 'hotel'        ? HOTEL_NAV_ITEMS : // [hotel] [all tenants]
    config?.shop_type === 'repair'        ? REPAIR_NAV_ITEMS :
    config?.shop_type === 'drivingschool' ? DRIVINGSCHOOL_NAV_ITEMS :
    config?.shop_type === 'clothing'      ? CLOTHING_NAV_ITEMS :
    config?.shop_type === 'bakery'        ? BAKERY_NAV_ITEMS :
    config?.shop_type === 'optician'      ? OPTICIAN_NAV_ITEMS :
    config?.shop_type === 'tailor'        ? TAILOR_NAV_ITEMS :
    config?.shop_type === 'hardware'      ? HARDWARE_NAV_ITEMS :
    config?.shop_type === 'laundry'       ? LAUNDRY_NAV_ITEMS :
    config?.shop_type === 'catering'      ? CATERING_NAV_ITEMS :
    config?.shop_type === 'pestcontrol'   ? PESTCONTROL_NAV_ITEMS :
    config?.shop_type === 'petrolpump'    ? PETROLPUMP_NAV_ITEMS :
    config?.shop_type === 'furniture'     ? FURNITURE_NAV_ITEMS :
    config?.shop_type === 'printing'      ? PRINTING_NAV_ITEMS :
    config?.shop_type === 'ca'            ? CA_NAV_ITEMS :
    config?.shop_type === 'events'        ? EVENTS_NAV_ITEMS :
    config?.shop_type === 'travel'        ? TRAVEL_NAV_ITEMS :
    config?.shop_type === 'insurance'     ? INSURANCE_NAV_ITEMS :
    config?.shop_type === 'homeservice'   ? HOMESERVICE_NAV_ITEMS :
    config?.shop_type === 'tyrescrap'     ? TYRESCRAP_NAV_ITEMS : // [tyrescrap] [all tenants]
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
                    <NavLink to="/sync" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)' }}>
                      <RefreshCw className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      Sync
                    </NavLink>
                    <NavLink to="/settings" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--surface-border)' }}>
                      <Settings className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      Settings &amp; Updates
                    </NavLink>
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
                    <button onClick={() => { setShowUserMenu(false); setAuthenticated(false); }}
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

          {/* Clickable owner row */}
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ background: showUserMenu ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: 'var(--accent)', color: 'var(--on-accent, #111)' }}>
              {(config?.owner_name ?? 'O')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {config?.owner_name ?? 'Store Owner'}
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

      {/* Voice assistants — only StudyMate; removed from other shop apps [carwash] [all tenants] */}
      {config?.shop_type === 'study' && <StudyVoiceAssistant />}
      {/* [core] [all tenants] — Mobile bottom nav (shown only on small screens) */}
      <div className="lg:hidden">
        <MobileNav />
      </div>
      {/* [core] [all tenants] — Switch App modal */}
      {showSwitchModal && <SwitchAppModal onClose={() => setShowSwitchModal(false)} />}

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
                      if (e.key === 'Enter') {
                        const savedUser = (config?.settings as any)?.owner_username || config?.owner_name || '';
                        const savedPass = (config?.settings as any)?.owner_password || '1234';
                        if (ownerLoginUser.trim() === savedUser.trim() && ownerLoginPass === savedPass) {
                          setIsEmployeeMode(false); setShowOwnerLogin(false);
                        } else {
                          setOwnerLoginError('Incorrect username or password');
                        }
                      }
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
              <button onClick={() => {
                const savedUser = (config?.settings as any)?.owner_username || config?.owner_name || '';
                const savedPass = (config?.settings as any)?.owner_password || '1234';
                if (ownerLoginUser.trim() === savedUser.trim() && ownerLoginPass === savedPass) {
                  setIsEmployeeMode(false); setShowOwnerLogin(false);
                } else {
                  setOwnerLoginError('Incorrect username or password');
                }
              }}
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
