import { useEffect, useState } from 'react';
import { Upload, CheckCircle2, FileJson, FileText, Trash2 } from 'lucide-react';
import { wealthApi, type PlanningTemplateRecord } from '../../../services/wealthApi';
import { toApiError, type ApiError } from '../../../services/apiError';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';
import { cn } from '../../../lib/utils';

export function PlanningTemplateRegistryPage() {
  const [templates, setTemplates] = useState<PlanningTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [code, setCode] = useState('HOME_LOAN_MORTGAGE');
  const [name, setName] = useState('Home Loan Wealth Plan');
  const [versionNo, setVersionNo] = useState('1');
  const [locale, setLocale] = useState('vi-VN');
  const [productType, setProductType] = useState('HOME_LOAN');
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const rows = await wealthApi.listPlanningTemplates();
      setTemplates(rows);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleUpload = async () => {
    if (!docxFile) {
      setError(toApiError(new Error('DOCX file is required.')));
      return;
    }
    setSubmitting(true);
    try {
      const created = await wealthApi.uploadPlanningTemplate({
        code,
        name,
        versionNo: Number(versionNo),
        locale,
        productType,
        docxFile,
        mappingFile,
      });
      setSuccessMessage(`Template uploaded: ${created.code} v${created.versionNo}`);
      setDocxFile(null);
      setMappingFile(null);
      await loadTemplates();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (templateId: string) => {
    try {
      await wealthApi.publishPlanningTemplate(templateId);
      setSuccessMessage('Template published.');
      await loadTemplates();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  const handleDelete = async (item: PlanningTemplateRecord) => {
    const label = `${item.code} v${item.versionNo}`;
    if (!window.confirm(`Delete template "${label}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      await wealthApi.deletePlanningTemplate(item.id);
      setSuccessMessage(`Template deleted: ${label}`);
      await loadTemplates();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-serif italic text-zinc-900">Planning Template Registry</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Upload DOCX template and optional mapping JSON for planning generation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Template code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Version</span>
            <input
              value={versionNo}
              onChange={(e) => setVersionNo(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Locale</span>
            <input
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-zinc-500">Product type</span>
            <input
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">DOCX template</span>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setDocxFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">Mapping JSON (optional)</span>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setMappingFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={submitting}
          className={cn(
            'mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
            submitting ? 'bg-zinc-300 text-zinc-600' : 'bg-zinc-900 text-white hover:bg-zinc-800',
          )}
        >
          <Upload className="h-4 w-4" />
          {submitting ? 'Uploading…' : 'Upload template'}
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Registered templates</h2>
        {loading ? <p className="text-sm text-zinc-500 mt-3">Loading templates...</p> : null}
        {!loading && templates.length === 0 ? (
          <p className="text-sm text-zinc-500 mt-3">No planning template uploaded yet.</p>
        ) : null}
        <div className="space-y-3 mt-4">
          {templates.map((item) => (
            <div key={item.id} className="rounded-xl border border-zinc-200 p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900">
                  {item.code} v{item.versionNo} · {item.name}
                </p>
                <p className="text-xs text-zinc-500 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{item.documentFilename ?? 'template.docx'}</span>
                  <span className="inline-flex items-center gap-1"><FileJson className="h-3.5 w-3.5" />{item.mappingJson ? 'Mapping loaded' : 'No mapping'}</span>
                  <span>{item.locale}</span>
                  <span>{item.productType ?? 'GENERAL'}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded-full font-semibold',
                    item.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {item.status}
                </span>
                {item.status !== 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => void handlePublish(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Publish
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  disabled={deletingId === item.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                    deletingId === item.id
                      ? 'border-zinc-200 text-zinc-400 cursor-not-allowed'
                      : 'border-rose-200 text-rose-700 hover:bg-rose-50',
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === item.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
