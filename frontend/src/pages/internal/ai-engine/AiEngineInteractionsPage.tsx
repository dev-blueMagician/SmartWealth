/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import {
  wealthApi,
  type AiInteractionAdminRow,
  type CasePhaseAdminRow,
} from '../../../services/wealthApi';
import { toApiError, type ApiError } from '../../../services/apiError';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';

export function AiEngineInteractionsPage() {
  const [phases, setPhases] = useState<CasePhaseAdminRow[]>([]);
  const [phaseFilter, setPhaseFilter] = useState('');
  const [rows, setRows] = useState<AiInteractionAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [interactionId, setInteractionId] = useState('');
  const [phaseCode, setPhaseCode] = useState('');
  const [loopJson, setLoopJson] = useState('{}');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadPhases = useCallback(async () => {
    try {
      const list = await wealthApi.listAdminCasePhases();
      setPhases(list);
      setPhaseCode((prev) =>
        prev && list.some((p) => p.phaseCode === prev) ? prev : list[0]?.phaseCode ?? '',
      );
    } catch (err) {
      setError(toApiError(err));
    }
  }, []);

  const loadInteractions = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await wealthApi.listAdminAiInteractions(phaseFilter.trim() || undefined));
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, [phaseFilter]);

  useEffect(() => {
    void loadPhases();
  }, [loadPhases]);

  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  const resetForm = () => {
    setEditingId(null);
    setInteractionId('');
    setLoopJson('{}');
    setSystemPrompt('');
    if (phases.length > 0) setPhaseCode(phases[0].phaseCode);
  };

  const startEdit = (r: AiInteractionAdminRow) => {
    setEditingId(r.interactionId);
    setInteractionId(r.interactionId);
    setPhaseCode(r.phaseCode);
    try {
      setLoopJson(JSON.stringify(r.loopInput ?? {}, null, 2));
    } catch {
      setLoopJson('{}');
    }
    setSystemPrompt(r.systemPrompt ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let loopInput: Record<string, unknown>;
    try {
      loopInput = JSON.parse(loopJson) as Record<string, unknown>;
      if (loopInput === null || typeof loopInput !== 'object' || Array.isArray(loopInput)) {
        throw new Error('loop_input must be a JSON object.');
      }
    } catch (err) {
      setError(toApiError(err instanceof Error ? err : new Error('Invalid loop_input JSON.')));
      return;
    }
    if (!interactionId.trim() || !phaseCode.trim()) return;
    try {
      if (editingId) {
        await wealthApi.updateAdminAiInteraction(editingId, {
          phaseCode: phaseCode.trim(),
          loopInput,
          systemPrompt: systemPrompt.trim() || null,
        });
        setSuccessMessage(`Updated ${editingId}.`);
      } else {
        await wealthApi.createAdminAiInteraction({
          interactionId: interactionId.trim(),
          phaseCode: phaseCode.trim(),
          loopInput,
          systemPrompt: systemPrompt.trim() || null,
        });
        setSuccessMessage(`Created ${interactionId.trim()}.`);
      }
      resetForm();
      await loadInteractions();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete interaction ${id}?`)) return;
    try {
      await wealthApi.deleteAdminAiInteraction(id);
      setSuccessMessage(`Deleted ${id}.`);
      if (editingId === id) resetForm();
      await loadInteractions();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div>
        <h2 className="text-xl font-semibold text-slate-900">AI interactions</h2>
        <p className="text-sm text-slate-500 mt-1">
          CRUD <span className="font-mono">ai_interaction</span> including <span className="font-mono">loop_input</span> (JSON) and{' '}
          <span className="font-mono">system_prompt</span>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
        <span className="text-[10px] font-bold uppercase text-slate-400">Filter by phase</span>
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-mono"
        >
          <option value="">All phases</option>
          {phases.map((p) => (
            <option key={p.phaseCode} value={p.phaseCode}>
              {p.phaseCode}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <p className="text-xs font-bold text-slate-600 uppercase">{editingId ? `Edit ${editingId}` : 'Create interaction'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">interaction_id</span>
            <input
              value={interactionId}
              onChange={(e) => setInteractionId(e.target.value)}
              disabled={!!editingId}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono disabled:bg-slate-50"
              placeholder="onboarding_completeness"
            />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">phase_code</span>
            <select
              value={phaseCode}
              onChange={(e) => setPhaseCode(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-mono"
            >
              {phases.map((p) => (
                <option key={p.phaseCode} value={p.phaseCode}>
                  {p.phaseCode}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="space-y-1 block">
          <span className="text-[10px] font-bold uppercase text-slate-400">loop_input (JSON object)</span>
          <textarea
            value={loopJson}
            onChange={(e) => setLoopJson(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-[10px] font-bold uppercase text-slate-400">system_prompt</span>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
            placeholder="Optional system prompt for this interaction…"
          />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500">
            {editingId ? 'Save' : 'Create'}
          </button>
          {editingId ? (
            <button type="button" onClick={() => resetForm()} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold">
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold uppercase text-slate-400">Rows</div>
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No interactions.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">id</th>
                  <th className="text-left px-4 py-2">phase</th>
                  <th className="text-left px-4 py-2">prompt</th>
                  <th className="text-right px-4 py-2">actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.interactionId} className="hover:bg-slate-50/80 align-top">
                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{r.interactionId}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.phaseCode}</td>
                    <td className="px-4 py-2 text-xs text-slate-600 max-w-md truncate" title={r.systemPrompt ?? ''}>
                      {r.systemPrompt ? `${r.systemPrompt.slice(0, 80)}…` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                      <button type="button" onClick={() => startEdit(r)} className="text-indigo-600 text-xs font-bold">
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(r.interactionId)} className="text-rose-600 text-xs font-bold">
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
