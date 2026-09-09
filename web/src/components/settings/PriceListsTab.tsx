import React, { useEffect, useState } from 'react';
import { Archive, CheckCircle2, Edit3, Plus, Tag, X } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { canManagePriceListsForSession, PriceList, validatePriceList } from '../../domain/priceLists';
import { Badge } from '../common/Badge';
import { useAuth } from '../../context/AuthContext';

type PriceListDraft = {
  code: string;
  name: string;
  description: string;
  discountPercent: string;
};

const EMPTY_DRAFT: PriceListDraft = { code: '', name: '', description: '', discountPercent: '0' };

function draftFromPriceList(list: PriceList): PriceListDraft {
  return {
    code: list.code ?? list.id,
    name: list.name,
    description: list.description ?? '',
    discountPercent: String(list.discountPercent),
  };
}

export const PriceListsTab: React.FC = () => {
  const { priceLists, priceListsLoading, createPriceList, updatePriceList, archivePriceList, hasPermission, currentTerms } = useERP();
  const { session } = useAuth();
  const liveAdmin = canManagePriceListsForSession(session);
  // Unsigned demo mode intentionally retains the local fixture permission
  // surface. Every authenticated session uses the authoritative acting seat
  // and held-seat list above; INITIAL_USERS/INITIAL_ROLES never grant it.
  const canView = session ? liveAdmin : hasPermission('settings', 'view');
  const canCreate = session ? liveAdmin : hasPermission('settings', 'create');
  const canEdit = session ? liveAdmin : hasPermission('settings', 'edit');
  const canArchive = session ? liveAdmin : hasPermission('settings', 'delete');

  const [draft, setDraft] = useState<PriceListDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<PriceList | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (editing) setDraft(draftFromPriceList(editing));
  }, [editing]);

  if (!canView) {
    return <div role="alert" className="rounded-2xl border border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error-container)] p-5 text-sm text-[var(--md-sys-color-on-error-container)]">You do not have permission to view price lists.</div>;
  }

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setSaved(false);
    setFormOpen(true);
  };

  const openEdit = (list: PriceList) => {
    setEditing(list);
    setError(null);
    setSaved(false);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const discountPercent = Number(draft.discountPercent);
    const candidate = {
      name: draft.name,
      description: draft.description.trim() || undefined,
      discountPercent,
      itemOverrides: editing?.itemOverrides ?? [],
    };
    const validation = validatePriceList(candidate);
    if (validation.length > 0) {
      setError(validation[0].message);
      return;
    }

    try {
      if (editing) {
        if (!canEdit) return;
        await updatePriceList(editing.id, candidate);
      } else {
        if (!canCreate) return;
        await createPriceList({ code: draft.code, ...candidate, active: true });
      }
      setSaved(true);
      setFormOpen(false);
      setEditing(null);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save price list.');
    }
  };

  const archive = async (list: PriceList) => {
    if (!canArchive || list.active === false) return;
    setError(null);
    try {
      await archivePriceList(list.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive price list.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
            <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)]">Price Lists</h2>
            <Badge variant="purple" size="sm">Tenant registry</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-[var(--md-sys-color-on-surface-variant)]">
            Manage customer pricing tiers for {currentTerms.customer.toLowerCase()} accounts. Standard pricing remains the explicit unbound state.
          </p>
        </div>
        {canCreate && <button type="button" onClick={openCreate} className="flex items-center gap-1.5 self-start rounded-xl bg-[var(--md-sys-color-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary-container)]"><Plus className="h-4 w-4" />New Price List</button>}
      </div>

      {error && <div role="alert" className="rounded-xl border border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error-container)] p-3 text-xs text-[var(--md-sys-color-on-error-container)]">{error}</div>}
      {saved && <div role="status" className="flex items-center gap-1.5 text-xs font-semibold text-[var(--md-sys-color-primary)]"><CheckCircle2 className="h-4 w-4" />Price list saved.</div>}

      <div className="overflow-x-auto rounded-2xl border border-[var(--md-sys-color-outline-variant)]">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]"><tr><th className="px-4 py-3 font-bold">Code</th><th className="px-4 py-3 font-bold">Name</th><th className="px-4 py-3 font-bold">Discount</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Actions</th></tr></thead>
          <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
            {priceLists.map((list) => (
              <tr key={list.id} className="text-[var(--md-sys-color-on-surface)]">
                <td className="px-4 py-3 font-mono font-semibold">{list.code ?? list.id}</td>
                <td className="px-4 py-3"><div className="font-semibold">{list.name}</div>{list.description && <div className="mt-0.5 text-[11px] text-[var(--md-sys-color-on-surface-variant)]">{list.description}</div>}</td>
                <td className="px-4 py-3">{list.discountPercent}%</td>
                <td className="px-4 py-3">{list.active === false ? 'Archived' : 'Active'}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2">
                  {canEdit && list.active !== false && (!session || (!priceListsLoading && !!list.registryId)) && <button type="button" onClick={() => openEdit(list)} aria-label={'Edit ' + list.name} className="rounded-lg p-1.5 text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary-container)]"><Edit3 className="h-4 w-4" /></button>}
                  {canArchive && list.active !== false && (!session || (!priceListsLoading && !!list.registryId)) && <button type="button" onClick={() => archive(list)} aria-label={'Archive ' + list.name} className="rounded-lg p-1.5 text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]"><Archive className="h-4 w-4" /></button>}
                </div></td>
              </tr>
            ))}
            {priceLists.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--md-sys-color-on-surface-variant)]">No price lists in this tenant registry.</td></tr>}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--md-sys-color-scrim)]/70 p-4" role="dialog" aria-modal="true" aria-label={editing ? 'Edit price list' : 'Create price list'}>
          <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-3"><h3 className="text-sm font-bold">{editing ? 'Edit Price List' : 'Create Price List'}</h3><button type="button" onClick={closeForm} aria-label="Close"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <label className="space-y-1"><span className="font-semibold">Stable code *</span><input required disabled={Boolean(editing)} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. trade_15" className="w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-transparent px-3 py-2 disabled:opacity-60" /></label>
              <label className="space-y-1"><span className="font-semibold">Display name *</span><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Trade Discount" className="w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-transparent px-3 py-2" /></label>
              <label className="space-y-1"><span className="font-semibold">Flat discount (%)</span><input type="number" min="0" max="100" step="0.01" value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })} className="w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-transparent px-3 py-2" /></label>
              <label className="space-y-1 sm:col-span-2"><span className="font-semibold">Description</span><textarea rows={3} maxLength={1000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-transparent px-3 py-2" /></label>
            </div>
            {error && <div role="alert" className="text-xs text-[var(--md-sys-color-error)]">{error}</div>}
            <div className="flex justify-end gap-2"><button type="button" onClick={closeForm} className="rounded-xl px-3.5 py-2 text-xs">Cancel</button><button type="submit" className="rounded-xl bg-[var(--md-sys-color-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--md-sys-color-on-primary)]">{editing ? 'Save Changes' : 'Create Price List'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
};
