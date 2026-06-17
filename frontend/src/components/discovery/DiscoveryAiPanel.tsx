import { Sparkles, Lightbulb, AlertTriangle, Wand2 } from 'lucide-react';
import type { DiscoveryQuestion } from '../../services/discoveryTypes';
import { useT } from '../../i18n';

type Props = {
  focusedQuestion: DiscoveryQuestion | null;
  suggestion: string | null;
  explanation: string | null;
  missingSummary: string | null;
  loading: boolean;
  onSuggestAnswer: () => void;
  onExplain: () => void;
  onRefreshMissing: () => void;
  onApplySuggestion?: () => void;
};

export function DiscoveryAiPanel({
  focusedQuestion,
  suggestion,
  explanation,
  missingSummary,
  loading,
  onSuggestAnswer,
  onExplain,
  onRefreshMissing,
  onApplySuggestion,
}: Props) {
  const t = useT();
  return (
    <aside className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-5 h-fit sticky top-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-900">{t.discoveryAi.assistant}</h3>
          <p className="text-[10px] text-zinc-500">{t.discoveryAi.assistantHint}</p>
        </div>
      </div>

      {focusedQuestion ? (
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
          <p className="text-[10px] font-mono text-zinc-400 uppercase mb-1">{t.discoveryAi.focused}</p>
          <p className="text-xs font-medium text-zinc-800">{focusedQuestion.questionId}</p>
          <p className="text-xs text-zinc-600 mt-1 line-clamp-3">{focusedQuestion.questionText}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={loading}
              onClick={onSuggestAnswer}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 disabled:opacity-50"
            >
              <Wand2 className="w-3 h-3" /> {t.discoveryAi.suggestAnswer}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onExplain}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 text-[10px] font-bold hover:bg-zinc-50 disabled:opacity-50"
            >
              <Lightbulb className="w-3 h-3" /> {t.discoveryAi.explain}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">{t.discoveryAi.clickHint}</p>
      )}

      {loading ? <p className="text-xs text-indigo-500 animate-pulse">{t.discoveryAi.thinking}</p> : null}

      {suggestion ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-zinc-400">{t.discoveryAi.suggestedValue}</p>
          <p className="text-sm text-zinc-800 whitespace-pre-wrap">{suggestion}</p>
          {onApplySuggestion && focusedQuestion ? (
            <button
              type="button"
              onClick={onApplySuggestion}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-500"
            >
              {t.discoveryAi.applyToField}
            </button>
          ) : null}
        </div>
      ) : null}

      {explanation ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-zinc-400">{t.discoveryAi.guidance}</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{explanation}</p>
        </div>
      ) : null}

      <div className="pt-3 border-t border-zinc-100 space-y-2">
        <button
          type="button"
          disabled={loading}
          onClick={onRefreshMissing}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 disabled:opacity-50"
        >
          <AlertTriangle className="w-4 h-4" />
          {t.discoveryAi.checkMissing}
        </button>
        {missingSummary ? (
          <p className="text-xs text-amber-900 whitespace-pre-wrap">{missingSummary}</p>
        ) : null}
      </div>
    </aside>
  );
}