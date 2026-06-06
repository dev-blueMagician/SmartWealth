import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send,
  ChevronLeft,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  RefreshCw,
  Layers,
  Lightbulb,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';
import { wealthApi, type ExecutionInstructionSummary, type FinancialPlanSummary, type RecommendationSummary } from '../../services/wealthApi';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';

const INSTRUCTION_DRAFT = 'DRAFT';

export const ExecutionConsolePage = () => {
  const { portalCaps } = useAuth();
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [recommendationId, setRecommendationId] = useState('');
  const [instructionId, setInstructionId] = useState<string | null>(null);
  const [instructionStatus, setInstructionStatus] = useState<string | null>(null);
  /** Human-readable summary of the last create/send — no raw API dump. */
  const [activitySummary, setActivitySummary] = useState<{
    title: string;
    detail?: string;
    status?: string;
  } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [plans, setPlans] = useState<FinancialPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationSummary[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [executionRows, setExecutionRows] = useState<ExecutionInstructionSummary[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);

  useEffect(() => {
    if (!caseId) {
      setLoadingContext(false);
      return;
    }
    let mounted = true;
    wealthApi
      .getCase(caseId)
      .then((c) => {
        if (!mounted) return;
        const cid = c?.clientId ?? null;
        setClientId(cid);
      })
      .catch((err) => {
        if (mounted) setError(toApiError(err));
      })
      .finally(() => {
        if (mounted) setLoadingContext(false);
      });
    return () => {
      mounted = false;
    };
  }, [caseId]);

  useEffect(() => {
    if (!clientId) {
      setPlans([]);
      setSelectedPlanId('');
      return;
    }
    let mounted = true;
    wealthApi
      .listClientPlans(clientId)
      .then((items) => {
        if (!mounted) return;
        setPlans(items);
        if (items.length > 0 && items[0]?.id) {
          setSelectedPlanId(items[0].id);
        } else {
          setSelectedPlanId('');
        }
      })
      .catch((err) => {
        if (mounted) setError(toApiError(err));
      });
    return () => {
      mounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!selectedPlanId) {
      setRecommendations([]);
      return;
    }
    let mounted = true;
    setLoadingRecs(true);
    wealthApi
      .listPlanRecommendations(selectedPlanId)
      .then((items) => {
        if (!mounted) return;
        setRecommendations(items);
        if (items.length > 0 && items[0]?.id) {
          setRecommendationId(items[0].id ?? '');
        }
      })
      .catch((err) => {
        if (mounted) setError(toApiError(err));
      })
      .finally(() => {
        if (mounted) setLoadingRecs(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedPlanId]);

  const loadExecutionRows = async (showToast: boolean) => {
    if (!clientId) return;
    setLoadingExecutions(true);
    try {
      const rows = await wealthApi.listClientExecutionInstructions(clientId);
      setExecutionRows(rows);
      if (showToast) {
        setSuccessMessage('Execution instructions refreshed.');
      }
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoadingExecutions(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;
    void loadExecutionRows(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  /** Keep header / send gate aligned with server after list refresh. */
  useEffect(() => {
    if (!instructionId) return;
    const row = executionRows.find((r) => r.id === instructionId);
    if (row) {
      setInstructionStatus(row.status ?? null);
      return;
    }
    if (!loadingExecutions) {
      setInstructionId(null);
      setInstructionStatus(null);
    }
  }, [executionRows, instructionId, loadingExecutions]);

  const sortedExecutionRows = [...executionRows].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });

  const canSendSelected = Boolean(instructionId && instructionStatus === INSTRUCTION_DRAFT);

  const handleExecute = async () => {
    if (!recommendationId.trim()) {
      setError(toApiError(new Error('Recommendation ID is required — pick a plan and recommendation above.')));
      return;
    }
    setLoading(true);
    try {
      const createdId = await wealthApi.createExecutionInstruction(recommendationId.trim(), {
        channel: 'trade-execution-console',
      });
      if (!createdId) {
        throw new Error('Execution instruction ID missing from backend response.');
      }
      setInstructionId(createdId);
      setInstructionStatus(INSTRUCTION_DRAFT);
      setActivitySummary({
        title: 'Instruction drafted',
        detail: 'Review and send when ready. It stays in draft until you confirm.',
        status: INSTRUCTION_DRAFT,
      });
      setSuccessMessage('Execution instruction created successfully.');
      await loadExecutionRows(false);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendInstruction = async () => {
    if (!instructionId) {
      setError(toApiError(new Error('Select a draft instruction in the list before sending.')));
      return;
    }
    if (instructionStatus !== INSTRUCTION_DRAFT) {
      setError(toApiError(new Error('Only DRAFT instructions can be sent — pick a draft row below.')));
      return;
    }
    setSending(true);
    try {
      const response = await wealthApi.sendExecutionInstruction(instructionId);
      setInstructionStatus(response.status ?? 'SENT');
      setActivitySummary({
        title: 'Instruction sent',
        detail: 'The instruction has been released for execution.',
        status: response.status ?? 'SENT',
      });
      setSuccessMessage('Execution instruction sent successfully.');
      await loadExecutionRows(false);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSending(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
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
          <h1 className="text-3xl font-serif italic text-zinc-900">Trade Execution Protocol</h1>
          <p className="text-zinc-500 text-sm">
            Case <span className="text-zinc-800 font-medium tabular-nums">{caseId?.slice(0, 8) ?? '—'}…</span>
            {clientId && (
              <>
                {' '}
                · Client <span className="text-zinc-800 font-medium tabular-nums">{clientId.slice(0, 8)}…</span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => void loadExecutionRows(true)}
            disabled={loadingExecutions || !clientId}
            className={cn(
              'px-6 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all',
              loadingExecutions || !clientId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50',
            )}
          >
            <RefreshCw className={cn('w-4 h-4', loadingExecutions && 'animate-spin')} />
            Refresh executions
          </button>
          {portalCaps.canCreateExecutionInstruction && (
          <button
            onClick={handleExecute}
            disabled={loading}
            className={cn(
              'px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-xl shadow-zinc-900/10',
              loading ? 'opacity-50' : 'hover:bg-zinc-800',
            )}
          >
            {loading ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Create instruction
          </button>
          )}
          {portalCaps.canSendExecutionInstruction && (
          <button
            onClick={handleSendInstruction}
            disabled={sending || !canSendSelected}
            title={
              instructionId && instructionStatus !== INSTRUCTION_DRAFT
                ? 'Selected instruction is not a draft'
                : undefined
            }
            className={cn(
              'px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-xl shadow-emerald-600/20',
              sending || !canSendSelected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-500',
            )}
          >
            {sending ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Send instruction
          </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 rounded-2xl">
                <Layers className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-serif italic text-zinc-900">Plan & recommendation</h2>
                <p className="text-xs text-zinc-500">
                  Choose the financial plan version, then the recommendation used for execution.
                </p>
              </div>
            </div>
            {loadingContext ? (
              <p className="text-sm text-zinc-400 italic">Loading case…</p>
            ) : !clientId ? (
              <p className="text-sm text-amber-700">No client linked to this case — cannot load plans.</p>
            ) : (
              <>
                <label className="block space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                    Financial plan (client)
                  </span>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {plans.length === 0 && <option value="">No plans — create draft in Planning workspace</option>}
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.id ?? '').slice(0, 8)}… · {p.status ?? '?'} · v{p.versionNo ?? '?'}
                        {p.approved ? ' · APPROVED' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedPlan && (
                  <p className="text-[11px] text-zinc-500">
                    The plan must be <strong>approved</strong> before an instruction can be created. Current status:{' '}
                    <span className="font-medium text-zinc-700">{selectedPlan.status}</span>
                    {selectedPlan.approved ? ' · Approved' : ' · Not approved yet'}
                  </p>
                )}
                <label className="block space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Lightbulb className="w-3 h-3" /> Recommendation
                  </span>
                  <select
                    value={recommendationId}
                    onChange={(e) => setRecommendationId(e.target.value)}
                    disabled={loadingRecs || !selectedPlanId}
                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    {loadingRecs && <option value="">Loading…</option>}
                    {!loadingRecs && recommendations.length === 0 && (
                      <option value="">No recommendations — create one under the plan</option>
                    )}
                    {!loadingRecs &&
                      recommendations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {(r.id ?? '').slice(0, 8)}… · {r.recType ?? '?'} · {(r.summary ?? '').slice(0, 40)}
                          {(r.summary ?? '').length > 40 ? '…' : ''}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
          </section>

          <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-serif italic">Execution Instruction Request</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-zinc-100 text-zinc-500 rounded uppercase tracking-widest">
                {instructionId ? instructionStatus ?? '—' : 'NONE_SELECTED'}
              </span>
            </div>

            <div className="p-8 space-y-4">
              <p className="text-sm text-zinc-600">
                Pick the recommendation above to create a new draft. In the sidebar list, select exactly which instruction
                you want to send — only rows in <span className="font-semibold text-zinc-800">DRAFT</span> can be released.
              </p>
            </div>

            <div className="p-8 bg-zinc-50 border-t border-zinc-100 italic font-serif text-sm text-zinc-500">
              Instructions are tied to an approved plan. Approve the recommendation (decision gate) so the plan becomes
              APPROVED before creating execution.
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
            <h3 className="font-serif italic text-lg mb-4">Instructions for this client</h3>
            <p className="text-[11px] text-zinc-500 mb-3">
              Select one row — <span className="font-semibold text-zinc-700">Send instruction</span> applies only to DRAFT
              rows.
            </p>
            <div className="space-y-2 max-h-64 overflow-auto text-xs">
              {sortedExecutionRows.length === 0 ? (
                <p className="text-zinc-400">None yet.</p>
              ) : (
                sortedExecutionRows.map((row, idx) => {
                  const rid = row.id ?? '';
                  const selected = instructionId === rid;
                  return (
                    <label
                      key={rid || `execution-row-${idx}`}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                        selected
                          ? 'border-blue-400 bg-blue-50/80 ring-2 ring-blue-400/30'
                          : 'border-zinc-100 bg-zinc-50 hover:border-zinc-200',
                      )}
                    >
                      <input
                        type="radio"
                        name="execution-instruction-pick"
                        className="mt-1 h-3.5 w-3.5 shrink-0 accent-blue-600"
                        checked={selected}
                        onChange={() => {
                          setInstructionId(rid || null);
                          setInstructionStatus(row.status ?? null);
                        }}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate font-mono tabular-nums text-zinc-800">{rid ? `${rid.slice(0, 8)}…` : '—'}</span>
                          <span
                            className={cn(
                              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                              row.status === INSTRUCTION_DRAFT ? 'bg-amber-100 text-amber-900' : 'bg-zinc-200 text-zinc-600',
                            )}
                          >
                            {row.status ?? '?'}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          Rec {(row.recommendationId ?? '').slice(0, 8)}
                          {(row.recommendationId ?? '').length > 8 ? '…' : ''}
                          {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleString()}` : ''}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
            <h3 className="font-serif italic text-lg mb-4">Last step</h3>
            {activitySummary ? (
              <div className="space-y-3">
                <p className="text-base font-medium text-zinc-900">{activitySummary.title}</p>
                {activitySummary.detail && <p className="text-sm text-zinc-600 leading-relaxed">{activitySummary.detail}</p>}
                {activitySummary.status && (
                  <p className="text-xs text-zinc-500">
                    Status: <span className="font-semibold text-zinc-800">{activitySummary.status}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Create or send an instruction to see a short summary here.</p>
            )}
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Selected for send</p>
              <p className="text-sm font-medium text-zinc-900 mt-1 tabular-nums break-all">
                {instructionId ? `${instructionId.slice(0, 8)}…` : '—'}
              </p>
              {instructionId && instructionStatus !== INSTRUCTION_DRAFT && (
                <p className="mt-2 text-[11px] text-amber-800">
                  This row is not a draft — choose a DRAFT row to enable Send.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
