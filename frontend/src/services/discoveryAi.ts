import { discoveryApi } from './discoveryApi';
import { toApiError } from './apiError';
import type { DiscoveryQuestion } from './discoveryTypes';

export async function suggestDiscoveryAnswer(
  question: DiscoveryQuestion,
  answers: Record<string, unknown>,
  caseLabel?: string,
): Promise<string> {
  try {
    const res = await discoveryApi.discoveryAiSuggestAnswer({
      questionId: question.questionId,
      module: question.module,
      section: question.section,
      questionText: question.questionText,
      answerType: question.answerType,
      existingAnswers: answers,
      caseLabel: caseLabel ?? null,
    });
    return res.text?.trim() || 'No suggestion available.';
  } catch (err) {
    const apiErr = toApiError(err);
    return apiErr.message;
  }
}

export async function explainDiscoveryQuestion(question: DiscoveryQuestion): Promise<string> {
  try {
    const res = await discoveryApi.discoveryAiExplainQuestion({
      questionId: question.questionId,
      questionText: question.questionText,
      answerType: question.answerType,
      requiredFlag: question.requiredFlag,
    });
    return res.text?.trim() || 'No explanation available.';
  } catch (err) {
    return toApiError(err).message;
  }
}

export async function suggestMissingRequiredSummary(
  missing: DiscoveryQuestion[],
): Promise<string> {
  if (missing.length === 0) {
    return 'All required questions are answered.';
  }
  try {
    const res = await discoveryApi.discoveryAiMissingSummary(
      missing.map((q) => ({
        questionId: q.questionId,
        questionText: q.questionText,
      })),
    );
    return res.text?.trim() || '';
  } catch (err) {
    return `Still missing: ${missing.map((q) => q.questionId).join(', ')}. ${toApiError(err).message}`;
  }
}

export async function suggestFieldMapping(
  questionId: string,
  questionText?: string | null,
): Promise<{ systemField: string; entityType: string; transformType: string; rationale: string } | null> {
  try {
    const res = await discoveryApi.discoveryAiSuggestMapping({
      questionId,
      questionText,
    });
    return {
      systemField: res.systemField ?? '',
      entityType: res.entityType ?? 'client',
      transformType: res.transformType ?? 'none',
      rationale: res.rationale ?? '',
    };
  } catch {
    return null;
  }
}
