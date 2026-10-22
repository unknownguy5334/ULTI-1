import React from 'react';
import {
  Users, CreditCard, Key, LifeBuoy, TrendingUp, Clock, Activity, ArrowRight,
  BarChart3, Settings
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { Page, ErrorBox, InlineNotice, money, fmt, fmtDate } from '../adminShared';

export function OwnerDashboard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/overview');
  const d = data?.data || data || {};

  const pendingPayments = Number(d.pendingPaymentsCount || 0);
  const openSupport = Number(d.openSupportCount || 0);
  const recentTickets = (d.tickets || []).slice(0, 5);
  const priceHistory = (d.priceHistory || []).slice(0, 5);

  return (
    <Page
      title="Dashboard"
      description="A clear overview of student accounts, paid access, pending payments and support requests."
      onRefresh={reload}
    >
      <ErrorBox error={error} />

      {/* Action Required Alert Banners */}
      {(pendingPayments > 0 || openSupport > 0) && (
        <div className="space-y-3">
          {pendingPayments > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    {pendingPayments} Payment Proof{pendingPayments === 1 ? '' : 's'} Awaiting Verification
                  </h4>
                  <p className="text-xs text-amber-700">Students have uploaded manual transfer receipts waiting for your approval.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('payments')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0"
              >
                <span>Verify Payments</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {openSupport > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-900 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    {openSupport} Open Support Inquir{openSupport === 1 ? 'y' : 'ies'}
                  </h4>
                  <p className="text-xs text-blue-700">Student queries regarding schedule generation or payments need attention.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('support')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0"
              >
                <span>Open Support Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Metric KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <button type="button"
          onClick={() => onNavigate?.('students')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-slate-300 transition cursor-pointer w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Students</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{Number(d.studentsCount || 0).toLocaleString()}</div>
            <span className="text-[11px] text-slate-400">Total MIU student accounts</span>
          </div>
        </button>

        <button type="button"
          onClick={() => onNavigate?.('entitlements')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Active Passes</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">{Number(d.activeEntitlementsCount || 0).toLocaleString()}</div>
            <span className="text-[11px] text-slate-400">Current paid subscribers</span>
          </div>
        </button>

        <button type="button"
          onClick={() => onNavigate?.('financials')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Gross Lifetime Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{money(d.totalRevenue || 0)}</div>
            <span className="text-[11px] text-slate-400">Verified student payments</span>
          </div>
        </button>

        <button type="button"
          onClick={() => onNavigate?.('support')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Open Inquiries</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <LifeBuoy className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{d.openSupportCount || 0}</div>
            <span className="text-[11px] text-slate-400">Pending support tickets</span>
          </div>
        </button>
      </div>

      {/* Fast Navigation Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operational Quick Actions</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate?.('payments')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-left border border-slate-100 transition cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-emerald-600 mb-1" />
            <div className="font-bold text-xs text-slate-900">Verify Payments</div>
            <span className="text-[10px] text-slate-400">{pendingPayments} pending</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('students')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-left border border-slate-100 transition cursor-pointer"
          >
            <Users className="w-4 h-4 text-blue-600 mb-1" />
            <div className="font-bold text-xs text-slate-900">Student Directory</div>
            <span className="text-[10px] text-slate-400">Search & quotas</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('analytics')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-left border border-slate-100 transition cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-purple-600 mb-1" />
            <div className="font-bold text-xs text-slate-900">Analytics</div>
            <span className="text-[10px] text-slate-400">Funnels & growth</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('support')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-left border border-slate-100 transition cursor-pointer"
          >
            <LifeBuoy className="w-4 h-4 text-amber-600 mb-1" />
            <div className="font-bold text-xs text-slate-900">Support Desk</div>
            <span className="text-[10px] text-slate-400">{openSupport} tickets</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('health')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-left border border-slate-100 transition cursor-pointer"
          >
            <Activity className="w-4 h-4 text-emerald-600 mb-1" />
            <div className="font-bold text-xs text-slate-900">System Health</div>
            <span className="text-[10px] text-slate-400">Availability checks</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('settings')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-left border border-slate-100 transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-600 mb-1" />
            <div className="font-bold text-xs text-slate-900">App Settings</div>
            <span className="text-[10px] text-slate-400">Policies & config</span>
          </button>
        </div>
      </div>

      {/* Two-Column Overview Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Posture & Config */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900">Website settings</h3>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${d.config?.maintenanceEnabled ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {d.config?.maintenanceEnabled ? 'Maintenance enabled' : 'Health not checked here'}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Default Free Run Allowance</span>
              <span className="font-bold text-slate-900">{d.config?.freeRunAllowance ?? 1} runs/student</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Support Contact Email</span>
              <span className="font-bold text-slate-900">{d.config?.supportEmail || 'support@gadwal.app'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Active Payment Channels</span>
              <span className="font-bold text-slate-900">{(d.paymentMethods || []).length} methods enabled</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Maintenance Mode</span>
              <span className={`font-bold ${d.config?.maintenanceEnabled ? 'text-rose-700' : 'text-emerald-700'}`}>
                {d.config?.maintenanceEnabled ? 'ACTIVE (Locked)' : 'Inactive (Normal)'}
              </span>
            </div>
          </div>
        </div>

        {/* Active Product Catalog */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Active Product Catalog</h3>
            <button
              onClick={() => onNavigate?.('products')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
            >
              Manage Catalog →
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {(d.products || []).map((p: any) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{p.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    {p.durationDays ? `${p.durationDays} days access` : 'Semester'} · {p.accessScope || 'REGISTRATION'}
                  </span>
                </div>
                <span className="font-black text-emerald-700">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}
