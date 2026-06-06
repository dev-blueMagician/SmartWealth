import { ApiError } from './apiError';
import { getAccessToken } from '../auth/session';
import type {
  CreateDiscoveryMappingPayload,
  CreateDiscoveryQuestionOptionPayload,
  CreateDiscoveryQuestionPayload,
  DiscoveryAnswer,
  DiscoveryFieldMapping,
  DiscoveryQuestion,
  DiscoveryQuestionOption,
  SubmitDiscoveryAnswerPayload,
  UpdateDiscoveryMappingPayload,
  UpdateDiscoveryQuestionPayload,
  DiscoveryQuestionImportResult,
  DiscoveryAiTextResponse,
  DiscoverySuggestMappingResponse,
  FieldDictionaryPageResult,
  FieldDictionaryEntry,
  FieldDictionaryImportResult,
  CreateFieldDictionaryPayload,
  UpdateFieldDictionaryPayload,
  DiscoveryRebuildResult,
  CaseDiscoveryFieldPageResult,
  DiscoverySummaryResult,
} from './discoveryTypes';

const viteEnv = (import.meta as { env?: Record<string, string> }).env ?? {};
const API_BASE = (viteEnv.VITE_WEALTH_API_BASE_URL ?? 'http://localhost:8090').replace(/\/+$/, '');

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const rawBody = await response.text();
    let parsedBody: Record<string, unknown> | null = null;
    try {
      parsedBody = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
    } catch {
      parsedBody = null;
    }
    const code =
      typeof parsedBody?.code === 'string'
        ? parsedBody.code
        : response.status >= 500
          ? 'SYSTEM_ERROR'
          : 'HTTP_ERROR';
    const message =
      typeof parsedBody?.message === 'string'
        ? parsedBody.message
        : `HTTP ${response.status} ${response.statusText}`;
    throw new ApiError(response.status, code, message, rawBody || undefined);
  }
  const rawBody = await response.text();
  if (!response.status || response.status === 204 || !rawBody) return {} as T;
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Invalid response format from server.', rawBody);
  }
}

export const discoveryApi = {
  async listQuestions(params?: { module?: string; section?: string }): Promise<DiscoveryQuestion[]> {
    const qs = new URLSearchParams();
    if (params?.module?.trim()) qs.set('module', params.module.trim());
    if (params?.section?.trim()) qs.set('section', params.section.trim());
    const suffix = qs.toString() ? `?${qs}` : '';
    const rows = await requestJson<DiscoveryQuestion[]>(`/questions${suffix}`, { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async createQuestion(body: CreateDiscoveryQuestionPayload): Promise<DiscoveryQuestion> {
    return requestJson<DiscoveryQuestion>('/questions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateQuestion(
    questionId: string,
    body: UpdateDiscoveryQuestionPayload,
  ): Promise<DiscoveryQuestion> {
    return requestJson<DiscoveryQuestion>(`/questions/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async deleteQuestion(questionId: string): Promise<void> {
    await requestJson(`/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' });
  },

  async discoveryAiSuggestAnswer(body: {
    questionId: string;
    module?: string | null;
    section?: string | null;
    questionText?: string | null;
    answerType?: string | null;
    existingAnswers?: Record<string, unknown>;
    caseLabel?: string | null;
  }): Promise<DiscoveryAiTextResponse> {
    return requestJson<DiscoveryAiTextResponse>('/discovery/ai/suggest-answer', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async discoveryAiExplainQuestion(body: {
    questionId: string;
    questionText?: string | null;
    answerType?: string | null;
    requiredFlag?: boolean | null;
  }): Promise<DiscoveryAiTextResponse> {
    return requestJson<DiscoveryAiTextResponse>('/discovery/ai/explain-question', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async discoveryAiMissingSummary(
    missing: { questionId: string; questionText?: string | null }[],
  ): Promise<DiscoveryAiTextResponse> {
    return requestJson<DiscoveryAiTextResponse>('/discovery/ai/missing-summary', {
      method: 'POST',
      body: JSON.stringify({ missing }),
    });
  },

  async discoveryAiSuggestMapping(body: {
    questionId: string;
    questionText?: string | null;
  }): Promise<DiscoverySuggestMappingResponse> {
    return requestJson<DiscoverySuggestMappingResponse>('/discovery/ai/suggest-mapping', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async importQuestionsCsv(
    file: File,
    updateExisting = false,
  ): Promise<DiscoveryQuestionImportResult> {
    const token = getAccessToken();
    const form = new FormData();
    form.append('file', file);
    const qs = updateExisting ? '?updateExisting=true' : '';
    const response = await fetch(`${API_BASE}/questions/import${qs}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
    if (!response.ok) {
      const rawBody = await response.text();
      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
      } catch {
        parsedBody = null;
      }
      const code =
        typeof parsedBody?.code === 'string'
          ? parsedBody.code
          : response.status >= 500
            ? 'SYSTEM_ERROR'
            : 'HTTP_ERROR';
      const message =
        typeof parsedBody?.message === 'string'
          ? parsedBody.message
          : `HTTP ${response.status} ${response.statusText}`;
      throw new ApiError(response.status, code, message, rawBody || undefined);
    }
    const rawBody = await response.text();
    if (!rawBody) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Empty import response.');
    }
    try {
      return JSON.parse(rawBody) as DiscoveryQuestionImportResult;
    } catch {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Invalid import response.', rawBody);
    }
  },

  async createQuestionOption(
    questionId: string,
    body: CreateDiscoveryQuestionOptionPayload,
  ): Promise<DiscoveryQuestionOption> {
    return requestJson<DiscoveryQuestionOption>(
      `/questions/${encodeURIComponent(questionId)}/options`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  async listQuestionOptions(questionId: string): Promise<DiscoveryQuestionOption[]> {
    const rows = await requestJson<DiscoveryQuestionOption[]>(
      `/questions/${encodeURIComponent(questionId)}/options`,
      { method: 'GET' },
    );
    return Array.isArray(rows) ? rows : [];
  },

  async listAnswers(caseId: string): Promise<DiscoveryAnswer[]> {
    const rows = await requestJson<DiscoveryAnswer[]>(
      `/answers?caseId=${encodeURIComponent(caseId)}`,
      { method: 'GET' },
    );
    return Array.isArray(rows) ? rows : [];
  },

  async submitAnswer(payload: SubmitDiscoveryAnswerPayload): Promise<DiscoveryAnswer> {
    return requestJson<DiscoveryAnswer>('/answers', {
      method: 'POST',
      body: JSON.stringify({
        caseId: payload.caseId,
        questionId: payload.questionId,
        blockIndex: payload.blockIndex ?? 0,
        answerValue: payload.answerValue,
      }),
    });
  },

  async listMappings(): Promise<DiscoveryFieldMapping[]> {
    const rows = await requestJson<DiscoveryFieldMapping[]>('/mappings', { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async createMapping(body: CreateDiscoveryMappingPayload): Promise<DiscoveryFieldMapping> {
    return requestJson<DiscoveryFieldMapping>('/mappings', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateMapping(id: string, body: UpdateDiscoveryMappingPayload): Promise<DiscoveryFieldMapping> {
    return requestJson<DiscoveryFieldMapping>(`/mappings/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async deleteMapping(id: string): Promise<void> {
    await requestJson(`/mappings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async listFieldDictionary(params?: {
    dataDomain?: string;
    mandatoryLevel?: string;
    search?: string;
    page?: number;
    size?: number;
  }): Promise<FieldDictionaryPageResult> {
    const qs = new URLSearchParams();
    if (params?.dataDomain?.trim()) qs.set('dataDomain', params.dataDomain.trim());
    if (params?.mandatoryLevel?.trim()) qs.set('mandatoryLevel', params.mandatoryLevel.trim());
    if (params?.search?.trim()) qs.set('search', params.search.trim());
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.size != null) qs.set('size', String(params.size));
    const suffix = qs.toString() ? `?${qs}` : '';
    return requestJson<FieldDictionaryPageResult>(`/field-dictionary${suffix}`, { method: 'GET' });
  },

  async getFieldDictionaryCount(): Promise<number> {
    const res = await requestJson<{ total: number }>('/field-dictionary/count', { method: 'GET' });
    return typeof res.total === 'number' ? res.total : 0;
  },

  async createFieldDictionary(body: CreateFieldDictionaryPayload): Promise<FieldDictionaryEntry> {
    return requestJson<FieldDictionaryEntry>('/field-dictionary', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateFieldDictionary(
    systemFieldName: string,
    body: UpdateFieldDictionaryPayload,
  ): Promise<FieldDictionaryEntry> {
    return requestJson<FieldDictionaryEntry>(
      `/field-dictionary/${encodeURIComponent(systemFieldName)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    );
  },

  async deleteFieldDictionary(systemFieldName: string): Promise<void> {
    await requestJson(`/field-dictionary/${encodeURIComponent(systemFieldName)}`, {
      method: 'DELETE',
    });
  },

  async rebuildCaseDiscovery(caseId: string): Promise<DiscoveryRebuildResult> {
    return requestJson<DiscoveryRebuildResult>(
      `/cases/${encodeURIComponent(caseId)}/discovery/rebuild`,
      { method: 'POST' },
    );
  },

  async getCaseDiscoverySummary(
    caseId: string,
    params?: {
      dataDomain?: string;
      filledLimit?: number;
      missingLimit?: number;
      unmappedLimit?: number;
    },
  ): Promise<DiscoverySummaryResult> {
    const qs = new URLSearchParams();
    if (params?.dataDomain?.trim()) qs.set('dataDomain', params.dataDomain.trim());
    if (params?.filledLimit != null) qs.set('filledLimit', String(params.filledLimit));
    if (params?.missingLimit != null) qs.set('missingLimit', String(params.missingLimit));
    if (params?.unmappedLimit != null) qs.set('unmappedLimit', String(params.unmappedLimit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return requestJson<DiscoverySummaryResult>(
      `/cases/${encodeURIComponent(caseId)}/discovery/summary${suffix}`,
      { method: 'GET' },
    );
  },

  async listCaseDiscoveryFields(
    caseId: string,
    params?: { status?: string; page?: number; size?: number },
  ): Promise<CaseDiscoveryFieldPageResult> {
    const qs = new URLSearchParams();
    if (params?.status?.trim()) qs.set('status', params.status.trim());
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.size != null) qs.set('size', String(params.size));
    const suffix = qs.toString() ? `?${qs}` : '';
    return requestJson<CaseDiscoveryFieldPageResult>(
      `/cases/${encodeURIComponent(caseId)}/discovery/fields${suffix}`,
      { method: 'GET' },
    );
  },

  async importFieldDictionaryCsv(
    file: File,
    updateExisting = false,
  ): Promise<FieldDictionaryImportResult> {
    const token = getAccessToken();
    const form = new FormData();
    form.append('file', file);
    const qs = updateExisting ? '?updateExisting=true' : '';
    const response = await fetch(`${API_BASE}/field-dictionary/import${qs}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
    if (!response.ok) {
      const rawBody = await response.text();
      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
      } catch {
        parsedBody = null;
      }
      const code =
        typeof parsedBody?.code === 'string'
          ? parsedBody.code
          : response.status >= 500
            ? 'SYSTEM_ERROR'
            : 'HTTP_ERROR';
      const message =
        typeof parsedBody?.message === 'string'
          ? parsedBody.message
          : `HTTP ${response.status} ${response.statusText}`;
      throw new ApiError(response.status, code, message, rawBody || undefined);
    }
    const rawBody = await response.text();
    if (!rawBody) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Empty import response.');
    }
    try {
      return JSON.parse(rawBody) as FieldDictionaryImportResult;
    } catch {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Invalid import response.', rawBody);
    }
  },
};
