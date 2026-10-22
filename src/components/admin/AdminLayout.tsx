import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, BarChart3, Users, CreditCard, Box, Settings, Bell,
  LifeBuoy, FileText, Database, Shield, Monitor, Activity, CalendarDays,
  PowerSquare, Package, Menu, X, Key, Download, Gift, ArrowLeft, LogOut,
  ChevronRight, Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminRole } from '../../types/auth';

const groups = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'ADMIN', 'FINANCE', 'SUPPORT'] },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['OWNER', 'ADMIN', 'FINANCE'] },
      { id: 'financials', label: 'Financial reports', icon: FileText, roles: ['OWNER', 'ADMIN', 'FINANCE'] },
    ],
  },
  {
    title: 'Students',
    items: [
      { id: 'students', label: 'Student directory', icon: Users, roles: ['OWNER', 'ADMIN', 'SUPPORT'] },
      { id: 'support', label: 'Support desk', icon: LifeBuoy, roles: ['OWNER', 'ADMIN', 'SUPPORT'] },
      { id: 'notifications', label: 'Announcements', icon: Bell, roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    title: 'Payments & access',
    items: [
      { id: 'payments', label: 'Payment review', icon: CreditCard, roles: ['OWNER', 'ADMIN', 'FINANCE'] },
      { id: 'entitlements', label: 'Student passes', icon: Key, roles: ['OWNER', 'ADMIN', 'FINANCE'] },
      { id: 'products', label: 'Products & pricing', icon: Package, roles: ['OWNER', 'ADMIN'] },
      { id: 'payment-methods', label: 'Payment methods', icon: Monitor, roles: ['OWNER', 'FINANCE'] },
      { id: 'complimentary', label: 'Complimentary access', icon: Gift, roles: ['OWNER'] },
    ],
  },
  {
    title: 'Product',
    items: [
      { id: 'schedules', label: 'Schedule engine', icon: Box, roles: ['OWNER', 'ADMIN'] },
      { id: 'ocr', label: 'OCR extraction', icon: FileText, roles: ['OWNER', 'ADMIN'] },
      { id: 'academic', label: 'Academic terms', icon: CalendarDays, roles: ['OWNER', 'ADMIN', 'SUPPORT'] },
      { id: 'free-runs', label: 'Free run quotas', icon: PowerSquare, roles: ['OWNER'] },
    ],
  },
  {
    title: 'Operations & settings',
    items: [
      { id: 'health', label: 'System health', icon: Activity, roles: ['OWNER', 'ADMIN'] },
      { id: 'maintenance', label: 'Maintenance mode', icon: Settings, roles: ['OWNER', 'ADMIN'] },
      { id: 'audit', label: 'Audit trail', icon: Database, roles: ['OWNER', 'ADMIN'] },
      { id: 'security', label: 'Security center', icon: Shield, roles: ['OWNER'] },
      { id: 'admins', label: 'Administrators', icon: Users, roles: ['OWNER'] },
      { id: 'data', label: 'Reports & exports', icon: Download, roles: ['OWNER'] },
      { id: 'settings', label: 'App settings', icon: Settings, roles: ['OWNER'] },
    ],
  },
];

export function AdminLayout({
  activeTab,
  setActiveTab,
  children,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const role = getAdminRole(user) || 'ADMIN';

  const visibleGroups = useMemo(() => groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => role === 'OWNER' || item.roles.includes(role)),
    }))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        !navSearch.trim() || `${item.label} ${group.title}`.toLowerCase().includes(navSearch.trim().toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0), [role, navSearch]);

  const allItems = groups.flatMap((group) => group.items);
  const currentItem = allItems.find((item) => item.id === activeTab);
  const currentGroup = groups.find((group) => group.items.some((item) => item.id === activeTab))?.title || 'Overview';
  const currentLabel = currentItem?.label || 'Dashboard';
  const currentTabAllowed = Boolean(currentItem && (role === 'OWNER' || currentItem.roles.includes(role)));

  useEffect(() => {
    if (!currentTabAllowed && activeTab !== 'dashboard') setActiveTab('dashboard');
  }, [currentTabAllowed, activeTab, setActiveTab]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const drawer = mobileDrawerRef.current;
    const getFocusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || []).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

    document.body.style.overflow = 'hidden';
    getFocusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        drawer?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const focusTarget = mobileMenuButtonRef.current;
      if (focusTarget && focusTarget.isConnected) focusTarget.focus();
      else previouslyFocused?.focus();
    };
  }, [mobileOpen]);

  const renderNav = (isMobile = false) => (
    <div className={`px-3 pb-5 ${isMobile ? 'space-y-5' : 'space-y-5'}`}>
      <label className="relative block px-1">
        <span className="sr-only">Find an admin section</span>
        <Search aria-hidden="true" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={navSearch}
          onChange={(event) => setNavSearch(event.target.value)}
          placeholder="Find a section"
          className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
        />
      </label>
      {visibleGroups.length === 0 && (
        <p className="px-2 py-4 text-sm text-slate-500">No sections match “{navSearch}”.</p>
      )}
      {visibleGroups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide uppercase">{group.title}</h2>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setActiveTab(item.id);
                    setNavSearch('');
                    if (isMobile) setMobileOpen(false);
                  }}
                  className={`min-h-10 w-full flex items-center gap-3 px-3 rounded-lg text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
                    active
                      ? 'bg-emerald-50 text-emerald-900 font-semibold border-l-[3px] border-emerald-700 pl-[9px]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 font-medium'
                  }`}
                >
                  <Icon aria-hidden="true" className={`w-[17px] h-[17px] shrink-0 ${active ? 'text-emerald-800' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  const userSummary = (
    <div className="space-y-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{user?.name || user?.email || 'Administrator'}</div>
        <div className="text-xs text-slate-500 truncate">{user?.email || ''}</div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <a href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded">
          <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" /> Student app
        </a>
        <button type="button" onClick={() => logout()} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded">
          <LogOut aria-hidden="true" className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="gadwal-admin flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden lg:flex w-[252px] shrink-0 flex-col bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto">
        <div className="px-5 pt-5 pb-4 border-b border-slate-200">
          <a href="/admin?tab=dashboard" className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <span className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <Shield aria-hidden="true" className="w-[18px] h-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold tracking-tight leading-tight">Gadwal</span>
              <span className="block text-xs text-slate-500 mt-0.5">Administration</span>
            </span>
          </a>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold tracking-wide">{role}</span>
            <span className="text-xs text-slate-500">MIU workspace</span>
          </div>
        </div>
        <nav aria-label="Admin navigation" className="flex-1 pt-3">{renderNav(false)}</nav>
        <div className="p-4 border-t border-slate-200">{userSummary}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation overlay" className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileOpen(false)} />
          <aside ref={mobileDrawerRef} role="dialog" aria-modal="true" aria-label="Admin navigation" tabIndex={-1} className="relative flex flex-col w-[min(88vw,340px)] h-full max-h-[100dvh] bg-white border-r border-slate-200 shadow-xl overflow-y-auto">
            <div className="px-4 py-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center"><Shield aria-hidden="true" className="w-[18px] h-[18px]" /></span>
                <div><div className="text-base font-semibold">Gadwal</div><div className="text-xs text-slate-500">{role} access</div></div>
              </div>
              <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><X aria-hidden="true" className="w-5 h-5" /></button>
            </div>
            <nav aria-label="Admin navigation" className="flex-1 pt-3">{renderNav(true)}</nav>
            <div className="p-4 border-t border-slate-200">{userSummary}</div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button ref={mobileMenuButtonRef} type="button" aria-label="Open navigation menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="w-10 h-10 shrink-0 rounded-lg border border-slate-200 inline-flex items-center justify-center text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <Menu aria-hidden="true" className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{currentLabel}</div><div className="text-xs text-slate-500 truncate">{currentGroup}</div></div>
          <button type="button" aria-label="Sign out" onClick={() => logout()} className="text-xs font-medium text-slate-600 hover:text-rose-700 px-2 py-2">Sign out</button>
        </header>

        <header className="hidden lg:flex sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-7 py-3.5 items-center justify-between gap-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-500">Gadwal</span><ChevronRight aria-hidden="true" className="w-4 h-4 text-slate-300 shrink-0" />
            <span className="text-slate-500">{currentGroup}</span><ChevronRight aria-hidden="true" className="w-4 h-4 text-slate-300 shrink-0" />
            <span className="font-semibold text-slate-900 truncate">{currentLabel}</span>
          </nav>
          <div className="flex items-center gap-3 shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-700" /><span className="text-xs text-slate-600">Signed in as {role.toLowerCase()}</span></div>
        </header>

        <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
