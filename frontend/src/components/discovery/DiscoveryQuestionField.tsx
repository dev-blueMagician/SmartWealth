import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  isMultiSelect,
  normalizeAnswerType,
  usesOptionsList,
} from '../../lib/discoveryUtils';
import type { DiscoveryQuestion, DiscoveryQuestionOption } from '../../services/discoveryTypes';

type Props = {
  question: DiscoveryQuestion;
  blockIndex: number;
  value: unknown;
  missing: boolean;
  saving: boolean;
  options: DiscoveryQuestionOption[];
  optionsLoading: boolean;
  onChange: (questionId: string, blockIndex: number, value: unknown) => void;
  onAddBlock?: (questionId: string) => void;
  onRemoveBlock?: (questionId: string, blockIndex: number) => void;
  showBlockControls?: boolean;
  blockCount?: number;
};

export function DiscoveryQuestionField({
  question,
  blockIndex,
  value,
  missing,
  saving,
  options,
  optionsLoading,
  onChange,
  onAddBlock,
  onRemoveBlock,
  showBlockControls,
  blockCount = 1,
}: Props) {
  const answerType = normalizeAnswerType(question.answerType);
  const qid = question.questionId;
  const id = `${qid}-${blockIndex}`;

  const [localText, setLocalText] = useState(String(value ?? ''));

  useEffect(() => {
    setLocalText(value === null || value === undefined ? '' : String(value));
  }, [value, blockIndex, qid]);

  const borderClass = missing
    ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/30'
    : 'border-zinc-200 bg-white';

  const commitText = () => {
    if (answerType === 'number') {
      const n = localText.trim() === '' ? null : Number(localText);
      onChange(qid, blockIndex, Number.isFinite(n as number) ? n : null);
    } else {
      onChange(qid, blockIndex, localText);
    }
  };

  const renderInput = () => {
    if (usesOptionsList(answerType)) {
      if (isMultiSelect(answerType)) {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-2">
            {optionsLoading ? (
              <p className="text-xs text-zinc-400">Loading options…</p>
            ) : options.length === 0 ? (
              <p className="text-xs text-amber-600">No options configured for this question.</p>
            ) : (
              options.map((opt) => {
                const val = opt.optionValue ?? opt.optionLabel ?? '';
                const checked = selected.includes(val);
                return (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, val]
                          : selected.filter((v) => v !== val);
                        onChange(qid, blockIndex, next);
                      }}
                      className="rounded border-zinc-300 text-indigo-600"
                    />
                    {opt.optionLabel ?? opt.optionValue}
                  </label>
                );
              })
            )}
          </div>
        );
      }
      return (
        <select
          id={id}
          value={value === null || value === undefined ? '' : String(value)}
          disabled={optionsLoading}
          onChange={(e) => onChange(qid, blockIndex, e.target.value || null)}
          className={cn('w-full px-3 py-2 rounded-xl border text-sm', borderClass)}
        >
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.optionValue ?? opt.optionLabel ?? ''}>
              {opt.optionLabel ?? opt.optionValue}
            </option>
          ))}
        </select>
      );
    }

    if (answerType === 'number') {
      return (
        <input
          id={id}
          type="number"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={commitText}
          className={cn('w-full px-3 py-2 rounded-xl border text-sm font-mono', borderClass)}
          placeholder="0"
        />
      );
    }

    return (
      <input
        id={id}
        type="text"
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={commitText}
        className={cn('w-full px-3 py-2 rounded-xl border text-sm', borderClass)}
        placeholder="Your answer"
      />
    );
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        missing ? 'border-rose-200' : 'border-zinc-100',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">{qid}</span>
            {question.requiredFlag ? (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                Required
              </span>
            ) : null}
            {question.repeatable && blockCount > 1 ? (
              <span className="text-[9px] font-mono text-zinc-400">block {blockIndex + 1}</span>
            ) : null}
            {saving ? (
              <span className="text-[9px] text-indigo-500 animate-pulse">Saving…</span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-zinc-900">{question.questionText ?? qid}</p>
        </div>
        {showBlockControls && question.repeatable ? (
          <div className="flex gap-1 shrink-0">
            {blockIndex === blockCount - 1 ? (
              <button
                type="button"
                title="Add row"
                onClick={() => onAddBlock?.(qid)}
                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            ) : null}
            {blockCount > 1 ? (
              <button
                type="button"
                title="Remove row"
                onClick={() => onRemoveBlock?.(qid, blockIndex)}
                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {renderInput()}
    </div>
  );
}
