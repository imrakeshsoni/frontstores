import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/app/store/app.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { SetupWizard } from '@/modules/setup/SetupWizard';
import { AppLoginScreen } from '@/modules/auth/AppLoginScreen';
import { CreatePasswordScreen } from '@/modules/auth/CreatePasswordScreen';
import { hasAuth } from '@/lib/db/auth';
import { claimSession, heartbeatSession, releaseSession } from '@/lib/db/session';
import { SubscriptionGate } from '@/modules/subscription/SubscriptionGate';
import { SyncAccessGate } from '@/components/sync/SyncAccessGate';
import { useIdleTimer } from '@/lib/hooks/useIdleTimer';
import { PinLockGate } from '@/components/ui/PinLockGate';

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
const AnnouncementsPage = lazy(() => import('@/modules/announcements/AnnouncementsPage'));
const KhataPage           = lazy(() => import('@/modules/khata/KhataPage').then(m => ({ default: m.KhataPage })));
const ExpensesPage        = lazy(() => import('@/modules/expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const PurchaseOrdersPage  = lazy(() => import('@/modules/purchase-orders/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })));
// [coaching] [all tenants]
// [admin] [all tenants] — FrontStores owner admin panel
const AdminPage = lazy(() => import('@/modules/admin/AdminPage').then(m => ({ default: m.AdminPage })));


// [gym] [all tenants]

// [realestate] [all tenants]

// [jewellery] [all tenants]

// [grocery] [all tenants]

// [carwash] [all tenants]
const CarwashDashboard        = lazy(() => import('@/modules/carwash/CarwashDashboard').then(m => ({ default: m.CarwashDashboard })));
const JobsListPage            = lazy(() => import('@/modules/carwash/JobsListPage').then(m => ({ default: m.JobsListPage })));
const JobCardPage             = lazy(() => import('@/modules/carwash/JobCardPage').then(m => ({ default: m.JobCardPage })));
const CarwashServicesPage     = lazy(() => import('@/modules/carwash/CarwashServicesPage').then(m => ({ default: m.CarwashServicesPage })));
const CarwashReportsPage      = lazy(() => import('@/modules/carwash/CarwashReportsPage').then(m => ({ default: m.CarwashReportsPage })));
const BroadcastPage           = lazy(() => import('@/modules/carwash/BroadcastPage').then(m => ({ default: m.BroadcastPage })));
const CarwashAppointmentsPage = lazy(() => import('@/modules/carwash/CarwashAppointmentsPage').then(m => ({ default: m.CarwashAppointmentsPage })));
const CarwashInventoryPage        = lazy(() => import('@/modules/carwash/CarwashInventoryPage').then(m => ({ default: m.CarwashInventoryPage })));
const CarwashVehicleTypesPage     = lazy(() => import('@/modules/carwash/CarwashVehicleTypesPage').then(m => ({ default: m.CarwashVehicleTypesPage })));
const CarwashSetupPage            = lazy(() => import('@/modules/carwash/CarwashSetupPage').then(m => ({ default: m.CarwashSetupPage })));
const CarwashAttendancePage       = lazy(() => import('@/modules/carwash/CarwashAttendancePage').then(m => ({ default: m.CarwashAttendancePage })));
const CarwashStaffDetailPage      = lazy(() => import('@/modules/carwash/CarwashStaffDetailPage').then(m => ({ default: m.CarwashStaffDetailPage })));

// [clinic] [all tenants]


// [medical] [all tenants] — Pharmacy
const BatchManagerPage    = lazy(() => import('@/modules/pharmacy/BatchManagerPage').then(m => ({ default: m.BatchManagerPage })));
const PrescriptionsPage   = lazy(() => import('@/modules/pharmacy/PrescriptionsPage').then(m => ({ default: m.PrescriptionsPage })));
const PatientHistoryPage  = lazy(() => import('@/modules/pharmacy/PatientHistoryPage').then(m => ({ default: m.PatientHistoryPage })));
const ScheduleRegisterPage = lazy(() => import('@/modules/pharmacy/ScheduleRegisterPage').then(m => ({ default: m.ScheduleRegisterPage })));
const SupplierReturnsPage  = lazy(() => import('@/modules/pharmacy/SupplierReturnsPage').then(m => ({ default: m.SupplierReturnsPage })));
const SaltSearchPage       = lazy(() => import('@/modules/pharmacy/SaltSearchPage').then(m => ({ default: m.SaltSearchPage })));

// [repair] [all tenants]

// [drivingschool] [all tenants]

// [tailor] [all tenants]

// [hardware] [all tenants]
const HardwareDashboard  = lazy(() => import('@/modules/hardware/HardwareDashboard').then(m => ({ default: m.HardwareDashboard })));
const HardwarePOSPage    = lazy(() => import('@/modules/hardware/HardwarePOSPage').then(m => ({ default: m.HardwarePOSPage })));
const HardwareProductsPage = lazy(() => import('@/modules/hardware/HardwareProductsPage').then(m => ({ default: m.HardwareProductsPage })));
const HardwareCreditPage = lazy(() => import('@/modules/hardware/CreditAccountsPage').then(m => ({ default: m.CreditAccountsPage })));
const HardwareInventoryPage = lazy(() => import('@/modules/hardware/HardwareInventoryPage').then(m => ({ default: m.HardwareInventoryPage })));
const HardwareQuotationPage = lazy(() => import('@/modules/hardware/HardwareQuotationPage').then(m => ({ default: m.HardwareQuotationPage })));
const HardwareSetupPage  = lazy(() => import('@/modules/hardware/HardwareSetupPage').then(m => ({ default: m.HardwareSetupPage })));
const HardwareBroadcastPage = lazy(() => import('@/modules/hardware/HardwareBroadcastPage').then(m => ({ default: m.HardwareBroadcastPage })));
const HardwareReports    = lazy(() => import('@/modules/hardware/HardwareReportsPage').then(m => ({ default: m.HardwareReportsPage })));
const HardwareStaffPage       = lazy(() => import('@/modules/hardware/HardwareStaffPage').then(m => ({ default: m.HardwareStaffPage })));
const HardwareAttendancePage  = lazy(() => import('@/modules/hardware/HardwareAttendancePage').then(m => ({ default: m.HardwareAttendancePage })));
const HardwareStaffDetailPage = lazy(() => import('@/modules/hardware/HardwareStaffDetailPage').then(m => ({ default: m.HardwareStaffDetailPage })));

// [laundry] [all tenants]

// [catering] [all tenants]

// [pestcontrol] [all tenants]

// [clothing] [all tenants]

// [bakery] [all tenants]

// [optician] [all tenants]

// [petrolpump] [all tenants]

// [furniture] [all tenants]

// [printing] [all tenants]

// [hotel] [all tenants]

// [ca] [all tenants]

// [crm] [all tenants]
// [crm] [tenant: FrontStores.com] — Salesforce-style Accounts object

// [events] [all tenants]

// [travel] [all tenants]

// [insurance] [all tenants]

// [tyrescrap] [all tenants]

// [homeservice] [all tenants]

// [beauty] [all tenants]

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

  // [all apps] [all tenants] — start auto-sync once authenticated
  useEffect(() => {
    if (!isAuthenticated || !config?.tenant_id) return;
    import('@/lib/autoSync').then(({ initAutoSync }) => initAutoSync(config.tenant_id));
    return () => { import('@/lib/autoSync').then(({ stopAutoSync }) => stopAutoSync()); };
  }, [isAuthenticated, config?.tenant_id]);

  // [carwash] [all tenants] — Apply amber accent + Barlow font; dark/light follows user's theme toggle
  useEffect(() => {
    const el = document.documentElement;
    if (config?.shop_type === 'carwash') {
      el.classList.add('carwash-theme');
    } else {
      el.classList.remove('carwash-theme');
    }
  }, [config?.shop_type]);

  useEffect(() => {
    if (!isSetupComplete || !config?.tenant_id) return;
    // [core] [all tenants] — reset stale auth state immediately so we show Loading
    // instead of the wrong screen while the async check runs (e.g. after app switch)
    setAuthChecked(false);
    setAuthExists(false);
    const tenantId = config.tenant_id;
    hasAuth(tenantId).then(async exists => {
      setAuthExists(exists);
      // [all apps] [all tenants] — dev mode: skip login entirely (auto-login as owner).
      // Guarded by import.meta.env.DEV so production customers always see the login.
      if (import.meta.env.DEV) {
        sessionStorage.setItem('fs_logged_in_username', 'owner');
        setAuthenticated(true);
        setAuthChecked(true);
        return;
      }
      if (exists) {
        // [all apps] [all tenants] — only auto-resume a session on THIS device if it
        // previously logged in here (remembered per-tenant in localStorage, which
        // survives app restarts unlike sessionStorage). A device that has never
        // logged in for this tenant must always go through AppLoginScreen so it
        // claims its OWN username's slot — never the default 'owner' slot, which
        // would otherwise lock the real owner out on their next launch.
        const rememberedUsername = localStorage.getItem(`fs_remember_user_${tenantId}`);
        if (rememberedUsername) {
          const claim = await claimSession(tenantId, rememberedUsername);
          if (!claim.blocked) {
            if (claim.sessionId) sessionStorage.setItem('fs_session_id', claim.sessionId);
            sessionStorage.setItem('fs_logged_in_username', rememberedUsername);
            setAuthenticated(true);
          }
        }
      }
      setAuthChecked(true);
    });
  }, [isSetupComplete, config?.tenant_id]);

  // [all apps] [all tenants] — best-effort single-session enforcement: keep this
  // device's session alive while logged in, and release it on logout/app-switch
  // so another device can claim it without waiting for the TTL to expire.
  const sessionRef = useRef<{ tenantId: string; sessionId: string; username: string } | null>(null);
  useEffect(() => {
    if (isAuthenticated && config?.tenant_id) {
      const sessionId = sessionStorage.getItem('fs_session_id');
      const username = sessionStorage.getItem('fs_logged_in_username') || 'owner';
      if (sessionId) sessionRef.current = { tenantId: config.tenant_id, sessionId, username };
    } else if (!isAuthenticated && sessionRef.current) {
      const { tenantId, sessionId, username } = sessionRef.current;
      sessionRef.current = null;
      sessionStorage.removeItem('fs_session_id');
      sessionStorage.removeItem('fs_logged_in_username');
      localStorage.removeItem(`fs_remember_user_${tenantId}`);
      releaseSession(tenantId, sessionId, username);
    }
  }, [isAuthenticated, config?.tenant_id]);

  useEffect(() => {
    if (!isAuthenticated || !config?.tenant_id) return;
    const sessionId = sessionStorage.getItem('fs_session_id');
    if (!sessionId) return;
    const username = sessionStorage.getItem('fs_logged_in_username') || 'owner';
    const tenantId = config.tenant_id;
    const interval = setInterval(() => { heartbeatSession(tenantId, sessionId, username); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, config?.tenant_id]);

  if (isLoading) return <Loading />;
  if (!isSetupComplete) return <SetupWizard />;
  if (!authChecked) return <Loading />;
  // No password set yet (user upgraded from old version) — force password creation
  if (!authExists) return <CreatePasswordScreen onCreated={() => setAuthExists(true)} />;
  if (!isAuthenticated) return <AppLoginScreen />;

  return (
    <SubscriptionGate>
    <SyncAccessGate>
    <IdleTimerProvider />
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to={
              config?.shop_type === 'restaurant' ? '/restaurant/dashboard' :
              config?.shop_type === 'carwash'    ? '/carwash/dashboard' :
              config?.shop_type === 'hardware'     ? '/hardware/dashboard' :
              config?.shop_type === 'admin'        ? '/admin' : // [admin] [all tenants]
              '/dashboard'
            } replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="pos"        element={<POSPage />} />
            <Route path="products"   element={<ProductsPage />} />
            <Route path="inventory"  element={<InventoryPage />} />
            <Route path="orders"     element={<OrdersPage />} />
            <Route path="customers"  element={config?.shop_type === 'carwash' ? <PinLockGate settingKey="pin_lock_customers" label="Customers"><CustomersPage /></PinLockGate> : <CustomersPage />} />
            <Route path="khata"      element={<KhataPage />} />
            <Route path="expenses"   element={config?.shop_type === 'carwash' ? <PinLockGate settingKey="pin_lock_expenses" label="Expenses"><ExpensesPage /></PinLockGate> : <ExpensesPage />} />
            <Route path="suppliers"        element={<SuppliersPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="reports"    element={<ReportsPage />} />
            <Route path="settings"   element={<SettingsPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            {/* [admin] [all tenants] — FrontStores owner admin panel */}
            <Route path="admin" element={<AdminPage />} />
            {/* [medical] [all tenants] — Pharmacy */}
            <Route path="pharmacy/batches"  element={<BatchManagerPage />} />
            <Route path="pharmacy/rx"       element={<PrescriptionsPage />} />
            <Route path="pharmacy/patients" element={<PatientHistoryPage />} />
            <Route path="pharmacy/schedule" element={<ScheduleRegisterPage />} />
            <Route path="pharmacy/returns"  element={<SupplierReturnsPage />} />
            <Route path="pharmacy/salt"     element={<SaltSearchPage />} />

            {/* [grocery] [all tenants] */}

            {/* [carwash] [all tenants] */}
            <Route path="carwash/dashboard"  element={<PinLockGate settingKey="pin_lock_dashboard"    label="Dashboard">    <CarwashDashboard /></PinLockGate>} />
            <Route path="carwash/jobs"       element={<PinLockGate settingKey="pin_lock_jobs"         label="Job Cards">    <JobsListPage /></PinLockGate>} />
            <Route path="carwash/jobs/:id"   element={<JobCardPage />} />
            <Route path="carwash/services"      element={<PinLockGate settingKey="pin_lock_services"     label="Services">     <CarwashServicesPage /></PinLockGate>} />
            <Route path="carwash/reports"       element={<PinLockGate settingKey="pin_lock_reports"      label="Reports">      <CarwashReportsPage /></PinLockGate>} />
            <Route path="carwash/broadcast"     element={<PinLockGate settingKey="pin_lock_broadcast"    label="Broadcast">    <BroadcastPage /></PinLockGate>} />
            <Route path="carwash/appointments"  element={<PinLockGate settingKey="pin_lock_appointments" label="Appointments"> <CarwashAppointmentsPage /></PinLockGate>} />
            <Route path="carwash/inventory"     element={<PinLockGate settingKey="pin_lock_inventory"    label="Inventory">    <CarwashInventoryPage /></PinLockGate>} />
            <Route path="carwash/vehicle-types" element={<PinLockGate settingKey="pin_lock_vehicle_types" label="Vehicle Types"><CarwashVehicleTypesPage /></PinLockGate>} />
            <Route path="carwash/attendance"     element={<PinLockGate settingKey="pin_lock_attendance"   label="Attendance">   <CarwashAttendancePage /></PinLockGate>} />
            <Route path="carwash/staff/:staffId" element={<CarwashStaffDetailPage />} />
            <Route path="carwash/setup"         element={<PinLockGate settingKey="pin_lock_setup"        label="Setup">        <CarwashSetupPage /></PinLockGate>} />

            {/* [clinic] [all tenants] */}


            {/* [coaching] [all tenants] */}

            {/* [gym] [all tenants] */}

            {/* [jewellery] [all tenants] */}

            {/* [realestate] [all tenants] */}

            {/* [tailor] [all tenants] */}

            {/* [hardware] [all tenants] */}
            <Route path="hardware/dashboard" element={<HardwareDashboard />} />
            <Route path="hardware/pos"       element={<HardwarePOSPage />} />
            <Route path="hardware/products"  element={<HardwareProductsPage />} />
            <Route path="hardware/inventory" element={<HardwareInventoryPage />} />
            <Route path="hardware/credit"    element={<HardwareCreditPage />} />
            <Route path="hardware/quotations" element={<HardwareQuotationPage />} />
            <Route path="hardware/broadcast" element={<HardwareBroadcastPage />} />
            <Route path="hardware/setup"     element={<HardwareSetupPage />} />
            <Route path="hardware/reports"   element={<HardwareReports />} />
            <Route path="hardware/staff"          element={<HardwareStaffPage />} />
            <Route path="hardware/staff/:staffId" element={<HardwareStaffDetailPage />} />
            <Route path="hardware/attendance"     element={<HardwareAttendancePage />} />

            {/* [hotel] [all tenants] */}

            {/* [clothing] [all tenants] */}

            {/* [bakery] [all tenants] */}

            {/* [optician] [all tenants] */}

            {/* [beauty] [all tenants] */}

            {/* [laundry] [all tenants] */}

            {/* [ca] [all tenants] */}

            {/* [crm] [all tenants] */}
            {/* [crm] [tenant: FrontStores.com] — Salesforce-style Accounts object */}

            {/* [catering] [all tenants] */}

            {/* [pestcontrol] [all tenants] */}

            {/* [restaurant] [all tenants] */}
            <Route path="restaurant/dashboard" element={<RestaurantDashboard />} />
            <Route path="restaurant/tables"    element={<TablesPage />} />
            <Route path="restaurant/menu"      element={<MenuPage />} />
            <Route path="restaurant/kitchen"   element={<KitchenPage />} />
            <Route path="restaurant/orders"    element={<RestaurantOrdersPage />} />
            <Route path="restaurant/staff"     element={<StaffPage />} />
            <Route path="restaurant/reports"   element={<RestaurantReportsPage />} />

            {/* [repair] [all tenants] */}

            {/* [drivingschool] [all tenants] */}

            {/* [petrolpump] [all tenants] */}

            {/* [furniture] [all tenants] */}

            {/* [printing] [all tenants] */}

            {/* [tyrescrap] [all tenants] */}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
    </SyncAccessGate>
    </SubscriptionGate>
  );
}
