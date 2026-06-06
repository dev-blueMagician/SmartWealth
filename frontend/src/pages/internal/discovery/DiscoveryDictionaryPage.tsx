import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { discoveryApi } from '../../../services/discoveryApi';
import type {
  FieldDictionaryEntry,
  FieldDictionaryImportResult,
  UpdateFieldDictionaryPayload,
} from '../../../services/discoveryTypes';
import { toApiError, type ApiError } from '../../../services/apiError';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';

const PAGE_SIZE = 50;

const MANDATORY_OPTIONS = ['', 'Mandatory', 'Optional', 'Conditional'] as const;

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export function DiscoveryDictionaryPage() {
  const [items, setItems] = useState<FieldDictionaryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [dbTotal, setDbTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dataDomain, setDataDomain] = useState('');
  const [mandatoryLevel, setMandatoryLevel] = useState('');

  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [systemFieldName, setSystemFieldName] = useState('');
  const [rowNo, setRowNo] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formItem, setFormItem] = useState('');
  const [detailFieldGroup, setDetailFieldGroup] = useState('');
  const [detailFieldNo, setDetailFieldNo] = useState('');
  const [detailFieldName, setDetailFieldName] = useState('');
  const [fieldDescription, setFieldDescription] = useState('');
  const [dataType, setDataType] = useState('');
  const [formMandatory, setFormMandatory] = useState('');
  const [appliesTo, setAppliesTo] = useState('');
  const [suggestedSource, setSuggestedSource] = useState('');
  const [validationRule, setValidationRule] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [sensitivity, setSensitivity] = useState('');
  const [updateFrequency, setUpdateFrequency] = useState('');
  const [missingDataAction, setMissingDataAction] = useState('');
  const [exampleValue, setExampleValue] = useState('');
  const [notes, setNotes] = useState('');

  const [importFile, setImportFile] = useState<File | null>(null);
  const [updateExistingOnImport, setUpdateExistingOnImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<FieldDictionaryImportResult | null>(null);

  const modalOpen = isCreateMode || !!editingKey;

  const closeModal = () => {
    setIsCreateMode(false);
    setEditingKey(null);
    setSystemFieldName('');
    setRowNo('');
    setFormDomain('');
    setFormItem('');
    setDetailFieldGroup('');
    setDetailFieldNo('');
    setDetailFieldName('');
    setFieldDescription('');
    setDataType('');
    setFormMandatory('');
    setAppliesTo('');
    setSuggestedSource('');
    setValidationRule('');
    setUsedFor('');
    setSensitivity('');
    setUpdateFrequency('');
    setMissingDataAction('');
    setExampleValue('');
    setNotes('');
  };

  const startCreate = () => {
    closeModal();
    setIsCreateMode(true);
  };

  const startEdit = (row: FieldDictionaryEntry) => {
    setIsCreateMode(false);
    setEditingKey(row.systemFieldName);
    setSystemFieldName(row.systemFieldName);
    setRowNo(row.rowNo != null ? String(row.rowNo) : '');
    setFormDomain(row.dataDomain ?? '');
    setFormItem(row.dataItem ?? '');
    setDetailFieldGroup(row.detailFieldGroup ?? '');
    setDetailFieldNo(row.detailFieldNo != null ? String(row.detailFieldNo) : '');
    setDetailFieldName(row.detailFieldName ?? '');
    setFieldDescription(row.fieldDescription ?? '');
    setDataType(row.dataType ?? '');
    setFormMandatory(row.mandatoryLevel ?? '');
    setAppliesTo(row.appliesTo ?? '');
    setSuggestedSource(row.suggestedSource ?? '');
    setValidationRule(row.validationRule ?? '');
    setUsedFor(row.usedFor ?? '');
    setSensitivity(row.sensitivity ?? '');
    setUpdateFrequency(row.updateFrequency ?? '');
    setMissingDataAction(row.missingDataAction ?? '');
    setExampleValue(row.exampleValue ?? '');
    setNotes(row.notes ?? '');
  };

  const buildPayload = (): UpdateFieldDictionaryPayload => ({
    rowNo: parseOptionalInt(rowNo),
    dataDomain: formDomain.trim() || null,
    dataItem: formItem.trim() || null,
    detailFieldGroup: detailFieldGroup.trim() || null,
    detailFieldNo: parseOptionalInt(detailFieldNo),
    detailFieldName: detailFieldName.trim() || null,
    fieldDescription: fieldDescription.trim() || null,
    dataType: dataType.trim() || null,
    mandatoryLevel: formMandatory.trim() || null,
    appliesTo: appliesTo.trim() || null,
    suggestedSource: suggestedSource.trim() || null,
    validationRule: validationRule.trim() || null,
    usedFor: usedFor.trim() || null,
    sensitivity: sensitivity.trim() || null,
    updateFrequency: updateFrequency.trim() || null,
    missingDataAction: missingDataAction.trim() || null,
    exampleValue: exampleValue.trim() || null,
    notes: notes.trim() || null,
  });

  const loadCount = useCallback(async () => {
    try {
      setDbTotal(await discoveryApi.getFieldDictionaryCount());
    } catch {
      setDbTotal(null);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discoveryApi.listFieldDictionary({
        search: search.trim() || undefined,
        dataDomain: dataDomain.trim() || undefined,
        mandatoryLevel: mandatoryLevel.trim() || undefined,
        page,
        size: PAGE_SIZE,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, [search, dataDomain, mandatoryLevel, page]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, saving]);

  const handleImport = async () => {
    if (!importFile) {
      setError(toApiError(new Error('Choose a CSV file first.')));
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await discoveryApi.importFieldDictionaryCsv(importFile, updateExistingOnImport);
      setImportResult(result);
      setSuccessMessage(
        `Imported dictionary: ${result.fieldsCreated} created, ${result.fieldsUpdated} updated.`,
      );
      setImportFile(null);
      setPage(0);
      await loadCount();
      await loadPage();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreateMode && !editingKey) return;
    setSaving(true);
    try {
      if (isCreateMode) {
        const key = systemFieldName.trim();
        if (!key) {
          setError(toApiError(new Error('system_field_name is required.')));
          return;
        }
        await discoveryApi.createFieldDictionary({
          systemFieldName: key,
          ...buildPayload(),
        });
        setSuccessMessage(`Created ${key}.`);
        await loadCount();
      } else if (editingKey) {
        await discoveryApi.updateFieldDictionary(editingKey, buildPayload());
        setSuccessMessage(`Updated ${editingKey}.`);
      }
      closeModal();
      await loadPage();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string, fromModal = false) => {
    if (
      !window.confirm(
        `Delete field "${key}"? Blocked if used by case discovery or question mappings.`,
      )
    ) {
      return;
    }
    try {
      await discoveryApi.deleteFieldDictionary(key);
      setSuccessMessage(`Deleted ${key}.`);
      if (fromModal || editingKey === key) closeModal();
      await loadCount();
      await loadPage();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const labelClass = 'text-[10px] font-bold uppercase text-slate-400';
  const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm';

  return (
    <div className="w-full max-w-none mx-auto flex flex-col gap-4 p-4 md:p-6 min-h-[calc(100vh-8rem)]">
      <header className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-indigo-700">
            <BookOpen className="w-6 h-6" />
            <h1 className="text-2xl font-black text-slate-900">Field dictionary</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Browse all fields — use <span className="font-bold">New field</span> or row actions to add or
            edit in a popup.
          </p>
          {dbTotal != null ? (
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-bold">{dbTotal.toLocaleString()}</span> fields in database
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New field
        </button>
      </header>

      <details className="shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm group">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Upload className="w-4 h-4 text-indigo-600" />
          Import CSV
          <span className="text-xs font-normal text-slate-500 ml-1">(click to expand)</span>
        </summary>
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={updateExistingOnImport}
                onChange={(e) => setUpdateExistingOnImport(e.target.checked)}
              />
              Update existing fields
            </label>
            <button
              type="button"
              disabled={importing || !importFile}
              onClick={() => void handleImport()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
          </div>
          {importResult ? (
            <p className="text-xs text-slate-700">
              Rows {importResult.rowsRead} · Created {importResult.fieldsCreated} · Updated{' '}
              {importResult.fieldsUpdated} · Skipped {importResult.fieldsSkipped}
            </p>
          ) : null}
        </div>
      </details>

      <section className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-end shrink-0">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 min-w-[180px] flex-1">
            <span className="flex items-center gap-1">
              <Search className="w-3 h-3" />
              Search
            </span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="system field, domain, item…"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 min-w-[140px]">
            Data domain
            <input
              value={dataDomain}
              onChange={(e) => {
                setDataDomain(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 min-w-[120px]">
            Mandatory
            <select
              value={mandatoryLevel}
              onChange={(e) => {
                setMandatoryLevel(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">All</option>
              <option value="Mandatory">Mandatory</option>
              <option value="Optional">Optional</option>
              <option value="Conditional">Conditional</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No fields found.</p>
        ) : (
          <div className="flex-1 min-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 font-bold">System field</th>
                  <th className="text-left p-3 font-bold">Domain · Item</th>
                  <th className="text-left p-3 font-bold">Detail</th>
                  <th className="text-left p-3 font-bold">Type</th>
                  <th className="text-left p-3 font-bold">Mandatory</th>
                  <th className="text-right p-3 font-bold w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.systemFieldName}
                    className="border-t border-slate-100 hover:bg-slate-50/80 cursor-pointer"
                    onClick={() => startEdit(row)}
                  >
                    <td className="p-3 font-mono text-slate-800 max-w-[280px] break-all">
                      {row.systemFieldName}
                    </td>
                    <td className="p-3 text-slate-700">
                      {[row.dataDomain, row.dataItem].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[200px] truncate">
                      {row.detailFieldName ?? '—'}
                    </td>
                    <td className="p-3 text-slate-600">{row.dataType ?? '—'}</td>
                    <td className="p-3 text-slate-600">{row.mandatoryLevel ?? '—'}</td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => startEdit(row)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => void handleDelete(row.systemFieldName)}
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

        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span>
            Page {page + 1} / {totalPages} · {total.toLocaleString()} matching
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-dictionary-modal-title"
          onClick={() => {
            if (!saving) closeModal();
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2
                  id="field-dictionary-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {isCreateMode ? 'New field' : 'Edit field'}
                </h2>
                {!isCreateMode && editingKey ? (
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{editingKey}</p>
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

            <form
              onSubmit={(e) => void handleSave(e)}
              className="flex flex-col min-h-0 flex-1"
            >
              <div className="overflow-y-auto px-5 py-4 space-y-3">
                <label className="block space-y-1">
                  <span className={labelClass}>system_field_name *</span>
                  <input
                    value={systemFieldName}
                    onChange={(e) => setSystemFieldName(e.target.value)}
                    readOnly={!isCreateMode}
                    required
                    maxLength={200}
                    placeholder="e.g. client.risk_profile"
                    className={`${inputClass} font-mono ${!isCreateMode ? 'bg-slate-50' : ''}`}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className={labelClass}>row_no</span>
                    <input
                      value={rowNo}
                      onChange={(e) => setRowNo(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>mandatory_level</span>
                    <select
                      value={formMandatory}
                      onChange={(e) => setFormMandatory(e.target.value)}
                      className={inputClass}
                    >
                      {MANDATORY_OPTIONS.map((o) => (
                        <option key={o || 'all'} value={o}>
                          {o || '—'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className={labelClass}>data_domain</span>
                    <input
                      value={formDomain}
                      onChange={(e) => setFormDomain(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>data_item</span>
                    <input
                      value={formItem}
                      onChange={(e) => setFormItem(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className={labelClass}>detail_field_group</span>
                    <input
                      value={detailFieldGroup}
                      onChange={(e) => setDetailFieldGroup(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>detail_field_no</span>
                    <input
                      value={detailFieldNo}
                      onChange={(e) => setDetailFieldNo(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className={labelClass}>detail_field_name</span>
                  <input
                    value={detailFieldName}
                    onChange={(e) => setDetailFieldName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>field_description</span>
                  <textarea
                    value={fieldDescription}
                    onChange={(e) => setFieldDescription(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className={labelClass}>data_type</span>
                    <input
                      value={dataType}
                      onChange={(e) => setDataType(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>applies_to</span>
                    <input
                      value={appliesTo}
                      onChange={(e) => setAppliesTo(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className={labelClass}>suggested_source</span>
                  <textarea
                    value={suggestedSource}
                    onChange={(e) => setSuggestedSource(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>validation_rule</span>
                  <textarea
                    value={validationRule}
                    onChange={(e) => setValidationRule(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>used_for</span>
                  <textarea
                    value={usedFor}
                    onChange={(e) => setUsedFor(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className={labelClass}>sensitivity</span>
                    <input
                      value={sensitivity}
                      onChange={(e) => setSensitivity(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>update_frequency</span>
                    <input
                      value={updateFrequency}
                      onChange={(e) => setUpdateFrequency(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className={labelClass}>missing_data_action</span>
                  <textarea
                    value={missingDataAction}
                    onChange={(e) => setMissingDataAction(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>example_value</span>
                  <input
                    value={exampleValue}
                    onChange={(e) => setExampleValue(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-slate-100 shrink-0 bg-slate-50/80 rounded-b-2xl">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : isCreateMode ? 'Create field' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white disabled:opacity-50"
                >
                  Cancel
                </button>
                {editingKey && !isCreateMode ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete(editingKey, true)}
                    className="ml-auto px-4 py-2 border border-rose-200 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-50 flex items-center gap-1 disabled:opacity-50"
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

      {error ? <ErrorPopup error={error} onClose={() => setError(null)} /> : null}
      {successMessage ? (
        <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
      ) : null}
    </div>
  );
}
