import React, { useState } from 'react';
import {
  CreditCard, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle,
  RefreshCw, Smartphone, Building, QrCode, X
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn } from '../adminShared';

export function OwnerPaymentMethods() {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/overview');
  const methods = data?.data?.paymentMethods || [];

  const [editingMethod, setEditingMethod] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    type: 'INSTAPAY',
    destination: '',
    accountHolder: '',
    instructions: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const startCreate = () => {
    setEditingMethod(null);
    setFormData({
      id: `method_${Date.now()}`,
      type: 'INSTAPAY',
      destination: '',
      accountHolder: '',
      instructions: '',
      isActive: true,
    });
    setIsCreating(true);
  };

  const startEdit = (m: any) => {
    setIsCreating(false);
    setEditingMethod(m);
    setFormData({
      id: m.id,
      type: m.type || 'INSTAPAY',
      destination: m.destination || m.accountNumber || '',
      accountHolder: m.accountHolder || '',
      instructions: m.instructions || '',
      isActive: m.isActive !== false,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.destination.trim()) {
      setBanner({ type: 'error', text: 'Please specify the payment destination number or IPA handle.' });
      return;
    }

    setSaving(true);
    setBanner(null);

    try {
      const { response, data: resData } = await fetchJson('/api/admin/owner/payment-methods', {
        method: isCreating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error((resData as any)?.error || 'Could not save payment channel.');
      }

      setBanner({ type: 'success', text: 'Payment channel updated successfully.' });
      setEditingMethod(null);
      setIsCreating(false);
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save payment channel.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Payment Gateways & Transfer Channels"
      description="Manage InstaPay handles, Vodafone Cash wallet numbers, and student deposit instructions."
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
          <h3 className="font-bold text-base text-slate-900">Configured Payment Methods</h3>
          <p className="text-xs text-slate-500">Destination addresses shown to students when selecting manual transfer.</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Payment Method</span>
        </button>
      </div>

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {methods.map((m: any) => (
          <div
            key={m.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                    {m.type === 'VODAFONE_CASH' ? <Smartphone className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{m.type || 'INSTAPAY'}</h4>
                    <span className="text-xs font-mono font-bold text-slate-700">{m.destination || m.id}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  m.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {m.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              {m.accountHolder && (
                <div className="text-xs text-slate-600">
                  <span className="font-bold">Account Holder: </span>
                  <span>{m.accountHolder}</span>
                </div>
              )}

              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {m.instructions || 'Include your student email in the payment transfer note.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => startEdit(m)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Edit Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create Modal */}
      {(isCreating || editingMethod) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">
                {isCreating ? 'Add Payment Channel' : `Edit: ${editingMethod?.type || 'Method'}`}
              </h3>
              <button
                onClick={() => { setIsCreating(false); setEditingMethod(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Type / Channel</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
                >
                  <option value="INSTAPAY">InstaPay (IPA / Phone)</option>
                  <option value="VODAFONE_CASH">Vodafone Cash Wallet</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                  <option value="ORANGE_CASH">Orange Cash</option>
                  <option value="ETISALAT_CASH">Etisalat Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination Handle / Wallet Phone</label>
                <input
                  type="text"
                  required
                  value={formData.destination}
                  onChange={e => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="e.g., gadwal@instapay or 01012345678"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Holder Full Name</label>
                <input
                  type="text"
                  value={formData.accountHolder}
                  onChange={e => setFormData({ ...formData, accountHolder: e.target.value })}
                  placeholder="e.g., Gadwal App Admin / Financial Officer"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Student Deposit Instructions</label>
                <textarea
                  rows={3}
                  value={formData.instructions}
                  onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="Include instructions for student transfer reference and screenshot attachment..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="methodActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="methodActive" className="font-bold text-slate-700 cursor-pointer">
                  Enable this method in student checkout
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setEditingMethod(null); }}
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
                  <span>{saving ? 'Saving...' : 'Save Channel'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}
