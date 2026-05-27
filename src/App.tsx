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
