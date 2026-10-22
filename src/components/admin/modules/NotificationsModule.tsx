import React, { useEffect, useState } from 'react';
import { Bell, Send, RefreshCw, MessageSquare, Users, CalendarClock, Save } from 'lucide-react';
import { useAdminData, Page, ErrorBox, InlineNotice } from '../adminShared';
import { fetchJson } from '../../../services/resilientFetch';

type Audience = 'ALL' | 'ACTIVE' | 'PAID' | 'FREE' | 'EXPIRING' | 'STUDENT';
type DeliveryMode = 'SEND' | 'DRAFT' | 'SCHEDULED';
function getCampaignPriority(campaign: any): 'NORMAL' | 'HIGH' | 'URGENT' {
  const legacy = String(campaign?.type || '').toUpperCase();
  if (legacy === 'NORMAL' || legacy === 'HIGH' || legacy === 'URGENT') return legacy;
  const priority = String(campaign?.priority || 'NORMAL').toUpperCase();
  return priority === 'HIGH' || priority === 'URGENT' ? priority : 'NORMAL';
}
const audienceLabels: Record<Audience, string> = {
  ALL: 'All registered students',
  ACTIVE: 'Active accounts',
  PAID: 'Students with an active pass',
  FREE: 'Registered students without an active pass',
  EXPIRING: 'Passes expiring within 30 days',
  STUDENT: 'One student',
};

export function OwnerNotifications() {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/notifications');
  const campaigns = data?.campaigns || [];
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState<Audience>('ALL');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('SEND');
  const [scheduledAt, setScheduledAt] = useState('');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentMatches, setStudentMatches] = useState<any[]>([]);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
  const [studentLookupError, setStudentLookupError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [actioningCampaignId, setActioningCampaignId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formError, setFormError] = useState('');
  const recipientQuery = new URLSearchParams({ scope: targetAudience });
  if (targetAudience === 'STUDENT' && selectedStudent) recipientQuery.set('studentId', selectedStudent.id);
  const { data: recipientData, error: recipientError, loading: recipientLoading } = useAdminData(
    `/api/admin/owner/notifications/recipients?${recipientQuery.toString()}`,
  );

  useEffect(() => {
    if (targetAudience !== 'STUDENT' || selectedStudent || studentSearch.trim().length < 2) {
      setStudentMatches([]); setStudentLookupError(''); setStudentLookupLoading(false); return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStudentLookupLoading(true); setStudentLookupError('');
      try {
        const { response, data: result } = await fetchJson(`/api/admin/students?search=${encodeURIComponent(studentSearch.trim())}&page=1&pageSize=10`, { signal: controller.signal });
        if (!response.ok) throw new Error((result as any)?.error || 'Could not search students.');
        setStudentMatches(Array.isArray((result as any)?.students) ? (result as any).students.map((entry: any) => ({ id: entry.student?.id, name: entry.student?.displayName || '', email: entry.student?.email || '' })).filter((entry: any) => entry.id) : []);
      } catch (error: any) {
        if (!controller.signal.aborted) setStudentLookupError(error?.message || 'Could not search students.');
      } finally { if (!controller.signal.aborted) setStudentLookupLoading(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [targetAudience, selectedStudent, studentSearch]);
  const recipientCount = Number(recipientData?.recipients ?? 0);
  const maxRecipients = Number(recipientData?.maximumRecipients ?? 10000);
  const hasContent = title.trim().length > 0 && body.trim().length > 0;
  const recipientGate = !recipientLoading && !recipientError && Boolean(recipientData) && recipientCount > 0 && recipientCount <= maxRecipients;
  const scheduleIsFuture = Boolean(scheduledAt) && new Date(scheduledAt).getTime() > Date.now();
  const validStudentTarget = targetAudience !== 'STUDENT' || Boolean(selectedStudent);
  const canSubmit = !sending && hasContent && (deliveryMode === 'DRAFT' || (validStudentTarget && recipientGate && (deliveryMode !== 'SCHEDULED' || scheduleIsFuture))); 
  const minScheduleTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const handleSubmitCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setBanner(null);
    if (!title.trim() || !body.trim()) {
      setFormError('Enter both a title and a message.');
      return;
    }
    if (targetAudience === 'STUDENT' && !selectedStudent) {
      setFormError('Search for and select the student who should receive this announcement.');
      return;
    }
    if (deliveryMode !== 'DRAFT') {
      if (recipientLoading || recipientError || !recipientData) {
        setFormError('The recipient count is not available. Refresh the page or try again before scheduling or sending.');
        return;
      }
      if (recipientCount < 1) {
        setFormError('This audience has no recipients. Nothing was scheduled or sent.');
        return;
      }
      if (recipientCount > maxRecipients) {
        setFormError(`This audience has ${recipientCount.toLocaleString()} recipients. The current limit is ${maxRecipients.toLocaleString()}. Narrow the audience first.`);
        return;
      }
    }
    if (deliveryMode === 'SCHEDULED' && !scheduleIsFuture) {
      setFormError('Choose a future date and time to schedule this announcement.');
      return;
    }
    if (deliveryMode === 'SEND') {
      const confirmed = window.confirm(
        `Send “${title.trim()}” to ${recipientCount.toLocaleString()} ${recipientCount === 1 ? 'student' : 'students'} in “${audienceLabels[targetAudience]}”? This cannot be undone.`,
      );
      if (!confirmed) return;
    } else if (deliveryMode === 'SCHEDULED') {
      const confirmed = window.confirm(
        `Schedule “${title.trim()}” for ${new Date(scheduledAt).toLocaleString()} to ${recipientCount.toLocaleString()} ${recipientCount === 1 ? 'student' : 'students'}?`,
      );
      if (!confirmed) return;
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(), message: body.trim(), scope: targetAudience, priority, status: deliveryMode,
      };
      if (targetAudience === 'STUDENT' && selectedStudent) payload.studentId = selectedStudent.id;
      if (deliveryMode === 'SCHEDULED') payload.scheduledAt = new Date(scheduledAt).toISOString();
      const { response, data: responseData } = await fetchJson(editingCampaignId ? `/api/admin/owner/notifications/campaigns/${encodeURIComponent(editingCampaignId)}` : '/api/admin/owner/notifications/campaigns', {
        method: editingCampaignId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((responseData as any)?.error || 'The campaign could not be saved.');
      const sent = Number((responseData as any)?.sent ?? 0);
      if (editingCampaignId) {
        setBanner({ type: 'success', text: deliveryMode === 'SCHEDULED' ? 'Scheduled announcement updated.' : 'Draft changes saved.' });
      } else if (deliveryMode === 'SEND') {
        setBanner({ type: 'success', text: `Announcement sent to ${sent.toLocaleString()} ${sent === 1 ? 'student' : 'students'}.` });
      } else if (deliveryMode === 'SCHEDULED') {
        setBanner({ type: 'success', text: `Announcement scheduled for ${new Date(scheduledAt).toLocaleString()}.` });
      } else {
        setBanner({ type: 'success', text: 'Draft saved. Nothing was sent to students.' });
      }
      setTitle(''); setBody(''); setScheduledAt(''); setDeliveryMode('SEND'); setEditingCampaignId(null); setSelectedStudent(null); setStudentSearch('');
      await reload();
    } catch (error: any) {
      setBanner({ type: 'error', text: error?.message || 'The announcement could not be sent. No success was recorded.' });
    } finally {
      setSending(false);
    }
  };

  const resetComposer = () => {
    setTitle(''); setBody(''); setScheduledAt(''); setTargetAudience('ALL'); setPriority('NORMAL');
    setDeliveryMode('SEND'); setEditingCampaignId(null); setSelectedStudent(null); setStudentSearch(''); setFormError('');
  };

  const editCampaign = (campaign: any) => {
    const scope = String(campaign.targetScope || 'ALL').toUpperCase();
    if (scope === 'STUDENT') {
      setBanner({ type: 'error', text: 'This saved campaign targets one student. To avoid losing its recipient identity, edit it from the original draft workflow or create a new campaign.' });
      return;
    }
    setEditingCampaignId(String(campaign.id)); setTitle(String(campaign.title || '')); setBody(String(campaign.message || ''));
    setTargetAudience((['ALL','ACTIVE','PAID','FREE','EXPIRING'].includes(scope) ? scope : 'ALL') as Audience);
    setPriority(getCampaignPriority(campaign));
    if (String(campaign.status).toUpperCase() === 'SCHEDULED' && campaign.scheduledAt) {
      const d = new Date(campaign.scheduledAt); setScheduledAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16)); setDeliveryMode('SCHEDULED');
    } else { setScheduledAt(''); setDeliveryMode('DRAFT'); }
    setFormError(''); setBanner(null);
    document.getElementById('announcement-composer-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const runCampaignAction = async (campaign: any, action: 'CANCEL'|'RETRY'|'SEND_NOW') => {
    const id = String(campaign.id);
    if (action === 'CANCEL' && !window.confirm(`Cancel the scheduled announcement “${campaign.title}”? It will not be sent.`)) return;
    if (action === 'RETRY' && !window.confirm(`Queue “${campaign.title}” for another delivery attempt? The server will re-check its audience when it runs.`)) return;
    if (action === 'SEND_NOW') {
      try {
        const query = new URLSearchParams({ scope: String(campaign.targetScope || 'ALL') });
        if (campaign.targetStudentId) query.set('studentId', String(campaign.targetStudentId));
        const { response, data: preview } = await fetchJson(`/api/admin/owner/notifications/recipients?${query.toString()}`);
        if (!response.ok) throw new Error((preview as any)?.error || 'The recipient count could not be verified.');
        const count = Number((preview as any)?.recipients || 0);
        const max = Number((preview as any)?.maximumRecipients || 10000);
        if (count < 1 || count > max) throw new Error(count < 1 ? 'This audience has no recipients. Nothing was sent.' : 'This audience exceeds the send limit. Narrow it first.');
        if (!window.confirm(`Send “${campaign.title}” to ${count.toLocaleString()} ${count === 1 ? 'student' : 'students'} now? Recipients will be revalidated by the server.`)) return;
      } catch (error: any) {
        setBanner({ type: 'error', text: error?.message || 'Could not verify recipients. Nothing was sent.' }); return;
      }
    }
    setActioningCampaignId(id); setBanner(null);
    try {
      const { response, data: result } = await fetchJson(`/api/admin/owner/notifications/campaigns/${encodeURIComponent(id)}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error((result as any)?.error || 'The campaign action failed.');
      setBanner({ type: 'success', text: (result as any)?.message || 'Campaign updated.' });
      if (editingCampaignId === id) resetComposer();
      await reload();
    } catch (error: any) {
      setBanner({ type: 'error', text: error?.message || 'The campaign action failed. Refresh the history and try again.' });
    } finally { setActioningCampaignId(null); }
  };

  return (
    <Page
      title="Announcements"
      description="Send an in-app message to a defined student audience and keep a record of each dispatch."
      onRefresh={reload}
    >
      <ErrorBox error={error} />
      {banner && <InlineNotice tone={banner.type}><div className="flex items-start justify-between gap-3 w-full"><span>{banner.text}</span><button type="button" onClick={() => setBanner(null)} className="text-xs font-semibold underline">Dismiss</button></div></InlineNotice>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] gap-5 items-start">
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5" aria-labelledby="announcement-composer-title">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0"><Bell aria-hidden="true" className="w-5 h-5" /></div>
            <div><h3 id="announcement-composer-title" className="font-semibold text-base">New announcement</h3><p className="text-sm text-slate-500 mt-1">Choose recipients carefully. The count is checked against the same server-side audience rule used for dispatch.</p></div>
          </div>

          {banner?.type === 'error' && <div className="text-sm text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-lg">{banner.text}</div>}
          {formError && <div role="alert" className="text-sm text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-lg">{formError}</div>}

          <form onSubmit={handleSubmitCampaign} className="space-y-4">
            <div>
              <label htmlFor="announcement-audience" className="block text-sm font-medium text-slate-800 mb-1.5">Recipients</label>
              <select id="announcement-audience" value={targetAudience} onChange={(event) => setTargetAudience(event.target.value as Audience)} className="w-full min-h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                <option value="ALL">{audienceLabels.ALL}</option>
                <option value="ACTIVE">{audienceLabels.ACTIVE}</option>
                <option value="PAID">{audienceLabels.PAID}</option>
                <option value="FREE">{audienceLabels.FREE}</option>
                <option value="EXPIRING">{audienceLabels.EXPIRING}</option>
                <option value="STUDENT">{audienceLabels.STUDENT}</option>
              </select>
              {targetAudience === 'STUDENT' && <div className="mt-3 space-y-2">
                {selectedStudent ? <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="min-w-0"><p className="text-sm font-semibold text-emerald-900 truncate">{selectedStudent.name || selectedStudent.email}</p><p className="text-xs text-emerald-800 truncate">{selectedStudent.email}</p></div><button type="button" onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} className="text-xs font-semibold text-emerald-900 underline shrink-0">Change</button></div> : <>
                  <label htmlFor="announcement-student-search" className="block text-xs font-medium text-slate-700">Find a registered student by name, email or ID</label>
                  <input id="announcement-student-search" value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Start typing at least 2 characters" className="w-full min-h-10 px-3 border border-slate-300 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
                  {studentLookupLoading && <p className="text-xs text-slate-500">Searching…</p>}
                  {studentLookupError && <p role="alert" className="text-xs text-rose-700">{studentLookupError}</p>}
                  {studentMatches.length > 0 && <ul className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100" aria-label="Student search results">{studentMatches.map(student => <li key={student.id}><button type="button" onClick={() => { setSelectedStudent(student); setStudentSearch(''); setStudentMatches([]); }} className="w-full p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"><span className="block text-sm font-medium text-slate-900">{student.name || 'Unnamed student'}</span><span className="block text-xs text-slate-500">{student.email} · {student.id}</span></button></li>)}</ul>}
                  {studentSearch.trim().length >= 2 && !studentLookupLoading && !studentLookupError && studentMatches.length === 0 && <p className="text-xs text-slate-500">No students found for that search.</p>}
                </>}
              </div>}
              <div className={`mt-2 rounded-lg border p-3 ${recipientError || (recipientData && recipientCount > maxRecipients) ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`} aria-live="polite">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Users aria-hidden="true" className="w-4 h-4 text-slate-500" />
                  {recipientLoading ? 'Counting recipients…' : recipientError ? 'Recipient count unavailable' : `${recipientCount.toLocaleString()} ${recipientCount === 1 ? 'recipient' : 'recipients'}`}
                </div>
                {recipientError ? <p className="text-xs text-rose-700 mt-1">{recipientError}</p> : <p className="text-xs text-slate-500 mt-1">Maximum per send: {maxRecipients.toLocaleString()}. {targetAudience === 'FREE' ? 'This means registered accounts with no active entitlement; it does not include anonymous site visitors.' : ''}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="announcement-priority" className="block text-sm font-medium text-slate-800 mb-1.5">Priority</label>
              <select id="announcement-priority" value={priority} onChange={(event) => setPriority(event.target.value as any)} className="w-full min-h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                <option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label htmlFor="announcement-title" className="block text-sm font-medium text-slate-800 mb-1.5">Title</label>
              <input id="announcement-title" type="text" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="For example, registration closes Friday" className="w-full min-h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
              <p className="text-xs text-slate-500 text-right mt-1">{title.length}/160</p>
            </div>

            <div>
              <label htmlFor="announcement-message" className="block text-sm font-medium text-slate-800 mb-1.5">Message</label>
              <textarea id="announcement-message" required maxLength={2000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the message students will receive." className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm leading-6 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 resize-y" />
              <p className="text-xs text-slate-500 text-right mt-1">{body.length}/2000</p>
            </div>

            <div>
              <label htmlFor="announcement-delivery" className="block text-sm font-medium text-slate-800 mb-1.5">When should this go out?</label>
              <select id="announcement-delivery" value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as DeliveryMode)} className="w-full min-h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                {!editingCampaignId && <option value="SEND">Send now</option>}
                <option value="SCHEDULED">Schedule for later</option>
                <option value="DRAFT">Save as draft</option>
              </select>
              {deliveryMode === 'SCHEDULED' && <div className="mt-3"><label htmlFor="announcement-schedule-time" className="block text-sm font-medium text-slate-800 mb-1.5">Send date and time (your local time)</label><input id="announcement-schedule-time" type="datetime-local" required min={minScheduleTime} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="w-full min-h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" /><p className="text-xs text-slate-500 mt-1">The server validates that the scheduled time is still in the future.</p></div>}
            </div>

            <button type="submit" disabled={!canSubmit} className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
              {sending ? <RefreshCw aria-hidden="true" className="w-4 h-4 animate-spin" /> : deliveryMode === 'DRAFT' ? <Save aria-hidden="true" className="w-4 h-4" /> : deliveryMode === 'SCHEDULED' ? <CalendarClock aria-hidden="true" className="w-4 h-4" /> : <Send aria-hidden="true" className="w-4 h-4" />}
              {sending ? 'Saving…' : editingCampaignId ? (deliveryMode === 'SCHEDULED' ? 'Save schedule' : 'Save changes') : deliveryMode === 'DRAFT' ? 'Save draft' : deliveryMode === 'SCHEDULED' ? 'Review and schedule' : 'Review and send'}
            </button>
            <p className="text-xs text-slate-500">Drafts and scheduled announcements are saved in the same history. Scheduled sends are handled by the server and may require the campaign worker to be running.</p>
            {editingCampaignId && <button type="button" onClick={resetComposer} className="w-full min-h-10 text-sm font-medium text-slate-600 hover:text-slate-900">Stop editing</button>}
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6" aria-labelledby="announcement-history-title">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4 mb-2">
            <div><h3 id="announcement-history-title" className="font-semibold text-base">Announcement history</h3><p className="text-sm text-slate-500 mt-1">Saved campaigns and their latest dispatch status.</p></div>
            <span className="text-xs text-slate-500">{campaigns.length} records</span>
          </div>
          {loading ? <div className="py-10 text-center text-sm text-slate-500">Loading announcement history…</div> : campaigns.length === 0 ? (
            <div className="py-12 text-center"><MessageSquare aria-hidden="true" className="w-8 h-8 mx-auto text-slate-300 mb-3" /><p className="text-sm font-medium text-slate-800">No announcements yet</p><p className="text-sm text-slate-500 mt-1">Drafts, scheduled campaigns and sent announcements appear here.</p></div>
          ) : (
            <div className="divide-y divide-slate-200">
              {campaigns.map((campaign: any) => {
                const campaignPriority = getCampaignPriority(campaign);
                const state = String(campaign.status || 'UNKNOWN').toUpperCase();
                const stateClass = state === 'SENT' ? 'bg-emerald-50 text-emerald-800' : state === 'FAILED' ? 'bg-rose-50 text-rose-800' : state === 'SCHEDULED' ? 'bg-blue-50 text-blue-800' : state === 'DRAFT' ? 'bg-slate-100 text-slate-700' : state === 'PROCESSING' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700';
                return <article key={campaign.id} className="py-4 first:pt-3 last:pb-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h4 className="text-sm font-semibold text-slate-900 break-words">{campaign.title}</h4><p className="text-xs text-slate-500 mt-1">{campaign.sentAt ? `Sent ${new Date(campaign.sentAt).toLocaleString()}` : campaign.scheduledAt ? `Scheduled ${new Date(campaign.scheduledAt).toLocaleString()}` : `Created ${new Date(campaign.createdAt).toLocaleString()}`}</p></div>
                    <span className={`shrink-0 inline-flex px-2 py-1 rounded-md text-[11px] font-semibold ${stateClass}`}>{state.toLowerCase()}</span>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{campaign.message}</p>
                  {state === 'FAILED' && campaign.failureReason && <p className="text-xs rounded-lg bg-rose-50 text-rose-800 border border-rose-200 p-2.5">Delivery issue: {campaign.failureReason}</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{audienceLabels[campaign.targetScope as Audience] || (campaign.targetScope === 'EXPIRING' ? 'Passes expiring within 30 days' : campaign.targetScope === 'STUDENT' ? 'One student' : campaign.targetScope || 'Unknown audience')}</span>
                    <span>{Number(campaign.sentCount || 0).toLocaleString()} recipients</span>
                    <span>Priority: {campaignPriority}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(state === 'DRAFT' || state === 'SCHEDULED') && campaign.targetScope !== 'STUDENT' && <button type="button" disabled={actioningCampaignId === String(campaign.id)} onClick={() => editCampaign(campaign)} className="min-h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Edit</button>}
                    {state === 'DRAFT' && <button type="button" disabled={actioningCampaignId === String(campaign.id)} onClick={() => void runCampaignAction(campaign, 'SEND_NOW')} className="min-h-9 px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50">Send now</button>}
                    {state === 'SCHEDULED' && <button type="button" disabled={actioningCampaignId === String(campaign.id)} onClick={() => void runCampaignAction(campaign, 'CANCEL')} className="min-h-9 px-3 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50">Cancel schedule</button>}
                    {state === 'FAILED' && <button type="button" disabled={actioningCampaignId === String(campaign.id)} onClick={() => void runCampaignAction(campaign, 'RETRY')} className="min-h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-50">{actioningCampaignId === String(campaign.id) ? 'Working…' : 'Retry delivery'}</button>}
                  </div>
                </article>;
              })}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
