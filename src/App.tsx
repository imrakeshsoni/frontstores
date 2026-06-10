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
const CarwashReportsPage      = lazy(() => import('@/modules/carwash/CarwashReportsPage').then(m => ({ default: m.CarwashReportsPage })));
const BroadcastPage           = lazy(() => import('@/modules/carwash/BroadcastPage').then(m => ({ default: m.BroadcastPage })));
const CarwashAppointmentsPage = lazy(() => import('@/modules/carwash/CarwashAppointmentsPage').then(m => ({ default: m.CarwashAppointmentsPage })));
const CarwashInventoryPage        = lazy(() => import('@/modules/carwash/CarwashInventoryPage').then(m => ({ default: m.CarwashInventoryPage })));
const CarwashVehicleTypesPage     = lazy(() => import('@/modules/carwash/CarwashVehicleTypesPage').then(m => ({ default: m.CarwashVehicleTypesPage })));
const CarwashSetupPage            = lazy(() => import('@/modules/carwash/CarwashSetupPage').then(m => ({ default: m.CarwashSetupPage })));
const CarwashAttendancePage       = lazy(() => import('@/modules/carwash/CarwashAttendancePage').then(m => ({ default: m.CarwashAttendancePage })));
const CarwashStaffDetailPage      = lazy(() => import('@/modules/carwash/CarwashStaffDetailPage').then(m => ({ default: m.CarwashStaffDetailPage })));

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

// [medical] [all tenants] — Pharmacy
const BatchManagerPage    = lazy(() => import('@/modules/pharmacy/BatchManagerPage').then(m => ({ default: m.BatchManagerPage })));
const PrescriptionsPage   = lazy(() => import('@/modules/pharmacy/PrescriptionsPage').then(m => ({ default: m.PrescriptionsPage })));
const PatientHistoryPage  = lazy(() => import('@/modules/pharmacy/PatientHistoryPage').then(m => ({ default: m.PatientHistoryPage })));
const ScheduleRegisterPage = lazy(() => import('@/modules/pharmacy/ScheduleRegisterPage').then(m => ({ default: m.ScheduleRegisterPage })));
const SupplierReturnsPage  = lazy(() => import('@/modules/pharmacy/SupplierReturnsPage').then(m => ({ default: m.SupplierReturnsPage })));
const SaltSearchPage       = lazy(() => import('@/modules/pharmacy/SaltSearchPage').then(m => ({ default: m.SaltSearchPage })));

// [repair] [all tenants]
const RepairDashboard      = lazy(() => import('@/modules/repair/RepairDashboard').then(m => ({ default: m.RepairDashboard })));
const RepairJobsPage       = lazy(() => import('@/modules/repair/JobsPage').then(m => ({ default: m.JobsPage })));
const RepairNewJobPage     = lazy(() => import('@/modules/repair/NewJobPage').then(m => ({ default: m.NewJobPage })));
const RepairJobDetailPage  = lazy(() => import('@/modules/repair/JobDetailPage').then(m => ({ default: m.JobDetailPage })));
const RepairPartsPage      = lazy(() => import('@/modules/repair/PartsInventoryPage').then(m => ({ default: m.PartsInventoryPage })));
const RepairReportsPage    = lazy(() => import('@/modules/repair/RepairReportsPage').then(m => ({ default: m.RepairReportsPage })));

// [drivingschool] [all tenants]
const DrivingDashboard      = lazy(() => import('@/modules/drivingschool/DrivingDashboard').then(m => ({ default: m.DrivingDashboard })));
const DSStudentsPage        = lazy(() => import('@/modules/drivingschool/StudentsPage').then(m => ({ default: m.StudentsPage })));
const DSNewStudentPage      = lazy(() => import('@/modules/drivingschool/NewStudentPage').then(m => ({ default: m.NewStudentPage })));
const DSStudentDetailPage   = lazy(() => import('@/modules/drivingschool/StudentDetailPage').then(m => ({ default: m.StudentDetailPage })));
const DSSessionsPage        = lazy(() => import('@/modules/drivingschool/SessionsPage').then(m => ({ default: m.SessionsPage })));
const DSVehiclesPage        = lazy(() => import('@/modules/drivingschool/VehiclesPage').then(m => ({ default: m.VehiclesPage })));
const DSInstructorsPage     = lazy(() => import('@/modules/drivingschool/InstructorsPage').then(m => ({ default: m.InstructorsPage })));
const DSDrivingReportsPage  = lazy(() => import('@/modules/drivingschool/DrivingReportsPage').then(m => ({ default: m.DrivingReportsPage })));

// [tailor] [all tenants]
const TailorDashboard    = lazy(() => import('@/modules/tailor/TailorDashboard').then(m => ({ default: m.TailorDashboard })));
const TailorOrdersPage   = lazy(() => import('@/modules/tailor/TailorOrdersPage').then(m => ({ default: m.TailorOrdersPage })));
const TailorNewOrderPage = lazy(() => import('@/modules/tailor/NewOrderPage').then(m => ({ default: m.NewOrderPage })));
const TailorMeasurements = lazy(() => import('@/modules/tailor/MeasurementsPage').then(m => ({ default: m.MeasurementsPage })));
const TailorReports      = lazy(() => import('@/modules/tailor/TailorReportsPage').then(m => ({ default: m.TailorReportsPage })));

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
const LaundryDashboard   = lazy(() => import('@/modules/laundry/LaundryDashboard').then(m => ({ default: m.LaundryDashboard })));
const LaundryOrdersPage  = lazy(() => import('@/modules/laundry/LaundryOrdersPage').then(m => ({ default: m.LaundryOrdersPage })));
const LaundryNewOrderPage = lazy(() => import('@/modules/laundry/LaundryNewOrderPage').then(m => ({ default: m.LaundryNewOrderPage })));
const LaundryServicesPage = lazy(() => import('@/modules/laundry/LaundryServicesPage').then(m => ({ default: m.LaundryServicesPage })));
const LaundryReports     = lazy(() => import('@/modules/laundry/LaundryReportsPage').then(m => ({ default: m.LaundryReportsPage })));

// [catering] [all tenants]
const CateringDashboard  = lazy(() => import('@/modules/catering/CateringDashboard').then(m => ({ default: m.CateringDashboard })));
const CateringEventsPage = lazy(() => import('@/modules/catering/CateringEventsPage').then(m => ({ default: m.CateringEventsPage })));
const CateringNewEventPage = lazy(() => import('@/modules/catering/CateringNewEventPage').then(m => ({ default: m.CateringNewEventPage })));
const CateringMenuPage   = lazy(() => import('@/modules/catering/CateringMenuPage').then(m => ({ default: m.CateringMenuPage })));
const CateringReports    = lazy(() => import('@/modules/catering/CateringReportsPage').then(m => ({ default: m.CateringReportsPage })));

// [pestcontrol] [all tenants]
const PestDashboard      = lazy(() => import('@/modules/pestcontrol/PestDashboard').then(m => ({ default: m.PestDashboard })));
const PCJobsPage         = lazy(() => import('@/modules/pestcontrol/PCJobsPage').then(m => ({ default: m.PCJobsPage })));
const PCNewJobPage       = lazy(() => import('@/modules/pestcontrol/PCNewJobPage').then(m => ({ default: m.PCNewJobPage })));
const PCCustomersPage    = lazy(() => import('@/modules/pestcontrol/PCCustomersPage').then(m => ({ default: m.PCCustomersPage })));
const PCContractsPage    = lazy(() => import('@/modules/pestcontrol/PCContractsPage').then(m => ({ default: m.PCContractsPage })));
const PCReportsPage      = lazy(() => import('@/modules/pestcontrol/PCReportsPage').then(m => ({ default: m.PCReportsPage })));

// [clothing] [all tenants]
const ClothingDashboard  = lazy(() => import('@/modules/clothing/ClothingDashboard').then(m => ({ default: m.ClothingDashboard })));
const ClothingPOSPage    = lazy(() => import('@/modules/clothing/ClothingPOSPage').then(m => ({ default: m.ClothingPOSPage })));
const ClothingProductsPage = lazy(() => import('@/modules/clothing/ClothingProductsPage').then(m => ({ default: m.ClothingProductsPage })));
const ClothingExchangesPage = lazy(() => import('@/modules/clothing/ExchangesPage').then(m => ({ default: m.ExchangesPage })));
const ClothingReports    = lazy(() => import('@/modules/clothing/ClothingReportsPage').then(m => ({ default: m.ClothingReportsPage })));

// [bakery] [all tenants]
const BakeryDashboard    = lazy(() => import('@/modules/bakery/BakeryDashboard').then(m => ({ default: m.BakeryDashboard })));
const BakeryPOSPage      = lazy(() => import('@/modules/bakery/BakeryPOSPage').then(m => ({ default: m.BakeryPOSPage })));
const BakeryProductionPage = lazy(() => import('@/modules/bakery/ProductionPage').then(m => ({ default: m.ProductionPage })));
const BakeryBulkOrdersPage = lazy(() => import('@/modules/bakery/BulkOrdersPage').then(m => ({ default: m.BulkOrdersPage })));
const BakeryReports      = lazy(() => import('@/modules/bakery/BakeryReportsPage').then(m => ({ default: m.BakeryReportsPage })));

// [optician] [all tenants]
const OpticianDashboard  = lazy(() => import('@/modules/optician/OpticianDashboard').then(m => ({ default: m.OpticianDashboard })));
const OpticianPatientsPage = lazy(() => import('@/modules/optician/PatientsPage').then(m => ({ default: m.PatientsPage })));
const OpticianRxPage     = lazy(() => import('@/modules/optician/PrescriptionPage').then(m => ({ default: m.PrescriptionPage })));
const OpticianOrdersPage = lazy(() => import('@/modules/optician/OrdersPage').then(m => ({ default: m.OrdersPage })));
const OpticianInventoryPage = lazy(() => import('@/modules/optician/InventoryPage').then(m => ({ default: m.InventoryPage })));
const OpticianReports    = lazy(() => import('@/modules/optician/OpticianReportsPage').then(m => ({ default: m.OpticianReportsPage })));

// [petrolpump] [all tenants]
const PetrolDashboard    = lazy(() => import('@/modules/petrolpump/PetrolDashboard').then(m => ({ default: m.PetrolDashboard })));
const ShiftPage          = lazy(() => import('@/modules/petrolpump/ShiftPage').then(m => ({ default: m.ShiftPage })));
const FuelRatesPage      = lazy(() => import('@/modules/petrolpump/FuelRatesPage').then(m => ({ default: m.FuelRatesPage })));
const PPCreditAccountsPage = lazy(() => import('@/modules/petrolpump/CreditAccountsPage').then(m => ({ default: m.CreditAccountsPage })));
const PetrolReports      = lazy(() => import('@/modules/petrolpump/PetrolReportsPage').then(m => ({ default: m.PetrolReportsPage })));

// [furniture] [all tenants]
const FurnitureDashboard  = lazy(() => import('@/modules/furniture/FurnitureDashboard').then(m => ({ default: m.FurnitureDashboard })));
const FurnitureOrdersPage = lazy(() => import('@/modules/furniture/OrdersPage').then(m => ({ default: m.OrdersPage })));
const FurnitureNewOrderPage = lazy(() => import('@/modules/furniture/NewOrderPage').then(m => ({ default: m.NewOrderPage })));
const FurnitureCustomOrdersPage = lazy(() => import('@/modules/furniture/CustomOrdersPage').then(m => ({ default: m.CustomOrdersPage })));
const FurnitureProductsPage = lazy(() => import('@/modules/furniture/FurnitureProductsPage').then(m => ({ default: m.FurnitureProductsPage })));
const FurnitureReports    = lazy(() => import('@/modules/furniture/FurnitureReportsPage').then(m => ({ default: m.FurnitureReportsPage })));

// [printing] [all tenants]
const PrintingDashboard  = lazy(() => import('@/modules/printing/PrintingDashboard').then(m => ({ default: m.PrintingDashboard })));
const PrintingJobsPage   = lazy(() => import('@/modules/printing/JobsPage').then(m => ({ default: m.JobsPage })));
const PrintingNewJobPage = lazy(() => import('@/modules/printing/NewJobPage').then(m => ({ default: m.NewJobPage })));
const PrintingStationeryPage = lazy(() => import('@/modules/printing/StationeryPage').then(m => ({ default: m.StationeryPage })));
const PrintingReports    = lazy(() => import('@/modules/printing/PrintingReportsPage').then(m => ({ default: m.PrintingReportsPage })));

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
const CADashboard             = lazy(() => import('@/modules/ca/CADashboard').then(m => ({ default: m.CADashboard })));
const CAClientsPage           = lazy(() => import('@/modules/ca/ClientsPage').then(m => ({ default: m.CAClientsPage })));
const CATasksPage             = lazy(() => import('@/modules/ca/TasksPage').then(m => ({ default: m.CATasksPage })));
const CADocumentsPage         = lazy(() => import('@/modules/ca/DocumentsPage').then(m => ({ default: m.CADocumentsPage })));
const CAReportsPage           = lazy(() => import('@/modules/ca/CAReportsPage').then(m => ({ default: m.CAReportsPage })));
const CAInvoicesPage          = lazy(() => import('@/modules/ca/InvoicesPage').then(m => ({ default: m.CAInvoicesPage })));
const CAComplianceCalendarPage = lazy(() => import('@/modules/ca/ComplianceCalendarPage').then(m => ({ default: m.CAComplianceCalendarPage })));
const CAStaffPage             = lazy(() => import('@/modules/ca/StaffPage').then(m => ({ default: m.CAStaffPage })));

// [crm] [all tenants]
const CRMDashboard            = lazy(() => import('@/modules/crm/CRMDashboard').then(m => ({ default: m.CRMDashboard })));
const CRMLeadsPage            = lazy(() => import('@/modules/crm/LeadsPage').then(m => ({ default: m.CRMLeadsPage })));
const CRMContactsPage         = lazy(() => import('@/modules/crm/ContactsPage').then(m => ({ default: m.CRMContactsPage })));
const CRMPipelinePage         = lazy(() => import('@/modules/crm/PipelinePage').then(m => ({ default: m.CRMPipelinePage })));
const CRMFollowUpsPage        = lazy(() => import('@/modules/crm/FollowUpsPage').then(m => ({ default: m.CRMFollowUpsPage })));
const CRMCommunicationLogPage = lazy(() => import('@/modules/crm/CommunicationLogPage').then(m => ({ default: m.CRMCommunicationLogPage })));
const CRMWhatsAppInboxPage    = lazy(() => import('@/modules/crm/WhatsAppInboxPage').then(m => ({ default: m.WhatsAppInboxPage })));
const CRMCommissionsPage      = lazy(() => import('@/modules/crm/CommissionsPage').then(m => ({ default: m.CommissionsPage })));
const CRMTeamPage             = lazy(() => import('@/modules/crm/TeamPage').then(m => ({ default: m.TeamPage })));

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

// [tyrescrap] [all tenants]
const TyreScrapDashboard = lazy(() => import('@/modules/tyrescrap/TyreScrapDashboard').then(m => ({ default: m.TyreScrapDashboard })));
const TyrePurchasePage   = lazy(() => import('@/modules/tyrescrap/TyrePurchasePage').then(m => ({ default: m.TyrePurchasePage })));
const TyreSalesPage      = lazy(() => import('@/modules/tyrescrap/TyreSalesPage').then(m => ({ default: m.TyreSalesPage })));
const TyreStockPage      = lazy(() => import('@/modules/tyrescrap/TyreStockPage').then(m => ({ default: m.TyreStockPage })));
const TyreVendorsPage    = lazy(() => import('@/modules/tyrescrap/TyreVendorsPage').then(m => ({ default: m.TyreVendorsPage })));
const TyreBuyersPage     = lazy(() => import('@/modules/tyrescrap/TyreBuyersPage').then(m => ({ default: m.TyreBuyersPage })));
const TyreExpensesPage   = lazy(() => import('@/modules/tyrescrap/TyreExpensesPage').then(m => ({ default: m.TyreExpensesPage })));
const TyreReportsPage    = lazy(() => import('@/modules/tyrescrap/TyreReportsPage').then(m => ({ default: m.TyreReportsPage })));

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
      // [all apps] [all tenants] — dev mode: skip login entirely
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
              config?.shop_type === 'grocery'    ? '/grocery/dashboard' :
              config?.shop_type === 'carwash'    ? '/carwash/dashboard' :
              config?.shop_type === 'clinic'     ? '/clinic/dashboard' :
              config?.shop_type === 'beauty'     ? '/beauty/dashboard' :
              config?.shop_type === 'study'      ? '/study/dashboard' :
              config?.shop_type === 'coaching'   ? '/coaching/dashboard' :
              config?.shop_type === 'gym'        ? '/gym/dashboard' :
              config?.shop_type === 'jewellery'   ? '/jewellery/dashboard' :
              config?.shop_type === 'realestate'  ? '/realestate/dashboard' :
              config?.shop_type === 'hotel'        ? '/hotel/dashboard' : // [hotel] [all tenants]
              config?.shop_type === 'repair'       ? '/repair/dashboard' :
              config?.shop_type === 'drivingschool'? '/drivingschool/dashboard' :
              config?.shop_type === 'tailor'       ? '/tailor/dashboard' :
              config?.shop_type === 'hardware'     ? '/hardware/dashboard' :
              config?.shop_type === 'laundry'      ? '/laundry/dashboard' :
              config?.shop_type === 'catering'     ? '/catering/dashboard' :
              config?.shop_type === 'pestcontrol'  ? '/pestcontrol/dashboard' :
              config?.shop_type === 'clothing'     ? '/clothing/dashboard' :
              config?.shop_type === 'bakery'       ? '/bakery/dashboard' :
              config?.shop_type === 'optician'     ? '/optician/dashboard' :
              config?.shop_type === 'petrolpump'   ? '/petrolpump/dashboard' :
              config?.shop_type === 'furniture'    ? '/furniture/dashboard' :
              config?.shop_type === 'printing'     ? '/printing/dashboard' :
              config?.shop_type === 'ca'           ? '/ca/dashboard' :
              config?.shop_type === 'crm'          ? '/crm/dashboard' :
              config?.shop_type === 'events'       ? '/events/dashboard' :
              config?.shop_type === 'travel'       ? '/travel/dashboard' :
              config?.shop_type === 'insurance'    ? '/insurance/dashboard' :
              config?.shop_type === 'homeservice'  ? '/homeservice/dashboard' :
              config?.shop_type === 'tyrescrap'    ? '/tyrescrap/dashboard' : // [tyrescrap] [all tenants]
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
            {/* [medical] [all tenants] — Pharmacy */}
            <Route path="pharmacy/batches"  element={<BatchManagerPage />} />
            <Route path="pharmacy/rx"       element={<PrescriptionsPage />} />
            <Route path="pharmacy/patients" element={<PatientHistoryPage />} />
            <Route path="pharmacy/schedule" element={<ScheduleRegisterPage />} />
            <Route path="pharmacy/returns"  element={<SupplierReturnsPage />} />
            <Route path="pharmacy/salt"     element={<SaltSearchPage />} />

            {/* [grocery] [all tenants] */}
            <Route path="grocery/dashboard" element={<GroceryDashboard />} />
            <Route path="grocery/cash"      element={<CashDrawerPage />} />
            <Route path="grocery/purchase"  element={<PurchasePage />} />

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

            {/* [tailor] [all tenants] */}
            <Route path="tailor/dashboard"    element={<TailorDashboard />} />
            <Route path="tailor/orders"       element={<TailorOrdersPage />} />
            <Route path="tailor/orders/new"   element={<TailorNewOrderPage />} />
            <Route path="tailor/measurements" element={<TailorMeasurements />} />
            <Route path="tailor/reports"      element={<TailorReports />} />

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

            {/* [clothing] [all tenants] */}
            <Route path="clothing/dashboard" element={<ClothingDashboard />} />
            <Route path="clothing/billing"   element={<ClothingPOSPage />} />
            <Route path="clothing/products"  element={<ClothingProductsPage />} />
            <Route path="clothing/exchanges" element={<ClothingExchangesPage />} />
            <Route path="clothing/reports"   element={<ClothingReports />} />

            {/* [bakery] [all tenants] */}
            <Route path="bakery/dashboard"   element={<BakeryDashboard />} />
            <Route path="bakery/billing"     element={<BakeryPOSPage />} />
            <Route path="bakery/production"  element={<BakeryProductionPage />} />
            <Route path="bakery/bulk-orders" element={<BakeryBulkOrdersPage />} />
            <Route path="bakery/reports"     element={<BakeryReports />} />

            {/* [optician] [all tenants] */}
            <Route path="optician/dashboard"     element={<OpticianDashboard />} />
            <Route path="optician/patients"      element={<OpticianPatientsPage />} />
            <Route path="optician/prescriptions" element={<OpticianRxPage />} />
            <Route path="optician/orders"        element={<OpticianOrdersPage />} />
            <Route path="optician/inventory"     element={<OpticianInventoryPage />} />
            <Route path="optician/reports"       element={<OpticianReports />} />

            {/* [beauty] [all tenants] */}
            <Route path="beauty/dashboard"              element={<BeautyDashboard />} />
            <Route path="beauty/services"               element={<BeautyServicesPage />} />
            <Route path="beauty/appointments"           element={<BeautyAppointmentListPage />} />
            <Route path="beauty/appointments/new"       element={<BeautyNewAppointmentPage />} />
            <Route path="beauty/appointments/:id"       element={<BeautyAppointmentDetailPage />} />
            <Route path="beauty/staff"                  element={<BeautyStaffPage />} />
            <Route path="beauty/memberships"            element={<BeautyMembershipsPage />} />
            <Route path="beauty/reports"                element={<BeautyReportsPage />} />

            {/* [laundry] [all tenants] */}
            <Route path="laundry/dashboard"  element={<LaundryDashboard />} />
            <Route path="laundry/orders"     element={<LaundryOrdersPage />} />
            <Route path="laundry/orders/new" element={<LaundryNewOrderPage />} />
            <Route path="laundry/services"   element={<LaundryServicesPage />} />
            <Route path="laundry/reports"    element={<LaundryReports />} />

            {/* [ca] [all tenants] */}
            <Route path="ca/dashboard"   element={<CADashboard />} />
            <Route path="ca/clients"     element={<CAClientsPage />} />
            <Route path="ca/tasks"       element={<CATasksPage />} />
            <Route path="ca/documents"   element={<CADocumentsPage />} />
            <Route path="ca/invoices"    element={<CAInvoicesPage />} />
            <Route path="ca/compliance"  element={<CAComplianceCalendarPage />} />
            <Route path="ca/staff"       element={<CAStaffPage />} />
            <Route path="ca/reports"     element={<CAReportsPage />} />

            {/* [crm] [all tenants] */}
            <Route path="crm/dashboard"      element={<CRMDashboard />} />
            <Route path="crm/leads"          element={<CRMLeadsPage />} />
            <Route path="crm/wa-inbox"       element={<CRMWhatsAppInboxPage />} />
            <Route path="crm/contacts"       element={<CRMContactsPage />} />
            <Route path="crm/pipeline"       element={<CRMPipelinePage />} />
            <Route path="crm/followups"      element={<CRMFollowUpsPage />} />
            <Route path="crm/communications" element={<CRMCommunicationLogPage />} />
            <Route path="crm/commissions"    element={<CRMCommissionsPage />} />
            <Route path="crm/team"           element={<CRMTeamPage />} />

            {/* [catering] [all tenants] */}
            <Route path="catering/dashboard"    element={<CateringDashboard />} />
            <Route path="catering/events"       element={<CateringEventsPage />} />
            <Route path="catering/events/new"   element={<CateringNewEventPage />} />
            <Route path="catering/menu"         element={<CateringMenuPage />} />
            <Route path="catering/reports"      element={<CateringReports />} />

            {/* [pestcontrol] [all tenants] */}
            <Route path="pestcontrol/dashboard"  element={<PestDashboard />} />
            <Route path="pestcontrol/jobs"       element={<PCJobsPage />} />
            <Route path="pestcontrol/jobs/new"   element={<PCNewJobPage />} />
            <Route path="pestcontrol/customers"  element={<PCCustomersPage />} />
            <Route path="pestcontrol/contracts"  element={<PCContractsPage />} />
            <Route path="pestcontrol/reports"    element={<PCReportsPage />} />

            {/* [restaurant] [all tenants] */}
            <Route path="restaurant/dashboard" element={<RestaurantDashboard />} />
            <Route path="restaurant/tables"    element={<TablesPage />} />
            <Route path="restaurant/menu"      element={<MenuPage />} />
            <Route path="restaurant/kitchen"   element={<KitchenPage />} />
            <Route path="restaurant/orders"    element={<RestaurantOrdersPage />} />
            <Route path="restaurant/staff"     element={<StaffPage />} />
            <Route path="restaurant/reports"   element={<RestaurantReportsPage />} />

            {/* [repair] [all tenants] */}
            <Route path="repair/dashboard" element={<RepairDashboard />} />
            <Route path="repair/jobs"      element={<RepairJobsPage />} />
            <Route path="repair/jobs/new"  element={<RepairNewJobPage />} />
            <Route path="repair/jobs/:id"  element={<RepairJobDetailPage />} />
            <Route path="repair/parts"     element={<RepairPartsPage />} />
            <Route path="repair/reports"   element={<RepairReportsPage />} />

            {/* [drivingschool] [all tenants] */}
            <Route path="drivingschool/dashboard"      element={<DrivingDashboard />} />
            <Route path="drivingschool/students"       element={<DSStudentsPage />} />
            <Route path="drivingschool/students/new"   element={<DSNewStudentPage />} />
            <Route path="drivingschool/students/:id"   element={<DSStudentDetailPage />} />
            <Route path="drivingschool/sessions"       element={<DSSessionsPage />} />
            <Route path="drivingschool/vehicles"       element={<DSVehiclesPage />} />
            <Route path="drivingschool/instructors"    element={<DSInstructorsPage />} />
            <Route path="drivingschool/reports"        element={<DSDrivingReportsPage />} />

            {/* [petrolpump] [all tenants] */}
            <Route path="petrolpump/dashboard" element={<PetrolDashboard />} />
            <Route path="petrolpump/shift"     element={<ShiftPage />} />
            <Route path="petrolpump/rates"     element={<FuelRatesPage />} />
            <Route path="petrolpump/credit"    element={<PPCreditAccountsPage />} />
            <Route path="petrolpump/reports"   element={<PetrolReports />} />

            {/* [furniture] [all tenants] */}
            <Route path="furniture/dashboard"      element={<FurnitureDashboard />} />
            <Route path="furniture/orders"         element={<FurnitureOrdersPage />} />
            <Route path="furniture/orders/new"     element={<FurnitureNewOrderPage />} />
            <Route path="furniture/custom-orders"  element={<FurnitureCustomOrdersPage />} />
            <Route path="furniture/products"       element={<FurnitureProductsPage />} />
            <Route path="furniture/reports"        element={<FurnitureReports />} />

            {/* [printing] [all tenants] */}
            <Route path="printing/dashboard" element={<PrintingDashboard />} />
            <Route path="printing/jobs"      element={<PrintingJobsPage />} />
            <Route path="printing/jobs/new"  element={<PrintingNewJobPage />} />
            <Route path="printing/stationery" element={<PrintingStationeryPage />} />
            <Route path="printing/reports"   element={<PrintingReports />} />

            {/* [tyrescrap] [all tenants] */}
            <Route path="tyrescrap/dashboard" element={<TyreScrapDashboard />} />
            <Route path="tyrescrap/purchase"  element={<TyrePurchasePage />} />
            <Route path="tyrescrap/sales"     element={<TyreSalesPage />} />
            <Route path="tyrescrap/stock"     element={<TyreStockPage />} />
            <Route path="tyrescrap/vendors"   element={<TyreVendorsPage />} />
            <Route path="tyrescrap/buyers"    element={<TyreBuyersPage />} />
            <Route path="tyrescrap/expenses"  element={<TyreExpensesPage />} />
            <Route path="tyrescrap/reports"   element={<TyreReportsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
    </SyncAccessGate>
    </SubscriptionGate>
  );
}
