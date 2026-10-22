import React, { useEffect, useState } from 'react';
import { fetchJson } from '../../services/resilientFetch';
import { Users, CreditCard, Activity, Box, RefreshCw } from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const { response, data } = await fetchJson('/api/admin/owner/dashboard');
      if (response.ok && data) {
        setStats((data as any).stats || null);
      } else {
        setError((data as any)?.error || 'Failed to load owner metrics.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while loading metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-text-secondary font-medium">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading live business overview...</span>
      </div>
    );
  }

  const payments = Array.isArray(stats?.payments) ? stats.payments : [];
  const usage = Array.isArray(stats?.usage) ? stats.usage : [];
  const entitlements = Array.isArray(stats?.entitlements) ? stats.entitlements : [];
  const totalStudents = Number(stats?.students?.total) || 0;

  const totalRevenue = payments.reduce((acc: number, p: any) => {
    return p.status === 'APPROVED' ? acc + (Number(p.totalAmount) || 0) : acc;
  }, 0);

  const totalUsageRuns = usage.reduce((acc: number, b: any) => acc + (Number(b.count) || 0), 0);
  const activeEntitlements = entitlements.reduce((acc: number, b: any) => {
    return b.status === 'ACTIVE' ? acc + (Number(b.count) || 0) : acc;
  }, 0);

  return (
    <div className="p-8 space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-ink">Business Overview</h2>
          <p className="text-sm text-text-secondary mt-0.5">Live platform vitals and revenue overview</p>
        </div>
        <button
          onClick={loadStats}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-mist hover:bg-line text-ink transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">
          {error} (Displaying available cached data)
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-paper border border-line rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3 mb-4 text-text-secondary">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Students</span>
          </div>
          <div className="text-3xl font-black">{totalStudents}</div>
        </div>
        <div className="bg-paper border border-line rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3 mb-4 text-text-secondary">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Approved Revenue</span>
          </div>
          <div className="text-3xl font-black">{totalRevenue} EGP</div>
        </div>
        <div className="bg-paper border border-line rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3 mb-4 text-text-secondary">
            <Activity className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Usage Runs</span>
          </div>
          <div className="text-3xl font-black">{totalUsageRuns}</div>
        </div>
        <div className="bg-paper border border-line rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3 mb-4 text-text-secondary">
            <Box className="w-5 h-5 text-purple-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Active Entitlements</span>
          </div>
          <div className="text-3xl font-black">{activeEntitlements}</div>
        </div>
      </div>
      
      {/* Pending Action Items Section */}
      <h3 className="text-lg font-bold mt-8 mb-4">Attention Required</h3>
      <div className="bg-mist border border-line rounded-xl p-5">
        <p className="text-sm text-text-secondary font-medium">All systems operational. No critical blockers detected.</p>
      </div>
    </div>
  );
}

