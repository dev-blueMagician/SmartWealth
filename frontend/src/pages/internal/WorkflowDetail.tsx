import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Play, CheckCircle2, Activity, DatabaseZap, RefreshCw } from 'lucide-react';
import { wealthApi } from '../../services/wealthApi';
import { workflowApi, type CasePhaseAssessmentsFull, type OrchestrationSeedHints } from '../../services/workflowApi';
import { ApiError, toApiError, type ApiError as ApiErrorShape } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';
import { cn } from '../../lib/utils';
import {
  CUSTOM_QUEUE_SELECT_VALUE,
  WORKFLOW_QUEUE_STATE_ORDER,
  WORKFLOW_QUEUE_TO_STATES_PRESETS,
  resolveStartFromSelectValue,
  resolveToStatesSelectValue,
} from '../../constants/workflowQueueStates';

const TOKEN_STORAGE_KEY = 'smartwealth_internal_workflow_token';

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const FALLBACK_PHASE_ORDER = ['ONBOARDING', 'DISCOVERY', 'PLANNING', 'COLLABORATION', 'EXECUTION', 'MONITORING'] as const;

export const WorkflowDetailPage = () => {
  const { workflowId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const linkedCaseId = (searchParams.get('caseId') ?? '').trim();

  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [workflowData, setWorkflowData] = useState<Record<string, unknown> | null>(null);
  const [auditEvents, setAuditEvents] = useState<Record<string, unknown>[]>([]);
  const [internalAuditEvents, setInternalAuditEvents] = useState<Record<string, unknown>[]>([]);
  const [lastActionResult, setLastActionResult] = useState<unknown>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'warning'>('success');

  const [reviewerId, setReviewerId] = useState('rm-ui-01');
  const [reviewNote, setReviewNote] = useState('Approved from internal workflow UI.');
  const [approved, setApproved] = useState(true);

  const [internalToken, setInternalToken] = useState<string>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) ?? 'secret-test';
    } catch {
      return 'secret-test';
    }
  });
  const [processLimit, setProcessLimit] = useState('20');
  const [assessmentCode, setAssessmentCode] = useState('onboarding_completeness');
  const [toStates, setToStates] = useState('READY_FOR_VALIDATION');
  const [seedEvents, setSeedEvents] = useState(true);
  const [startFromState, setStartFromState] = useState('DATA_CAPTURE');
  /** When true, seed «from» uses text field (value not in preset list or user chose Custom). */
  const [startFromManualEntry, setStartFromManualEntry] = useState(false);
  /** When true, target states use text field. */
  const [toStatesManualEntry, setToStatesManualEntry] = useState(false);
  const [activeFlowTab, setActiveFlowTab] = useState<'business' | 'internal'>('business');

  const [phaseManifest, setPhaseManifest] = useState<CasePhaseAssessmentsFull | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string>('ONBOARDING');
  const [linkedCasePhase, setLinkedCasePhase] = useState<string | null>(null);
  const [seedHints, setSeedHints] = useState<OrchestrationSeedHints | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [loadingSeedHints, setLoadingSeedHints] = useState(false);

  const phaseOrder = useMemo(() => {
    if (phaseManifest?.phase_order?.length) return phaseManifest.phase_order;
    return [...FALLBACK_PHASE_ORDER];
  }, [phaseManifest]);

  const assessmentsForPhase = useMemo(() => {
    const codes = phaseManifest?.phases?.[selectedPhase];
    return Array.isArray(codes) ? codes : [];
  }, [phaseManifest, selectedPhase]);

  useEffect(() => {
    let cancelled = false;
    setLoadingManifest(true);
    void workflowApi
      .getCasePhaseAssessments()
      .then((res) => {
        if (cancelled || !('phases' in res)) return;
        setPhaseManifest(res);
      })
      .catch((err) => {
        if (!cancelled) setError(toApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingManifest(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!linkedCaseId) {
      setLinkedCasePhase(null);
      return;
    }
    let cancelled = false;
    void wealthApi
      .getCase(linkedCaseId)
      .then((rec) => {
        if (cancelled || !rec?.phase) return;
        const ph = String(rec.phase).toUpperCase();
        setLinkedCasePhase(ph);
        setSelectedPhase(ph);
      })
      .catch(() => {
        if (!cancelled) setLinkedCasePhase(null);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedCaseId]);

  useEffect(() => {
    if (!assessmentsForPhase.length) return;
    if (!assessmentsForPhase.includes(assessmentCode)) {
      setAssessmentCode(assessmentsForPhase[0]);
    }
  }, [assessmentsForPhase, assessmentCode]);

  useEffect(() => {
    if (!workflowId || !assessmentCode.trim()) return;
    let cancelled = false;
    setLoadingSeedHints(true);
    void workflowApi
      .getOrchestrationSeedHints(workflowId, assessmentCode, internalToken)
      .then((hints) => {
        if (cancelled) return;
        setSeedHints(hints);
        const joinedTargets = hints.to_states.join(', ');
        setStartFromState(hints.from_state);
        setToStates(joinedTargets);
        setStartFromManualEntry(resolveStartFromSelectValue(hints.from_state) === CUSTOM_QUEUE_SELECT_VALUE);
        setToStatesManualEntry(resolveToStatesSelectValue(joinedTargets) === CUSTOM_QUEUE_SELECT_VALUE);
      })
      .catch((err) => {
        if (!cancelled) setError(toApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingSeedHints(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workflowId, assessmentCode, internalToken]);

  useEffect(() => {
    if (!workflowId) return;
    void loadCoreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  const internalTokenPreview = useMemo(
    () => (internalToken ? `${internalToken.slice(0, 4)}...${internalToken.slice(-2)}` : 'Not set'),
    [internalToken],
  );

  const persistToken = () => {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, internalToken);
      setToastVariant('success');
      setSuccessMessage('Internal token saved successfully.');
    } catch {
      // no-op: localStorage might be unavailable in restricted contexts.
    }
  };

  const runAction = async (
    name: string,
    handler: () => Promise<unknown>,
    successText?: string | ((result: unknown) => string | { message: string; variant?: 'success' | 'warning' } | undefined),
  ) => {
    setRunningAction(name);
    try {
      const result = await handler();
      setLastActionResult(result);
      if (typeof successText === 'function') {
        const msg = successText(result);
        if (typeof msg === 'string') {
          setToastVariant('success');
          setSuccessMessage(msg);
        } else if (msg && typeof msg === 'object') {
          setToastVariant(msg.variant ?? 'success');
          setSuccessMessage(msg.message);
        }
      } else if (successText) {
        setToastVariant('success');
        setSuccessMessage(successText);
      }
      return result;
    } catch (err) {
      setError(toApiError(err));
      throw err;
    } finally {
      setRunningAction(null);
    }
  };

  const loadCoreData = async () => {
    if (!workflowId) return;
    setLoadingDetail(true);
    try {
      const [workflow, audit] = await Promise.all([workflowApi.getWorkflow(workflowId), workflowApi.listAuditEvents(workflowId)]);
      setWorkflowData(workflow);
      setAuditEvents(audit);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRunWorkflow = async () => {
    if (!workflowId) return;
    await runAction('run-workflow', () => workflowApi.runWorkflow(workflowId), 'Run workflow completed successfully.');
    await loadCoreData();
  };

  const handleHumanApproval = async (event: FormEvent) => {
    event.preventDefault();
    if (!workflowId) return;
    await runAction(
      'human-approval',
      () =>
        workflowApi.applyHumanApproval(workflowId, {
          approved,
          reviewer_id: reviewerId,
          note: reviewNote || undefined,
        }),
      'Human approval submitted successfully.',
    );
    await loadCoreData();
  };

  const handleProcessAiEvents = async () => {
    const limit = Number(processLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      setError(new ApiError(400, 'VALIDATION_ERROR', 'Process limit must be a positive number.'));
      return;
    }
    await runAction(
      'process-ai-events',
      () => workflowApi.processAiEvents(limit, internalToken),
      'Process AI events completed successfully.',
    );
  };

  const handleSeedFixtures = async (event: FormEvent) => {
    event.preventDefault();
    if (!workflowId) return;
    const states = toStates
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (states.length === 0) {
      setError(new ApiError(400, 'VALIDATION_ERROR', 'to_states must contain at least one state.'));
      return;
    }
    await runAction(
      'seed-fixtures',
      () =>
        workflowApi.seedFixtures(
          {
            workflow_id: workflowId,
            assessment_code: assessmentCode,
            to_states: states,
            seed_events: seedEvents,
            start_from_state: startFromState,
          },
          internalToken,
        ),
      (result) => {
        const row = result as Record<string, unknown>;
        const seeded = Array.isArray(row.seeded_events) ? row.seeded_events.length : 0;
        const skipped = Array.isArray(row.skipped_duplicate_pending_events)
          ? row.skipped_duplicate_pending_events.length
          : 0;
        const wfShort = `${workflowId.slice(0, 8)}…`;
        let msg = `Seed for ${wfShort}: ${seeded} event(s) inserted`;
        if (skipped > 0) {
          msg += ` · ${skipped} skipped (pending duplicate same workflow + from→to)`;
        }
        msg += '.';
        return skipped > 0 ? { message: msg, variant: 'warning' as const } : msg;
      },
    );
  };

  const handleLoadInternalAudit = async () => {
    if (!workflowId) return;
    const events = await runAction(
      'internal-audit',
      () => workflowApi.internalAudit(workflowId, internalToken),
      'Internal audit loaded successfully.',
    );
    if (Array.isArray(events)) {
      setInternalAuditEvents(events as Record<string, unknown>[]);
    }
  };

  if (!workflowId) return <div className="p-10 text-zinc-500">Missing workflow ID.</div>;

  return (
    <div className="space-y-8">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast
        message={successMessage}
        variant={toastVariant}
        onClose={() => {
          setSuccessMessage(null);
          setToastVariant('success');
        }}
      />

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Link
            to="/internal/ai-engine/workflows"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-900"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Workflow List
          </Link>
          <h1 className="text-3xl font-serif italic text-zinc-900">Workflow Management</h1>
          <p className="text-sm text-zinc-500 font-mono">{workflowId}</p>
          {linkedCaseId ? (
            <p className="text-xs text-zinc-500">
              Linked case: <span className="font-mono text-zinc-700">{linkedCaseId}</span>
              {linkedCasePhase ? (
                <>
                  {' '}
                  · phase <span className="font-semibold text-zinc-800">{linkedCasePhase}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <button
          onClick={loadCoreData}
          disabled={loadingDetail}
          className={cn(
            'px-5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 inline-flex items-center gap-2 transition-all',
            loadingDetail ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-50',
          )}
        >
          <RefreshCw className={cn('w-4 h-4', loadingDetail && 'animate-spin')} />
          Reload Data
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-2 inline-flex gap-2">
        <button
          onClick={() => setActiveFlowTab('business')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all',
            activeFlowTab === 'business' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50',
          )}
        >
          Business Flow
        </button>
        <button
          onClick={() => setActiveFlowTab('internal')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all',
            activeFlowTab === 'internal' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50',
          )}
        >
          Internal Queue Flow
        </button>
      </div>

      {activeFlowTab === 'business' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif italic text-zinc-900">Step 1: Run Workflow</h2>
                <button
                  onClick={handleRunWorkflow}
                  disabled={runningAction !== null}
                  className={cn(
                    'px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all',
                    runningAction ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-800',
                  )}
                >
                  <Play className="w-4 h-4" />
                  Run Workflow
                </button>
              </div>
              <pre className="max-h-72 overflow-auto text-xs font-mono bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                {workflowData ? prettyJson(workflowData) : loadingDetail ? 'Loading workflow...' : 'No workflow data'}
              </pre>
            </section>

            <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-serif italic text-zinc-900">Step 2: Human Approval (if required)</h2>
              <form className="space-y-4" onSubmit={handleHumanApproval}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Reviewer ID</span>
                    <input
                      value={reviewerId}
                      onChange={(e) => setReviewerId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Note</span>
                    <input
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
                    <input
                      type="radio"
                      checked={approved}
                      onChange={() => setApproved(true)}
                      className="accent-emerald-600"
                    />
                    Approved
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
                    <input
                      type="radio"
                      checked={!approved}
                      onChange={() => setApproved(false)}
                      className="accent-rose-600"
                    />
                    Rejected
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={runningAction !== null}
                  className={cn(
                    'px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all',
                    runningAction ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-500',
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Human Approval
                </button>
              </form>
            </section>

            <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-serif italic text-zinc-900">Step 3: Audit Events</h2>
              <pre className="max-h-80 overflow-auto text-xs font-mono bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                {prettyJson(auditEvents)}
              </pre>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-zinc-900 text-white rounded-3xl border border-zinc-800 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-serif italic">Latest Action Result</h2>
              <pre className="max-h-60 overflow-auto text-xs font-mono bg-white/5 border border-white/10 rounded-2xl p-4">
                {prettyJson(lastActionResult)}
              </pre>
            </section>
          </div>
        </div>
      )}

      {activeFlowTab === 'internal' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-serif italic text-zinc-900">Internal API Token</h2>
              <p className="text-xs text-zinc-500">Preview: {internalTokenPreview}</p>
              <label className="space-y-2 block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">
                  X-Internal-Token (AI-engine)
                </span>
                <input
                  value={internalToken}
                  onChange={(e) => setInternalToken(e.target.value)}
                  placeholder="Matches AI-engine internal_workflow_event_token"
                  autoComplete="off"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
              <button
                onClick={persistToken}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-50"
              >
                Save Token in Browser
              </button>
            </section>

            <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-serif italic text-zinc-900">Internal Workflow Actions</h2>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Uses workflow <span className="font-mono text-zinc-700">{workflowId.slice(0, 8)}…</span>. Seed skips
                inserting an event when this workflow already has a <strong>pending</strong> row (
                <span className="font-mono">processed_at</span> empty) with the same{' '}
                <span className="font-mono">from_state → to_state</span> — avoids duplicate AI loop work.
              </p>
              <form className="space-y-3 pt-2" onSubmit={handleSeedFixtures}>
                <p className="text-xs font-bold text-zinc-600">Step 1: Seed Fixtures</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Phase và assessment lấy từ catalog AI-engine (<span className="font-mono text-zinc-700">GET /api/v1/case-phase-assessments</span>
                  , DB <span className="font-mono">case_phase</span> / <span className="font-mono">ai_interaction</span> khi đã seed).{' '}
                  <span className="font-mono">from_state</span> / <span className="font-mono">to_state</span> gợi ý từ{' '}
                  <span className="font-mono">workflow_event</span> của đúng <span className="font-mono">workflow_id</span>, lọc theo
                  assessment đã chọn qua <span className="font-mono">workflow_ai_trigger</span> (
                  <span className="font-mono">to_state</span> khớp trigger). Nếu chưa có event phù hợp → default + danh sách trigger.
                  <span className="font-mono"> orchestration_request</span> chỉ để xem ngữ cảnh.
                  {loadingManifest ? ' Đang tải manifest…' : ''}
                </p>
                <label className="space-y-2 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">
                    Case phase (filter manifest)
                  </span>
                  <select
                    value={selectedPhase}
                    onChange={(e) => setSelectedPhase(e.target.value)}
                    disabled={loadingManifest || phaseOrder.length === 0}
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    {phaseOrder.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">
                    Assessment (child spec code)
                  </span>
                  <select
                    value={assessmentsForPhase.includes(assessmentCode) ? assessmentCode : ''}
                    onChange={(e) => setAssessmentCode(e.target.value)}
                    disabled={assessmentsForPhase.length === 0}
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    {assessmentsForPhase.length === 0 ? (
                      <option value="">No assessments for phase</option>
                    ) : (
                      assessmentsForPhase.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {seedHints ? (
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 space-y-1 text-[11px] text-zinc-600">
                    <p>
                      Hints: <span className="font-mono text-zinc-800">from_state</span> ← {seedHints.sources.from_state};{' '}
                      <span className="font-mono text-zinc-800">to_states</span> ← {seedHints.sources.to_states}.
                      {loadingSeedHints ? ' Đang làm mới…' : ''}
                    </p>
                    {seedHints.workflow_event ? (
                      <pre className="max-h-28 overflow-auto text-[10px] font-mono text-zinc-700 whitespace-pre-wrap bg-white/60 rounded-lg p-2 border border-zinc-100">
                        {prettyJson(seedHints.workflow_event)}
                      </pre>
                    ) : null}
                    {seedHints.orchestration_request ? (
                      <details className="group">
                        <summary className="cursor-pointer font-semibold text-zinc-700">
                          orchestration_request (latest row)
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto text-[10px] font-mono text-zinc-700 whitespace-pre-wrap">
                          {prettyJson(seedHints.orchestration_request)}
                        </pre>
                      </details>
                    ) : (
                      <p className="text-zinc-500 italic">Chưa có orchestration_request cho workflow này — gợi ý dùng default.</p>
                    )}
                  </div>
                ) : null}
                <label className="space-y-2 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">
                    Target states (preset chain)
                  </span>
                  <select
                    value={toStatesManualEntry ? CUSTOM_QUEUE_SELECT_VALUE : resolveToStatesSelectValue(toStates)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CUSTOM_QUEUE_SELECT_VALUE) setToStatesManualEntry(true);
                      else {
                        setToStatesManualEntry(false);
                        setToStates(v);
                      }
                    }}
                    disabled={loadingSeedHints}
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 bg-white disabled:opacity-60"
                  >
                    {WORKFLOW_QUEUE_TO_STATES_PRESETS.map((p) => (
                      <option key={p.id} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                    <option value={CUSTOM_QUEUE_SELECT_VALUE}>Custom… (comma-separated)</option>
                  </select>
                  {toStatesManualEntry ? (
                    <input
                      value={toStates}
                      onChange={(e) => setToStates(e.target.value)}
                      placeholder="STATE_A, STATE_B, …"
                      disabled={loadingSeedHints}
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 font-mono text-xs"
                    />
                  ) : null}
                </label>
                <label className="space-y-2 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">
                    Start from state (first transition «from»)
                  </span>
                  <select
                    value={startFromManualEntry ? CUSTOM_QUEUE_SELECT_VALUE : resolveStartFromSelectValue(startFromState)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CUSTOM_QUEUE_SELECT_VALUE) setStartFromManualEntry(true);
                      else {
                        setStartFromManualEntry(false);
                        setStartFromState(v);
                      }
                    }}
                    disabled={loadingSeedHints}
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 bg-white disabled:opacity-60"
                  >
                    {WORKFLOW_QUEUE_STATE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value={CUSTOM_QUEUE_SELECT_VALUE}>Custom…</option>
                  </select>
                  {startFromManualEntry ? (
                    <input
                      value={startFromState}
                      onChange={(e) => setStartFromState(e.target.value)}
                      placeholder="FROM_STATE"
                      disabled={loadingSeedHints}
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 font-mono text-xs"
                    />
                  ) : null}
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedEvents}
                    onChange={(e) => setSeedEvents(e.target.checked)}
                    className="accent-zinc-900"
                  />
                  Insert workflow_event rows (queue for process-ai-events)
                </label>
                <button
                  type="submit"
                  disabled={runningAction !== null}
                  className={cn(
                    'w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold transition-all',
                    runningAction ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-500',
                  )}
                >
                  Execute `seed-fixtures`
                </button>
              </form>

              <div className="pt-4 border-t border-zinc-100 space-y-3">
                <p className="text-xs font-bold text-zinc-600">Step 2: Process AI Events</p>
                <label className="space-y-2 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Process Limit</span>
                  <input
                    value={processLimit}
                    onChange={(e) => setProcessLimit(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <button
                  onClick={handleProcessAiEvents}
                  disabled={runningAction !== null}
                  className={cn(
                    'w-full px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold inline-flex justify-center items-center gap-2 transition-all',
                    runningAction ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-800',
                  )}
                >
                  <DatabaseZap className="w-4 h-4" />
                  Run `process-ai-events`
                </button>
              </div>

              <div className="pt-4 border-t border-zinc-100">
                <p className="text-xs font-bold text-zinc-600 mb-3">Step 3: Load Internal Audit</p>
                <button
                  onClick={handleLoadInternalAudit}
                  disabled={runningAction !== null}
                  className={cn(
                    'w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 inline-flex justify-center items-center gap-2 transition-all',
                    runningAction ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-50',
                  )}
                >
                  <Activity className="w-4 h-4" />
                  Load Internal Audit
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-serif italic text-zinc-900">Internal Audit (`/internal/workflow/audit`)</h2>
              <pre className="max-h-60 overflow-auto text-xs font-mono bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                {prettyJson(internalAuditEvents)}
              </pre>
            </section>

            <section className="bg-zinc-900 text-white rounded-3xl border border-zinc-800 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-serif italic">Latest Action Result</h2>
              <pre className="max-h-60 overflow-auto text-xs font-mono bg-white/5 border border-white/10 rounded-2xl p-4">
                {prettyJson(lastActionResult)}
              </pre>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
