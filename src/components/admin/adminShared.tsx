import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchJson } from '../../services/resilientFetch';

export const money = (n: any) => `${Number(n || 0).toLocaleString()} EGP`;
export const fmt = (v: any) => (v ? new Date(v).toLocaleString() : '—');
export const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString() : '—');

export function useAdminData(url: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { response, data: resData } = await fetchJson(url, { timeoutMs: 25000 });
      if (!response.ok) throw new Error((resData as any)?.error || `Request failed (${response.status})`);
      setData(resData);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data. Please check network and permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [url]);

  return { data, loading, error, reload: load };
}

export function Page({
  title,
  description,
  children,
  onRefresh,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onRefresh?: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-600 mt-1.5">{description}</p>}
        </div>
        {onRefresh && (
          <button
            type="button"
            disabled={refreshing}
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error' | 'danger';
  children: React.ReactNode;
}) {
  const colors = {
    info: 'bg-blue-50 text-blue-900 border-blue-200',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    error: 'bg-rose-50 text-rose-900 border-rose-200',
    danger: 'bg-rose-50 text-rose-900 border-rose-200',
  };
  return (
    <div className={`p-4 rounded-xl text-xs border font-medium flex items-center gap-2 ${colors[tone] || colors.info}`}>
      {children}
    </div>
  );
}

export function Btn({
  tone = 'dark',
  size = 'md',
  disabled,
  onClick,
  children,
  className = '',
  type = 'button',
}: {
  tone?: 'dark' | 'green' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const tones = {
    dark: 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs',
    green: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-900/10',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-900/10',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700',
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-xs rounded-xl font-bold',
    lg: 'px-5 py-2.5 text-sm rounded-xl font-bold',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}
