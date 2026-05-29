import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { SetupWizard } from '@/modules/setup/SetupWizard';
import { AppLoginScreen } from '@/modules/auth/AppLoginScreen';
import { CreatePasswordScreen } from '@/modules/auth/CreatePasswordScreen';
import { hasAuth } from '@/lib/db/auth';
import { SubscriptionGate } from '@/modules/subscription/SubscriptionGate';
import { useIdleTimer } from '@/lib/hooks/useIdleTimer';

function IdleTimerProvider() { useIdleTimer(); return null; }

const Dashboard     = lazy(() => import('@/modules/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const POSPage       = lazy(() => import('@/modules/pos/POSPage').then(m => ({ default: m.POSPage })));
const ProductsPage  = lazy(() => import('@/modules/products/ProductsPage').then(m => ({ default: m.ProductsPage })));
const InventoryPage = lazy(() => import('@/modules/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const OrdersPage    = lazy(() => import('@/modules/orders/OrdersPage').then(m => ({ default: m.OrdersPage })));
const CustomersPage = lazy(() => import('@/modules/customers/CustomersPage').then(m => ({ default: m.CustomersPage })));
const SuppliersPage = lazy(() => import('@/modules/suppliers/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const ReportsPage   = lazy(() => import('@/modules/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage  = lazy(() => import('@/modules/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const KhataPage           = lazy(() => import('@/modules/khata/KhataPage').then(m => ({ default: m.KhataPage })));
const ExpensesPage        = lazy(() => import('@/modules/expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const PurchaseOrdersPage  = lazy(() => import('@/modules/purchase-orders/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })));
// [coaching] [all tenants]
const CoachingDashboard  = lazy(() => import('@/modules/coaching/CoachingDashboard').then(m => ({ default: m.CoachingDashboard })));
const CoachingStudents   = lazy(() => import('@/modules/coaching/StudentsPage').then(m => ({ default: m.StudentsPage })));
const CoachingBatches    = lazy(() => import('@/modules/coaching/BatchesPage').then(m => ({ default: m.BatchesPage })));
const CoachingAttendance = lazy(() => import('@/modules/coaching/AttendancePage').then(m => ({ default: m.AttendancePage })));
const CoachingFees       = lazy(() => import('@/modules/coaching/FeesPage').then(m => ({ default: m.FeesPage })));
const CoachingExams      = lazy(() => import('@/modules/coaching/ExamsPage').then(m => ({ default: m.ExamsPage })));
const CoachingTeachers   = lazy(() => import('@/modules/coaching/TeachersPage').then(m => ({ default: m.TeachersPage })));
const CoachingReports    = lazy(() => import('@/modules/coaching/CoachingReportsPage').then(m => ({ default: m.CoachingReportsPage })));

// [gym] [all tenants]
const GymDashboard   = lazy(() => import('@/modules/gym/GymDashboard').then(m => ({ default: m.GymDashboard })));
const GymMembers     = lazy(() => import('@/modules/gym/MembersPage').then(m => ({ default: m.MembersPage })));
const GymPlans       = lazy(() => import('@/modules/gym/PlansPage').then(m => ({ default: m.PlansPage })));
const GymCheckIn     = lazy(() => import('@/modules/gym/CheckInPage').then(m => ({ default: m.CheckInPage })));
const GymRenewals    = lazy(() => import('@/modules/gym/RenewalsPage').then(m => ({ default: m.RenewalsPage })));
const GymStaff       = lazy(() => import('@/modules/gym/GymStaffPage').then(m => ({ default: m.GymStaffPage })));
const GymReports     = lazy(() => import('@/modules/gym/GymReportsPage').then(m => ({ default: m.GymReportsPage })));

// [realestate] [all tenants]
const RealEstateDashboard = lazy(() => import('@/modules/realestate/RealEstateDashboard').then(m => ({ default: m.RealEstateDashboard })));
const RELeadsPage         = lazy(() => import('@/modules/realestate/LeadsPage').then(m => ({ default: m.LeadsPage })));
const REPropertiesPage    = lazy(() => import('@/modules/realestate/PropertiesPage').then(m => ({ default: m.PropertiesPage })));
const REProjectsPage      = lazy(() => import('@/modules/realestate/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const REDealsPage         = lazy(() => import('@/modules/realestate/DealsPage').then(m => ({ default: m.DealsPage })));
const RESiteVisitsPage    = lazy(() => import('@/modules/realestate/SiteVisitsPage').then(m => ({ default: m.SiteVisitsPage })));
const RECommissionsPage   = lazy(() => import('@/modules/realestate/CommissionsPage').then(m => ({ default: m.CommissionsPage })));
const REDocumentsPage     = lazy(() => import('@/modules/realestate/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const REBuildersPage      = lazy(() => import('@/modules/realestate/BuildersPage').then(m => ({ default: m.BuildersPage })));
const REReportsPage       = lazy(() => import('@/modules/realestate/REReportsPage').then(m => ({ default: m.REReportsPage })));

// [jewellery] [all tenants]
const JewelleryDashboard    = lazy(() => import('@/modules/jewellery/JewelleryDashboard').then(m => ({ default: m.JewelleryDashboard })));
const JewelleryGoldRate     = lazy(() => import('@/modules/jewellery/GoldRatePage').then(m => ({ default: m.GoldRatePage })));
const JewelleryProducts     = lazy(() => import('@/modules/jewellery/JewelleryProductsPage').then(m => ({ default: m.JewelleryProductsPage })));
const JewelleryCustomOrders = lazy(() => import('@/modules/jewellery/CustomOrdersPage').then(m => ({ default: m.CustomOrdersPage })));
const JewelleryRepairs      = lazy(() => import('@/modules/jewellery/RepairsPage').then(m => ({ default: m.RepairsPage })));
const JewelleryReports      = lazy(() => import('@/modules/jewellery/JewelleryReportsPage').then(m => ({ default: m.JewelleryReportsPage })));

// [grocery] [all tenants]
const GroceryDashboard        = lazy(() => import('@/modules/grocery/GroceryDashboard').then(m => ({ default: m.GroceryDashboard })));
const CashDrawerPage          = lazy(() => import('@/modules/grocery/CashDrawerPage').then(m => ({ default: m.CashDrawerPage })));
const PurchasePage            = lazy(() => import('@/modules/grocery/PurchasePage').then(m => ({ default: m.PurchasePage })));

// [carwash] [all tenants]
const CarwashDashboard        = lazy(() => import('@/modules/carwash/CarwashDashboard').then(m => ({ default: m.CarwashDashboard })));
const JobsListPage            = lazy(() => import('@/modules/carwash/JobsListPage').then(m => ({ default: m.JobsListPage })));
const JobCardPage             = lazy(() => import('@/modules/carwash/JobCardPage').then(m => ({ default: m.JobCardPage })));
const CarwashServicesPage     = lazy(() => import('@/modules/carwash/CarwashServicesPage').then(m => ({ default: m.CarwashServicesPage })));
const MembershipPage          = lazy(() => import('@/modules/carwash/MembershipPage').then(m => ({ default: m.MembershipPage })));
const CarwashStaffPage        = lazy(() => import('@/modules/carwash/CarwashStaffPage').then(m => ({ default: m.CarwashStaffPage })));
const CarwashReportsPage      = lazy(() => import('@/modules/carwash/CarwashReportsPage').then(m => ({ default: m.CarwashReportsPage })));

// [clinic] [all tenants]
const ClinicDashboard         = lazy(() => import('@/modules/clinic/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })));
const PatientsPage            = lazy(() => import('@/modules/clinic/PatientsPage').then(m => ({ default: m.PatientsPage })));
const VisitPage               = lazy(() => import('@/modules/clinic/VisitPage').then(m => ({ default: m.VisitPage })));
const AppointmentsPage        = lazy(() => import('@/modules/clinic/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })));
const DoctorsPage             = lazy(() => import('@/modules/clinic/DoctorsPage').then(m => ({ default: m.DoctorsPage })));
const PharmacyPage            = lazy(() => import('@/modules/clinic/PharmacyPage').then(m => ({ default: m.PharmacyPage })));
const LabPage                 = lazy(() => import('@/modules/clinic/LabPage').then(m => ({ default: m.LabPage })));
const IPDPage                 = lazy(() => import('@/modules/clinic/IPDPage').then(m => ({ default: m.IPDPage })));
const BillingPage             = lazy(() => import('@/modules/clinic/BillingPage').then(m => ({ default: m.BillingPage })));
const ClinicReportsPage       = lazy(() => import('@/modules/clinic/ClinicReportsPage').then(m => ({ default: m.ClinicReportsPage })));

// [study] [all tenants]
const StudyDashboard          = lazy(() => import('@/modules/study/StudyDashboard').then(m => ({ default: m.StudyDashboard })));
const AskAIPage               = lazy(() => import('@/modules/study/AskAIPage').then(m => ({ default: m.AskAIPage })));
const MockTestPage            = lazy(() => import('@/modules/study/MockTestPage').then(m => ({ default: m.MockTestPage })));
const FlashcardsPage          = lazy(() => import('@/modules/study/FlashcardsPage').then(m => ({ default: m.FlashcardsPage })));
const StudyTrackerPage        = lazy(() => import('@/modules/study/StudyTrackerPage').then(m => ({ default: m.StudyTrackerPage })));
const ParentReportPage        = lazy(() => import('@/modules/study/ParentReportPage').then(m => ({ default: m.ParentReportPage })));
const StudySetupPage          = lazy(() => import('@/modules/study/StudySetupPage').then(m => ({ default: m.StudySetupPage })));
const StudyResourcesPage      = lazy(() => import('@/modules/study/StudyResourcesPage').then(m => ({ default: m.StudyResourcesPage })));
const TimetablePage           = lazy(() => import('@/modules/study/TimetablePage').then(m => ({ default: m.TimetablePage })));
const PomodoroPage            = lazy(() => import('@/modules/study/PomodoroPage').then(m => ({ default: m.PomodoroPage })));
const ExamsPage               = lazy(() => import('@/modules/study/ExamsPage').then(m => ({ default: m.ExamsPage })));
const AssignmentsPage         = lazy(() => import('@/modules/study/AssignmentsPage').then(m => ({ default: m.AssignmentsPage })));
const GoalsPage               = lazy(() => import('@/modules/study/GoalsPage').then(m => ({ default: m.GoalsPage })));
const BadgesPage              = lazy(() => import('@/modules/study/BadgesPage').then(m => ({ default: m.BadgesPage })));
const FormulaBankPage         = lazy(() => import('@/modules/study/FormulaBankPage').then(m => ({ default: m.FormulaBankPage })));
const MindmapPage             = lazy(() => import('@/modules/study/MindmapPage').then(m => ({ default: m.MindmapPage })));
const PYQPage                 = lazy(() => import('@/modules/study/PYQPage').then(m => ({ default: m.PYQPage })));
const ChapterChecklistPage    = lazy(() => import('@/modules/study/ChapterChecklistPage').then(m => ({ default: m.ChapterChecklistPage })));
const RevisionPlannerPage     = lazy(() => import('@/modules/study/RevisionPlannerPage').then(m => ({ default: m.RevisionPlannerPage })));
const StudyCalendarPage       = lazy(() => import('@/modules/study/StudyCalendarPage').then(m => ({ default: m.StudyCalendarPage })));
const HeatmapPage             = lazy(() => import('@/modules/study/HeatmapPage').then(m => ({ default: m.HeatmapPage })));
const UnitConverterPage       = lazy(() => import('@/modules/study/UnitConverterPage').then(m => ({ default: m.UnitConverterPage })));
const CalculatorPage          = lazy(() => import('@/modules/study/CalculatorPage').then(m => ({ default: m.CalculatorPage })));
const BackupPage              = lazy(() => import('@/modules/study/BackupPage').then(m => ({ default: m.BackupPage })));
const RichNotesPage           = lazy(() => import('@/modules/study/RichNotesPage').then(m => ({ default: m.RichNotesPage })));
const WhiteboardPage          = lazy(() => import('@/modules/study/WhiteboardPage').then(m => ({ default: m.WhiteboardPage })));
const DoubtBankPage           = lazy(() => import('@/modules/study/DoubtBankPage').then(m => ({ default: m.DoubtBankPage })));
const ExamResultsPage         = lazy(() => import('@/modules/study/ExamResultsPage').then(m => ({ default: m.ExamResultsPage })));
const AttendancePage          = lazy(() => import('@/modules/study/AttendancePage').then(m => ({ default: m.AttendancePage })));
const TodayFocusPage          = lazy(() => import('@/modules/study/TodayFocusPage').then(m => ({ default: m.TodayFocusPage })));
const ExamRegistrationsPage   = lazy(() => import('@/modules/study/ExamRegistrationsPage').then(m => ({ default: m.ExamRegistrationsPage })));
const VocabularyPage          = lazy(() => import('@/modules/study/VocabularyPage').then(m => ({ default: m.VocabularyPage })));
const PeriodicTablePage       = lazy(() => import('@/modules/study/PeriodicTablePage').then(m => ({ default: m.PeriodicTablePage })));
const VideoBookmarksPage      = lazy(() => import('@/modules/study/VideoBookmarksPage').then(m => ({ default: m.VideoBookmarksPage })));
const ConceptCardsPage        = lazy(() => import('@/modules/study/ConceptCardsPage').then(m => ({ default: m.ConceptCardsPage })));
const SleepTrackerPage        = lazy(() => import('@/modules/study/SleepTrackerPage').then(m => ({ default: m.SleepTrackerPage })));
const StudyWrappedPage        = lazy(() => import('@/modules/study/StudyWrappedPage').then(m => ({ default: m.StudyWrappedPage })));
const WritingPracticePage     = lazy(() => import('@/modules/study/WritingPracticePage').then(m => ({ default: m.WritingPracticePage })));
const BrainBreakPage          = lazy(() => import('@/modules/study/BrainBreakPage').then(m => ({ default: m.BrainBreakPage })));
const MathConstantsPage       = lazy(() => import('@/modules/study/MathConstantsPage').then(m => ({ default: m.MathConstantsPage })));
const LocalAISetupPage        = lazy(() => import('@/modules/study/LocalAISetupPage').then(m => ({ default: m.LocalAISetupPage })));

// [hotel] [all tenants]
const HotelDashboard       = lazy(() => import('@/modules/hotel/HotelDashboard').then(m => ({ default: m.HotelDashboard })));
const HotelRoomGrid        = lazy(() => import('@/modules/hotel/RoomGridPage').then(m => ({ default: m.RoomGridPage })));
const HotelBookings        = lazy(() => import('@/modules/hotel/BookingsPage').then(m => ({ default: m.BookingsPage })));
const HotelNewBooking      = lazy(() => import('@/modules/hotel/NewBookingPage').then(m => ({ default: m.NewBookingPage })));
const HotelCheckIn         = lazy(() => import('@/modules/hotel/CheckInPage').then(m => ({ default: m.CheckInPage })));
const HotelCheckOut        = lazy(() => import('@/modules/hotel/CheckOutPage').then(m => ({ default: m.CheckOutPage })));
const HotelGuests          = lazy(() => import('@/modules/hotel/GuestsPage').then(m => ({ default: m.GuestsPage })));
const HotelHousekeeping    = lazy(() => import('@/modules/hotel/HousekeepingPage').then(m => ({ default: m.HousekeepingPage })));
const HotelMaintenance     = lazy(() => import('@/modules/hotel/MaintenancePage').then(m => ({ default: m.MaintenancePage })));
const HotelReports         = lazy(() => import('@/modules/hotel/HotelReportsPage').then(m => ({ default: m.HotelReportsPage })));
const HotelRoomSetup       = lazy(() => import('@/modules/hotel/RoomSetupPage').then(m => ({ default: m.RoomSetupPage })));
const HotelSettings        = lazy(() => import('@/modules/hotel/HotelSettingsPage').then(m => ({ default: m.HotelSettingsPage })));

// [ca] [all tenants]
const CADashboard      = lazy(() => import('@/modules/ca/CADashboard').then(m => ({ default: m.CADashboard })));
const CAClientsPage    = lazy(() => import('@/modules/ca/ClientsPage').then(m => ({ default: m.CAClientsPage })));
const CATasksPage      = lazy(() => import('@/modules/ca/TasksPage').then(m => ({ default: m.CATasksPage })));
const CADocumentsPage  = lazy(() => import('@/modules/ca/DocumentsPage').then(m => ({ default: m.CADocumentsPage })));
const CAReportsPage    = lazy(() => import('@/modules/ca/CAReportsPage').then(m => ({ default: m.CAReportsPage })));

// [events] [all tenants]
const EventsDashboard  = lazy(() => import('@/modules/events/EventsDashboard').then(m => ({ default: m.EventsDashboard })));
const EventsListPage   = lazy(() => import('@/modules/events/EventsListPage').then(m => ({ default: m.EventsListPage })));
const NewEventPage     = lazy(() => import('@/modules/events/NewEventPage').then(m => ({ default: m.NewEventPage })));
const VendorsPage      = lazy(() => import('@/modules/events/VendorsPage').then(m => ({ default: m.VendorsPage })));
const EventReportsPage = lazy(() => import('@/modules/events/EventReportsPage').then(m => ({ default: m.EventReportsPage })));

// [travel] [all tenants]
const TravelDashboard  = lazy(() => import('@/modules/travel/TravelDashboard').then(m => ({ default: m.TravelDashboard })));
const BookingsPage     = lazy(() => import('@/modules/travel/BookingsPage').then(m => ({ default: m.BookingsPage })));
const NewBookingPage   = lazy(() => import('@/modules/travel/NewBookingPage').then(m => ({ default: m.NewBookingPage })));
const VisaPage         = lazy(() => import('@/modules/travel/VisaPage').then(m => ({ default: m.VisaPage })));
const TravelReports    = lazy(() => import('@/modules/travel/TravelReportsPage').then(m => ({ default: m.TravelReportsPage })));

// [insurance] [all tenants]
const InsuranceDashboard = lazy(() => import('@/modules/insurance/InsuranceDashboard').then(m => ({ default: m.InsuranceDashboard })));
const InsClientsPage     = lazy(() => import('@/modules/insurance/InsClientsPage').then(m => ({ default: m.InsClientsPage })));
const PoliciesPage       = lazy(() => import('@/modules/insurance/PoliciesPage').then(m => ({ default: m.PoliciesPage })));
const RenewalsPage       = lazy(() => import('@/modules/insurance/RenewalsPage').then(m => ({ default: m.InsRenewalsPage })));
const ClaimsPage         = lazy(() => import('@/modules/insurance/ClaimsPage').then(m => ({ default: m.InsClaimsPage })));
const InsReportsPage     = lazy(() => import('@/modules/insurance/InsReportsPage').then(m => ({ default: m.InsReportsPage })));

// [homeservice] [all tenants]
const ServiceDashboard   = lazy(() => import('@/modules/homeservice/ServiceDashboard').then(m => ({ default: m.ServiceDashboard })));
const HSJobsPage         = lazy(() => import('@/modules/homeservice/JobsPage').then(m => ({ default: m.JobsPage })));
const HSNewJobPage       = lazy(() => import('@/modules/homeservice/NewJobPage').then(m => ({ default: m.NewJobPage })));
const TechniciansPage    = lazy(() => import('@/modules/homeservice/TechniciansPage').then(m => ({ default: m.TechniciansPage })));
const MaterialsPage      = lazy(() => import('@/modules/homeservice/MaterialsPage').then(m => ({ default: m.MaterialsPage })));
const AMCPage            = lazy(() => import('@/modules/homeservice/AMCPage').then(m => ({ default: m.AMCPage })));
const ServiceReportsPage = lazy(() => import('@/modules/homeservice/ServiceReportsPage').then(m => ({ default: m.ServiceReportsPage })));

// [beauty] [all tenants]
const BeautyDashboard         = lazy(() => import('@/modules/beauty/BeautyDashboard').then(m => ({ default: m.BeautyDashboard })));
const BeautyServicesPage      = lazy(() => import('@/modules/beauty/BeautyServicesPage').then(m => ({ default: m.BeautyServicesPage })));
const BeautyAppointmentListPage = lazy(() => import('@/modules/beauty/BeautyAppointmentPage').then(m => ({ default: m.BeautyAppointmentListPage })));
const BeautyNewAppointmentPage  = lazy(() => import('@/modules/beauty/BeautyAppointmentPage').then(m => ({ default: m.BeautyNewAppointmentPage })));
const BeautyAppointmentDetailPage = lazy(() => import('@/modules/beauty/BeautyAppointmentPage').then(m => ({ default: m.BeautyAppointmentDetailPage })));
const BeautyStaffPage         = lazy(() => import('@/modules/beauty/BeautyStaffPage').then(m => ({ default: m.BeautyStaffPage })));
const BeautyMembershipsPage   = lazy(() => import('@/modules/beauty/BeautyMembershipsPage').then(m => ({ default: m.BeautyMembershipsPage })));
const BeautyReportsPage       = lazy(() => import('@/modules/beauty/BeautyReportsPage').then(m => ({ default: m.BeautyReportsPage })));

// [restaurant] [all tenants]
const TablesPage              = lazy(() => import('@/modules/restaurant/TablesPage').then(m => ({ default: m.TablesPage })));
const MenuPage                = lazy(() => import('@/modules/restaurant/MenuPage').then(m => ({ default: m.MenuPage })));
const KitchenPage             = lazy(() => import('@/modules/restaurant/KitchenPage').then(m => ({ default: m.KitchenPage })));
const RestaurantOrdersPage    = lazy(() => import('@/modules/restaurant/RestaurantOrdersPage').then(m => ({ default: m.RestaurantOrdersPage })));
const RestaurantDashboard     = lazy(() => import('@/modules/restaurant/RestaurantDashboard').then(m => ({ default: m.RestaurantDashboard })));
const RestaurantReportsPage   = lazy(() => import('@/modules/restaurant/RestaurantReportsPage').then(m => ({ default: m.RestaurantReportsPage })));
const StaffPage               = lazy(() => import('@/modules/restaurant/StaffPage').then(m => ({ default: m.StaffPage })));

function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading FrontStores…</div>
    </div>
  );
}

export default function App() {
  const { isLoading, isSetupComplete, isAuthenticated, config, loadConfig, setAuthenticated } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [authExists, setAuthExists] = useState(false);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    if (!isSetupComplete || !config?.tenant_id) return;
    hasAuth(config.tenant_id).then(exists => {
      setAuthExists(exists);
      setAuthChecked(true);
    });
  }, [isSetupComplete, config?.tenant_id]);

  if (isLoading) return <Loading />;
  if (!isSetupComplete) return <SetupWizard />;
  if (!authChecked) return <Loading />;
  // No password set yet (user upgraded from old version) — force password creation
  if (!authExists) return <CreatePasswordScreen onCreated={() => setAuthExists(true)} />;
  if (!isAuthenticated) return <AppLoginScreen />;

  return (
    <SubscriptionGate>
    <IdleTimerProvider />
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to={
              config?.shop_type === 'restaurant' ? '/restaurant/dashboard' :
              config?.shop_type === 'grocery'    ? '/grocery/dashboard' :
              config?.shop_type === 'carwash'    ? '/carwash/dashboard' :
              config?.shop_type === 'clinic'     ? '/clinic/dashboard' :
              config?.shop_type === 'beauty'     ? '/beauty/dashboard' :
              config?.shop_type === 'study'      ? '/study/dashboard' :
              config?.shop_type === 'coaching'   ? '/coaching/dashboard' :
              config?.shop_type === 'gym'        ? '/gym/dashboard' :
              config?.shop_type === 'jewellery'   ? '/jewellery/dashboard' :
              config?.shop_type === 'realestate'  ? '/realestate/dashboard' :
              config?.shop_type === 'hotel'        ? '/hotel/dashboard' :
              config?.shop_type === 'ca'           ? '/ca/dashboard' :
              config?.shop_type === 'events'       ? '/events/dashboard' :
              config?.shop_type === 'travel'       ? '/travel/dashboard' :
              config?.shop_type === 'insurance'    ? '/insurance/dashboard' :
              config?.shop_type === 'homeservice'  ? '/homeservice/dashboard' :
              '/dashboard'
            } replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="pos"        element={<POSPage />} />
            <Route path="products"   element={<ProductsPage />} />
            <Route path="inventory"  element={<InventoryPage />} />
            <Route path="orders"     element={<OrdersPage />} />
            <Route path="customers"  element={<CustomersPage />} />
            <Route path="khata"      element={<KhataPage />} />
            <Route path="expenses"   element={<ExpensesPage />} />
            <Route path="suppliers"        element={<SuppliersPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="reports"    element={<ReportsPage />} />
            <Route path="settings"   element={<SettingsPage />} />
            {/* [grocery] [all tenants] */}
            <Route path="grocery/dashboard" element={<GroceryDashboard />} />
            <Route path="grocery/cash"      element={<CashDrawerPage />} />
            <Route path="grocery/purchase"  element={<PurchasePage />} />

            {/* [carwash] [all tenants] */}
            <Route path="carwash/dashboard"  element={<CarwashDashboard />} />
            <Route path="carwash/jobs"       element={<JobsListPage />} />
            <Route path="carwash/jobs/:id"   element={<JobCardPage />} />
            <Route path="carwash/services"   element={<CarwashServicesPage />} />
            <Route path="carwash/membership" element={<MembershipPage />} />
            <Route path="carwash/staff"      element={<CarwashStaffPage />} />
            <Route path="carwash/reports"    element={<CarwashReportsPage />} />

            {/* [clinic] [all tenants] */}
            <Route path="clinic/dashboard"    element={<ClinicDashboard />} />
            <Route path="clinic/patients"     element={<PatientsPage />} />
            <Route path="clinic/visits/new"   element={<VisitPage />} />
            <Route path="clinic/appointments" element={<AppointmentsPage />} />
            <Route path="clinic/doctors"      element={<DoctorsPage />} />
            <Route path="clinic/pharmacy"     element={<PharmacyPage />} />
            <Route path="clinic/lab"          element={<LabPage />} />
            <Route path="clinic/ipd"          element={<IPDPage />} />
            <Route path="clinic/billing"      element={<BillingPage />} />
            <Route path="clinic/reports"      element={<ClinicReportsPage />} />

            {/* [study] [all tenants] */}
            <Route path="study/dashboard"  element={<StudyDashboard />} />
            <Route path="study/ask"        element={<AskAIPage />} />
            <Route path="study/mock-tests" element={<MockTestPage />} />
            <Route path="study/flashcards" element={<FlashcardsPage />} />
            <Route path="study/resources"    element={<StudyResourcesPage />} />
            <Route path="study/tracker"      element={<StudyTrackerPage />} />
            <Route path="study/parents"      element={<ParentReportPage />} />
            <Route path="study/setup"        element={<StudySetupPage />} />
            <Route path="study/timetable"    element={<TimetablePage />} />
            <Route path="study/pomodoro"     element={<PomodoroPage />} />
            <Route path="study/exams"        element={<ExamsPage />} />
            <Route path="study/assignments"  element={<AssignmentsPage />} />
            <Route path="study/goals"        element={<GoalsPage />} />
            <Route path="study/badges"       element={<BadgesPage />} />
            <Route path="study/formulas"     element={<FormulaBankPage />} />
            <Route path="study/mindmaps"     element={<MindmapPage />} />
            <Route path="study/pyq"          element={<PYQPage />} />
            <Route path="study/chapters"     element={<ChapterChecklistPage />} />
            <Route path="study/revision"     element={<RevisionPlannerPage />} />
            <Route path="study/calendar"     element={<StudyCalendarPage />} />
            <Route path="study/analytics"    element={<HeatmapPage />} />
            <Route path="study/converter"    element={<UnitConverterPage />} />
            <Route path="study/calculator"   element={<CalculatorPage />} />
            <Route path="study/backup"       element={<BackupPage />} />
            <Route path="study/notes"        element={<RichNotesPage />} />
            <Route path="study/whiteboard"   element={<WhiteboardPage />} />
            <Route path="study/doubts"       element={<DoubtBankPage />} />
            <Route path="study/results"      element={<ExamResultsPage />} />
            <Route path="study/attendance"   element={<AttendancePage />} />
            <Route path="study/focus"        element={<TodayFocusPage />} />
            <Route path="study/registrations" element={<ExamRegistrationsPage />} />
            <Route path="study/vocabulary"   element={<VocabularyPage />} />
            <Route path="study/periodic"     element={<PeriodicTablePage />} />
            <Route path="study/videos"       element={<VideoBookmarksPage />} />
            <Route path="study/concepts"     element={<ConceptCardsPage />} />
            <Route path="study/sleep"        element={<SleepTrackerPage />} />
            <Route path="study/wrapped"      element={<StudyWrappedPage />} />
            <Route path="study/writing"      element={<WritingPracticePage />} />
            <Route path="study/brain-break"  element={<BrainBreakPage />} />
            <Route path="study/constants"    element={<MathConstantsPage />} />
            <Route path="study/local-ai"     element={<LocalAISetupPage />} />

            {/* [coaching] [all tenants] */}
            <Route path="coaching/dashboard"  element={<CoachingDashboard />} />
            <Route path="coaching/students"   element={<CoachingStudents />} />
            <Route path="coaching/batches"    element={<CoachingBatches />} />
            <Route path="coaching/attendance" element={<CoachingAttendance />} />
            <Route path="coaching/fees"       element={<CoachingFees />} />
            <Route path="coaching/exams"      element={<CoachingExams />} />
            <Route path="coaching/teachers"   element={<CoachingTeachers />} />
            <Route path="coaching/reports"    element={<CoachingReports />} />

            {/* [gym] [all tenants] */}
            <Route path="gym/dashboard" element={<GymDashboard />} />
            <Route path="gym/members"   element={<GymMembers />} />
            <Route path="gym/plans"     element={<GymPlans />} />
            <Route path="gym/checkin"   element={<GymCheckIn />} />
            <Route path="gym/renewals"  element={<GymRenewals />} />
            <Route path="gym/staff"     element={<GymStaff />} />
            <Route path="gym/reports"   element={<GymReports />} />

            {/* [jewellery] [all tenants] */}
            <Route path="jewellery/dashboard"     element={<JewelleryDashboard />} />
            <Route path="jewellery/gold-rate"     element={<JewelleryGoldRate />} />
            <Route path="jewellery/products"      element={<JewelleryProducts />} />
            <Route path="jewellery/billing"       element={<JewelleryProducts />} />
            <Route path="jewellery/custom-orders" element={<JewelleryCustomOrders />} />
            <Route path="jewellery/repairs"       element={<JewelleryRepairs />} />
            <Route path="jewellery/reports"       element={<JewelleryReports />} />

            {/* [realestate] [all tenants] */}
            <Route path="realestate/dashboard"   element={<RealEstateDashboard />} />
            <Route path="realestate/leads"       element={<RELeadsPage />} />
            <Route path="realestate/properties"  element={<REPropertiesPage />} />
            <Route path="realestate/projects"    element={<REProjectsPage />} />
            <Route path="realestate/deals"       element={<REDealsPage />} />
            <Route path="realestate/site-visits" element={<RESiteVisitsPage />} />
            <Route path="realestate/commissions" element={<RECommissionsPage />} />
            <Route path="realestate/documents"   element={<REDocumentsPage />} />
            <Route path="realestate/builders"    element={<REBuildersPage />} />
            <Route path="realestate/reports"     element={<REReportsPage />} />

            {/* [hotel] [all tenants] */}
            <Route path="hotel/dashboard"    element={<HotelDashboard />} />
            <Route path="hotel/rooms"        element={<HotelRoomGrid />} />
            <Route path="hotel/bookings"     element={<HotelBookings />} />
            <Route path="hotel/bookings/new" element={<HotelNewBooking />} />
            <Route path="hotel/checkin"      element={<HotelCheckIn />} />
            <Route path="hotel/checkout"     element={<HotelCheckOut />} />
            <Route path="hotel/guests"       element={<HotelGuests />} />
            <Route path="hotel/housekeeping" element={<HotelHousekeeping />} />
            <Route path="hotel/maintenance"  element={<HotelMaintenance />} />
            <Route path="hotel/reports"      element={<HotelReports />} />
            <Route path="hotel/setup/rooms"  element={<HotelRoomSetup />} />
            <Route path="hotel/settings"     element={<HotelSettings />} />

            {/* [ca] [all tenants] */}
            <Route path="ca/dashboard" element={<CADashboard />} />
            <Route path="ca/clients"   element={<CAClientsPage />} />
            <Route path="ca/tasks"     element={<CATasksPage />} />
            <Route path="ca/documents" element={<CADocumentsPage />} />
            <Route path="ca/reports"   element={<CAReportsPage />} />

            {/* [events] [all tenants] */}
            <Route path="events/dashboard" element={<EventsDashboard />} />
            <Route path="events/list"      element={<EventsListPage />} />
            <Route path="events/new"       element={<NewEventPage />} />
            <Route path="events/vendors"   element={<VendorsPage />} />
            <Route path="events/reports"   element={<EventReportsPage />} />

            {/* [travel] [all tenants] */}
            <Route path="travel/dashboard" element={<TravelDashboard />} />
            <Route path="travel/bookings"  element={<BookingsPage />} />
            <Route path="travel/new"       element={<NewBookingPage />} />
            <Route path="travel/visa"      element={<VisaPage />} />
            <Route path="travel/reports"   element={<TravelReports />} />

            {/* [insurance] [all tenants] */}
            <Route path="insurance/dashboard" element={<InsuranceDashboard />} />
            <Route path="insurance/clients"   element={<InsClientsPage />} />
            <Route path="insurance/policies"  element={<PoliciesPage />} />
            <Route path="insurance/renewals"  element={<RenewalsPage />} />
            <Route path="insurance/claims"    element={<ClaimsPage />} />
            <Route path="insurance/reports"   element={<InsReportsPage />} />

            {/* [homeservice] [all tenants] */}
            <Route path="homeservice/dashboard" element={<ServiceDashboard />} />
            <Route path="homeservice/jobs"      element={<HSJobsPage />} />
            <Route path="homeservice/new-job"   element={<HSNewJobPage />} />
            <Route path="homeservice/techs"     element={<TechniciansPage />} />
            <Route path="homeservice/materials" element={<MaterialsPage />} />
            <Route path="homeservice/amc"       element={<AMCPage />} />
            <Route path="homeservice/reports"   element={<ServiceReportsPage />} />

            {/* [beauty] [all tenants] */}
            <Route path="beauty/dashboard"              element={<BeautyDashboard />} />
            <Route path="beauty/services"               element={<BeautyServicesPage />} />
            <Route path="beauty/appointments"           element={<BeautyAppointmentListPage />} />
            <Route path="beauty/appointments/new"       element={<BeautyNewAppointmentPage />} />
            <Route path="beauty/appointments/:id"       element={<BeautyAppointmentDetailPage />} />
            <Route path="beauty/staff"                  element={<BeautyStaffPage />} />
            <Route path="beauty/memberships"            element={<BeautyMembershipsPage />} />
            <Route path="beauty/reports"                element={<BeautyReportsPage />} />

            {/* [restaurant] [all tenants] */}
            <Route path="restaurant/dashboard" element={<RestaurantDashboard />} />
            <Route path="restaurant/tables"    element={<TablesPage />} />
            <Route path="restaurant/menu"      element={<MenuPage />} />
            <Route path="restaurant/kitchen"   element={<KitchenPage />} />
            <Route path="restaurant/orders"    element={<RestaurantOrdersPage />} />
            <Route path="restaurant/staff"     element={<StaffPage />} />
            <Route path="restaurant/reports"   element={<RestaurantReportsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
    </SubscriptionGate>
  );
}
