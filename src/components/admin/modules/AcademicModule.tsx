import React, { useState } from 'react';
import {
  CalendarDays, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle,
  RefreshCw, Clock, X
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn, fmtDate } from '../adminShared';

export function OwnerAcademic() {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/academic-periods');
  const periods = data?.periods || [];

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    academicYear: '',
    term: 'FALL',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
    enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);

    try {
      const { response, data: resData } = await fetchJson('/api/admin/owner/academic-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error((resData as any)?.error || 'Could not save academic term period.');
      }

      setBanner({ type: 'success', text: `Academic period ${formData.academicYear} (${formData.term}) saved.` });
      setIsCreating(false);
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save academic term.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Academic Calendar & Term Windows"
      description="Manage active MIU university semesters, enrollment cutoffs, and default subscription end dates."
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

      {/* Top Bar with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-900">University Terms</h3>
          <p className="text-xs text-slate-500">Official semester start/end timelines for registration windows.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const fallbackStart = today.getMonth() + 1 >= 9 ? today.getFullYear() : today.getFullYear() - 1;
            const context = data?.currentContext;
            setFormData({
              academicYear: String(context?.academicYear || `${fallbackStart}–${fallbackStart + 1}`),
              term: String(context?.term || 'FALL').toUpperCase(),
              startDate: today.toISOString().slice(0, 10),
              endDate: new Date(today.getTime() + 120 * 86400000).toISOString().slice(0, 10),
              enabled: true,
            });
            setIsCreating(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Academic Term</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Academic Year</th>
                <th className="p-3.5">Term</th>
                <th className="p-3.5">Start Date</th>
                <th className="p-3.5">End Date</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No academic periods defined yet.
                  </td>
                </tr>
              ) : (
                periods.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{p.academicYear}</td>
                    <td className="p-3.5 font-semibold text-slate-700">{p.term}</td>
                    <td className="p-3.5 text-slate-600">{fmtDate(p.startDate)}</td>
                    <td className="p-3.5 text-slate-600">{fmtDate(p.endDate)}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${Number(p.enabled ?? 1) === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {Number(p.enabled ?? 1) === 1 ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">Add Academic Term</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  required
                  value={formData.academicYear}
                  onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                  placeholder="e.g., 2026–2027"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Term Name</label>
                <select
                  value={formData.term}
                  onChange={e => setFormData({ ...formData, term: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
                >
                  <option value="FALL">Fall Semester</option>
                  <option value="SPRING">Spring Semester</option>
                  <option value="SUMMER">Summer Term</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Saving...' : 'Add Term'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}
