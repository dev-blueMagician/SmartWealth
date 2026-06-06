import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { discoveryApi } from '../../../services/discoveryApi';
import type { DiscoveryFieldMapping, DiscoveryQuestion } from '../../../services/discoveryTypes';
import { toApiError, type ApiError } from '../../../services/apiError';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';

export function DiscoveryMappingPage() {
  const [mappings, setMappings] = useState<DiscoveryFieldMapping[]>([]);
  const [questions, setQuestions] = useState<DiscoveryQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [qidFilter, setQidFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState('');
  const [systemField, setSystemField] = useState('');
  const [entityType, setEntityType] = useState('');
  const [transformType, setTransformType] = useState('');
  const [aiHint, setAiHint] = useState('');
  const [fieldSuggestions, setFieldSuggestions] = useState<string[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');

  const modalOpen = isCreateMode || !!editingId;

  const questionById = useMemo(() => {
    const map = new Map<string, DiscoveryQuestion>();
    for (const q of questions) map.set(q.questionId, q);
    return map;
  }, [questions]);

  const closeModal = () => {
    setIsCreateMode(false);
    setEditingId(null);
    setQuestionId('');
    setSystemField('');
    setEntityType('');
    setTransformType('');
    setAiHint('');
    setFieldSearch('');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRows, qRows] = await Promise.all([
        discoveryApi.listMappings(),
        discoveryApi.listQuestions(),
      ]);
      setMappings(mapRows);
      setQuestions(qRows);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, saving]);

  useEffect(() => {
    const q = fieldSearch.trim();
    if (q.length < 2) {
      setFieldSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      void discoveryApi
        .listFieldDictionary({ search: q, size: 25 })
        .then((res) => setFieldSuggestions(res.items.map((i) => i.systemFieldName)))
        .catch(() => setFieldSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [fieldSearch]);

  const filtered = useMemo(() => {
    return mappings.filter((m) => {
      if (qidFilter.trim() && !m.questionId.toLowerCase().includes(qidFilter.trim().toLowerCase())) {
        return false;
      }
      if (moduleFilter.trim()) {
        const q = questionById.get(m.questionId);
        if (!q?.module || q.module !== moduleFilter.trim()) return false;
      }
      return true;
    });
  }, [mappings, qidFilter, moduleFilter, questionById]);

  const uniqueModules = useMemo(
    () => [...new Set(questions.map((q) => q.module).filter(Boolean))] as string[],
    [questions],
  );

  const startCreate = () => {
    closeModal();
    setIsCreateMode(true);
  };

  const startEdit = (row: DiscoveryFieldMapping) => {
    setIsCreateMode(false);
    setEditingId(row.id);
    setQuestionId(row.questionId);
    setSystemField(row.systemField);
    setEntityType(row.entityType ?? '');
    setTransformType(row.transformType ?? '');
    setFieldSearch(row.systemField);
    setAiHint('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionId.trim() || !systemField.trim()) return;
    const body = {
      questionId: questionId.trim(),
      systemField: systemField.trim(),
      entityType: entityType.trim() || null,
      transformType: transformType.trim() || null,
    };
    setSaving(true);
    try {
      if (isCreateMode) {
        await discoveryApi.createMapping(body);
        setSuccessMessage('Mapping created.');
      } else if (editingId) {
        await discoveryApi.updateMapping(editingId, body);
        setSuccessMessage('Mapping updated.');
      }
      closeModal();
      await load();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, fromModal = false) => {
    if (!window.confirm('Delete this mapping?')) return;
    try {
      await discoveryApi.deleteMapping(id);
      setSuccessMessage('Mapping deleted.');
      if (fromModal || editingId === id) closeModal();
      await load();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const handleAiSuggest = async () => {
    if (!questionId.trim()) return;
    const q = questionById.get(questionId.trim());
    setAiHint('');
    try {
      const hint = await discoveryApi.discoveryAiSuggestMapping({
        questionId: questionId.trim(),
        questionText: q?.questionText,
      });
      setSystemField(hint.systemField);
      setFieldSearch(hint.systemField);
      setEntityType(hint.entityType);
      setTransformType(hint.transformType);
      setAiHint(hint.rationale);
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const labelClass = 'text-[10px] font-bold uppercase text-slate-400';
  const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm';

  return (
    <div className="w-full max-w-none mx-auto flex flex-col gap-4 p-4 md:p-6 min-h-[calc(100vh-8rem)]">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <header className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-600" />
            Discovery field mappings
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Map question IDs to <span className="font-mono">system_field</span> — use popup for add/edit.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New mapping
        </button>
      </header>

      <section className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center shrink-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={qidFilter}
            onChange={(e) => setQidFilter(e.target.value)}
            placeholder="Filter by QID"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono flex-1 min-w-[120px]"
          />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[140px]"
          >
            <option value="">All modules</option>
            {uniqueModules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} mappings</span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No mappings match filters.</p>
        ) : (
          <div className="flex-1 min-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">QID</th>
                  <th className="text-left px-4 py-3 font-bold">Module</th>
                  <th className="text-left px-4 py-3 font-bold">system_field</th>
                  <th className="text-left px-4 py-3 font-bold">entity_type</th>
                  <th className="text-left px-4 py-3 font-bold">transform</th>
                  <th className="text-right px-4 py-3 font-bold w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/80 cursor-pointer"
                    onClick={() => startEdit(m)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{m.questionId}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {questionById.get(m.questionId)?.module ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs max-w-[280px] break-all">
                      {m.systemField}
                    </td>
                    <td className="px-4 py-3 text-xs">{m.entityType ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{m.transformType ?? '—'}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => startEdit(m)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => void handleDelete(m.id)}
                          className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mapping-modal-title"
          onClick={() => {
            if (!saving) closeModal();
          }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 id="mapping-modal-title" className="text-lg font-bold text-slate-900">
                {isCreateMode ? 'New mapping' : 'Edit mapping'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto px-5 py-4 space-y-3">
                <label className="block space-y-1">
                  <span className={labelClass}>question_id *</span>
                  <input
                    list="discovery-qids-modal"
                    value={questionId}
                    onChange={(e) => setQuestionId(e.target.value)}
                    required
                    className={`${inputClass} font-mono`}
                    placeholder="Q042"
                  />
                  <datalist id="discovery-qids-modal">
                    {questions.map((q) => (
                      <option key={q.questionId} value={q.questionId} />
                    ))}
                  </datalist>
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>system_field *</span>
                  <input
                    list="discovery-system-fields-modal"
                    value={systemField}
                    onChange={(e) => {
                      setSystemField(e.target.value);
                      setFieldSearch(e.target.value);
                    }}
                    required
                    className={`${inputClass} font-mono`}
                    placeholder="personal_and_identity_profile__..."
                  />
                  <datalist id="discovery-system-fields-modal">
                    {fieldSuggestions.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <p className="text-[10px] text-slate-500">Must exist in Field dictionary.</p>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className={labelClass}>entity_type</span>
                    <input
                      value={entityType}
                      onChange={(e) => setEntityType(e.target.value)}
                      className={inputClass}
                      placeholder="client"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>transform_type</span>
                    <input
                      value={transformType}
                      onChange={(e) => setTransformType(e.target.value)}
                      className={inputClass}
                      placeholder="currency"
                    />
                  </label>
                </div>
                {aiHint ? (
                  <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">{aiHint}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleAiSuggest()}
                  className="inline-flex items-center gap-1 px-3 py-2 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI suggest mapping
                </button>
              </div>

              <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-slate-100 shrink-0 bg-slate-50/80 rounded-b-2xl">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : isCreateMode ? 'Create mapping' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white disabled:opacity-50"
                >
                  Cancel
                </button>
                {editingId && !isCreateMode ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete(editingId, true)}
                    className="ml-auto px-4 py-2 border border-rose-200 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
