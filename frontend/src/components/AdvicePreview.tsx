import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Zap, CheckCircle2, XCircle, Info, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  wealthApi,
  type FinancialPlanSummary,
  type RecommendationSummary,
  type WorkflowCreateClientOption,
} from '../services/wealthApi';
import { toApiError, type ApiError } from '../services/apiError';
import { ErrorPopup } from './ErrorPopup';
import { SuccessToast } from './SuccessToast';

export const AdvicePreview = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<WorkflowCreateClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [plans, setPlans] = useState<FinancialPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationSummary[]>([]);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingClients(true);
    wealthApi
      .listResolvedClients()
      .then((items) => {
        if (!mounted) return;
        setClients(items);
        if (items.length > 0) {
          setSelectedClientId(items[0].clientId);
        }
      })
      .catch((err) => {
        if (mounted) setError(toApiError(err));
      })
      .finally(() => {
        if (mounted) setLoadingClients(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setPlans([]);
      setSelectedPlanId('');
      return;
    }
    let mounted = true;
    setLoadingPlans(true);
    wealthApi
      .listClientPlans(selectedClientId)
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
      })
      .finally(() => {
        if (mounted) setLoadingPlans(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedPlanId) {
      setRecommendations([]);
      setSelectedRecommendationId(null);
      return;
    }
    let mounted = true;
    setLoadingRecs(true);
    wealthApi
      .listPlanRecommendations(selectedPlanId)
      .then((items) => {
        if (!mounted) return;
        setRecommendations(items);
        setSelectedRecommendationId(items.length > 0 && items[0]?.id ? items[0].id : null);
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

  const selectedRecommendation = recommendations.find((r) => r.id === selectedRecommendationId) ?? null;

  const submitDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedRecommendationId) {
      setError(toApiError(new Error('Select a recommendation first.')));
      return;
    }
    setSubmittingDecision(true);
    try {
      await wealthApi.submitDecision(selectedRecommendationId, decision);
      if (decision === 'APPROVED') {
        navigate('/mobile', { replace: true, state: { adviceApproved: true } });
        return;
      }
      setSuccessMessage(`Decision submitted: ${decision}`);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="space-y-5">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div className="flex items-center gap-2 px-1">
        <Zap className="w-5 h-5 text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-900 leading-tight">New Advice</h2>
      </div>

      <div className="space-y-3 px-1">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Client</span>
          <div className="relative">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={loadingClients}
              className="w-full appearance-none pl-4 pr-10 py-3 border border-slate-200 rounded-2xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {clients.length === 0 && !loadingClients && (
                <option value="">No clients — create a case in RM portal first</option>
              )}
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName ?? c.clientId.slice(0, 8) + '…'}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Financial plan</span>
          <div className="relative">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              disabled={loadingPlans || !selectedClientId}
              className="w-full appearance-none pl-4 pr-10 py-3 border border-slate-200 rounded-2xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
            >
              {plans.length === 0 && !loadingPlans && (
                <option value="">No plans yet — complete WM planning first</option>
              )}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.id ?? '').slice(0, 8)}… · {p.status ?? '?'} · v{p.versionNo ?? '?'}
                  {p.approved ? ' ✓' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </label>
      </div>

      <div className="bg-slate-50 p-2 rounded-[2.5rem] border border-slate-100">
        <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recommendations</p>
          {loadingRecs ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-16 bg-slate-100 rounded-2xl" />
              <div className="h-16 bg-slate-100 rounded-2xl" />
            </div>
          ) : recommendations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No recommendations for this plan.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {recommendations.map((rec) => {
                const isSelected = rec.id === selectedRecommendationId;
                return (
                  <li key={rec.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRecommendationId(rec.id ?? null)}
                      className={cn(
                        'w-full text-left p-4 rounded-2xl border transition-all',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-500/20'
                          : 'border-slate-100 bg-slate-50/50 hover:border-slate-200',
                      )}
                    >
                      <p className="text-[10px] font-mono text-slate-400 mb-1">{(rec.id ?? '').slice(0, 8)}…</p>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-tight">
                        {rec.recType ?? 'RECOMMENDATION'}
                      </p>
                      <p className="text-sm text-slate-700 mt-1 line-clamp-3">{rec.summary || '—'}</p>
                      {rec.createdAt && (
                        <p className="text-[10px] text-slate-400 mt-2">
                          {new Date(rec.createdAt).toLocaleString()}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedRecommendation && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-2 border-t border-slate-100 space-y-2"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Selected</p>
              <p className="text-sm text-slate-700 leading-relaxed">{selectedRecommendation.summary}</p>
            </motion.div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => void submitDecision('APPROVED')}
              disabled={submittingDecision || !selectedRecommendationId}
              className={cn(
                'flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                submittingDecision || !selectedRecommendationId
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-indigo-700',
              )}
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </button>
            <button
              onClick={() => void submitDecision('REJECTED')}
              disabled={submittingDecision || !selectedRecommendationId}
              className={cn(
                'w-16 py-4 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center transition-all',
                submittingDecision || !selectedRecommendationId
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-slate-200',
              )}
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-3xl">
        <Info className="w-5 h-5 text-indigo-600 shrink-0" />
        <p className="text-[10px] text-indigo-900/60 font-medium leading-tight uppercase tracking-wider">
          Approving updates your financial plan status so execution can proceed.
        </p>
      </div>
    </div>
  );
};
