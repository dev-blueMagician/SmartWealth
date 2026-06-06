import { ApiError } from './apiError';

export type WorkflowCacheItem = {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  clientId?: string;
  caseId?: string;
  caseType?: string;
};

type HumanApprovalRequest = {
  approved: boolean;
  reviewer_id: string;
  note?: string | null;
};

export type CasePhaseAssessmentsFull = {
  version: string;
  phase_order: string[];
  phases: Record<string, string[]>;
};

export type CasePhaseAssessmentsFiltered = {
  version: string;
  case_phase: string;
  assessments: string[];
};

export type OrchestrationSeedHints = {
  workflow_id: string;
  assessment_code: string;
  orchestration_request: Record<string, unknown> | null;
  /** Latest workflow_event for this workflow where to_state matches assessment via workflow_ai_trigger. */
  workflow_event: {
    event_id: string;
    from_state: string;
    to_state: string;
    occurred_at?: string | null;
  } | null;
  from_state: string;
  to_states: string[];
  sources: { from_state: string; to_states: string };
};

type SeedFixturesRequest = {
  workflow_id: string;
  request_id?: string;
  assessment_code?: string;
  to_states?: string[];
  seed_events?: boolean;
  start_from_state?: string;
};

type StateChangedRequest = {
  entity_type: string;
  entity_id: string;
  from_state: string;
  to_state: string;
  triggered_by: 'SYSTEM' | 'HUMAN' | 'CLIENT';
  occurred_at: string;
};

const viteEnv = (import.meta as any).env ?? {};
/** Workflow runtime lives on AI-engine; override with VITE_WORKFLOW_API_BASE_URL if needed. */
const WORKFLOW_ENGINE_BASE_URL = (
  viteEnv.VITE_WORKFLOW_API_BASE_URL ??
  viteEnv.VITE_AI_ENGINE_BASE_URL ??
  'http://localhost:8010'
).replace(/\/+$/, '');
const AI_ENGINE_INTERNAL_BASE_URL = (viteEnv.VITE_AI_ENGINE_BASE_URL ?? 'http://localhost:8010').replace(/\/+$/, '');
const DEFAULT_INTERNAL_TOKEN = String(viteEnv.VITE_INTERNAL_WORKFLOW_TOKEN ?? '').trim();
const WORKFLOW_CACHE_KEY = 'smartwealth_workflow_cache';

function buildHeaders(token?: string, init?: HeadersInit): HeadersInit {
  const resolvedToken = (token ?? DEFAULT_INTERNAL_TOKEN).trim();
  return {
    'Content-Type': 'application/json',
    ...(resolvedToken ? { 'X-Internal-Token': resolvedToken } : {}),
    ...(init ?? {}),
  };
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: buildHeaders(token, init?.headers),
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
      typeof parsedBody?.detail === 'string'
        ? parsedBody.detail
        : typeof parsedBody?.message === 'string'
          ? parsedBody.message
          : `HTTP ${response.status} ${response.statusText}`;

    throw new ApiError(response.status, code, message, rawBody || undefined);
  }

  const rawBody = await response.text();
  if (!rawBody) return {} as T;
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Invalid response format from server.', rawBody);
  }
}

function loadWorkflowCache(): WorkflowCacheItem[] {
  try {
    const raw = localStorage.getItem(WORKFLOW_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkflowCache(items: WorkflowCacheItem[]): void {
  localStorage.setItem(WORKFLOW_CACHE_KEY, JSON.stringify(items));
}

function upsertWorkflowCache(item: WorkflowCacheItem): void {
  if (!item.id) return;
  const existing = loadWorkflowCache();
  const idx = existing.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...item, updatedAt: new Date().toISOString() };
  } else {
    existing.unshift({ ...item, updatedAt: new Date().toISOString() });
  }
  saveWorkflowCache(existing);
}

export const workflowApi = {
  loadWorkflowCache,

  async listWorkflows(limit = 200): Promise<WorkflowCacheItem[]> {
    const response = await requestJson<Array<Record<string, unknown>>>(WORKFLOW_ENGINE_BASE_URL, `/api/v1/workflows?limit=${limit}`, {
      method: 'GET',
    });
    const mapped = response.map((item) => {
      const id = String(item.workflow_id ?? item.id ?? '');
      const status = typeof item.status === 'string' ? item.status : undefined;
      const updatedAt = typeof item.updated_at === 'string' ? item.updated_at : undefined;
      return {
        id,
        status,
        updatedAt,
      };
    }).filter((item) => item.id);
    saveWorkflowCache(mapped);
    return mapped;
  },

  async createWorkflow(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await requestJson<Record<string, unknown>>(WORKFLOW_ENGINE_BASE_URL, '/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify({ payload }),
    });
    const id = String(response.id ?? response.workflow_id ?? '');
    if (id) {
      upsertWorkflowCache({
        id,
        status: typeof response.status === 'string' ? response.status : 'CREATED',
        createdAt: new Date().toISOString(),
      });
    }
    return response;
  },

  async getWorkflow(workflowId: string): Promise<Record<string, unknown>> {
    const response = await requestJson<Record<string, unknown>>(WORKFLOW_ENGINE_BASE_URL, `/api/v1/workflows/${workflowId}`, { method: 'GET' });
    upsertWorkflowCache({
      id: String(response.id ?? workflowId),
      status: typeof response.status === 'string' ? response.status : undefined,
    });
    return response;
  },

  async runWorkflow(workflowId: string): Promise<Record<string, unknown>> {
    const response = await requestJson<Record<string, unknown>>(WORKFLOW_ENGINE_BASE_URL, `/api/v1/workflows/${workflowId}/run`, { method: 'POST' });
    upsertWorkflowCache({
      id: workflowId,
      status: typeof response.status === 'string' ? response.status : 'RUN_REQUESTED',
    });
    return response;
  },

  async listAuditEvents(workflowId: string): Promise<Record<string, unknown>[]> {
    return requestJson<Record<string, unknown>[]>(WORKFLOW_ENGINE_BASE_URL, `/api/v1/workflows/${workflowId}/audit-events`, { method: 'GET' });
  },

  async applyHumanApproval(workflowId: string, body: HumanApprovalRequest): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>(WORKFLOW_ENGINE_BASE_URL, `/api/v1/workflows/${workflowId}/human-approval`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async processAiEvents(limit: number, token?: string): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>(
      AI_ENGINE_INTERNAL_BASE_URL,
      '/internal/workflow/process-ai-events',
      {
        method: 'POST',
        body: JSON.stringify({ limit }),
      },
      token,
    );
  },

  async seedFixtures(body: SeedFixturesRequest, token?: string): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>(
      AI_ENGINE_INTERNAL_BASE_URL,
      '/internal/workflow/seed-fixtures',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
    );
  },

  async stateChanged(body: StateChangedRequest, token?: string): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>(
      AI_ENGINE_INTERNAL_BASE_URL,
      '/internal/workflow/state-changed',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
    );
  },

  async internalAudit(workflowId: string, token?: string): Promise<Record<string, unknown>[]> {
    return requestJson<Record<string, unknown>[]>(
      AI_ENGINE_INTERNAL_BASE_URL,
      `/internal/workflow/audit/${workflowId}`,
      { method: 'GET' },
      token,
    );
  },

  /** Public AI-engine catalog: full matrix or filter by `case_phase` (e.g. ONBOARDING). */
  async getCasePhaseAssessments(casePhase?: string): Promise<CasePhaseAssessmentsFull | CasePhaseAssessmentsFiltered> {
    const qs = casePhase ? `?case_phase=${encodeURIComponent(casePhase)}` : '';
    return requestJson<CasePhaseAssessmentsFull | CasePhaseAssessmentsFiltered>(
      WORKFLOW_ENGINE_BASE_URL,
      `/api/v1/case-phase-assessments${qs}`,
      { method: 'GET' },
    );
  },

  /** Internal: suggested seed from/orchestration_request + workflow_event + workflow_ai_trigger. */
  async getOrchestrationSeedHints(workflowId: string, assessmentCode: string, token?: string): Promise<OrchestrationSeedHints> {
    const qs = `?assessment_code=${encodeURIComponent(assessmentCode)}`;
    return requestJson<OrchestrationSeedHints>(
      AI_ENGINE_INTERNAL_BASE_URL,
      `/internal/workflow/orchestration-seed-hints/${encodeURIComponent(workflowId)}${qs}`,
      { method: 'GET' },
      token,
    );
  },
};
