import React, { useState } from 'react';
import {
  CreditCard, CheckCircle2, XCircle, Clock, Eye, AlertTriangle,
  RefreshCw, Search, Filter, ExternalLink, MessageSquare, X
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn, money, fmt, fmtDate } from '../adminShared';

export function OwnerPayments() {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const { data, reload, error, loading } = useAdminData('/api/admin/payments');
  const payments = data?.payments || [];

  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApprove = async (paymentId: string) => {
    setActionBusy(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/payments/${encodeURIComponent(paymentId)}/approve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Approval failed.');
      setBanner({ type: 'success', text: 'Payment approved! Student pass entitlement activated.' });
      setSelectedPayment(null);
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to approve payment.' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (paymentId: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting this payment submission.');
      return;
    }

    setActionBusy(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/payments/${encodeURIComponent(paymentId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Rejection failed.');
      setBanner({ type: 'success', text: 'Payment rejected and student notified with reason.' });
      setSelectedPayment(null);
      setRejectReason('');
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to reject payment.' });
    } finally {
      setActionBusy(false);
    }
  };

  const filtered = payments.filter((p: any) => {
    const item = p.payment || p;
    const matchesSearch = !search ||
      (item.studentEmail || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.studentDisplayName || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.referenceNumber || '').toLowerCase().includes(search.toLowerCase());

    const status = (item.status || 'PENDING').toUpperCase();
    const matchesStatus = filterStatus === 'ALL' || status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <Page
      title="Payment Verification & Billing Ledger"
      description="Review student manual transfer proofs (InstaPay, Vodafone Cash), verify receipts, and grant semester access."
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

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by student, email, reference number, or ID..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  filterStatus === st ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Student</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Method</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Date Submitted</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Loading payment submissions...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">No payment records found.</td>
                </tr>
              ) : (
                filtered.map((entry: any) => {
                  const p = entry.payment || entry;
                  const status = (p.status || 'PENDING').toUpperCase();

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 min-w-[200px]">
                        <div className="font-bold text-slate-900">{p.studentDisplayName || p.studentEmail || p.studentId}</div>
                        <div className="text-[11px] text-slate-400">{p.studentEmail}</div>
                      </td>
                      <td className="p-3.5 font-black text-slate-900">{money(p.amount)}</td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-700 uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                          {p.paymentMethod || 'MANUAL'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                          status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">{fmt(p.createdAt)}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedPayment(p)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                        >
                          Review
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

      {/* Review Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Review Payment Submission</h3>
                <span className="text-[11px] text-slate-400 font-mono">ID: {selectedPayment.id}</span>
              </div>
              <button onClick={() => setSelectedPayment(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Student</span>
                  <span className="font-bold text-slate-900">{selectedPayment.studentDisplayName || selectedPayment.studentEmail}</span>
                  <span className="block text-slate-500">{selectedPayment.studentEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Amount</span>
                  <span className="font-black text-emerald-700 text-sm">{money(selectedPayment.amount)}</span>
                  <span className="block text-slate-500 uppercase">{selectedPayment.paymentMethod}</span>
                </div>
              </div>

              {selectedPayment.proofUrl && (
                <div>
                  <span className="block font-bold text-slate-700 mb-1">Transfer Screenshot / Receipt Proof</span>
                  <a
                    href={selectedPayment.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block border border-slate-200 rounded-xl overflow-hidden hover:opacity-90 transition"
                  >
                    <img
                      src={selectedPayment.proofUrl}
                      alt="Payment proof"
                      className="w-full max-h-64 object-contain bg-slate-900"
                    />
                  </a>
                </div>
              )}

              {selectedPayment.referenceNumber && (
                <div>
                  <span className="block font-bold text-slate-700">Reference Number:</span>
                  <span className="font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded-md">{selectedPayment.referenceNumber}</span>
                </div>
              )}

              {selectedPayment.notes && (
                <div>
                  <span className="block font-bold text-slate-700">Student Notes:</span>
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">{selectedPayment.notes}</p>
                </div>
              )}

              {selectedPayment.status === 'PENDING' && (
                <div className="pt-2">
                  <label className="block font-bold text-slate-700 mb-1">Rejection Reason (If rejecting)</label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="e.g. Unreadable receipt screenshot or transfer not received..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl text-xs"
              >
                Close
              </button>

              {selectedPayment.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleReject(selectedPayment.id)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApprove(selectedPayment.id)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {actionBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Approve & Grant</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
