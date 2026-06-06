import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { discoveryApi } from '../../../services/discoveryApi';
import type {
  DiscoveryQuestion,
  DiscoveryQuestionImportResult,
  DiscoveryQuestionOption,
} from '../../../services/discoveryTypes';
import { usesOptionsList, normalizeAnswerType } from '../../../lib/discoveryUtils';
import { toApiError, type ApiError } from '../../../services/apiError';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';

const ANSWER_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'choice', label: 'Single choice' },
  { value: 'multi-select', label: 'Multi-select' },
  { value: 'block', label: 'Repeatable block' },
] as const;

export function DiscoveryQuestionsPage() {
  const [rows, setRows] = useState<DiscoveryQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchQid, setSearchQid] = useState('');

  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState('');
  const [module, setModule] = useState('');
  const [section, setSection] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [answerType, setAnswerType] = useState('text');
  const [repeatable, setRepeatable] = useState(false);
  const [requiredFlag, setRequiredFlag] = useState(false);
  const [conditionalFlag, setConditionalFlag] = useState(false);

  const [options, setOptions] = useState<DiscoveryQuestionOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [bulkOptions, setBulkOptions] = useState('');

  const [importFile, setImportFile] = useState<File | null>(null);
  const [updateExistingOnImport, setUpdateExistingOnImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<DiscoveryQuestionImportResult | null>(null);

  const modalOpen = isCreateMode || !!editingId;
  const showOptionsPanel = modalOpen && !!editingId && usesOptionsList(normalizeAnswerType(answerType));

  const closeModal = () => {
    setIsCreateMode(false);
    setEditingId(null);
    setQuestionId('');
    setModule('');
    setSection('');
    setQuestionText('');
    setAnswerType('text');
    setRepeatable(false);
    setRequiredFlag(false);
    setConditionalFlag(false);
    setOptions([]);
    setNewOptionValue('');
    setNewOptionLabel('');
    setBulkOptions('');
  };

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      setRows(
        await discoveryApi.listQuestions({
          module: moduleFilter.trim() || undefined,
          section: sectionFilter.trim() || undefined,
        }),
      );
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, sectionFilter]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, saving]);

  const loadOptions = useCallback(async (qid: string) => {
    setOptionsLoading(true);
    try {
      setOptions(await discoveryApi.listQuestionOptions(qid));
    } catch (err) {
      setError(toApiError(err));
      setOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const q = searchQid.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.questionId.toLowerCase().includes(q) ||
        (r.questionText ?? '').toLowerCase().includes(q),
    );
  }, [rows, searchQid]);

  const uniqueModules = useMemo(
    () => [...new Set(rows.map((r) => r.module).filter(Boolean))] as string[],
    [rows],
  );
  const uniqueSections = useMemo(
    () => [...new Set(rows.map((r) => r.section).filter(Boolean))] as string[],
    [rows],
  );

  const startCreate = () => {
    closeModal();
    setIsCreateMode(true);
  };

  const startEdit = (r: DiscoveryQuestion) => {
    setIsCreateMode(false);
    setEditingId(r.questionId);
    setQuestionId(r.questionId);
    setModule(r.module ?? '');
    setSection(r.section ?? '');
    setQuestionText(r.questionText ?? '');
    setAnswerType(r.answerType ?? 'text');
    setRepeatable(!!r.repeatable);
    setRequiredFlag(!!r.requiredFlag);
    setConditionalFlag(!!r.conditionalFlag);
    void loadOptions(r.questionId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionId.trim()) return;
    const payload = {
      module: module.trim() || null,
      section: section.trim() || null,
      questionText: questionText.trim() || null,
      answerType: answerType.trim() || null,
      repeatable,
      requiredFlag,
      conditionalFlag,
    };
    setSaving(true);
    try {
      if (isCreateMode) {
        await discoveryApi.createQuestion({
          questionId: questionId.trim(),
          ...payload,
        });
        setSuccessMessage(`Created ${questionId.trim()}.`);
      } else if (editingId) {
        await discoveryApi.updateQuestion(editingId, payload);
        setSuccessMessage(`Updated ${editingId}.`);
      }
      closeModal();
      await loadQuestions();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, fromModal = false) => {
    if (!window.confirm(`Delete question ${id}? Related options/answers may block deletion.`)) return;
    try {
      await discoveryApi.deleteQuestion(id);
      setSuccessMessage(`Deleted ${id}.`);
      if (fromModal || editingId === id) closeModal();
      await loadQuestions();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const handleAddOption = async () => {
    const qid = editingId;
    if (!qid) return;
    if (!newOptionValue.trim() && !newOptionLabel.trim()) {
      setError(toApiError(new Error('Enter option_value or option_label.')));
      return;
    }
    try {
      await discoveryApi.createQuestionOption(qid, {
        optionValue: newOptionValue.trim() || newOptionLabel.trim(),
        optionLabel: newOptionLabel.trim() || newOptionValue.trim(),
      });
      setNewOptionValue('');
      setNewOptionLabel('');
      setSuccessMessage('Option added.');
      await loadOptions(qid);
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const handleImportCsv = async () => {
    if (!importFile) {
      setError(toApiError(new Error('Choose a CSV file first.')));
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await discoveryApi.importQuestionsCsv(importFile, updateExistingOnImport);
      setImportResult(result);
      setSuccessMessage(
        `Import done: ${result.questionsCreated} created, ${result.questionsUpdated} updated.`,
      );
      setImportFile(null);
      await loadQuestions();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setImporting(false);
    }
  };

  const handleBulkAddOptions = async () => {
    const qid = editingId;
    if (!qid || !bulkOptions.trim()) return;
    const parts = bulkOptions
      .split(/[;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      for (const part of parts) {
        await discoveryApi.createQuestionOption(qid, {
          optionValue: part,
          optionLabel: part,
        });
      }
      setBulkOptions('');
      setSuccessMessage(`Added ${parts.length} option(s).`);
      await loadOptions(qid);
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
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Discovery questions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Full list view — <span className="font-bold">New question</span> or row click opens a popup to
            add or edit.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New question
        </button>
      </header>

      <details className="shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Upload className="w-4 h-4 text-indigo-600" />
          Import from CSV
          <span className="text-xs font-normal text-slate-500 ml-1">(click to expand)</span>
        </summary>
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setImportFile(e.target.files?.[0] ?? null);
                setImportResult(null);
              }}
              className="text-sm text-slate-600"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={updateExistingOnImport}
                onChange={(e) => setUpdateExistingOnImport(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Update existing (by QID)
            </label>
            <button
              type="button"
              disabled={importing || !importFile}
              onClick={() => void handleImportCsv()}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
          </div>
          {importResult ? (
            <p className="text-xs text-slate-700">
              Rows {importResult.rowsRead} · Created {importResult.questionsCreated} · Updated{' '}
              {importResult.questionsUpdated} · Options {importResult.optionsCreated} · Mappings{' '}
              {importResult.mappingsCreated}
            </p>
          ) : null}
        </div>
      </details>

      <section className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center shrink-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={searchQid}
            onChange={(e) => setSearchQid(e.target.value)}
            placeholder="Search QID or text"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex-1 min-w-[140px]"
          />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[120px]"
          >
            <option value="">All modules</option>
            {uniqueModules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[120px]"
          >
            <option value="">All sections</option>
            {uniqueSections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadQuestions()}
            className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Reload
          </button>
          <span className="text-xs text-slate-500 ml-auto">{filteredRows.length} shown</span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : filteredRows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No questions.</p>
        ) : (
          <div className="flex-1 min-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">QID</th>
                  <th className="text-left px-4 py-3 font-bold">Module · Section</th>
                  <th className="text-left px-4 py-3 font-bold">Question</th>
                  <th className="text-left px-4 py-3 font-bold">Type</th>
                  <th className="text-left px-4 py-3 font-bold">Flags</th>
                  <th className="text-right px-4 py-3 font-bold w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r) => (
                  <tr
                    key={r.questionId}
                    className="hover:bg-slate-50/80 cursor-pointer"
                    onClick={() => startEdit(r)}
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{r.questionId}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[140px]">
                      {[r.module, r.section].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[280px] truncate">
                      {r.questionText ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{r.answerType ?? '—'}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {r.requiredFlag ? 'req ' : ''}
                      {r.repeatable ? 'rep ' : ''}
                      {r.conditionalFlag ? 'cond' : ''}
                      {!r.requiredFlag && !r.repeatable && !r.conditionalFlag ? '—' : ''}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => startEdit(r)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => void handleDelete(r.questionId)}
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
          aria-labelledby="question-modal-title"
          onClick={() => {
            if (!saving) closeModal();
          }}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 id="question-modal-title" className="text-lg font-bold text-slate-900">
                  {isCreateMode ? 'New question' : 'Edit question'}
                </h2>
                {!isCreateMode && editingId ? (
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{editingId}</p>
                ) : null}
              </div>
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
                    value={questionId}
                    onChange={(e) => setQuestionId(e.target.value)}
                    readOnly={!isCreateMode}
                    required
                    maxLength={32}
                    className={`${inputClass} font-mono ${!isCreateMode ? 'bg-slate-50' : ''}`}
                    placeholder="Q042"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className={labelClass}>module</span>
                    <input
                      value={module}
                      onChange={(e) => setModule(e.target.value)}
                      maxLength={100}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>section</span>
                    <input
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      maxLength={100}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className={labelClass}>question_text</span>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    rows={3}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>answer_type</span>
                  <select
                    value={answerType}
                    onChange={(e) => setAnswerType(e.target.value)}
                    className={`${inputClass} bg-white`}
                  >
                    {ANSWER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={repeatable}
                      onChange={(e) => setRepeatable(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    Repeatable
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiredFlag}
                      onChange={(e) => setRequiredFlag(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conditionalFlag}
                      onChange={(e) => setConditionalFlag(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    Conditional
                  </label>
                </div>

                {showOptionsPanel ? (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <p className={labelClass}>Answer options</p>
                    {optionsLoading ? (
                      <p className="text-xs text-slate-500">Loading…</p>
                    ) : options.length === 0 ? (
                      <p className="text-xs text-slate-500">No options yet.</p>
                    ) : (
                      <ul className="text-xs space-y-1 max-h-24 overflow-y-auto font-mono text-slate-700">
                        {options.map((o) => (
                          <li key={o.id}>{o.optionLabel ?? o.optionValue}</li>
                        ))}
                      </ul>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={newOptionValue}
                        onChange={(e) => setNewOptionValue(e.target.value)}
                        placeholder="option_value"
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                      <input
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        placeholder="option_label"
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAddOption()}
                      className="w-full px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold"
                    >
                      Add option
                    </button>
                    <textarea
                      value={bulkOptions}
                      onChange={(e) => setBulkOptions(e.target.value)}
                      rows={2}
                      placeholder="Bulk: Yes; No; Maybe"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void handleBulkAddOptions()}
                      className="w-full px-3 py-1.5 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold"
                    >
                      Add bulk options
                    </button>
                  </div>
                ) : editingId ? (
                  <p className="text-xs text-slate-500">
                    Save the question first, then edit again to manage options (choice types only).
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-slate-100 shrink-0 bg-slate-50/80 rounded-b-2xl">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : isCreateMode ? 'Create question' : 'Save changes'}
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
