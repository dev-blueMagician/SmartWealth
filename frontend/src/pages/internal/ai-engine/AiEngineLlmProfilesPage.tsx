/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { wealthApi, type AiLlmProfileAdminRow } from '../../../services/wealthApi';
import { toApiError, type ApiError } from '../../../services/apiError';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';

const PROVIDERS = ['deepseek', 'azure_openai'] as const;
type LlmProviderId = (typeof PROVIDERS)[number];

export function AiEngineLlmProfilesPage() {
  const [rows, setRows] = useState<AiLlmProfileAdminRow[]>([]);
  const [active, setActive] = useState<AiLlmProfileAdminRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [code, setCode] = useState('default');
  const [displayName, setDisplayName] = useState('Default profile');
  const [llmProvider, setLlmProvider] = useState<LlmProviderId>('deepseek');
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState('');
  const [deepseekModel, setDeepseekModel] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('');
  const [azureApiVersion, setAzureApiVersion] = useState('');
  const [assessmentLlmEnabled, setAssessmentLlmEnabled] = useState(false);
  const [completenessLoopGraphEnabled, setCompletenessLoopGraphEnabled] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deepseekApiKeyInput, setDeepseekApiKeyInput] = useState('');
  const [azureOpenaiApiKeyInput, setAzureOpenaiApiKeyInput] = useState('');
  const [pendingClearDeepseekKey, setPendingClearDeepseekKey] = useState(false);
  const [pendingClearAzureKey, setPendingClearAzureKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, act] = await Promise.all([wealthApi.listAdminLlmProfiles(), wealthApi.getActiveAdminLlmProfile()]);
      setRows(list);
      setActive(act);
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
    setEditingId(null);
    setCode('default');
    setDisplayName('Default profile');
    setLlmProvider('deepseek');
    setDeepseekBaseUrl('');
    setDeepseekModel('');
    setAzureEndpoint('');
    setAzureDeployment('');
    setAzureApiVersion('');
    setAssessmentLlmEnabled(false);
    setCompletenessLoopGraphEnabled(false);
    setIsActive(true);
    setDeepseekApiKeyInput('');
    setAzureOpenaiApiKeyInput('');
    setPendingClearDeepseekKey(false);
    setPendingClearAzureKey(false);
  };

  const startEdit = (r: AiLlmProfileAdminRow) => {
    setEditingId(r.id);
    setCode(r.code);
    setDisplayName(r.displayName);
    setLlmProvider((r.llmProvider === 'azure_openai' ? 'azure_openai' : 'deepseek') as LlmProviderId);
    setDeepseekBaseUrl(r.deepseekBaseUrl ?? '');
    setDeepseekModel(r.deepseekModel ?? '');
    setAzureEndpoint(r.azureOpenaiEndpoint ?? '');
    setAzureDeployment(r.azureOpenaiDeployment ?? '');
    setAzureApiVersion(r.azureOpenaiApiVersion ?? '');
    setAssessmentLlmEnabled(r.assessmentLlmEnabled);
    setCompletenessLoopGraphEnabled(r.completenessLoopGraphEnabled);
    setIsActive(r.active);
    setDeepseekApiKeyInput('');
    setAzureOpenaiApiKeyInput('');
    setPendingClearDeepseekKey(false);
    setPendingClearAzureKey(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !displayName.trim()) return;
    const base = {
      code: code.trim(),
      displayName: displayName.trim(),
      llmProvider,
      deepseekBaseUrl: deepseekBaseUrl.trim() || null,
      deepseekModel: deepseekModel.trim() || null,
      azureOpenaiEndpoint: azureEndpoint.trim() || null,
      azureOpenaiDeployment: azureDeployment.trim() || null,
      azureOpenaiApiVersion: azureApiVersion.trim() || null,
      assessmentLlmEnabled,
      completenessLoopGraphEnabled,
      active: isActive,
    };
    const payload = {
      ...base,
      ...(editingId
        ? {
            ...(deepseekApiKeyInput.trim()
              ? { deepseekApiKey: deepseekApiKeyInput.trim() }
              : pendingClearDeepseekKey
                ? { deepseekApiKey: '' }
                : {}),
            ...(azureOpenaiApiKeyInput.trim()
              ? { azureOpenaiApiKey: azureOpenaiApiKeyInput.trim() }
              : pendingClearAzureKey
                ? { azureOpenaiApiKey: '' }
                : {}),
          }
        : {
            ...(deepseekApiKeyInput.trim() ? { deepseekApiKey: deepseekApiKeyInput.trim() } : {}),
            ...(azureOpenaiApiKeyInput.trim() ? { azureOpenaiApiKey: azureOpenaiApiKeyInput.trim() } : {}),
          }),
    };
    try {
      if (editingId) {
        await wealthApi.updateAdminLlmProfile(editingId, payload);
        setSuccessMessage('Profile updated.');
      } else {
        await wealthApi.createAdminLlmProfile(payload);
        setSuccessMessage('Profile created.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this LLM profile?')) return;
    try {
      await wealthApi.deleteAdminLlmProfile(id);
      setSuccessMessage('Deleted.');
      if (editingId === id) resetForm();
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
        <h2 className="text-xl font-semibold text-slate-900">AI settings — LLM profiles</h2>
        <p className="text-sm text-slate-500 mt-1">
          Profiles are stored in <span className="font-mono">ai_llm_profile</span>. Optional API keys are saved in the database (restrict DB access);
          the AI-engine merges the <span className="font-semibold">active</span> profile over environment defaults at runtime.
        </p>
      </div>

      {active ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          <span className="font-bold">Active profile:</span>{' '}
          <span className="font-mono">{active.code}</span> · {active.llmProvider}
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No active profile (404).</div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <p className="text-xs font-bold text-slate-600 uppercase">{editingId ? 'Edit profile' : 'Create profile'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!editingId}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono disabled:bg-slate-50"
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
          <label className="space-y-1 block md:col-span-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">llm_provider</span>
            <select
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value as LlmProviderId)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          {llmProvider === 'deepseek' ? (
            <>
              <p className="md:col-span-2 text-[11px] font-semibold text-slate-600 pt-1 border-t border-slate-100 mt-1">
                DeepSeek
              </p>
              <label className="space-y-1 block md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">deepseek_base_url</span>
                <input
                  value={deepseekBaseUrl}
                  onChange={(e) => setDeepseekBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-xs"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] font-bold uppercase text-slate-400">deepseek_model</span>
                <input
                  value={deepseekModel}
                  onChange={(e) => setDeepseekModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-xs"
                />
              </label>
              <label className="space-y-1 block md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  deepseek_api_key <span className="font-normal normal-case text-slate-400">(optional)</span>
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={deepseekApiKeyInput}
                  onChange={(e) => {
                    setDeepseekApiKeyInput(e.target.value);
                    setPendingClearDeepseekKey(false);
                  }}
                  placeholder={editingId ? 'Leave blank to keep existing key' : 'sk-…'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-xs"
                />
                {editingId && rows.find((x) => x.id === editingId)?.deepseekApiKeyConfigured ? (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] text-emerald-700">A key is stored.</span>
                    <button
                      type="button"
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                      onClick={() => {
                        setPendingClearDeepseekKey(true);
                        setDeepseekApiKeyInput('');
                      }}
                    >
                      Clear stored key on save
                    </button>
                    {pendingClearDeepseekKey ? (
                      <span className="text-[11px] text-amber-700">Will remove key when you save.</span>
                    ) : null}
                  </div>
                ) : null}
              </label>
            </>
          ) : null}

          {llmProvider === 'azure_openai' ? (
            <>
              <p className="md:col-span-2 text-[11px] font-semibold text-slate-600 pt-1 border-t border-slate-100 mt-1">
                Azure OpenAI
              </p>
              <label className="space-y-1 block md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">azure_openai_endpoint</span>
                <input
                  value={azureEndpoint}
                  onChange={(e) => setAzureEndpoint(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-xs"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] font-bold uppercase text-slate-400">azure_deployment</span>
                <input
                  value={azureDeployment}
                  onChange={(e) => setAzureDeployment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-xs"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] font-bold uppercase text-slate-400">azure_api_version</span>
                <input
                  value={azureApiVersion}
                  onChange={(e) => setAzureApiVersion(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-xs"
                />
              </label>
              <label className="space-y-1 block md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  azure_openai_api_key <span className="font-normal normal-case text-slate-400">(optional)</span>
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={azureOpenaiApiKeyInput}
                  onChange={(e) => {
                    setAzureOpenaiApiKeyInput(e.target.value);
                    setPendingClearAzureKey(false);
                  }}
                  placeholder={editingId ? 'Leave blank to keep existing key' : 'Key…'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-xs"
                />
                {editingId && rows.find((x) => x.id === editingId)?.azureOpenaiApiKeyConfigured ? (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] text-emerald-700">A key is stored.</span>
                    <button
                      type="button"
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                      onClick={() => {
                        setPendingClearAzureKey(true);
                        setAzureOpenaiApiKeyInput('');
                      }}
                    >
                      Clear stored key on save
                    </button>
                    {pendingClearAzureKey ? (
                      <span className="text-[11px] text-amber-700">Will remove key when you save.</span>
                    ) : null}
                  </div>
                ) : null}
              </label>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={assessmentLlmEnabled}
              onChange={(e) => setAssessmentLlmEnabled(e.target.checked)}
              className="accent-slate-900"
            />
            assessment_llm_enabled
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={completenessLoopGraphEnabled}
              onChange={(e) => setCompletenessLoopGraphEnabled(e.target.checked)}
              className="accent-slate-900"
            />
            completeness_loop_graph_enabled
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-slate-900" />
            active (only one should be active)
          </label>
        </div>
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
        <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold uppercase text-slate-400">Profiles</div>
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No profiles.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">code</th>
                  <th className="text-left px-4 py-2">provider</th>
                  <th className="text-left px-4 py-2">active</th>
                  <th className="text-right px-4 py-2">actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-2">{r.llmProvider}</td>
                    <td className="px-4 py-2">{r.active ? 'yes' : 'no'}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button type="button" onClick={() => startEdit(r)} className="text-indigo-600 text-xs font-bold">
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(r.id)} className="text-rose-600 text-xs font-bold">
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
