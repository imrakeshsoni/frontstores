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
            <Route path="study/tracker"    element={<StudyTrackerPage />} />
            <Route path="study/parents"    element={<ParentReportPage />} />
            <Route path="study/setup"      element={<StudySetupPage />} />

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
