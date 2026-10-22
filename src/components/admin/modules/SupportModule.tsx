import React, { useEffect, useState } from 'react';
import { LifeBuoy, Send, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, fmt } from '../adminShared';

type TicketStatusFilter = 'ALL' | 'OPEN' | 'RESOLVED';
type PriorityFilter = 'ALL' | 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

const PAGE_SIZE = 25;

export function OwnerSupport() {
  const [filterStatus, setFilterStatus] = useState<TicketStatusFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [threadRefresh, setThreadRefresh] = useState(0);
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status: filterStatus, priority: priorityFilter });
  if (debouncedSearch) query.set('search', debouncedSearch);
  const { data, reload, error, loading } = useAdminData(`/api/admin/support?${query.toString()}`);
  const tickets = data?.tickets || [];
  const total = Number(data?.total || 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!selectedTicket?.id) return;
    let active = true;
    setThreadLoading(true);
    setThreadError('');
    void fetchJson(`/api/admin/support/${encodeURIComponent(selectedTicket.id)}/thread`)
      .then(({ response, data: resData }) => {
        if (!response.ok) throw new Error((resData as any)?.error || 'Could not load conversation.');
        if (active && (resData as any)?.ticket) setSelectedTicket((resData as any).ticket);
      })
      .catch((err: any) => {
        if (active) setThreadError(err?.message || 'Could not load conversation.');
      })
      .finally(() => { if (active) setThreadLoading(false); });
    return () => { active = false; };
  }, [selectedTicket?.id, threadRefresh]);

  useEffect(() => {
    if (selectedTicket?.id && !tickets.some((ticket: any) => ticket.id === selectedTicket.id) && !loading && page === 1) {
      // Keep the selected conversation readable when a filter changes; it may simply no longer match the list.
    }
  }, [tickets, selectedTicket?.id, loading, page]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim() || busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/support/${encodeURIComponent(selectedTicket.id)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Could not post support reply.');
      setBanner({ type: 'success', text: 'Reply sent to student.' });
      setReplyMessage('');
      setThreadRefresh(v => v + 1);
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to send reply.' });
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (ticketId: string, status: 'RESOLVED' | 'OPEN') => {
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/support/${encodeURIComponent(ticketId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Status change failed.');
      setSelectedTicket((current: any) => current?.id === ticketId ? { ...current, status } : current);
      setBanner({ type: 'success', text: status === 'RESOLVED' ? 'Inquiry marked as resolved.' : 'Inquiry reopened.' });
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to update status.' });
    } finally {
      setBusy(false);
    }
  };

  const setStatusFilter = (status: TicketStatusFilter) => { setFilterStatus(status); setPage(1); };
  const isResolved = (status: string) => status === 'RESOLVED' || status === 'CLOSED';

  return (
    <Page
      title="Support"
      description="Read student inquiries, send replies, and track unresolved requests."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {banner && (
        <InlineNotice tone={banner.type}>
          <div className="flex w-full items-center justify-between gap-3">
            <span>{banner.text}</span>
            <button type="button" onClick={() => setBanner(null)} className="min-h-9 text-sm underline">Dismiss</button>
          </div>
        </InlineNotice>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3" aria-label="Support filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search support inquiries</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search student, email, subject or message"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              type="search"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Priority</span>
            <select
              value={priorityFilter}
              onChange={event => { setPriorityFilter(event.target.value as PriorityFilter); setPage(1); }}
              className="min-h-11 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="ALL">All priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {(['ALL', 'OPEN', 'RESOLVED'] as const).map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              aria-pressed={filterStatus === status}
              className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${filterStatus === status ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {status === 'ALL' ? 'All inquiries' : status === 'OPEN' ? 'Needs attention' : 'Resolved'}
            </button>
          ))}
          <span className="ml-auto self-center text-sm text-slate-500">{total.toLocaleString()} {total === 1 ? 'inquiry' : 'inquiries'}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <section className="flex max-h-[720px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-1" aria-label="Inquiry list">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Inquiries</h3>
            <span className="text-xs text-slate-500">Page {page} of {pageCount}</span>
          </div>
          <div className="min-h-44 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading inquiries…</div>
            ) : tickets.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No inquiries match these filters.</div>
            ) : tickets.map((ticket: any) => {
              const selected = selectedTicket?.id === ticket.id;
              const resolved = isResolved(ticket.status);
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => { setSelectedTicket(ticket); setThreadError(''); }}
                  aria-pressed={selected}
                  className={`block min-h-24 w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${selected ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{ticket.subject || 'Student inquiry'}</span>
                    <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ${resolved ? 'bg-slate-100 text-slate-600' : ticket.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{ticket.status || 'OPEN'}</span>
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-600">{ticket.studentName || ticket.studentEmail || 'Account not linked'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <span>{ticket.studentEmail || 'No email available'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{fmt(ticket.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(v => Math.max(1, v - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
            </button>
            <span className="text-xs text-slate-500">{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}` : '0 results'}</span>
            <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage(v => Math.min(pageCount, v + 1))} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
              Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="flex min-h-[440px] min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-2" aria-label="Selected inquiry conversation">
          {selectedTicket ? (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold text-slate-900">{selectedTicket.subject || 'Student inquiry'}</h3>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    From {selectedTicket.studentName ? `${selectedTicket.studentName} · ` : ''}{selectedTicket.studentEmail || 'unlinked student'} · {fmt(selectedTicket.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Priority: {selectedTicket.priority || 'NORMAL'} · Status: {selectedTicket.status || 'OPEN'}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleResolve(selectedTicket.id, isResolved(selectedTicket.status) ? 'OPEN' : 'RESOLVED')}
                  className="min-h-10 shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {isResolved(selectedTicket.status) ? 'Reopen inquiry' : 'Mark resolved'}
                </button>
              </div>
              <div className="flex-1 space-y-3 py-4">
                <article className="rounded-lg bg-slate-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original message</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{selectedTicket.description || 'No description provided.'}</p>
                </article>
                {threadLoading && <p className="text-sm text-slate-500">Loading conversation…</p>}
                {threadError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{threadError} <button type="button" className="ml-2 underline" onClick={() => setThreadRefresh(v => v + 1)}>Try again</button></p>}
                {!threadLoading && !threadError && (selectedTicket.messages || []).map((message: any) => (
                  <article key={message.id} className={`rounded-lg border p-3 sm:p-4 ${message.authorType === 'ADMIN' ? 'ml-3 border-emerald-100 bg-emerald-50/50 sm:ml-8' : 'mr-3 border-slate-200 bg-white sm:mr-8'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{message.authorType === 'ADMIN' ? 'Admin reply' : 'Student reply'}</span>
                      <time dateTime={message.createdAt ? new Date(message.createdAt).toISOString() : undefined}>{fmt(message.createdAt)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{message.body}</p>
                  </article>
                ))}
                {!threadLoading && !threadError && !(selectedTicket.messages || []).length && (
                  <p className="text-sm text-slate-500">No replies yet.</p>
                )}
              </div>
              <form onSubmit={handleSendReply} className="space-y-3 border-t border-slate-200 pt-4">
                <div>
                  <label htmlFor="support-reply" className="mb-1.5 block text-sm font-medium text-slate-800">Reply to student</label>
                  <textarea
                    id="support-reply"
                    rows={4}
                    value={replyMessage}
                    onChange={event => setReplyMessage(event.target.value)}
                    maxLength={5000}
                    placeholder="Write a clear, helpful response…"
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <div className="mt-1 text-right text-xs text-slate-500">{replyMessage.length}/5000</div>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">The reply is recorded in the conversation and an in-app notification is sent where supported.</p>
                  <button type="submit" disabled={busy || !replyMessage.trim() || threadLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                    {busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    Send reply
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <LifeBuoy className="h-9 w-9 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">Choose an inquiry</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-600">Select an item from the list to read the full conversation and reply.</p>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
