import type { DiscoveryAnswer, DiscoveryQuestion } from '../services/discoveryTypes';

export type AnswerKey = string;

export function answerKey(questionId: string, blockIndex: number): AnswerKey {
  return `${questionId}:${blockIndex}`;
}

export function parseAnswerKey(key: AnswerKey): { questionId: string; blockIndex: number } {
  const idx = key.lastIndexOf(':');
  if (idx < 0) return { questionId: key, blockIndex: 0 };
  return {
    questionId: key.slice(0, idx),
    blockIndex: Number.parseInt(key.slice(idx + 1), 10) || 0,
  };
}

export function isEmptyAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function isQuestionAnswered(
  question: DiscoveryQuestion,
  answers: Record<AnswerKey, unknown>,
  blockCounts: Record<string, number>,
): boolean {
  const qid = question.questionId;
  if (question.repeatable) {
    const count = blockCounts[qid] ?? 1;
    for (let i = 0; i < count; i++) {
      if (isEmptyAnswerValue(answers[answerKey(qid, i)])) return false;
    }
    return true;
  }
  return !isEmptyAnswerValue(answers[answerKey(qid, 0)]);
}

export function computeRequiredProgress(
  questions: DiscoveryQuestion[],
  answers: Record<AnswerKey, unknown>,
  blockCounts: Record<string, number>,
): { completed: number; total: number; percent: number } {
  const required = questions.filter((q) => q.requiredFlag);
  const total = required.length;
  if (total === 0) return { completed: 0, total: 0, percent: 100 };
  const completed = required.filter((q) => isQuestionAnswered(q, answers, blockCounts)).length;
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  };
}

export function answersFromApiRows(rows: DiscoveryAnswer[]): {
  values: Record<AnswerKey, unknown>;
  blockCounts: Record<string, number>;
} {
  const values: Record<AnswerKey, unknown> = {};
  const blockCounts: Record<string, number> = {};
  for (const row of rows) {
    const key = answerKey(row.questionId, row.blockIndex ?? 0);
    values[key] = row.answerValue;
    const prev = blockCounts[row.questionId] ?? 0;
    blockCounts[row.questionId] = Math.max(prev, (row.blockIndex ?? 0) + 1);
  }
  return { values, blockCounts };
}

export function groupQuestionsByModuleSection(questions: DiscoveryQuestion[]): Map<string, DiscoveryQuestion[]> {
  const map = new Map<string, DiscoveryQuestion[]>();
  for (const q of questions) {
    const label = [q.module, q.section].filter(Boolean).join(' · ') || 'General';
    const list = map.get(label) ?? [];
    list.push(q);
    map.set(label, list);
  }
  return map;
}

export function normalizeAnswerType(answerType?: string | null): string {
  return (answerType ?? 'text').trim().toLowerCase();
}

export function usesOptionsList(answerType: string): boolean {
  return ['choice', 'enum', 'select', 'multi-select', 'multiselect', 'multi_select'].includes(answerType);
}

export function isMultiSelect(answerType: string): boolean {
  return ['multi-select', 'multiselect', 'multi_select'].includes(answerType);
}
