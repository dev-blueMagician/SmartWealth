import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ClipboardList, Filter, RefreshCw } from 'lucide-react';
import { DiscoveryQuestionField } from '../../../components/discovery/DiscoveryQuestionField';
import { DiscoveryAiPanel } from '../../../components/discovery/DiscoveryAiPanel';
import { ErrorPopup } from '../../../components/ErrorPopup';
import { SuccessToast } from '../../../components/SuccessToast';
import {
  answerKey,
  answersFromApiRows,
  computeRequiredProgress,
  groupQuestionsByModuleSection,
  isEmptyAnswerValue,
  isQuestionAnswered,
  usesOptionsList,
  normalizeAnswerType,
  type AnswerKey,
} from '../../../lib/discoveryUtils';
import { discoveryApi } from '../../../services/discoveryApi';
import {
  explainDiscoveryQuestion,
  suggestDiscoveryAnswer,
  suggestMissingRequiredSummary,
} from '../../../services/discoveryAi';
import type {
  DiscoveryQuestion,
  DiscoveryQuestionOption,
  DiscoverySummaryResult,
} from '../../../services/discoveryTypes';
import { toApiError, type ApiError } from '../../../services/apiError';
import { wealthApi } from '../../../services/wealthApi';

export function DiscoveryQuestionnairePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [questions, setQuestions] = useState<DiscoveryQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<AnswerKey, unknown>>({});
  const [blockCounts, setBlockCounts] = useState<Record<string, number>>({});
  const [optionsCache, setOptionsCache] = useState<Record<string, DiscoveryQuestionOption[]>>({});
  const [optionsLoading, setOptionsLoading] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [moduleFilter, setModuleFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [caseLabel, setCaseLabel] = useState('');
  const [focusedQuestion, setFocusedQuestion] = useState<DiscoveryQuestion | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiMissingSummary, setAiMissingSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [highlightMissing, setHighlightMissing] = useState(true);
  const [fieldStats, setFieldStats] = useState<{
    mandatoryFieldsTotal: number;
    mandatoryFieldsFilled: number;
    mandatoryFieldsMissing: number;
  } | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [discoverySummary, setDiscoverySummary] = useState<DiscoverySummaryResult | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadFieldStats = useCallback(async () => {
    if (!caseId) return;
    try {
      const summary = await discoveryApi.getCaseDiscoverySummary(caseId, {
        filledLimit: 25,
        missingLimit: 15,
        unmappedLimit: 10,
      });
      setDiscoverySummary(summary);
      setFieldStats({
        mandatoryFieldsTotal: summary.stats.mandatoryFieldsTotal,
        mandatoryFieldsFilled: summary.stats.mandatoryFieldsFilled,
        mandatoryFieldsMissing: summary.stats.mandatoryFieldsMissing,
      });
    } catch {
      setFieldStats(null);
      setDiscoverySummary(null);
    }
  }, [caseId]);

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [caseDetail, questionRows, answerRows] = await Promise.all([
        wealthApi.getCase(caseId),
        discoveryApi.listQuestions({
          module: moduleFilter || undefined,
          section: sectionFilter || undefined,
        }),
        discoveryApi.listAnswers(caseId),
      ]);
      setCaseLabel(caseDetail?.clientName ? `${caseDetail.clientName} · ${caseId}` : caseId);
      setQuestions(questionRows);
      const { values, blockCounts: bc } = answersFromApiRows(answerRows);
      setAnswers(values);
      setBlockCounts(bc);
      await loadFieldStats();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, [caseId, moduleFilter, sectionFilter, loadFieldStats]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ensureOptions = useCallback(
    async (question: DiscoveryQuestion) => {
      const qid = question.questionId;
      if (!usesOptionsList(normalizeAnswerType(question.answerType))) return;
      if (optionsCache[qid] || optionsLoading[qid]) return;
      setOptionsLoading((prev) => ({ ...prev, [qid]: true }));
      try {
        const opts = await discoveryApi.listQuestionOptions(qid);
        setOptionsCache((prev) => ({ ...prev, [qid]: opts }));
      } catch (err) {
        setError(toApiError(err));
      } finally {
        setOptionsLoading((prev) => ({ ...prev, [qid]: false }));
      }
    },
    [optionsCache, optionsLoading],
  );

  useEffect(() => {
    for (const q of questions) {
      void ensureOptions(q);
    }
  }, [questions, ensureOptions]);

  const progress = useMemo(
    () => computeRequiredProgress(questions, answers, blockCounts),
    [questions, answers, blockCounts],
  );

  const grouped = useMemo(() => groupQuestionsByModuleSection(questions), [questions]);

  const missingRequired = useMemo(
    () =>
      questions.filter(
        (q) => q.requiredFlag && !isQuestionAnswered(q, answers, blockCounts),
      ),
    [questions, answers, blockCounts],
  );

  const persistAnswer = useCallback(
    async (questionId: string, blockIndex: number, value: unknown) => {
      if (!caseId) return;
      const key = answerKey(questionId, blockIndex);
      setSavingKeys((prev) => ({ ...prev, [key]: true }));
      try {
        await discoveryApi.submitAnswer({
          caseId,
          questionId,
          blockIndex,
          answerValue: value,
        });
        await loadFieldStats();
      } catch (err) {
        setError(toApiError(err));
      } finally {
        setSavingKeys((prev) => ({ ...prev, [key]: false }));
      }
    },
    [caseId, loadFieldStats],
  );

  const handleRebuildDataset = async () => {
    if (!caseId) return;
    setRebuilding(true);
    try {
      const res = await discoveryApi.rebuildCaseDiscovery(caseId);
      await loadFieldStats();
      const warn =
        res.unmappedAnswerCount > 0
          ? `${res.unmappedAnswerCount} answer(s) not mapped to field_dictionary.`
          : null;
      setSuccessMessage(
        [
          `Dataset rebuilt: ${res.fieldsWritten} fields (${res.filledCount} filled).`,
          warn,
        ]
          .filter(Boolean)
          .join(' '),
      );
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setRebuilding(false);
    }
  };

  const fieldMandatoryPercent = useMemo(() => {
    if (!fieldStats || fieldStats.mandatoryFieldsTotal <= 0) return 0;
    return Math.round(
      (fieldStats.mandatoryFieldsFilled / fieldStats.mandatoryFieldsTotal) * 100,
    );
  }, [fieldStats]);

  const handleChange = useCallback(
    (questionId: string, blockIndex: number, value: unknown) => {
      const key = answerKey(questionId, blockIndex);
      setAnswers((prev) => ({ ...prev, [key]: value }));
      const q = questions.find((x) => x.questionId === questionId);
      if (q) setFocusedQuestion(q);

      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        void persistAnswer(questionId, blockIndex, value);
      }, 600);
    },
    [persistAnswer, questions],
  );

  const handleAddBlock = (questionId: string) => {
    setBlockCounts((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] ?? 1) + 1,
    }));
  };

  const handleRemoveBlock = (questionId: string, blockIndex: number) => {
    setBlockCounts((prev) => {
      const count = prev[questionId] ?? 1;
      if (count <= 1) return prev;
      return { ...prev, [questionId]: count - 1 };
    });
    setAnswers((prev) => {
      const next = { ...prev };
      const count = blockCounts[questionId] ?? 1;
      delete next[answerKey(questionId, blockIndex)];
      for (let i = blockIndex + 1; i < count; i++) {
        const from = answerKey(questionId, i);
        const to = answerKey(questionId, i - 1);
        if (from in next) {
          next[to] = next[from];
          delete next[from];
        }
      }
      return next;
    });
  };

  const handleSuggestAnswer = async () => {
    if (!focusedQuestion) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const text = await suggestDiscoveryAnswer(focusedQuestion, answers, caseLabel);
      setAiSuggestion(text);
    } finally {
      setAiLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!focusedQuestion) return;
    setAiLoading(true);
    setAiExplanation(null);
    try {
      setAiExplanation(await explainDiscoveryQuestion(focusedQuestion));
    } finally {
      setAiLoading(false);
    }
  };

  const handleMissingCheck = async () => {
    setHighlightMissing(true);
    setAiLoading(true);
    try {
      setAiMissingSummary(await suggestMissingRequiredSummary(missingRequired));
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = () => {
    if (!focusedQuestion || !aiSuggestion) return;
    const blockIndex = 0;
    const qid = focusedQuestion.questionId;
    const answerType = normalizeAnswerType(focusedQuestion.answerType);
    let value: unknown = aiSuggestion;
    if (answerType === 'number') {
      const n = Number(aiSuggestion.replace(/[^\d.-]/g, ''));
      value = Number.isFinite(n) ? n : aiSuggestion;
    }
    handleChange(qid, blockIndex, value);
    setSuccessMessage(`Applied suggestion to ${qid}.`);
  };

  const uniqueModules = useMemo(
    () => [...new Set(questions.map((q) => q.module).filter(Boolean))] as string[],
    [questions],
  );
  const uniqueSections = useMemo(
    () => [...new Set(questions.map((q) => q.section).filter(Boolean))] as string[],
    [questions],
  );

  if (!caseId) {
    return <p className="text-sm text-zinc-500">Missing case ID.</p>;
  }

  return (
    <div className="space-y-6">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to={`/internal/cases/${caseId}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to case
          </Link>
          <h2 className="text-2xl font-serif italic text-zinc-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-indigo-600" />
            Discovery questionnaire
          </h2>
          <p className="text-sm text-zinc-500 mt-1 font-mono">{caseLabel}</p>
        </div>
        <div className="min-w-[240px] space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500">
              <span>Required questions</span>
              <span>
                {progress.completed}/{progress.total} ({progress.percent}%)
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
          {fieldStats ? (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500">
                <span>Mandatory fields (dictionary)</span>
                <span>
                  {fieldStats.mandatoryFieldsFilled}/{fieldStats.mandatoryFieldsTotal} (
                  {fieldMandatoryPercent}%)
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${fieldMandatoryPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500">
                {fieldStats.mandatoryFieldsMissing.toLocaleString()} mandatory fields still missing
                in catalog projection
              </p>
            </div>
          ) : null}
          <button
            type="button"
            disabled={rebuilding}
            onClick={() => void handleRebuildDataset()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? 'Rebuilding…' : 'Rebuild field dataset'}
          </button>
        </div>
      </div>

      {discoverySummary ? (
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3 text-xs text-zinc-600 space-y-2">
          <button
            type="button"
            onClick={() => setSummaryExpanded((v) => !v)}
            className="font-bold text-indigo-700 hover:text-indigo-600"
          >
            {summaryExpanded ? 'Hide' : 'Show'} LLM-safe discovery summary ({discoverySummary.stats.filledCount}{' '}
            filled / {discoverySummary.filledFields.length} shown)
          </button>
          {summaryExpanded ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
              <div>
                <p className="font-bold uppercase text-[10px] text-zinc-500 mb-1">Filled (sample)</p>
                <ul className="space-y-0.5 font-mono text-[10px]">
                  {discoverySummary.filledFields.map((f) => (
                    <li key={f.systemField}>
                      {f.questionId}: {f.valueText ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-bold uppercase text-[10px] text-zinc-500 mb-1">Unmapped</p>
                <ul className="space-y-0.5 font-mono text-[10px]">
                  {discoverySummary.unmappedAnswers.length === 0 ? (
                    <li>None</li>
                  ) : (
                    discoverySummary.unmappedAnswers.map((u) => (
                      <li key={`${u.questionId}:${u.blockIndex}`}>
                        {u.questionId} → {u.mappingSystemField ?? 'no mapping'}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-zinc-200 px-4 py-3">
        <Filter className="w-4 h-4 text-zinc-400" />
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white"
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
          className="px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white"
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
          onClick={() => void loadData()}
          className="px-3 py-2 text-xs font-bold rounded-xl border border-zinc-200 hover:bg-zinc-50"
        >
          Apply filters
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading questionnaire…</p>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center text-sm text-zinc-500">
          No questions defined. Add questions via admin API or seed data.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-8">
            {[...grouped.entries()].map(([groupLabel, groupQuestions]) => (
              <section key={groupLabel} className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">{groupLabel}</h3>
                <div className="space-y-4">
                  {groupQuestions.map((q) => {
                    const count = q.repeatable ? (blockCounts[q.questionId] ?? 1) : 1;
                    return Array.from({ length: count }, (_, blockIndex) => {
                      const key = answerKey(q.questionId, blockIndex);
                      const missing =
                        highlightMissing &&
                        !!q.requiredFlag &&
                        isEmptyAnswerValue(answers[key]);
                      return (
                        <div
                          key={key}
                          onFocusCapture={() => setFocusedQuestion(q)}
                        >
                          <DiscoveryQuestionField
                            question={q}
                            blockIndex={blockIndex}
                            value={answers[key]}
                            missing={missing}
                            saving={!!savingKeys[key]}
                            options={optionsCache[q.questionId] ?? []}
                            optionsLoading={!!optionsLoading[q.questionId]}
                            onChange={handleChange}
                            onAddBlock={handleAddBlock}
                            onRemoveBlock={handleRemoveBlock}
                            showBlockControls={!!q.repeatable}
                            blockCount={count}
                          />
                        </div>
                      );
                    });
                  })}
                </div>
              </section>
            ))}
          </div>

          <DiscoveryAiPanel
            focusedQuestion={focusedQuestion}
            suggestion={aiSuggestion}
            explanation={aiExplanation}
            missingSummary={aiMissingSummary}
            loading={aiLoading}
            onSuggestAnswer={() => void handleSuggestAnswer()}
            onExplain={() => void handleExplain()}
            onRefreshMissing={() => void handleMissingCheck()}
            onApplySuggestion={applySuggestion}
          />
        </div>
      )}
    </div>
  );
}
