/**
 * Consolidated Admin Module Exports
 * Modularized for peak reliability, mobile responsiveness, and maintainability.
 */

export * from './adminShared';
export { OwnerDataExports } from './modules/DataExportsModule';
export { OwnerNotifications } from './modules/NotificationsModule';
export { OwnerProducts } from './modules/ProductsModule';
export { OwnerPaymentMethods } from './modules/PaymentMethodsModule';
export { OwnerAcademic } from './modules/AcademicModule';
export { OwnerEntitlements } from './modules/EntitlementsModule';
export { OwnerStudents } from './modules/StudentsModule';
export { OwnerPayments } from './modules/PaymentsModule';
export { OwnerSupport } from './modules/SupportModule';
export { OwnerFinancials } from './modules/FinancialsModule';
export { OwnerDashboard } from './modules/DashboardModule';
export { OwnerAnalytics } from './modules/AnalyticsModule';
export { OwnerOperations } from './modules/OperationsModule';
export {
  OwnerHealth,
  OwnerMaintenance,
  OwnerSecurity,
  OwnerAdministrators,
  OwnerComplimentary,
  OwnerFreeRuns,
  OwnerSettings
} from './modules/SystemAdminModules';
