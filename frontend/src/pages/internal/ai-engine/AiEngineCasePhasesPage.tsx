/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { wealthApi, type CasePhaseAdminRow } from '../../../services/wealthApi';
import { toApiError, type ApiError } from '../../../services/apiError';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';
export function AiEngineCasePhasesPage() {
  const [rows, setRows] = useState<CasePhaseAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [phaseCode, setPhaseCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [enabled, setEnabled] = useState(true);
  const [catalogVersion, setCatalogVersion] = useState('1');
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await wealthApi.listAdminCasePhases());
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingCode(null);
    setPhaseCode('');
    setDisplayName('');
    setSortOrder('0');
    setEnabled(true);
    setCatalogVersion('1');
  };

  const startEdit = (r: CasePhaseAdminRow) => {
    setEditingCode(r.phaseCode);
    setPhaseCode(r.phaseCode);
    setDisplayName(r.displayName);
    setSortOrder(String(r.sortOrder));
    setEnabled(r.enabled);
    setCatalogVersion(r.catalogVersion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const so = Number(sortOrder);
    if (!phaseCode.trim() || !displayName.trim() || !Number.isFinite(so)) {
      setError(toApiError(new Error('phaseCode, displayName, sortOrder are required.')));
      return;
    }
    try {
      if (editingCode) {
        await wealthApi.updateAdminCasePhase(editingCode, {
          displayName: displayName.trim(),
          sortOrder: so,
          enabled,
          catalogVersion: catalogVersion.trim() || '1',
        });
        setSuccessMessage(`Updated phase ${editingCode}.`);
      } else {
        await wealthApi.createAdminCasePhase({
          phaseCode: phaseCode.trim(),
          displayName: displayName.trim(),
          sortOrder: so,
          enabled,
          catalogVersion: catalogVersion.trim() || '1',
        });
        setSuccessMessage(`Created phase ${phaseCode.trim()}.`);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const handleDelete = async (code: string) => {
    if (!window.confirm(`Delete case phase ${code}?`)) return;
    try {
      await wealthApi.deleteAdminCasePhase(code);
      setSuccessMessage(`Deleted ${code}.`);
      if (editingCode === code) resetForm();
      await load();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Case phases</h2>
        <p className="text-sm text-slate-500 mt-1">
          CRUD <span className="font-mono text-slate-700">case_phase</span> (ADMIN). Changes refresh backend cache; restart AI-engine or reload
          catalog if needed.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{editingCode ? `Edit ${editingCode}` : 'Create phase'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">phase_code (PK)</span>
            <input
              value={phaseCode}
              onChange={(e) => setPhaseCode(e.target.value)}
              disabled={!!editingCode}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono disabled:bg-slate-50"
              placeholder="ONBOARDING"
            />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">display_name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">sort_order</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">catalog_version</span>
            <input
              value={catalogVersion}
              onChange={(e) => setCatalogVersion(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-slate-900" />
          enabled
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500"
          >
            {editingCode ? 'Save' : 'Create'}
          </button>
          {editingCode ? (
            <button type="button" onClick={() => resetForm()} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold">
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold uppercase text-slate-400">All phases</div>
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No rows.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">code</th>
                  <th className="text-left px-4 py-2">display</th>
                  <th className="text-left px-4 py-2">order</th>
                  <th className="text-left px-4 py-2">enabled</th>
                  <th className="text-left px-4 py-2">ver</th>
                  <th className="text-right px-4 py-2">actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.phaseCode} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2 font-mono text-xs">{r.phaseCode}</td>
                    <td className="px-4 py-2">{r.displayName}</td>
                    <td className="px-4 py-2">{r.sortOrder}</td>
                    <td className="px-4 py-2">{r.enabled ? 'yes' : 'no'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.catalogVersion}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button type="button" onClick={() => startEdit(r)} className="text-indigo-600 text-xs font-bold">
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(r.phaseCode)} className="text-rose-600 text-xs font-bold">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
