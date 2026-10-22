import React, { useState } from 'react';
import {
  Key, Plus, Search, Filter, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Clock, Calendar, Users, X
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn, fmt, fmtDate } from '../adminShared';
import { devLogError } from '../../../utils/clientLogger';

export function OwnerEntitlements() {
  const { data, reload, error, loading } = useAdminData('/api/admin/entitlements');
  const entitlements = data?.entitlements || [];

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [isGranting, setIsGranting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [plan, setPlan] = useState('full_semester');
  const [days, setDays] = useState(120);
  const [grantReason, setGrantReason] = useState('');
  const [granting, setGranting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const searchStudents = async () => {
    if (!studentSearch.trim()) return;
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/students?search=${encodeURIComponent(studentSearch.trim())}`);
      if (response.ok) {
        setStudentResults((resData as any)?.students || []);
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Could not search for students.' });
      devLogError('Entitlement student search failed.');
    }
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!grantReason.trim()) { setBanner({ type: 'error', text: 'Enter a reason for granting access.' }); return; }
    setGranting(true);
    setBanner(null);

    try {
      const { response, data: resData } = await fetchJson('/api/admin/entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          plan,
          days: Number(days),
          reason: grantReason.trim(),
        }),
      });

      if (!response.ok) throw new Error((resData as any)?.error || 'Could not grant entitlement.');
      setBanner({ type: 'success', text: `Access granted to ${selectedStudent.displayName || selectedStudent.email}!` });
      setIsGranting(false);
      setSelectedStudent(null);
      setGrantReason('');
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to grant entitlement.' });
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (entitlementId: string) => {
    const reason = window.prompt('Please enter a reason for revoking this entitlement:', 'Administrative revocation');
    if (!reason || !reason.trim()) return;
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/entitlements/${encodeURIComponent(entitlementId)}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Revoke failed');
      setBanner({ type: 'success', text: 'Entitlement revoked successfully.' });
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Could not revoke access.' });
    }
  };

  const filtered = entitlements.filter((e: any) => {
    const item = e.entitlement || e;
    const nameMatch = !search ||
      (e.studentDisplayName || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.studentEmail || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.studentId || '').toLowerCase().includes(search.toLowerCase());

    const isExpired = item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();
    if (filterStatus === 'ACTIVE' && isExpired) return false;
    if (filterStatus === 'EXPIRED' && !isExpired) return false;
    return nameMatch;
  });

  return (
    <Page
      title="Student Access Entitlements"
      description="Active semester passes, complimentary permissions, expiry dates, and manual access overrides."
      onRefresh={reload}
    >
      <ErrorBox error={error} />

      {banner && (
        <InlineNotice tone={banner.type}>
          <div className="flex items-center justify-between w-full">
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="text-xs font-bold underline cursor-pointer">
              Dismiss
            </button>
          </div>
        </InlineNotice>
      )}

      {/* Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by student name or email..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['ALL', 'ACTIVE', 'EXPIRED'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterStatus === st ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsGranting(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Grant Access</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Student</th>
                <th className="p-3.5">Plan / Tier</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Granted On</th>
                <th className="p-3.5">Expires</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Loading entitlements...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">No entitlements found matching criteria.</td>
                </tr>
              ) : (
                filtered.map((e: any) => {
                  const item = e.entitlement || e;
                  const isExpired = item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 min-w-[200px]">
                        <div className="font-bold text-slate-900">{e.studentDisplayName || item.studentEmail || item.studentId}</div>
                        <div className="text-[11px] text-slate-400">{item.studentEmail}</div>
                      </td>
                      <td className="p-3.5 font-bold uppercase tracking-wide text-slate-700">
                        {item.plan || 'Semester Pass'}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          isExpired
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {isExpired ? 'EXPIRED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">{fmtDate(item.createdAt)}</td>
                      <td className="p-3.5 font-semibold text-slate-800 whitespace-nowrap">{fmtDate(item.expiresAt)}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevoke(item.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Grant Modal */}
      {isGranting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">Grant Student Entitlement</h3>
              <button type="button" aria-label="Close grant access dialog" onClick={() => { setIsGranting(false); setSelectedStudent(null); setGrantReason(''); }} className="w-10 h-10 inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGrant} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Student</label>
                {!selectedStudent ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        placeholder="Search student by name or email..."
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={searchStudents}
                        className="px-3 py-2 bg-slate-900 text-white font-bold rounded-xl"
                      >
                        Find
                      </button>
                    </div>
                    {studentResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {studentResults.map((s: any) => (
                          <button
                            type="button"
                            key={s.id || s.student?.id}
                            onClick={() => setSelectedStudent(s.student || s)}
                            className="w-full text-left p-2.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 flex justify-between items-center"
                          >
                            <span className="font-bold">{s.displayName || s.email}</span>
                            <span className="text-[11px] text-slate-400">{s.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-emerald-900">{selectedStudent.displayName || selectedStudent.email}</div>
                      <div className="text-[11px] text-emerald-700">{selectedStudent.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="text-emerald-700 hover:text-emerald-900 font-bold underline text-xs"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Plan Package</label>
                <select
                  value={plan}
                  onChange={e => setPlan(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
                >
                  <option value="full_semester">Full Semester Pass</option>
                  <option value="monthly_trial">Monthly Extension</option>
                  <option value="complimentary">Complimentary Override</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={e => setDays(Number(e.target.value) || 1)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="entitlement-grant-reason" className="block font-bold text-slate-700 mb-1">Reason for granting access</label>
                <textarea id="entitlement-grant-reason" rows={3} maxLength={500} required value={grantReason} onChange={e => setGrantReason(e.target.value)} placeholder="Record why this student is receiving manual access." className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsGranting(false); setSelectedStudent(null); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={granting || !selectedStudent}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {granting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{granting ? 'Granting...' : 'Grant Entitlement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}
