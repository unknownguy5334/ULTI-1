import React, { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { isAdminUser } from './types/auth';
import { AdminLayout } from './components/admin/AdminLayout';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { AdminAuditLog } from './components/admin/AdminAuditLog';
import {
  OwnerDashboard, OwnerAnalytics, OwnerStudents, OwnerProducts, OwnerPaymentMethods, OwnerNotifications, OwnerSupport,
  OwnerOperations, OwnerHealth, OwnerMaintenance, OwnerSecurity, OwnerAdministrators, OwnerFinancials, OwnerAcademic, OwnerEntitlements,
  OwnerFreeRuns, OwnerSettings, OwnerDataExports, OwnerPayments, OwnerComplimentary,
} from './components/admin/AdminOwnerModules';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  LogOut, 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle,
  X
} from 'lucide-react';

const ADMIN_TABS = new Set([
  'dashboard', 'analytics', 'audit', 'payments', 'students', 'support', 'notifications',
  'products', 'financials', 'schedules', 'ocr', 'free-runs', 'health', 'maintenance',
  'security', 'admins', 'complimentary', 'settings', 'payment-methods', 'academic',
  'entitlements', 'data',
]);

function readAdminTabFromUrl(): string {
  const candidate = new URLSearchParams(window.location.search).get('tab');
  return candidate && ADMIN_TABS.has(candidate) ? candidate : 'dashboard';
}

export function AdminApp() {
  const { user, status, login, logout } = useAuth();
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTabState] = useState<string>(() => readAdminTabFromUrl());
  const setActiveTab = (candidate: string) => {
    const next = ADMIN_TABS.has(candidate) ? candidate : 'dashboard';
    if (next === activeTab) return;
    setActiveTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.pushState({ adminTab: next }, '', `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    const syncTabFromHistory = () => setActiveTabState(readAdminTabFromUrl());
    window.addEventListener('popstate', syncTabFromHistory);
    // Normalize the initial admin location without adding a redundant history entry.
    const url = new URL(window.location.href);
    if (!url.searchParams.has('tab') || !ADMIN_TABS.has(url.searchParams.get('tab') || '')) {
      url.searchParams.set('tab', readAdminTabFromUrl());
      window.history.replaceState({ adminTab: 'dashboard' }, '', `${url.pathname}${url.search}${url.hash}`);
    }
    return () => window.removeEventListener('popstate', syncTabFromHistory);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const result = await login({ email: loginEmail.trim(), password: loginPassword });
      if (!result.ok) setLoginError(result.error || 'Invalid credentials.');
      else { setLoginPassword(''); setLoginEmail(''); }
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 1. Loading State
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center text-ink space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-text-secondary font-medium">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State -> Show Admin Sign In Form
  if (status === 'unauthenticated' || !user) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white border border-line rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-700">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">Gadwal Administrator</h1>
            <p className="text-sm text-text-secondary">Sign in with your verified MIU administrator credentials</p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3.5 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-700" />
              <span>{loginError}</span>
            </div>
          )}

          <div className="space-y-4">
            <GoogleSignInButton
              text="Continue with Admin Google Account"
              onError={(msg) => setLoginError(msg)}
            />

            <div className="relative flex items-center justify-center">
              <div className="border-t border-line w-full" />
              <span className="bg-white px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Or password
              </span>
              <div className="border-t border-line w-full" />
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@miuegypt.edu.eg"
                className="w-full min-h-[44px] bg-mist border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] bg-mist border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Access Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-ink transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Gadwal Student App</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated as Non-Admin Student -> Access Denied
  if (!isAdminUser(user)) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white border border-line rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto text-red-700">
            <XCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-ink tracking-tight">Access Restricted</h1>
            <p className="text-sm text-text-secondary">
              The account <strong className="text-ink">{user.email}</strong> does not have administrator privileges.
            </p>
          </div>
          <div className="p-4 bg-mist/60 rounded-xl text-xs text-text-secondary text-left space-y-1">
            <p>• Admin authorization is strictly enforced on the server.</p>
            <p>• If you believe this is in error, contact the system administrator.</p>
          </div>
          <div className="space-y-2.5 pt-2">
            <a
              href="/"
              className="w-full bg-mist hover:bg-line text-ink font-medium py-2.5 px-4 rounded-xl transition inline-flex items-center justify-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Student App</span>
            </a>
            <button
              onClick={() => logout()}
              className="w-full border border-line hover:bg-mist text-text-secondary font-medium py-2.5 px-4 rounded-xl transition inline-flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated administrator console. Each module enforces the same role boundary on the server.
  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <OwnerDashboard onNavigate={(tab: string) => setActiveTab(tab)} />}
      {activeTab === 'analytics' && <OwnerAnalytics />}
      {activeTab === 'audit' && <AdminAuditLog />}
      {activeTab === 'payments' && <OwnerPayments />}
      {activeTab === 'students' && <OwnerStudents />}
      {activeTab === 'support' && <OwnerSupport />}
      {activeTab === 'notifications' && <OwnerNotifications />}
      {activeTab === 'products' && <OwnerProducts />}
      {activeTab === 'financials' && <OwnerFinancials />}
      {activeTab === 'schedules' && <OwnerOperations kind="schedules" />}
      {activeTab === 'ocr' && <OwnerOperations kind="ocr" />}
      {activeTab === 'free-runs' && <OwnerFreeRuns />}
      {activeTab === 'health' && <OwnerHealth />}
      {activeTab === 'maintenance' && <OwnerMaintenance />}
      {activeTab === 'security' && <OwnerSecurity />}
      {activeTab === 'admins' && <OwnerAdministrators />}
      {activeTab === 'complimentary' && <OwnerComplimentary />}
      {activeTab === 'settings' && <OwnerSettings />}
      {activeTab === 'payment-methods' && <OwnerPaymentMethods />}
      {activeTab === 'academic' && <OwnerAcademic />}
      {activeTab === 'entitlements' && <OwnerEntitlements />}
      {activeTab === 'data' && <OwnerDataExports />}
    </AdminLayout>
  );
}