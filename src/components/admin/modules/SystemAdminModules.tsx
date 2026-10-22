import React, { useState, useEffect } from 'react';
import {
  Shield, Key, RefreshCw, AlertTriangle, CheckCircle2, UserCheck,
  Search, Lock, Unlock, Settings, Sliders, Activity, Server,
  SlidersHorizontal, Phone, Mail, MapPin, X
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn, fmt, fmtDate } from '../adminShared';

export function OwnerHealth() {
  const { data, loading, error, reload } = useAdminData('/api/admin/owner/health');
  const health = data?.health || {};

  return (
    <Page
      title="System Health & Diagnostics"
      description="Live runtime diagnostics, database status, and microservices heartbeat."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {health.checkedAt && (
        <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
          <span>Diagnostic Probe Heartbeat</span>
          <span className="font-mono text-[11px]">Last checked: {fmt(health.checkedAt)}</span>
        </div>
      )}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Pinging services...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Object.entries(health)
            .filter(([k]) => k !== 'checkedAt')
            .map(([k, v]: any) => {
              const isOk = Boolean(v?.ok);
              const serviceNames: Record<string, string> = {
                database: 'PostgreSQL Database',
                auth: 'Neon Authentication',
                gemini: 'Gemini Vision AI',
                storage: 'Persistent Storage',
                api: 'Application Server API',
                scheduleGeneration: 'Solver Engine',
                ocr: 'OCR Vision Pipeline',
              };
              return (
                <div key={k} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 tracking-tight">
                      {serviceNames[k] || k}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    Status:{' '}
                    <span className={isOk ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                      {isOk ? 'Operational' : 'Unavailable'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {v?.latencyMs ? `Latency: ${v.latencyMs}ms` : v?.configured ? 'Configured & Online' : 'Active runtime process'}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </Page>
  );
}

export function OwnerMaintenance() {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/maintenance');
  const m = data?.maintenance || {};
  const [form, setForm] = useState<any>(m);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (data?.maintenance) setForm(data.maintenance);
  }, [data]);

  const save = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson('/api/admin/owner/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Save failed.');
      setBanner({ type: 'success', text: 'Maintenance mode configuration saved.' });
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Maintenance Mode"
      description="Schedule or toggle maintenance banners and engine locks for students."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {banner && <InlineNotice tone={banner.type}><span>{banner.text}</span></InlineNotice>}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl space-y-5 shadow-2xs">
        <label className="flex items-center gap-3 font-bold text-sm text-slate-900 cursor-pointer">
          <input
            type="checkbox"
            checked={!!form.enabled}
            onChange={e => setForm({ ...form, enabled: e.target.checked })}
            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
          />
          <span>Maintenance Mode Active (Locks Student Actions)</span>
        </label>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Banner Message</label>
          <input
            value={form.message || ''}
            onChange={e => setForm({ ...form, message: e.target.value })}
            placeholder="Maintenance notice shown across all student viewports..."
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
          />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-2xs transition"
        >
          {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          <span>{busy ? 'Saving...' : 'Update Maintenance State'}</span>
        </button>
      </div>
    </Page>
  );
}

export function OwnerSecurity() {
  const { data, reload, error } = useAdminData('/api/admin/owner/security');
  const [busy, setBusy] = useState<string | null>(null);

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this administrator session?')) return;
    setBusy(id);
    try {
      const { response, data: resData } = await fetchJson(
        `/api/admin/owner/security/sessions/${encodeURIComponent(id)}/revoke`,
        { method: 'POST' }
      );
      if (!response.ok) alert((resData as any)?.error || 'Could not revoke session.');
      else await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page
      title="Security & Active Sessions"
      description="Monitor active administrator JWT sessions, IP logs, and privileged tokens."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
          Active Administrative Tokens
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {(data?.security?.sessions || []).length === 0 ? (
            <div className="p-6 text-center text-slate-400">No external administrator sessions logged.</div>
          ) : (
            (data?.security?.sessions || []).map((s: any) => (
              <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{s.email || s.userId}</div>
                  <div className="text-[11px] text-slate-400 font-mono">Session ID: {s.id} • Created {fmt(s.createdAt)}</div>
                </div>
                <button
                  disabled={busy === s.id}
                  onClick={() => revoke(s.id)}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Page>
  );
}

export function OwnerAdministrators() {
  const { data, reload, error } = useAdminData('/api/admin/owner/administrators');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [students, setStudents] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const findStudents = async () => {
    if (!search.trim()) return;
    setBusy(true);
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/students?search=${encodeURIComponent(search.trim())}`);
      if (response.ok) {
        setStudents((resData as any)?.students || []);
      }
    } finally {
      setBusy(false);
    }
  };

  const updateAdminRole = async (studentId: string, nextRole: string) => {
    setBusy(true);
    try {
      const { response, data: resData } = await fetchJson(
        `/api/admin/owner/administrators/${encodeURIComponent(studentId)}/role`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: nextRole }),
        }
      );
      if (!response.ok) throw new Error((resData as any)?.error || 'Role change failed.');
      setMessage(`Updated administrator role to ${nextRole}.`);
      setStudents([]);
      setSearch('');
      await reload();
    } catch (e: any) {
      alert(e?.message || 'Role change failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Administrator Directory & Roles"
      description="Configure privileged roles (ADMIN, FINANCE, SUPPORT, OWNER) and grant staff access."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {message && <InlineNotice tone="success"><span>{message}</span></InlineNotice>}

      {/* Add Administrator Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Grant Privileged Access</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void findStudents();
              }
            }}
            placeholder="Search student email to promote..."
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="FINANCE">FINANCE</option>
            <option value="SUPPORT">SUPPORT</option>
            <option value="OWNER">OWNER</option>
            <option value="NONE">NONE (Remove)</option>
          </select>
          <button
            type="button"
            disabled={busy || !search.trim()}
            onClick={findStudents}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </div>

        {students.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {students.map((entry: any) => {
              const s = entry.student || entry;
              return (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{s.displayName || s.email}</div>
                    <div className="text-[11px] text-slate-500">{s.email}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateAdminRole(s.id, role)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                      role === 'NONE'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    Set as {role}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Administrators List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Administrator</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.admins || []).map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3.5 min-w-[220px]">
                    <div className="font-bold text-slate-900">{a.displayName || a.email}</div>
                    <div className="text-[11px] text-slate-400">{a.email}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {a.adminRole}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span className="text-emerald-700 font-bold">{a.accountStatus || 'ACTIVE'}</span>
                  </td>
                  <td className="p-3.5 text-slate-500 whitespace-nowrap">{fmt(a.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}

export function OwnerComplimentary() {
  const { user } = useAuth();
  const isOwner = String(user?.role) === 'OWNER';
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const searchStudents = async () => {
    if (!search.trim()) return;
    setBusy(true);
    try {
      const { response, data } = await fetchJson(
        `/api/admin/students?search=${encodeURIComponent(search.trim())}`
      );
      if (response.ok) {
        setRows((data as any)?.students || []);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleComplimentary = async (action: 'GRANT' | 'REVOKE') => {
    if (!selected || !isOwner || !reason.trim()) return;
    setBusy(true);
    setBanner(null);
    try {
      const { response, data } = await fetchJson(
        `/api/admin/owner/students/${selected.id}/complimentary-access`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason: reason.trim() }),
        }
      );
      if (response.ok) {
        setBanner({ type: 'success', text: `Complimentary access ${action.toLowerCase()}ed.` });
        setReason('');
        await searchStudents();
      } else {
        setBanner({ type: 'error', text: (data as any)?.error || 'Action failed.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Complimentary Access & Grants"
      description="Grant unlimited access overrides with immutable audit reasoning."
    >
      {banner && <InlineNotice tone={banner.type}><span>{banner.text}</span></InlineNotice>}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by student name or email..."
              className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white"
            />
            <button
              type="button"
              disabled={busy}
              onClick={searchStudents}
              className="px-4 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              Search
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {rows.map((entry: any) => {
              const s = entry.student || entry;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                    selected?.id === s.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs">{s.displayName || s.email}</div>
                  <div className="text-[11px] opacity-75">{s.email}</div>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">
              Override for: {selected.displayName || selected.email}
            </h4>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Mandatory reason for audit log..."
              rows={3}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() => toggleComplimentary('GRANT')}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Grant Unlimited Access
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() => toggleComplimentary('REVOKE')}
                className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Revoke
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

export function OwnerFreeRuns() {
  const { data, reload, error } = useAdminData('/api/admin/owner/overview');
  const c = data?.data?.config || {};
  const [allowance, setAllowance] = useState(1);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (c.freeRunAllowance != null) setAllowance(Number(c.freeRunAllowance));
  }, [data]);

  const save = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson('/api/admin/owner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeRunAllowance: allowance }),
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Save failed.');
      setBanner({ type: 'success', text: 'Free run policy updated.' });
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Free Runs Policy"
      description="Default free generation allowance granted upon student registration."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {banner && <InlineNotice tone={banner.type}><span>{banner.text}</span></InlineNotice>}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md space-y-4 shadow-2xs">
        <label className="text-xs font-bold text-slate-700 block">Default Free Runs Allowance</label>
        <input
          type="number"
          min={0}
          max={20}
          value={allowance}
          onChange={e => setAllowance(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white"
        />
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="w-full py-2.5 px-4 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-2xs transition"
        >
          {busy ? 'Saving...' : 'Save Policy'}
        </button>
      </div>
    </Page>
  );
}

export function OwnerSettings() {
  const { data, reload, error } = useAdminData('/api/admin/owner/overview');
  const c = data?.data?.config || {};
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setForm({
      supportEmail: c.supportEmail || '',
      supportPhone: c.supportPhone || '',
      businessLocation: c.businessLocation || '',
    });
  }, [data]);

  const save = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson('/api/admin/owner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Save failed.');
      setBanner({ type: 'success', text: 'Global business settings saved.' });
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Settings & Contact" description="Global platform contact information." onRefresh={reload}>
      <ErrorBox error={error} />
      {banner && <InlineNotice tone={banner.type}><span>{banner.text}</span></InlineNotice>}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl space-y-4 shadow-2xs">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Support Email</label>
            <input
              value={form.supportEmail || ''}
              onChange={e => setForm({ ...form, supportEmail: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Support Phone / WhatsApp</label>
            <input
              value={form.supportPhone || ''}
              onChange={e => setForm({ ...form, supportPhone: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="w-full py-2.5 px-4 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-2xs transition"
        >
          {busy ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </Page>
  );
}
