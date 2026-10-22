import React, { useState } from 'react';
import {
  Download, FileSpreadsheet, FileJson, Users, CreditCard, Key,
  TrendingUp, Shield, HelpCircle, RefreshCw, CheckCircle2, AlertTriangle,
  FolderDown, ExternalLink, Copy, Check, Filter, Search
} from 'lucide-react';
import { fetchJson, getStoredAuthToken } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn } from '../adminShared';

interface ExportDataset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'Core' | 'Financial' | 'Operations' | 'Intelligence';
  countEstimate?: string;
}

const EXPORT_DATASETS: ExportDataset[] = [
  {
    id: 'students',
    name: 'Students Directory',
    description: 'Account IDs, names, email addresses, roles, status, run allowance and account timestamps. Use only for an approved support or operations task.',
    icon: Users,
    category: 'Core',
    countEstimate: 'All Accounts',
  },
  {
    id: 'payments',
    name: 'Payment Submissions Ledger',
    description: 'Payment submissions, amounts in EGP, plan, payment method and review timestamps. Proof files and reviewer notes are excluded.',
    icon: CreditCard,
    category: 'Financial',
    countEstimate: 'Submitted payment records',
  },
  {
    id: 'entitlements',
    name: 'Access Entitlements',
    description: 'Plan, term, status, amount/currency and expiry/revocation fields for student access records.',
    icon: Key,
    category: 'Financial',
    countEstimate: 'Active & Expired',
  },
  {
    id: 'revenue',
    name: 'Daily Revenue Trends',
    description: 'Daily value and count of approved payment submissions. This is not net revenue or a reconciled accounting report.',
    icon: TrendingUp,
    category: 'Financial',
    countEstimate: 'Historical Totals',
  },
  {
    id: 'audit',
    name: 'Audit Security Log',
    description: 'Recorded administrator actions, targets and sanitized metadata. Coverage reflects the events currently written by the application.',
    icon: Shield,
    category: 'Intelligence',
    countEstimate: 'Security Log',
  },
  {
    id: 'support',
    name: 'Support Inquiries & Feedback',
    description: 'Support ticket subject, category, priority, status, assignee and timestamps. Message bodies and internal notes are excluded.',
    icon: HelpCircle,
    category: 'Operations',
    countEstimate: 'Ticket Threads',
  },
];

export function OwnerDataExports() {
  const [downloading, setDownloading] = useState<{ id: string; format: 'csv' | 'json' } | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [previewData, setPreviewData] = useState<{ id: string; format: string; raw: string; sample: any[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  /** Download data through the authenticated API. Never put bearer tokens in a URL. */
  const executeDownload = async (datasetId: string, format: 'csv' | 'json', quiet = false): Promise<boolean> => {
    setDownloading({ id: datasetId, format });
    if (!quiet) setBanner(null);
    const token = getStoredAuthToken();
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `gadwal-${datasetId}-${timestamp}.${format}`;
    try {
      const response = await fetch(`/api/admin/owner/export/${encodeURIComponent(datasetId)}?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'same-origin',
      });
      if (!response.ok) {
        let message = `Export failed (${response.status}).`;
        try { const payload = await response.json(); message = payload?.error || message; } catch { /* retain safe HTTP message */ }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
      if (!quiet) setBanner({ type: 'success', text: `Downloaded ${fileName}.` });
      return true;
    } catch (error: any) {
      if (!quiet) setBanner({ type: 'error', text: error?.message || 'Export failed. Check your connection and role permissions, then try again.' });
      return false;
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Preview dataset live in the UI modal before exporting
   */
  const handlePreview = async (datasetId: string) => {
    setDownloading({ id: datasetId, format: 'json' });
    setBanner(null);
    try {
      const { response, data } = await fetchJson(`/api/admin/owner/export/${datasetId}?format=json&preview=1`);
      if (!response.ok) throw new Error((data as any)?.error || 'Failed to load preview data');

      const sample = Array.isArray(data) ? data.slice(0, 10) : [data];
      const raw = JSON.stringify(sample, null, 2);

      setPreviewData({
        id: datasetId,
        format: 'JSON',
        raw,
        sample,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Unable to load dataset preview.',
      });
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Copy exported data directly to clipboard (JSON/CSV)
   */
  const handleCopyClipboard = async () => {
    if (!previewData) return;
    try {
      await navigator.clipboard.writeText(previewData.raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setBanner({ type: 'error', text: 'Clipboard copy failed. Please select text manually.' });
    }
  };

  /**
   * Bulk Export All Datasets in Sequence
   */
  const handleBulkExport = async (format: 'csv' | 'json') => {
    setBulkDownloading(true);
    setBanner({ type: 'success', text: `Exporting all ${EXPORT_DATASETS.length} datasets as ${format.toUpperCase()}...` });

    let successCount = 0;
    const failed: string[] = [];
    for (const dataset of EXPORT_DATASETS) {
      const success = await executeDownload(dataset.id, format, true);
      if (success) successCount++;
      else failed.push(dataset.name);
      // Keep browser download prompts usable when a batch contains several files.
      await new Promise(resolve => window.setTimeout(resolve, 500));
    }

    setBulkDownloading(false);
    setBanner({
      type: failed.length ? 'error' : 'success',
      text: failed.length
        ? `Downloaded ${successCount} of ${EXPORT_DATASETS.length} files. Failed: ${failed.join(', ')}.`
        : `Downloaded all ${successCount} files. Each export is independently permission-checked and audited.`,
    });
  };

  const filteredDatasets = EXPORT_DATASETS.filter(ds => {
    const matchesSearch = !search ||
      ds.name.toLowerCase().includes(search.toLowerCase()) ||
      ds.description.toLowerCase().includes(search.toLowerCase()) ||
      ds.id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || ds.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Page
      title="Reports & exports"
      description="Download role-approved, data-minimized reports. Every export is permission-checked and recorded in the audit trail."
    >
      {/* Dynamic Status / Error Notice */}
      {banner && (
        <InlineNotice tone={banner.type}>
          <div className="flex items-center justify-between w-full">
            <span>{banner.text}</span>
            <button
              onClick={() => setBanner(null)}
              className="text-xs font-bold underline cursor-pointer hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        </InlineNotice>
      )}

      {/* Top Action & Bulk Export Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-base text-slate-900">Export selected reports</h3>
            <p className="text-sm text-slate-500 mt-1">Download the reports below in one format. This is a reporting export, not a database backup.</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              disabled={bulkDownloading || !!downloading}
              onClick={() => handleBulkExport('csv')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              {bulkDownloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Export All (CSV)</span>
            </button>

            <button
              type="button"
              disabled={bulkDownloading || !!downloading}
              onClick={() => handleBulkExport('json')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              {bulkDownloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4" />
              )}
              <span>Export All (JSON)</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search datasets (e.g. students, payments, audit)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['ALL', 'Core', 'Financial', 'Operations', 'Intelligence'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dataset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredDatasets.map(item => {
          const Icon = item.icon;
          const isDownloadingCsv = downloading?.id === item.id && downloading?.format === 'csv';
          const isDownloadingJson = downloading?.id === item.id && downloading?.format === 'json';

          return (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                    {item.category}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">{item.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!!downloading || bulkDownloading}
                    onClick={() => executeDownload(item.id, 'csv')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isDownloadingCsv ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>{isDownloadingCsv ? 'Exporting...' : 'Export CSV'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!downloading || bulkDownloading}
                    onClick={() => executeDownload(item.id, 'json')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isDownloadingJson ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    ) : (
                      <FileJson className="w-3.5 h-3.5 text-slate-600" />
                    )}
                    <span>{isDownloadingJson ? 'Exporting...' : 'JSON'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handlePreview(item.id)}
                  disabled={!!downloading || bulkDownloading}
                  className="w-full text-center py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Preview Sample Data & Copy
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-3 sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="export-preview-title" className="bg-white w-full max-w-3xl rounded-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 id="export-preview-title" className="font-semibold text-sm text-slate-900 capitalize">
                    Data preview: {previewData.id}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    A sample of up to 10 rows. The complete dataset is not loaded into this preview.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-200">
              <pre className="whitespace-pre-wrap break-all leading-relaxed">
                {previewData.raw}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyClipboard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeDownload(previewData.id, 'csv')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
