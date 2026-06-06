import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ChevronLeft,
  Target,
  ShieldCheck,
  Zap,
  Cpu,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';
import {
  wealthApi,
  type PlanningDraftDetail,
  type PlanningDraftSummary,
  type PlanningTemplateRecord,
} from '../../services/wealthApi';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';

export const PlanningWorkspacePage = () => {
  const { portalCaps } = useAuth();
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drafts, setDrafts] = useState<PlanningDraftSummary[]>([]);
  const [templates, setTemplates] = useState<PlanningTemplateRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [exportTemplateId, setExportTemplateId] = useState<string>('');
  const [planDetail, setPlanDetail] = useState<PlanningDraftDetail | null>(null);
  const [creatingRecommendation, setCreatingRecommendation] = useState(false);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [recommendationSummary, setRecommendationSummary] = useState(
    'Sample 60/40 equity vs fixed income tilt for BALANCED profile.',
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [assumptions, setAssumptions] = useState({
    horizonYears: '20',
    inflationPct: '2.5',
    targetReturnPct: '7.0',
    riskTolerance: 'Balanced',
  });

  const loadWorkspace = useCallback(async () => {
    if (!caseId) return;
    const [draftRows, templateRows] = await Promise.all([
      wealthApi.listCasePlanningDrafts(caseId),
      wealthApi.listActivePlanningTemplates(),
    ]);
    setDrafts(draftRows);
    setTemplates(templateRows);
    if (draftRows.length > 0 && !selectedPlanId) {
      setSelectedPlanId(draftRows[0].planId);
    }
    if (templateRows.length > 0) {
      if (!selectedTemplateId) setSelectedTemplateId(templateRows[0].id);
      if (!exportTemplateId) setExportTemplateId(templateRows[0].id);
    }
  }, [caseId, exportTemplateId, selectedPlanId, selectedTemplateId]);

  useEffect(() => {
    if (!caseId) return;
    loadWorkspace().catch((err) => {
      console.error('Failed to load planning workspace:', err);
      setError(toApiError(err));
    });
  }, [caseId, loadWorkspace]);

  useEffect(() => {
    if (!selectedPlanId) {
      setPlanDetail(null);
      return;
    }
    wealthApi
      .getPlanningDraft(selectedPlanId)
      .then(setPlanDetail)
      .catch((err) => setError(toApiError(err)));
  }, [selectedPlanId]);

  const buildAssumptionsPayload = () => ({
    horizonYears: Number(assumptions.horizonYears),
    inflationPct: Number(assumptions.inflationPct),
    targetReturnPct: Number(assumptions.targetReturnPct),
    riskTolerance: assumptions.riskTolerance,
  });

  const handleCreateOrRegenerateDraft = async () => {
    if (!caseId) return;
    setDrafting(true);
    try {
      const assumptionPayload = buildAssumptionsPayload();
      if (selectedPlanId) {
        const regenerated = await wealthApi.regeneratePlanningDraft(selectedPlanId, {
          assumptions: assumptionPayload,
        });
        setPlanDetail(regenerated);
        setSuccessMessage('Planning draft regenerated with AI agent.');
      } else {
        if (!selectedTemplateId) {
          throw new Error('Select an ACTIVE plan template before creating a draft.');
        }
        const created = await wealthApi.createCasePlanningDraft(caseId, {
          templateId: selectedTemplateId,
          assumptions: assumptionPayload,
        });
        setSelectedPlanId(created.planId);
        setPlanDetail(created);
        setSuccessMessage('Planning draft created with AI agent.');
      }
      await loadWorkspace();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setDrafting(false);
    }
  };

  const handleExportWord = async () => {
    if (!selectedPlanId) {
      setError(toApiError(new Error('Select a planning draft to export.')));
      return;
    }
    setExporting(true);
    try {
      const result = await wealthApi.exportPlanningDraft(selectedPlanId, {
        templateId: exportTemplateId || undefined,
        refreshCompose: true,
        exportMode: 'llm_only',
      });
      await wealthApi.downloadPlanningArtifact(result.artifactId, result.filename);
      setSuccessMessage(`Exported Word: ${result.filename}`);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setExporting(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedPlanId) {
      setError(toApiError(new Error('Select a planning draft to finalize.')));
      return;
    }
    setLoading(true);
    try {
      const updated = await wealthApi.regeneratePlanningDraft(selectedPlanId, { markReadyForReview: true });
      setPlanDetail(updated);
      setSuccessMessage('Draft marked ready for review. Use case chat or API to finalize if needed.');
      await loadWorkspace();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecommendation = async () => {
    if (!selectedPlanId) {
      setError(toApiError(new Error('Create a planning draft before creating a recommendation.')));
      return;
    }
    if (!recommendationSummary.trim()) {
      setError(toApiError(new Error('Recommendation summary is required.')));
      return;
    }
    setCreatingRecommendation(true);
    try {
      const response = await wealthApi.createRecommendation(selectedPlanId, {
        recType: 'ALLOCATION',
        summary: recommendationSummary.trim(),
      });
      setRecommendationId(response.id ?? null);
      setSuccessMessage(
        response.id
          ? `Recommendation created successfully: ${response.id}`
          : 'Recommendation created successfully.',
      );
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setCreatingRecommendation(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-900 transition-colors text-[10px] font-bold uppercase tracking-widest mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Case Detail
          </button>
          <h1 className="text-3xl font-serif italic text-zinc-900">Wealth Planning Workspace</h1>
          <p className="text-zinc-500 text-sm">
            Case Ref: <span className="font-mono text-zinc-900 font-bold">{caseId?.toUpperCase()}</span>
          </p>
        </div>
        {portalCaps.canUsePlanningWorkspace && (
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleCreateOrRegenerateDraft}
              disabled={drafting || templates.length === 0}
              className="px-6 py-3 bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-zinc-200 transition-all border border-zinc-200 disabled:opacity-50"
            >
              {selectedPlanId ? (
                <RefreshCw className={cn('w-4 h-4 text-blue-600', drafting && 'animate-spin')} />
              ) : (
                <Cpu className={cn('w-4 h-4 text-blue-600', drafting && 'animate-spin')} />
              )}
              {selectedPlanId ? 'Regenerate draft (AI)' : 'Create draft (AI)'}
            </button>
            <button
              onClick={handleExportWord}
              disabled={exporting || !selectedPlanId}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-emerald-500 transition-all disabled:opacity-50"
            >
              <FileDown className={cn('w-4 h-4', exporting && 'animate-pulse')} />
              Export plan ( *.Word)
            </button>
            <button
              onClick={handleCreateRecommendation}
              disabled={creatingRecommendation || !planDetail}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/10 disabled:opacity-50"
            >
              <Target className={cn('w-4 h-4', creatingRecommendation && 'animate-pulse')} />
              Create Recommendation
            </button>
            <button
              onClick={handleFinalize}
              disabled={loading || !selectedPlanId}
              className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/10 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Mark ready for review
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden p-8 space-y-6">
            <h2 className="text-xl font-serif italic text-zinc-900">Draft &amp; template</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="space-y-2 block">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Planning draft (case)
                </span>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm outline-none"
                >
                  <option value="">— New draft —</option>
                  {drafts.map((d) => (
                    <option key={d.planId} value={d.planId}>
                      {d.templateCode ?? 'plan'} · {d.status} · {d.planId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 block">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Template for create
                </span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={Boolean(selectedPlanId)}
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm outline-none disabled:opacity-60"
                >
                  {templates.length === 0 ? (
                    <option value="">No ACTIVE template — upload in Plan templates</option>
                  ) : (
                    templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} v{t.versionNo} ({t.locale})
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="space-y-2 block md:col-span-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Template for Word export
                </span>
                <select
                  value={exportTemplateId}
                  onChange={(e) => setExportTemplateId(e.target.value)}
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm outline-none"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} v{t.versionNo}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-blue-50 rounded-2xl">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-serif italic">Strategic Assumptions</h2>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Investment Horizon (Years)
                </label>
                <input
                  type="number"
                  value={assumptions.horizonYears}
                  onChange={(e) => setAssumptions({ ...assumptions, horizonYears: e.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Target Annual Return (%)
                </label>
                <input
                  type="number"
                  value={assumptions.targetReturnPct}
                  onChange={(e) => setAssumptions({ ...assumptions, targetReturnPct: e.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Inflation (%)
                </label>
                <input
                  type="number"
                  value={assumptions.inflationPct}
                  onChange={(e) => setAssumptions({ ...assumptions, inflationPct: e.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-blue-500/10 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Risk Profile Anchor
                </label>
                <select
                  value={assumptions.riskTolerance}
                  onChange={(e) => setAssumptions({ ...assumptions, riskTolerance: e.target.value })}
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none appearance-none"
                >
                  <option>Conservative</option>
                  <option>Balanced</option>
                  <option>Growth</option>
                  <option>Aggressive</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden p-8">
            <h2 className="text-xl font-serif italic text-zinc-900 mb-6">Plan draft payload</h2>
            <pre className="text-xs font-mono bg-zinc-50 border border-zinc-100 rounded-2xl p-4 overflow-auto max-h-[360px]">
              {planDetail?.payload
                ? JSON.stringify(planDetail.payload, null, 2)
                : 'Select or create a planning draft.'}
            </pre>
          </section>

          <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden p-8 space-y-4">
            <h2 className="text-xl font-serif italic text-zinc-900">Recommendation</h2>
            <label className="block space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Recommendation Summary
              </span>
              <textarea
                value={recommendationSummary}
                onChange={(e) => setRecommendationSummary(e.target.value)}
                className="w-full min-h-28 px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/10"
              />
            </label>
            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Recommendation ID</p>
              <p className="mt-1 text-sm font-mono font-bold text-zinc-900">
                {recommendationId ?? 'Not created yet'}
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-zinc-900 rounded-3xl p-6 text-white border border-zinc-800 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-serif italic tracking-tight">AI Planning Agent</h3>
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div className="space-y-6 relative z-10">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 italic font-serif text-sm text-zinc-300 leading-relaxed">
                Create/regenerate calls backend → AI-engine <code className="text-blue-300">/internal/planning/compose</code>{' '}
                (discovery rebuild + LLM narratives). Export fills DOCX placeholders from template mapping.
              </div>
              <div className="flex items-center gap-2 p-3 bg-white/10 rounded-2xl border border-white/5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {templates.length} ACTIVE template(s) · {drafts.length} draft(s)
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
