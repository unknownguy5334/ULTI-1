import React, { useState } from 'react';
import {
  Package, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle,
  RefreshCw, DollarSign, Clock, ShieldCheck, Tag, X
} from 'lucide-react';
import { useAdminData } from '../AdminOwnerModules';
import { fetchJson } from '../../../services/resilientFetch';
import { Page, ErrorBox, InlineNotice, Btn, money, fmt } from '../adminShared';

export function OwnerProducts() {
  const { data, reload, error, loading } = useAdminData('/api/admin/owner/overview');
  const products = data?.data?.products || [];

  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    amount: 150,
    currency: 'EGP',
    durationDays: 120,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const startCreate = () => {
    setEditingProduct(null);
    setFormData({
      id: `plan_${Date.now()}`,
      name: '',
      description: '',
      amount: 150,
      currency: 'EGP',
      durationDays: 120,
      isActive: true,
    });
    setIsCreating(true);
  };

  const startEdit = (p: any) => {
    setIsCreating(false);
    setEditingProduct(p);
    setFormData({
      id: p.id,
      name: p.name || '',
      description: p.description || p.shortDescription || '',
      amount: Number(p.amount) || 0,
      currency: p.currency || 'EGP',
      durationDays: Number(p.durationDays) || 120,
      isActive: p.isActive !== false,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.amount <= 0) {
      setBanner({ type: 'error', text: 'Please specify a valid product title and price.' });
      return;
    }

    setSaving(true);
    setBanner(null);

    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        durationDays: Number(formData.durationDays),
      };

      const { response, data: resData } = await fetchJson('/api/admin/owner/products', {
        method: isCreating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error((resData as any)?.error || 'Could not save product tier.');
      }

      setBanner({ type: 'success', text: `Product "${formData.name}" saved successfully.` });
      setEditingProduct(null);
      setIsCreating(false);
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save product.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Are you sure you want to deactivate or remove this product tier?')) return;
    setSaving(true);
    try {
      const { response, data: resData } = await fetchJson(`/api/admin/owner/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error((resData as any)?.error || 'Delete failed');
      setBanner({ type: 'success', text: 'Product tier removed.' });
      await reload();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Could not remove product.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Product Catalog & Tier Pricing"
      description="Manage student subscription packages, semester passes, promotional rates, and access durations."
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
          <h3 className="font-bold text-base text-slate-900">Active Student Plans</h3>
          <p className="text-xs text-slate-500">Tier options displayed on student checkout and upgrade screens.</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Product Tier</span>
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((p: any) => (
          <div
            key={p.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900">{money(p.amount)}</div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">{p.durationDays ? `${p.durationDays} Days` : 'Full Term'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                  {p.description || p.shortDescription || 'Full MIU semester generator access.'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                p.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {p.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title="Delete product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Edit / Create Modal */}
      {(isCreating || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">
                {isCreating ? 'Create New Product Tier' : `Edit Tier: ${editingProduct?.name}`}
              </h3>
              <button
                onClick={() => { setIsCreating(false); setEditingProduct(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Spring 2025 Semester Pass"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (EGP)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: Number(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Validity Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.durationDays}
                    onChange={e => setFormData({ ...formData, durationDays: Number(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Features included (unlimited generation, clash analysis, export)..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isActive" className="font-bold text-slate-700 cursor-pointer">
                  Visible & active on student checkout
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setEditingProduct(null); }}
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
                  <span>{saving ? 'Saving...' : 'Save Product Tier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Page>
  );
}
