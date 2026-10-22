import React, { useState } from 'react';
import {
  Users, Search, ShieldCheck, Key, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, X, ChevronLeft, ChevronRight, UserRound
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getAdminRole } from '../../../types/auth';
import { useAdminData } from '../adminShared';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, fmtDate } from '../adminShared';

const PAGE_SIZE = 25;
const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  SUSPENDED: 'bg-rose-50 text-rose-800 border-rose-200',
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
};

export function OwnerStudents() {
  const { user } = useAuth();
  const canManageAccountStatus = ['OWNER', 'ADMIN'].includes(getAdminRole(user) || '');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const { data, reload, error, loading } = useAdminData(
    `/api/admin/students?search=${encodeURIComponent(appliedSearch)}&page=${page}&pageSize=${PAGE_SIZE}&role=${roleFilter}&status=${statusFilter}`,
  );
  const students = data?.students || [];
  const total = Number(data?.total ?? students.length);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [freeRunsAdjustment, setFreeRunsAdjustment] = useState<number>(1);
  const [freeRunsReason, setFreeRunsReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusStudent, setStatusStudent] = useState<any | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleAdjustFreeRuns = async () => {
    if (!selectedStudent) return;
    if (!freeRunsReason.trim()) { setBanner({ type: 'error', text: 'Enter a reason for changing the allowance.' }); return; }
    setBusy(true);
    setBanner(null);
    try {
      const studentId = selectedStudent.id || selectedStudent.student?.id;
      const { response, data: responseData } = await fetchJson(`/api/admin/students/${encodeURIComponent(studentId)}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeRuns: Number(freeRunsAdjustment), reason: freeRunsReason.trim() }),
      });
      if (!response.ok) throw new Error((responseData as any)?.error || 'Could not update the free-run allowance.');
      setSelectedStudent(null);
      setFreeRunsReason('');
      setBanner({ type: 'success', text: `Free-run allowance updated for ${selectedStudent.displayName || selectedStudent.email}.` });
      await reload();
    } catch (error: any) {
      setBanner({ type: 'error', text: error?.message || 'Could not update the free-run allowance.' });
    } finally {
      setBusy(false);
    }
  };

  const handleAccountStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusStudent) return;
    const nextStatus = String(statusStudent.accountStatus).toUpperCase() === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (nextStatus === 'SUSPENDED' && !statusReason.trim()) {
      setBanner({ type: 'error', text: 'Enter a reason before suspending this account.' });
      return;
    }
    setStatusBusy(true);
    setBanner(null);
    try {
      const { response, data: responseData } = await fetchJson(`/api/admin/owner/students/${encodeURIComponent(statusStudent.id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason: nextStatus === 'SUSPENDED' ? statusReason.trim() : undefined }),
      });
      if (!response.ok) throw new Error((responseData as any)?.error || 'Could not update the account status.');
      setBanner({ type: 'success', text: `${statusStudent.displayName || statusStudent.email} is now ${nextStatus.toLowerCase()}.` });
      setStatusStudent(null);
      setStatusReason('');
      await reload();
    } catch (error: any) {
      setBanner({ type: 'error', text: error?.message || 'Could not update the account status.' });
    } finally {
      setStatusBusy(false);
    }
  };

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <Page
      title="Student directory"
      description="Find student accounts, check their current status and access, and manage free-run allowances."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {banner && <InlineNotice tone={banner.type}><div className="flex items-start justify-between gap-3 w-full"><span>{banner.text}</span><button type="button" onClick={() => setBanner(null)} className="text-xs font-semibold underline">Dismiss</button></div></InlineNotice>}

      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5" aria-label="Student directory filters">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_180px_170px_auto] gap-3 items-end">
          <div>
            <label htmlFor="student-search" className="block text-sm font-medium text-slate-800 mb-1.5">Search students</label>
            <div className="relative">
              <Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="student-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or account ID" className="w-full min-h-11 pl-9 pr-3 rounded-lg border border-slate-300 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
            </div>
          </div>
          <div>
            <label htmlFor="student-role" className="block text-sm font-medium text-slate-800 mb-1.5">Role</label>
            <select id="student-role" value={roleFilter} onChange={(event) => changeFilter(setRoleFilter, event.target.value)} className="w-full min-h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <option value="ALL">All roles</option><option value="STUDENT">Student</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option><option value="FINANCE">Finance</option><option value="SUPPORT">Support</option>
            </select>
          </div>
          <div>
            <label htmlFor="student-status" className="block text-sm font-medium text-slate-800 mb-1.5">Account status</label>
            <select id="student-status" value={statusFilter} onChange={(event) => changeFilter(setStatusFilter, event.target.value)} className="w-full min-h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <button type="submit" className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Search</button>
        </form>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-label="Student account results">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2"><Users aria-hidden="true" className="w-4 h-4 text-slate-500" /><h3 className="text-sm font-semibold text-slate-900">Accounts</h3><span className="text-xs text-slate-500">{total.toLocaleString()} total</span></div>
          <p className="text-xs text-slate-500">Showing {total ? ((page - 1) * PAGE_SIZE + 1).toLocaleString() : 0}–{Math.min(page * PAGE_SIZE, total).toLocaleString()}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Student account search results and account management actions</caption>
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr><th scope="col" className="px-4 py-3 font-semibold">Student</th><th scope="col" className="px-4 py-3 font-semibold">Role</th><th scope="col" className="px-4 py-3 font-semibold">Free runs</th><th scope="col" className="px-4 py-3 font-semibold">Status</th><th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">Joined</th><th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={6} className="p-10 text-center text-sm text-slate-500"><RefreshCw aria-hidden="true" className="w-4 h-4 animate-spin inline-block mr-2" />Loading accounts…</td></tr> : students.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center"><UserRound aria-hidden="true" className="w-7 h-7 mx-auto text-slate-300 mb-2" /><p className="text-sm font-medium text-slate-800">No accounts found</p><p className="text-sm text-slate-500 mt-1">Try a different search or filter.</p></td></tr>
              ) : students.map((entry: any) => {
                const student = entry.student || entry;
                const accountStatus = String(student.accountStatus || 'UNKNOWN').toUpperCase();
                const effectiveRole = String(student.adminRole && student.adminRole !== 'NONE' ? student.adminRole : student.role || 'STUDENT').toUpperCase();
                const ownAccount = student.id === user?.id;
                return <tr key={student.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3 min-w-[240px]">
                    <div className="flex items-start gap-3"><span className="w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-semibold">{String(student.displayName || student.email || 'S').slice(0, 1).toUpperCase()}</span><div className="min-w-0"><div className="font-medium text-slate-900 break-words">{student.displayName || 'Name not provided'}</div><div className="text-xs text-slate-500 break-all mt-0.5">{student.email}</div><div className="text-[11px] text-slate-400 font-mono mt-1 break-all">{student.id}</div></div></div>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">{effectiveRole}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className="font-semibold tabular-nums text-slate-900">{Number(student.freeRunsRemaining ?? student.freeRuns ?? 0).toLocaleString()}</span><span className="text-xs text-slate-500 ml-1">remaining</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${statusStyles[accountStatus] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{accountStatus === 'ACTIVE' ? <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" /> : accountStatus === 'SUSPENDED' ? <XCircle aria-hidden="true" className="w-3.5 h-3.5" /> : <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5" />}{accountStatus === 'UNKNOWN' ? 'Unknown' : accountStatus.toLowerCase()}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(student.createdAt)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2 min-w-[210px]">
                    <button type="button" onClick={() => { setSelectedStudent(student); setFreeRunsAdjustment(Number(student.freeRunsRemaining ?? student.freeRuns ?? 1)); setFreeRunsReason(''); }} className="inline-flex min-h-9 items-center gap-1.5 px-3 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><Key aria-hidden="true" className="w-3.5 h-3.5" />Quota</button>
                    {canManageAccountStatus && <button type="button" disabled={ownAccount || effectiveRole === 'OWNER' && accountStatus === 'ACTIVE'} title={ownAccount ? 'You cannot change your own account status here.' : effectiveRole === 'OWNER' && accountStatus === 'ACTIVE' ? 'Owner accounts are protected from suspension in this view.' : accountStatus === 'ACTIVE' ? 'Suspend this account' : 'Reactivate this account'} onClick={() => { setStatusStudent(student); setStatusReason(''); }} className="inline-flex min-h-9 items-center gap-1.5 px-3 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">{accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button>}
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white">
          <span className="text-xs text-slate-500">Page {page} of {pageCount}</span>
          <div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex items-center gap-1 px-3 min-h-9 rounded-lg border border-slate-300 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft aria-hidden="true" className="w-3.5 h-3.5" />Previous</button><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="inline-flex items-center gap-1 px-3 min-h-9 rounded-lg border border-slate-300 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">Next<ChevronRight aria-hidden="true" className="w-3.5 h-3.5" /></button></div>
        </div>
      </section>

      {selectedStudent && <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-3 sm:p-4"><div role="dialog" aria-modal="true" aria-labelledby="quota-dialog-title" className="bg-white w-full max-w-md rounded-xl border border-slate-200 overflow-hidden"><div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between"><div><h3 id="quota-dialog-title" className="font-semibold text-base">Adjust free runs</h3><p className="text-xs text-slate-500 mt-1">{selectedStudent.displayName || selectedStudent.email}</p></div><button type="button" aria-label="Close quota editor" onClick={() => { setSelectedStudent(null); setFreeRunsReason(''); }} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"><X aria-hidden="true" className="w-4 h-4" /></button></div><form onSubmit={(event) => { event.preventDefault(); void handleAdjustFreeRuns(); }} className="p-5 space-y-4"><div><label htmlFor="student-free-runs" className="block text-sm font-medium text-slate-800 mb-1.5">Remaining runs</label><input id="student-free-runs" type="number" min={0} max={50} required value={freeRunsAdjustment} onChange={(event) => setFreeRunsAdjustment(Math.max(0, Math.min(50, Number(event.target.value) || 0)))} className="w-full min-h-11 px-3 rounded-lg border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" /></div><div><label htmlFor="student-free-runs-reason" className="block text-sm font-medium text-slate-800 mb-1.5">Reason</label><textarea id="student-free-runs-reason" rows={3} maxLength={500} required value={freeRunsReason} onChange={(event) => setFreeRunsReason(event.target.value)} placeholder="Why is this allowance changing?" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm" /></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setSelectedStudent(null)} className="min-h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium">Cancel</button><button type="submit" disabled={busy || !freeRunsReason.trim()} className="min-h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save allowance'}</button></div></form></div></div>}

      {statusStudent && <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-3 sm:p-4"><div role="dialog" aria-modal="true" aria-labelledby="status-dialog-title" className="bg-white w-full max-w-md rounded-xl border border-slate-200 overflow-hidden"><div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3"><div><h3 id="status-dialog-title" className="font-semibold text-base">{String(statusStudent.accountStatus).toUpperCase() === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}</h3><p className="text-sm text-slate-500 mt-1">{statusStudent.displayName || statusStudent.email}</p></div><button type="button" aria-label="Close account status editor" onClick={() => setStatusStudent(null)} className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"><X aria-hidden="true" className="w-4 h-4" /></button></div><form onSubmit={handleAccountStatus} className="p-5 space-y-4"><p className="text-sm text-slate-600">{String(statusStudent.accountStatus).toUpperCase() === 'ACTIVE' ? 'The student will no longer be able to use account-protected features while suspended. This change is recorded in the audit trail.' : 'This restores normal account access. The change is recorded in the audit trail.'}</p>{String(statusStudent.accountStatus).toUpperCase() === 'ACTIVE' && <div><label htmlFor="suspension-reason" className="block text-sm font-medium text-slate-800 mb-1.5">Reason for suspension</label><textarea id="suspension-reason" rows={3} maxLength={500} required value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Record a concise, operational reason." className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" /><p className="text-xs text-slate-500 mt-1">{statusReason.length}/500</p></div>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setStatusStudent(null)} className="min-h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium">Cancel</button><button type="submit" disabled={statusBusy || (String(statusStudent.accountStatus).toUpperCase() === 'ACTIVE' && !statusReason.trim())} className={`min-h-10 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${String(statusStudent.accountStatus).toUpperCase() === 'ACTIVE' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>{statusBusy ? 'Saving…' : String(statusStudent.accountStatus).toUpperCase() === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}</button></div></form></div></div>}
    </Page>
  );
}
