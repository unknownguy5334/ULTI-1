import React, { useState } from 'react';
import {
  TrendingUp, CreditCard, DollarSign, Calendar, Download,
  BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, FileText
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { Page, ErrorBox, InlineNotice, Btn, money, fmt, fmtDate } from '../adminShared';

export function OwnerFinancials() {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/financials');
  const rep = data?.report || data || {};
  const summary = rep?.summary || {};
  const dailyTrends = rep?.daily || [];
  const methodBreakdown = rep?.methods || rep?.byMethod || [];
  const planBreakdown = rep?.byPlan || [];

  return (
    <Page
      title="Financial Intelligence & Revenue Analytics"
      description="Authoritative gross earnings, successful transaction volume, conversion breakdown, and daily cash flow."
      onRefresh={reload}
    >
      <ErrorBox error={error} />

      {/* Top Action Bar */}
      <div className="flex justify-end">
        <a
          href="/api/admin/owner/export/revenue"
          download="gadwal-revenue.csv"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Revenue CSV</span>
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Lifetime Revenue</span>
          <div className="text-2xl font-black text-emerald-700">{money(summary.totalRevenue || summary.revenue || 0)}</div>
          <span className="text-[11px] text-slate-400">All verified student payments</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month (30 Days)</span>
          <div className="text-2xl font-black text-slate-900">{money(summary.monthRevenue || 0)}</div>
          <span className="text-[11px] text-emerald-700 font-bold">Active Semester Enrollment</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approved Transactions</span>
          <div className="text-2xl font-black text-slate-900">{summary.approvedCount || summary.payments || 0}</div>
          <span className="text-[11px] text-slate-400">Verified student receipts</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Order Value</span>
          <div className="text-2xl font-black text-slate-900">{money(summary.averageOrderValue || 0)}</div>
          <span className="text-[11px] text-slate-400">Per subscriber transaction</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Revenue Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Daily Revenue Timeline</h3>
            <span className="text-xs text-slate-400 font-bold">Daily settlements</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Approved Volume</th>
                  <th className="p-3.5 text-right">Daily Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyTrends.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400">No daily revenue entries logged.</td>
                  </tr>
                ) : (
                  dailyTrends.map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold text-slate-900">{fmtDate(d.date)}</td>
                      <td className="p-3.5 text-slate-600">{d.payments || d.count || 0} payments</td>
                      <td className="p-3.5 text-right font-black text-emerald-700">{money(d.revenue || d.total || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Breakdowns: Gateway & Plan Mix */}
        <div className="space-y-6">
          {/* Method Mix Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Payment Gateway Mix</h3>
            <div className="space-y-3">
              {methodBreakdown.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-4">No gateway data recorded.</div>
              ) : (
                methodBreakdown.map((m: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900 uppercase">{m.method || 'INSTAPAY'}</span>
                      <span className="block text-[11px] text-slate-400">{m.payments || m.count || 0} orders</span>
                    </div>
                    <span className="font-black text-xs text-emerald-700">{money(m.revenue || m.total || 0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tier Plan Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Product Tier Distribution</h3>
            <div className="space-y-3">
              {planBreakdown.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-4">No plan transactions recorded.</div>
              ) : (
                planBreakdown.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900">{p.plan === 'ACADEMIC_YEAR' ? 'Full Academic Year' : 'Current Term Access'}</span>
                      <span className="block text-[11px] text-slate-400">{p.payments || p.count || 0} subscriptions</span>
                    </div>
                    <span className="font-black text-xs text-slate-900">{money(p.revenue || p.total || 0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
