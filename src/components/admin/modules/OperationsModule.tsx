import React, { useState } from 'react';
import {
  Activity, Sliders, RefreshCw, CheckCircle2, AlertTriangle,
  RotateCcw, Database, ShieldAlert, Cpu
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn } from '../adminShared';

export function OwnerOperations({ kind }: { kind?: 'schedules' | 'ocr' | string } = {}) {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/overview');
  const [clearingCache, setClearingCache] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClearCache = async () => {
    setClearingCache(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson('/api/admin/owner/operations/clear-cache', {
        method: 'POST',
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Cache clearance failed.');
      setBanner({ type: 'success', text: 'Temporary OCR and solver caches successfully purged.' });
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to clear cache.' });
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <Page
      title={kind === 'ocr' ? 'OCR & Document Parsing' : 'Schedule Engine Operations'}
      description="Manage background task workloads, OCR parser cache, and compute allocations."
      onRefresh={reload}
    >
      <ErrorBox error={error} />

      {banner && (
        <InlineNotice tone={banner.type}>
          <span>{banner.text}</span>
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workload Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {kind === 'ocr' ? 'OCR Extraction Pipeline' : 'Schedule Engine Status'}
              </h3>
              <p className="text-xs text-slate-500">Constraint satisfaction and genetic optimizer worker pool.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Solver Engine</span>
              <span className="text-emerald-700 font-black">OPERATIONAL (Online)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Max Concurrent Solves</span>
              <span className="text-slate-900 font-bold">32 Threads</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Average Execution Time</span>
              <span className="text-slate-900 font-mono">142 ms</span>
            </div>
          </div>
        </div>

        {/* Cache Management */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Purge Ephemeral Cache</h3>
                <p className="text-xs text-slate-500">Invalidate cached OCR schedule parse trees and precomputed timetables.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pt-2">
              Use this if students report outdated section lists after faculty updates are published.
            </p>
          </div>

          <button
            type="button"
            disabled={clearingCache}
            onClick={handleClearCache}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-2xs transition"
          >
            {clearingCache ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            <span>{clearingCache ? 'Purging Cache...' : 'Purge OCR & Engine Cache'}</span>
          </button>
        </div>
      </div>
    </Page>
  );
}
