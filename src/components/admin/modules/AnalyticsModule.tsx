import React, { useState } from 'react';
import {
  BarChart3, Download
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { getStoredAuthToken } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, money, fmtDate } from '../adminShared';

export function OwnerAnalytics() {
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<'30d' | '7d' | 'all'>('30d');
  const { data, reload, error, loading } = useAdminData(`/api/admin/owner/analytics?range=${timeRange}`);
  const a = data?.analytics || {};

  const dailySignups = a.dailySignups || [];
  const dailyRuns = a.dailyRuns || [];
  const dailyRevenue = a.dailyRevenue || [];

  // Funnel calculations
  const totalStudents = Number(a.students || 0);
  const active7 = Number(a.active7 || 0);
  const totalRuns = Number(a.runs || 0);
  const failedRuns = Number(a.failedRuns || 0);
  const periodLabel = String(a.periodLabel || (timeRange === '7d' ? 'Past 7 days' : timeRange === 'all' ? 'Lifetime' : 'Past 30 days'));
  const paidStudents = Number(a.paid || 0);
  const annualSubscribers = Number(a.annual || 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = getStoredAuthToken();
      const response = await fetch(`/api/admin/owner/export/analytics?format=csv&range=${timeRange}`, {
        credentials: 'same-origin', headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        let message = `Analytics export failed (${response.status}).`;
        try { message = (await response.json())?.error || message; } catch { /* keep safe HTTP fallback */ }
        throw new Error(message);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url;
      link.download = `gadwal-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err: any) {
      window.alert(err?.message || 'Could not export analytics. Check your connection and access permissions.');
    } finally { setExporting(false); }
  };

  const funnelSteps = [
    {
      label: '1. Registered Students',
      value: totalStudents,
      sub: 'All registered MIU student accounts',
      pct: '100%',
    },
    {
      label: '2. Active in the last 7 days',
      value: active7,
      sub: 'Distinct student accounts with an activity event',
      pct: totalStudents ? `${Math.round((active7 / totalStudents) * 100)}%` : '0%',
    },
    {
      label: '3. Paid Pass Subscribers',
      value: paidStudents,
      sub: 'Active semester/annual pass holders',
      pct: totalStudents ? `${Math.round((paidStudents / totalStudents) * 100)}%` : '0%',
    },
    {
      label: '4. Academic-year pass holders',
      value: annualSubscribers,
      sub: 'Two-semester premium pass holders',
      pct: paidStudents ? `${Math.round((annualSubscribers / paidStudents) * 100)}%` : '0%',
    },
  ];

  return (
    <Page
      title="Analytics"
      description="Student activity, schedule runs and approved payment submissions from Gadwal records."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {data?.analytics?.generatedAt && <p className="text-xs text-slate-500" aria-live="polite">Updated {new Date(data.analytics.generatedAt).toLocaleString()} · {loading ? 'Refreshing data…' : 'Metrics are database-backed; payment value is based on approved submissions created in the selected period.'}</p>}

      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
          {(['7d', '30d', 'all'] as const).map(tr => (
            <button
              key={tr}
              type="button"
              aria-pressed={timeRange === tr}
              onClick={() => setTimeRange(tr)}
              className={`min-h-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                timeRange === tr ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tr === '7d' ? 'Past 7 Days' : tr === '30d' ? 'Past 30 Days' : 'Lifetime'}
            </button>
          ))}
        </div>

        <button
          type="button" onClick={() => void handleExport()} disabled={exporting}
          className="inline-flex min-h-10 items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition disabled:opacity-50"
        >
          <Download aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" />
          <span>{exporting ? 'Exporting…' : `Export ${periodLabel} CSV`}</span>
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Active pass share</span>
          <div className="text-2xl font-semibold text-emerald-800">
            {Number(a.activePassShare || 0).toFixed(1)}%
          </div>
          <span className="text-xs text-slate-500">Active pass holders as a share of all accounts</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">7-day active ratio</span>
          <div className="text-2xl font-black text-slate-900">
            {Number(a.activation7 || 0).toFixed(1)}%
          </div>
          <span className="text-xs text-slate-500">Distinct accounts with a recent activity event</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Schedule runs · {periodLabel}</span>
          <div className="text-2xl font-black text-slate-900">
            {totalRuns.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {failedRuns.toLocaleString()} failed (
            {totalRuns ? ((failedRuns / totalRuns) * 100).toFixed(1) : 0}% of runs)
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-xs font-semibold text-slate-500">Approved payment value · {periodLabel}</span>
          <div className="text-2xl font-black text-slate-900">
            {money(a.approvedValue || 0)}
          </div>
          <span className="text-[11px] text-emerald-700 font-bold">
            {Number(a.approvedPayments || 0).toLocaleString()} approved submissions
          </span>
        </div>
      </div>

      {/* Conversion Funnel Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
        <div>
          <h3 className="font-semibold text-sm text-slate-900">Student accounts and access</h3>
          <p className="text-xs text-slate-500">Current account and entitlement totals. These are point-in-time counts, not a cohort conversion funnel.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {funnelSteps.map((step, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{step.label}</span>
                <span className="text-xs font-black text-emerald-700">{step.pct}</span>
              </div>
              <div className="text-xl font-black text-slate-900">{step.value.toLocaleString()}</div>
              <p className="text-[11px] text-slate-500">{step.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Activity Curves & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Registrations */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900">Daily registrations · recent {Math.min(Number(a.chartWindowDays || 30), 365)} days</h3>
            <span className="text-xs text-slate-400 font-bold">{dailySignups.length} days recorded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">New Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailySignups.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-6 text-center text-slate-400">No registration activity recorded in this period.</td>
                  </tr>
                ) : (
                  dailySignups.slice(-10).reverse().map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{fmtDate(row.date)}</td>
                      <td className="p-3 text-right font-black text-slate-900">+{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Solver Optimization Sessions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900">Daily schedule runs · recent {Math.min(Number(a.chartWindowDays || 30), 365)} days</h3>
            <span className="text-xs text-slate-400 font-bold">{dailyRuns.length} days recorded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Schedules Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyRuns.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-6 text-center text-slate-400">No solver generation activity recorded.</td>
                  </tr>
                ) : (
                  dailyRuns.slice(-10).reverse().map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{fmtDate(row.date)}</td>
                      <td className="p-3 text-right font-black text-emerald-700">{row.count} solves</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Page>
  );
}
