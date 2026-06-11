import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { SwitchAppModal } from '@/modules/switch/SwitchAppModal';
import { setAINavigator } from '@/lib/voice/aiNavigator';
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
  Cloud,
  CloudOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/app/store/app.store';
import { verifyAuth } from '@/lib/db/auth';
import { getShopTypeLabel } from '@/lib/shop/shopType';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import { StudyVoiceAssistant } from '@/modules/study/StudyVoiceAssistant';
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
  // [medical] [all tenants] — Pharmacy features
  { to: '/pharmacy/batches',   icon: Boxes,         label: 'Batch Manager',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/pharmacy/rx',        icon: FileText,      label: 'Prescriptions',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/pharmacy/patients',  icon: Users,         label: 'Patient History',   iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/pharmacy/schedule',  icon: ClipboardList, label: 'Schedule Register', iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/pharmacy/returns',   icon: PackagePlus,   label: 'Supplier Returns',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/pharmacy/salt',      icon: FlaskConical,  label: 'Salt Search',       iconBg: '#cffafe', iconColor: '#0891b2' },
];

// [grocery] [all tenants]
export const GROCERY_NAV_ITEMS = [
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
export const CLINIC_NAV_ITEMS = [
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
export const STUDY_NAV_ITEMS = [
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
export const COACHING_NAV_ITEMS = [
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
export const GYM_NAV_ITEMS = [
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
export const JEWELLERY_NAV_ITEMS = [
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
export const REPAIR_NAV_ITEMS = [
  { to: '/repair/dashboard', icon: LayoutDashboard, label: 'Dashboard',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/repair/jobs',      icon: ClipboardList,   label: 'Jobs',            iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/repair/jobs/new',  icon: Wrench,          label: 'New Job',         iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/repair/parts',     icon: Package,         label: 'Parts Inventory', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/expenses',         icon: Wallet,          label: 'Expenses',        iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/repair/reports',   icon: BarChart3,       label: 'Reports',         iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',         icon: Settings,        label: 'Settings',        iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [drivingschool] [all tenants]
export const DRIVINGSCHOOL_NAV_ITEMS = [
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
export const HOTEL_NAV_ITEMS = [
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
export const CLOTHING_NAV_ITEMS = [
  { to: '/clothing/dashboard', icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/clothing/billing',   icon: ShoppingCart,    label: 'Billing',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/clothing/products',  icon: Package,         label: 'Products',    iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/clothing/exchanges', icon: RefreshCw,       label: 'Exchanges',   iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/clothing/reports',   icon: BarChart3,       label: 'Reports',     iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [bakery] [all tenants]
export const BAKERY_NAV_ITEMS = [
  { to: '/bakery/dashboard',   icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/bakery/billing',     icon: ShoppingCart,    label: 'Billing',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/bakery/production',  icon: PackagePlus,     label: 'Production',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/bakery/bulk-orders', icon: CalendarDays,    label: 'Bulk Orders', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/bakery/reports',     icon: BarChart3,       label: 'Reports',     iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',    iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [optician] [all tenants]
export const OPTICIAN_NAV_ITEMS = [
  { to: '/optician/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/optician/patients',      icon: Users,           label: 'Patients',      iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/optician/prescriptions', icon: FileText,        label: 'Prescriptions', iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/optician/orders',        icon: ClipboardList,   label: 'Orders',        iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/optician/inventory',     icon: Boxes,           label: 'Inventory',     iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/optician/reports',       icon: BarChart3,       label: 'Reports',       iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',               icon: Settings,        label: 'Settings',      iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [tailor] [all tenants]
export const TAILOR_NAV_ITEMS = [
  { to: '/tailor/dashboard',    icon: LayoutDashboard, label: 'Dashboard',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/tailor/orders',       icon: ClipboardList,   label: 'Orders',       iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/tailor/orders/new',   icon: Receipt,         label: 'New Order',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/tailor/measurements', icon: Ruler,           label: 'Measurements', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/tailor/reports',      icon: BarChart3,       label: 'Reports',      iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',            icon: Settings,        label: 'Settings',     iconBg: '#f1f5f9', iconColor: '#64748b' },
];

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
export const LAUNDRY_NAV_ITEMS = [
  { to: '/laundry/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/laundry/orders',     icon: ClipboardList,   label: 'Orders',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/laundry/orders/new', icon: Receipt,         label: 'New Order',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/laundry/services',   icon: Package,         label: 'Price List', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/laundry/reports',    icon: BarChart3,       label: 'Reports',    iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',   iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [catering] [all tenants]
export const CATERING_NAV_ITEMS = [
  { to: '/catering/dashboard',  icon: LayoutDashboard, label: 'Dashboard', iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/catering/events',     icon: CalendarDays,    label: 'Events',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/catering/events/new', icon: Receipt,         label: 'New Event', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/catering/menu',       icon: BookOpen,        label: 'Menu',      iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/catering/reports',    icon: BarChart3,       label: 'Reports',   iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',            icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [pestcontrol] [all tenants]
export const PESTCONTROL_NAV_ITEMS = [
  { to: '/pestcontrol/dashboard', icon: LayoutDashboard, label: 'Dashboard', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/pestcontrol/jobs',      icon: ClipboardList,   label: 'Jobs',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/pestcontrol/jobs/new',  icon: Receipt,         label: 'New Job',   iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/pestcontrol/customers', icon: Users,           label: 'Customers', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/pestcontrol/contracts', icon: FileText,        label: 'Contracts', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/pestcontrol/reports',   icon: BarChart3,       label: 'Reports',   iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',              icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [petrolpump] [all tenants]
export const PETROLPUMP_NAV_ITEMS = [
  { to: '/petrolpump/dashboard', icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/petrolpump/shift',     icon: ClipboardCheck,  label: 'Today\'s Shift',iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/petrolpump/rates',     icon: Receipt,         label: 'Fuel Rates',    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/petrolpump/credit',    icon: BookOpen,        label: 'Credit Accts',  iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/petrolpump/reports',   icon: BarChart3,       label: 'Reports',       iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',             icon: Settings,        label: 'Settings',      iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [furniture] [all tenants]
export const FURNITURE_NAV_ITEMS = [
  { to: '/furniture/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     iconBg: '#fef3c7', iconColor: '#92400e' },
  { to: '/furniture/orders',        icon: ClipboardList,   label: 'Orders',        iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/furniture/orders/new',    icon: Receipt,         label: 'New Order',     iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/furniture/custom-orders', icon: Wrench,          label: 'Custom Orders', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/furniture/products',      icon: Package,         label: 'Products',      iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/furniture/reports',       icon: BarChart3,       label: 'Reports',       iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',                icon: Settings,        label: 'Settings',      iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [printing] [all tenants]
export const PRINTING_NAV_ITEMS = [
  { to: '/printing/dashboard', icon: LayoutDashboard, label: 'Dashboard',  iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/printing/jobs',      icon: ClipboardList,   label: 'Print Jobs', iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/printing/jobs/new',  icon: Receipt,         label: 'New Job',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/printing/stationery',icon: Package,         label: 'Stationery', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/printing/reports',   icon: BarChart3,       label: 'Reports',    iconBg: '#e0f2fe', iconColor: '#0284c7' },
  { to: '/settings',           icon: Settings,        label: 'Settings',   iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [ca] [all tenants]
export const CA_NAV_ITEMS = [
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

// [crm] [all tenants]
export const CRM_NAV_ITEMS = [
  { to: '/crm/dashboard',      icon: LayoutDashboard, label: 'Dashboard',   iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/crm/leads',          icon: Zap,             label: 'Leads',       iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/crm/wa-inbox',       icon: MessageSquare,   label: 'WA Inbox',    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/crm/contacts',       icon: Users,           label: 'Contacts',    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/crm/pipeline',       icon: Target,          label: 'Pipeline',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/crm/sales',          icon: ShoppingCart,    label: 'Sales',       iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/crm/service',        icon: Wrench,          label: 'Service',     iconBg: '#e0e7ff', iconColor: '#4f46e5' },
  { to: '/crm/followups',      icon: Timer,           label: 'Follow-ups',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/crm/communications', icon: Radio,           label: 'Comm. Log',   iconBg: '#e0f2fe', iconColor: '#0369a1' },
  { to: '/crm/commissions',    icon: DollarSign,      label: 'Commissions', iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/crm/team',           icon: UserCog,         label: 'Team',        iconBg: '#f0fdf4', iconColor: '#15803d' },
];

// [events] [all tenants]
export const EVENTS_NAV_ITEMS = [
  { to: '/events/dashboard', icon: LayoutDashboard, label: 'Dashboard', iconBg: '#fce7f3', iconColor: '#db2777' },
  { to: '/events/list',      icon: CalendarDays,    label: 'Events',    iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/events/new',       icon: Receipt,         label: 'New Event', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/events/vendors',   icon: Truck,           label: 'Vendors',   iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/events/reports',   icon: BarChart3,       label: 'Reports',   iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/settings',         icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [travel] [all tenants]
export const TRAVEL_NAV_ITEMS = [
  { to: '/travel/dashboard', icon: LayoutDashboard, label: 'Dashboard',    iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/travel/bookings',  icon: ClipboardList,   label: 'Bookings',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/travel/new',       icon: Receipt,         label: 'New Booking',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/travel/visa',      icon: FileText,        label: 'Visa Tracker', iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/travel/reports',   icon: BarChart3,       label: 'Reports',      iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/settings',         icon: Settings,        label: 'Settings',     iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [insurance] [all tenants]
export const INSURANCE_NAV_ITEMS = [
  { to: '/insurance/dashboard', icon: LayoutDashboard, label: 'Dashboard', iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/insurance/clients',   icon: Users,           label: 'Clients',   iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/insurance/policies',  icon: FileText,        label: 'Policies',  iconBg: '#ede9fe', iconColor: '#7c3aed' },
  { to: '/insurance/renewals',  icon: CalendarDays,    label: 'Renewals',  iconBg: '#fef3c7', iconColor: '#d97706' },
  { to: '/insurance/claims',    icon: ClipboardList,   label: 'Claims',    iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/insurance/reports',   icon: BarChart3,       label: 'Reports',   iconBg: '#cffafe', iconColor: '#0891b2' },
  { to: '/settings',            icon: Settings,        label: 'Settings',  iconBg: '#f1f5f9', iconColor: '#64748b' },
];

// [homeservice] [all tenants]
export const HOMESERVICE_NAV_ITEMS = [
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
export const REALESTATE_BASE_NAV = [
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

export function getRealEstateNavItems(role: string) {
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
export const BEAUTY_NAV_ITEMS = [
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
export const TYRESCRAP_NAV_ITEMS = [
  { to: '/tyrescrap/dashboard', icon: LayoutDashboard, label: 'Dashboard',  iconBg: '#dcfce7', iconColor: '#16a34a' },
  { to: '/tyrescrap/purchase',  icon: ShoppingCart,    label: 'Purchase',   iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/tyrescrap/sales',     icon: TrendingUp,      label: 'Sales',      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/tyrescrap/stock',     icon: Boxes,           label: 'Stock',      iconBg: '#f3e8ff', iconColor: '#9333ea' },
  { to: '/tyrescrap/vendors',   icon: Truck,           label: 'Vendors',    iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { to: '/tyrescrap/buyers',    icon: Users,           label: 'Buyers',     iconBg: '#dbeafe', iconColor: '#2563eb' },
  { to: '/tyrescrap/expenses',  icon: Wallet,          label: 'Expenses',   iconBg: '#fee2e2', iconColor: '#dc2626' },
  { to: '/tyrescrap/reports',   icon: BarChart3,       label: 'Reports',    iconBg: '#e0f2fe', iconColor: '#0284c7' },
];

// [core] [all tenants] — single source of truth for "which nav items does this
// shop type see", shared between the sidebar (AppLayout) and the staff tab-access
// picker (Settings), so the picker always matches what's actually in the sidebar.
export function getNavItemsForShopType(shopType: string | undefined, settings: any, isEmployeeMode = false) {
  const reRole = settings?.re_role ?? 'resale';
  return (
    shopType === 'restaurant'  ? RESTAURANT_NAV_ITEMS :
    shopType === 'grocery'     ? GROCERY_NAV_ITEMS :
    shopType === 'carwash'     ? (isEmployeeMode ? CARWASH_EMPLOYEE_NAV_ITEMS : CARWASH_NAV_ITEMS) :
    shopType === 'clinic'      ? CLINIC_NAV_ITEMS :
    shopType === 'beauty'      ? BEAUTY_NAV_ITEMS :
    shopType === 'study'       ? STUDY_NAV_ITEMS :
    shopType === 'coaching'    ? COACHING_NAV_ITEMS :
    shopType === 'gym'         ? GYM_NAV_ITEMS :
    shopType === 'jewellery'   ? JEWELLERY_NAV_ITEMS :
    shopType === 'realestate'  ? getRealEstateNavItems(reRole) :
    shopType === 'hotel'        ? HOTEL_NAV_ITEMS :
    shopType === 'repair'        ? REPAIR_NAV_ITEMS :
    shopType === 'drivingschool' ? DRIVINGSCHOOL_NAV_ITEMS :
    shopType === 'clothing'      ? CLOTHING_NAV_ITEMS :
    shopType === 'bakery'        ? BAKERY_NAV_ITEMS :
    shopType === 'optician'      ? OPTICIAN_NAV_ITEMS :
    shopType === 'tailor'        ? TAILOR_NAV_ITEMS :
    shopType === 'hardware'      ? HARDWARE_NAV_ITEMS :
    shopType === 'laundry'       ? LAUNDRY_NAV_ITEMS :
    shopType === 'catering'      ? CATERING_NAV_ITEMS :
    shopType === 'pestcontrol'   ? PESTCONTROL_NAV_ITEMS :
    shopType === 'petrolpump'    ? PETROLPUMP_NAV_ITEMS :
    shopType === 'furniture'     ? FURNITURE_NAV_ITEMS :
    shopType === 'printing'      ? PRINTING_NAV_ITEMS :
    shopType === 'ca'            ? CA_NAV_ITEMS :
    shopType === 'crm'           ? CRM_NAV_ITEMS :
    shopType === 'events'        ? EVENTS_NAV_ITEMS :
    shopType === 'travel'        ? TRAVEL_NAV_ITEMS :
    shopType === 'insurance'     ? INSURANCE_NAV_ITEMS :
    shopType === 'homeservice'   ? HOMESERVICE_NAV_ITEMS :
    shopType === 'tyrescrap'     ? TYRESCRAP_NAV_ITEMS :
    NAV_ITEMS
  );
}

export function AppLayout() {
  const { config, setAuthenticated } = useAppStore();
  const navigate = useNavigate();
  const { theme: crmTheme } = useTheme(); // [crm] [all tenants] — Aurora shell light/dark
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
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

  useEffect(() => {
    setAINavigator((path) => navigate(path));
  }, [navigate]);

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
        .then(({ syncWaLeadsFromServer }) => syncWaLeadsFromServer(tenantId, ownerName))
        .then(changed => {
          if (changed) {
            queryClient.invalidateQueries({ queryKey: ['crm-wa-inbox'] });
            queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
          }
        })
        .catch(() => { /* offline or db busy — next poll retries */ });
    };
    sync();
    const id = setInterval(sync, 30_000);
    return () => clearInterval(id);
  }, [tenantId, config?.shop_type, config?.owner_name, queryClient]);

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

  // [crm] [all tenants] — "Aurora" CRM shell: glass sidebar over aurora background, light & dark
  if (config?.shop_type === 'crm') {
    const dark = crmTheme === 'dark';
    const C = dark ? {
      bg: '#0a0c14',
      side: 'rgba(255,255,255,0.035)',
      sideBorder: 'rgba(255,255,255,0.08)',
      sideText: 'rgba(255,255,255,0.55)',
      sideLabel: 'rgba(255,255,255,0.28)',
      sideTitle: '#ffffff',
      menuBg: 'rgba(23,26,38,0.96)',
      menuText: 'rgba(255,255,255,0.65)',
      auroraOpacity: 1,
    } : {
      bg: '#f2f3fa',
      side: 'rgba(255,255,255,0.68)',
      sideBorder: 'rgba(18,21,38,0.09)',
      sideText: 'rgba(24,27,39,0.60)',
      sideLabel: 'rgba(24,27,39,0.36)',
      sideTitle: '#181b27',
      menuBg: 'rgba(255,255,255,0.97)',
      menuText: 'rgba(24,27,39,0.7)',
      auroraOpacity: 0.55,
    };
    const SIDE_GRADIENT = 'linear-gradient(135deg, #6366f1, #a855f7)';
    // Grouped IA — items still respect staff tab access (activeNavItems)
    const NAV_GROUPS: { label: string | null; paths: string[] }[] = [
      { label: null, paths: ['/crm/dashboard'] },
      { label: 'Sell', paths: ['/crm/leads', '/crm/wa-inbox', '/crm/pipeline', '/crm/sales'] },
      { label: 'Serve', paths: ['/crm/service', '/crm/followups'] },
      { label: 'People', paths: ['/crm/contacts', '/crm/communications'] },
      { label: 'Team', paths: ['/crm/commissions', '/crm/team'] },
    ];
    const groups = NAV_GROUPS
      .map(g => ({ ...g, items: g.paths.map(p => activeNavItems.find(i => i.to === p)).filter(Boolean) as typeof activeNavItems }))
      .filter(g => g.items.length > 0);
    const navItemStyle = (isActive: boolean): React.CSSProperties => ({
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', borderRadius: '9px', fontSize: '13px', fontWeight: isActive ? 700 : 500,
      textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.14s',
      background: isActive ? SIDE_GRADIENT : 'transparent',
      color: isActive ? '#ffffff' : C.sideText,
      boxShadow: isActive ? '0 6px 20px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none',
    });
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: "'Inter', -apple-system, sans-serif", position: 'relative' }}>
        {/* Aurora background */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none', opacity: C.auroraOpacity }}>
          <div style={{ position: 'absolute', top: '-220px', left: '-160px', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.30), transparent 65%)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', bottom: '-260px', right: '-180px', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.24), transparent 65%)', filter: 'blur(70px)' }} />
          <div style={{ position: 'absolute', top: '35%', left: '45%', width: '520px', height: '520px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.14), transparent 65%)', filter: 'blur(70px)' }} />
        </div>
        {/* Sidebar — glass */}
        <aside style={{ width: '220px', flexShrink: 0, background: C.side, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderRight: `1px solid ${C.sideBorder}`, display: 'flex', flexDirection: 'column', zIndex: 20 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 16px 14px', borderBottom: `1px solid ${C.sideBorder}` }}>
            <div style={{ background: SIDE_GRADIENT, borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 20px rgba(99,102,241,0.5)' }}>
              <Store style={{ width: '16px', height: '16px', color: '#fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.sideTitle, fontWeight: 800, fontSize: '13.5px', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {config?.shop_name || 'FrontStores'}
              </div>
              <div style={{ color: C.sideLabel, fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>CRM Workspace</div>
            </div>
          </div>

          {/* Nav groups */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
            {groups.map((g, gi) => (
              <div key={g.label ?? gi} style={{ marginBottom: '14px' }}>
                {g.label && (
                  <div style={{ fontSize: '9.5px', fontWeight: 800, color: C.sideLabel, textTransform: 'uppercase', letterSpacing: '0.12em', padding: '0 12px', marginBottom: '5px' }}>
                    {g.label}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {g.items.map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} style={({ isActive }) => navItemStyle(isActive)}>
                      <Icon style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Announcements pinned */}
          <div style={{ padding: '8px 10px', borderTop: `1px solid ${C.sideBorder}` }}>
            <NavLink to="/announcements" style={({ isActive }) => navItemStyle(isActive)}>
              <Megaphone style={{ width: '14px', height: '14px', flexShrink: 0 }} />
              Announcements
              {!!unreadAnnouncements && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', borderRadius: '999px', padding: '0 6px', fontSize: '10px', fontWeight: 700, minWidth: '17px', height: '17px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadAnnouncements > 9 ? '9+' : unreadAnnouncements}
                </span>
              )}
            </NavLink>
          </div>

          {/* User card */}
          <div style={{ position: 'relative', padding: '10px', borderTop: `1px solid ${C.sideBorder}` }}>
            <button onClick={() => setShowUserMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: showUserMenu ? C.sideBorder : 'none', border: 'none', cursor: 'pointer', padding: '8px 10px', borderRadius: '9px', width: '100%', transition: 'background 0.12s' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: SIDE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '12px', flexShrink: 0, boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                {((loggedInDisplayName ?? config?.owner_name)?.[0] || 'O').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ color: C.sideTitle, fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {loggedInDisplayName ?? config?.owner_name ?? 'Owner'}
                </div>
                <div style={{ color: C.sideLabel, fontSize: '10px', fontWeight: 600 }}>{staffTabAccess !== null ? 'Staff' : 'Owner'}</div>
              </div>
              <ChevronUp style={{ width: '12px', height: '12px', color: C.sideLabel, transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
            {showUserMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowUserMenu(false)} />
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '10px', right: '10px', background: C.menuBg, backdropFilter: 'blur(24px)', border: `1px solid ${C.sideBorder}`, borderRadius: '12px', overflow: 'hidden', zIndex: 50, boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
                  {[
                    { to: '/settings', icon: Settings, label: staffTabAccess !== null ? 'Check for Update' : 'Settings & Updates' },
                  ].map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} onClick={() => setShowUserMenu(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', color: C.menuText, textDecoration: 'none', fontSize: '12.5px', fontWeight: 600, borderBottom: `1px solid ${C.sideBorder}` }}>
                      <Icon style={{ width: '13px', height: '13px' }} /> {label}
                    </NavLink>
                  ))}
                  {/* [core] [all apps] [all tenants] — Switch App for everyone (testers AND clients) */}
                  <button onClick={() => { setShowUserMenu(false); setShowSwitchModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', color: C.menuText, background: 'none', border: 'none', borderBottom: `1px solid ${C.sideBorder}`, width: '100%', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <ArrowLeftRight style={{ width: '13px', height: '13px' }} /> Switch App
                  </button>
                  <button onClick={handleLogout}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', color: '#f87171', background: 'none', border: 'none', width: '100%', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <LogOut style={{ width: '13px', height: '13px' }} /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
        {showSwitchModal && <SwitchAppModal onClose={() => setShowSwitchModal(false)} />}
        <AnnouncementPopup />
      </div>
    );
  }

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

      {/* Voice assistants — only StudyMate; removed from other shop apps [carwash] [all tenants] */}
      {config?.shop_type === 'study' && <StudyVoiceAssistant />}
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
