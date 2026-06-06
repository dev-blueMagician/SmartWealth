import { ApiError } from './apiError';
import { getAccessToken } from '../auth/session';

type CaseRecord = {
  id: string;
  caseId?: string;
  clientId?: string;
  clientName?: string;
  phase?: string;
  status?: string;
  rmId?: string;
  type?: string;
  createdAt?: string;
};

export type CaseTaskRecord = {
  id: string;
  taskType: string;
  status: string;
  updatedAt?: string;
};

export type CaseChatThreadRecord = {
  id: string;
  caseId: string;
  channel: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CaseChatMessageRecord = {
  id: string;
  threadId: string;
  senderKind: string;
  actorRole: string;
  visibility: string;
  phaseCode?: string | null;
  assessmentCode?: string | null;
  intentCode?: string | null;
  body: string;
  contextSnapshot?: Record<string, unknown> | null;
  aiPayload?: Record<string, unknown> | null;
  createdAt?: string;
};

export type ChatAttachmentUploadResponse = {
  caseDocumentId: string;
  documentId: string;
  originalFilename: string;
  contentType?: string | null;
  byteSize?: number | null;
  docKind: string;
};

export type ClientProfileInfo = {
  clientId?: string;
  name?: string;
  status?: string;
  riskProfile?: string;
  residency?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  contactAddress?: string;
  createdAt?: string;
};

export type CaseDocumentRecord = {
  id: string;
  documentId: string;
  originalFilename?: string;
  contentType?: string;
  byteSize?: number;
  docKind?: string;
  phaseCode?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
};

export type WorkflowCreateCaseOption = {
  caseId: string;
  clientId: string;
  caseName?: string;
  clientName?: string;
  type?: string;
  status?: string;
  createdAt?: string;
};

export type WorkflowCreateClientOption = {
  clientId: string;
  clientName?: string;
  status?: string;
  createdAt?: string;
};

export type WorkflowCreateOptions = {
  cases: WorkflowCreateCaseOption[];
  clients: WorkflowCreateClientOption[];
};

/** GET /clients/{clientId}/assets */
export type ClientDiscoveryAsset = {
  id?: string;
  clientId?: string;
  assetType?: string;
  value?: number;
};

/** GET /clients/{clientId}/goals */
export type ClientDiscoveryGoal = {
  id?: string;
  clientId?: string;
  goalType?: string;
  targetAmount?: number;
};

/** Rows from GET /api/workflows/by-client/{clientId}. */
export type WorkflowLinkRow = {
  workflowId: string;
  caseId: string;
  clientId: string;
  caseType: string;
  caseStatus: string;
};

export type RecommendationCreatePayload = {
  recType: string;
  summary: string;
};

export type FinancialPlanSummary = {
  id?: string;
  clientId?: string;
  status?: string;
  versionNo?: number;
  approved?: boolean;
  createdAt?: string;
};

export type RecommendationSummary = {
  id?: string;
  planVersionId?: string;
  recType?: string;
  summary?: string;
  createdAt?: string;
};

export type PlanningTemplateRecord = {
  id: string;
  code: string;
  name: string;
  versionNo: number;
  status: string;
  locale: string;
  productType?: string | null;
  documentId: string;
  documentFilename?: string | null;
  mappingJson?: Record<string, unknown>;
  structureJson?: Record<string, unknown>;
  placeholdersDetected?: unknown;
  analyzedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PlanningDraftSummary = {
  planId: string;
  caseId: string;
  clientId: string;
  templateId?: string | null;
  templateCode?: string | null;
  status: string;
  createdAt?: string;
  finalizedAt?: string | null;
};

export type PlanningDraftDetail = {
  planId: string;
  caseId: string;
  clientId: string;
  templateId?: string | null;
  status: string;
  approved: boolean;
  createdAt?: string;
  finalizedAt?: string | null;
  payload?: Record<string, unknown>;
};

export type PlanningExportResult = {
  artifactId: string;
  documentId: string;
  filename: string;
  downloadPath: string;
};

export type ExecutionInstructionSummary = {
  id?: string;
  recommendationId?: string;
  status?: string;
  createdAt?: string;
};

const viteEnv = (import.meta as any).env ?? {};
const WEALTH_API_BASE_URL = (viteEnv.VITE_WEALTH_API_BASE_URL ?? 'http://localhost:8090').replace(/\/+$/, '');
/**
 * When set (non-empty), case chat uses NDJSON {@code POST .../chat/messages/stream}.
 * When unset/commented, uses synchronous {@code POST .../chat/messages}.
 */
const CASE_CHAT_STREAM_BASE_URL_RAW = String(viteEnv.VITE_CASE_CHAT_STREAM_BASE_URL ?? '').trim();
export const isCaseChatStreamEnabled = CASE_CHAT_STREAM_BASE_URL_RAW.length > 0;
const WEALTH_CHAT_STREAM_BASE_URL = (
  isCaseChatStreamEnabled ? CASE_CHAT_STREAM_BASE_URL_RAW : WEALTH_API_BASE_URL
).replace(/\/+$/, '');
const CACHE_KEY = 'smartwealth_cases_cache';

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  userId: string;
  username: string;
  roles: string[];
};

export type MeResponse = {
  userId: string;
  username: string;
  email?: string | null;
  roles: string[];
};

export type PortalUserSummary = {
  id: string;
  username: string;
  email?: string | null;
  enabled: boolean;
  roles: string[];
  clientId?: string | null;
};

export type AdminClientOption = {
  id: string;
  name?: string | null;
  status?: string | null;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${WEALTH_API_BASE_URL}${path}`, {
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
  if (!rawBody) return {} as T;

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Invalid response format from server.', rawBody);
  }
}

function loadCaseCache(): CaseRecord[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCaseCache(cases: CaseRecord[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cases));
}

function upsertCaseCache(nextCase: CaseRecord): void {
  const existing = loadCaseCache();
  const caseId = nextCase.id || nextCase.caseId;
  if (!caseId) return;
  const idx = existing.findIndex((item) => (item.id || item.caseId) === caseId);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...nextCase };
  } else {
    existing.unshift(nextCase);
  }
  saveCaseCache(existing);
}

export const wealthApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    return requestJson<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async fetchMe(): Promise<MeResponse> {
    return requestJson<MeResponse>('/api/auth/me', { method: 'GET' });
  },

  async listPortalUsers(): Promise<PortalUserSummary[]> {
    const rows = await requestJson<PortalUserSummary[]>('/api/admin/users', { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async listAdminClients(): Promise<AdminClientOption[]> {
    const rows = await requestJson<AdminClientOption[]>('/api/admin/clients', { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async createPortalUser(payload: {
    username: string;
    password: string;
    email?: string;
    roles: string[];
    clientId?: string | null;
  }): Promise<PortalUserSummary> {
    return requestJson<PortalUserSummary>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async patchPortalUser(
    id: string,
    payload: Partial<{ enabled: boolean; roles: string[]; password: string; email: string; clientId: string | null }>,
  ): Promise<PortalUserSummary> {
    return requestJson<PortalUserSummary>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // POST /api/cases
  async createCase(clientName: string, rmNote: string): Promise<string> {
    const payload = {
      clientName,
      rmNote,
    };
    const response = await requestJson<{ caseId?: string; clientId?: string; workflowId?: string }>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const caseId = response.caseId;
    if (!caseId) {
      throw new Error('Case creation response missing caseId.');
    }
    upsertCaseCache({
      id: caseId,
      caseId,
      clientId: response.clientId,
      status: 'INITIALIZED',
      createdAt: new Date().toISOString(),
    });
    return caseId;
  },

  // GET /api/cases
  async listCases(): Promise<CaseRecord[]> {
    const response = await requestJson<CaseRecord[] | { items?: CaseRecord[] }>('/api/cases', { method: 'GET' });
    const cases = Array.isArray(response) ? response : response.items ?? [];
    saveCaseCache(cases.map((item) => ({ ...item, id: item.id ?? item.caseId ?? '' })));
    return cases;
  },

  // GET /api/workflows/create-options
  async listWorkflowCreateOptions(): Promise<WorkflowCreateOptions> {
    const response = await requestJson<{
      cases?: WorkflowCreateCaseOption[];
      clients?: WorkflowCreateClientOption[];
    }>('/api/workflows/create-options', { method: 'GET' });
    return {
      cases: Array.isArray(response.cases) ? response.cases : [],
      clients: Array.isArray(response.clients) ? response.clients : [],
    };
  },

  /** Linked workflows for a client (case.workflow_id from AI-engine). */
  async listWorkflowLinksByClient(clientId: string): Promise<WorkflowLinkRow[]> {
    const rows = await requestJson<WorkflowLinkRow[]>(`/api/workflows/by-client/${encodeURIComponent(clientId)}`, {
      method: 'GET',
    });
    return Array.isArray(rows) ? rows : [];
  },

  /** Clients for mobile/internal pickers when create-options.clients is empty (derive from cases). */
  async listResolvedClients(): Promise<WorkflowCreateClientOption[]> {
    const options = await this.listWorkflowCreateOptions();
    let clients = options.clients;
    let cases = options.cases;
    if (clients.length === 0) {
      if (cases.length === 0) {
        const fallbackCases = await this.listCases();
        cases = fallbackCases
          .filter((item) => (item.id || item.caseId) && item.clientId)
          .map((item) => ({
            caseId: item.id || item.caseId || '',
            clientId: item.clientId || '',
            clientName: item.clientName,
          }));
      }
      const clientMap = new Map<string, WorkflowCreateClientOption>();
      cases.forEach((item) => {
        if (!item.clientId) return;
        clientMap.set(item.clientId, {
          clientId: item.clientId,
          clientName: item.clientName,
        });
      });
      clients = Array.from(clientMap.values());
    }
    return clients;
  },

  // GET /api/cases/{caseId}
  async getCase(caseId: string): Promise<CaseRecord | null> {
    const response = await requestJson<CaseRecord>(`/api/cases/${caseId}`, { method: 'GET' });
    const normalized = { ...response, id: response.id ?? response.caseId ?? caseId };
    upsertCaseCache(normalized);
    return normalized;
  },

  // GET /api/cases/{caseId}/tasks
  async listCaseTasks(caseId: string): Promise<CaseTaskRecord[]> {
    return requestJson<CaseTaskRecord[]>(`/api/cases/${caseId}/tasks`, { method: 'GET' });
  },

  async getCaseClientProfile(caseId: string): Promise<ClientProfileInfo> {
    return requestJson<ClientProfileInfo>(`/api/cases/${caseId}/client-profile`, { method: 'GET' });
  },

  async listCaseDocuments(caseId: string): Promise<CaseDocumentRecord[]> {
    const rows = await requestJson<CaseDocumentRecord[]>(`/api/cases/${caseId}/documents`, { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async getCaseChatThread(caseId: string): Promise<CaseChatThreadRecord> {
    return requestJson<CaseChatThreadRecord>(`/api/cases/${caseId}/chat/thread`, { method: 'GET' });
  },

  async listCaseChatMessages(caseId: string, threadId: string): Promise<CaseChatMessageRecord[]> {
    const tid = encodeURIComponent(threadId);
    return requestJson<CaseChatMessageRecord[]>(`/api/cases/${caseId}/chat/messages?threadId=${tid}`, {
      method: 'GET',
    });
  },

  async uploadCaseChatAttachment(
    caseId: string,
    file: File,
    docKind?: string | null,
  ): Promise<ChatAttachmentUploadResponse> {
    const token = getAccessToken();
    const fd = new FormData();
    fd.append('file', file);
    if (docKind && docKind.trim()) fd.append('docKind', docKind.trim());
    const response = await fetch(`${WEALTH_API_BASE_URL}/api/cases/${caseId}/chat/attachments`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd,
    });
    const rawBody = await response.text();
    if (!response.ok) {
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
    if (!rawBody) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Empty response from upload.', undefined);
    }
    try {
      return JSON.parse(rawBody) as ChatAttachmentUploadResponse;
    } catch {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Invalid JSON from upload.', rawBody);
    }
  },

  async deleteCaseChatHistory(
    caseId: string,
    threadId: string,
  ): Promise<{ threadId: string; deletedCount: number }> {
    const tid = encodeURIComponent(threadId);
    return requestJson<{ threadId: string; deletedCount: number }>(
      `/api/cases/${caseId}/chat/messages?threadId=${tid}`,
      { method: 'DELETE' },
    );
  },

  async sendCaseChatMessage(
    caseId: string,
    payload: {
      threadId?: string | null;
      phaseCode?: string | null;
      assessmentCode?: string | null;
      message: string;
      visibility?: string | null;
      autoDetectIntent?: boolean | null;
      attachmentIds?: string[] | null;
    },
  ): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>(`/api/cases/${caseId}/chat/messages`, {
      method: 'POST',
      body: JSON.stringify({
        threadId: payload.threadId ?? null,
        phaseCode: payload.phaseCode ?? null,
        assessmentCode: payload.assessmentCode ?? null,
        message: payload.message,
        visibility: payload.visibility ?? null,
        autoDetectIntent: payload.autoDetectIntent ?? null,
        attachmentIds: payload.attachmentIds?.length ? payload.attachmentIds : null,
      }),
    });
  },

  /**
   * NDJSON stream (phase, assistant_delta, catalog_turn_complete, done). Same JSON body as
   * {@link sendCaseChatMessage}; non-streaming turn stays on {@code POST .../chat/messages}.
   */
  async sendCaseChatMessageStream(
    caseId: string,
    payload: {
      threadId?: string | null;
      phaseCode?: string | null;
      assessmentCode?: string | null;
      message: string;
      visibility?: string | null;
      autoDetectIntent?: boolean | null;
      attachmentIds?: string[] | null;
    },
  ): Promise<Response> {
    const token = getAccessToken();
    return fetch(
      `${WEALTH_CHAT_STREAM_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/chat/messages/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          threadId: payload.threadId ?? null,
          phaseCode: payload.phaseCode ?? null,
          assessmentCode: payload.assessmentCode ?? null,
          message: payload.message,
          visibility: payload.visibility ?? null,
          autoDetectIntent: payload.autoDetectIntent ?? null,
          attachmentIds: payload.attachmentIds?.length ? payload.attachmentIds : null,
        }),
      },
    );
  },

  // POST /cases/{caseId}/discovery/check
  async checkDiscovery(caseId: string): Promise<{ casePhase?: string; phase?: string; caseStatus?: string; status?: string }> {
    const response = await requestJson<{ casePhase?: string; phase?: string; caseStatus?: string; status?: string }>(
      `/cases/${caseId}/discovery/check`,
      { method: 'POST' },
    );
    upsertCaseCache({
      id: caseId,
      caseId,
      phase: response.casePhase ?? response.phase,
      status: response.caseStatus ?? response.status ?? 'READY',
    });
    return response;
  },

  // POST /clients/{clientId}/plans
  async createPlan(clientId: string, assumptions: Record<string, unknown>): Promise<string | undefined> {
    const note = `Planning assumptions: ${JSON.stringify(assumptions)}`;
    const response = await requestJson<{ id?: string }>(`/clients/${clientId}/plans`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    return response.id;
  },

  // GET /clients/{clientId}/assets
  async listAssets(clientId: string): Promise<ClientDiscoveryAsset[]> {
    const cid = encodeURIComponent(clientId);
    const rows = await requestJson<ClientDiscoveryAsset[]>(`/clients/${cid}/assets`, { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  // GET /clients/{clientId}/goals
  async listGoals(clientId: string): Promise<ClientDiscoveryGoal[]> {
    const cid = encodeURIComponent(clientId);
    const rows = await requestJson<ClientDiscoveryGoal[]>(`/clients/${cid}/goals`, { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  // POST /clients/{clientId}/assets
  async createAsset(
    clientId: string,
    payload: { assetType: string; value: number },
  ): Promise<ClientDiscoveryAsset> {
    const cid = encodeURIComponent(clientId);
    return requestJson<ClientDiscoveryAsset>(`/clients/${cid}/assets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // POST /clients/{clientId}/goals
  async createGoal(
    clientId: string,
    payload: { goalType: string; targetAmount: number },
  ): Promise<ClientDiscoveryGoal> {
    const cid = encodeURIComponent(clientId);
    return requestJson<ClientDiscoveryGoal>(`/clients/${cid}/goals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // POST /plans/{planId}/draft
  async runPlanDraftCalculation(
    planId: string,
    scenarioKey: string,
    assumptions: Record<string, unknown>,
  ): Promise<unknown> {
    return requestJson(`/plans/${planId}/draft`, {
      method: 'POST',
      body: JSON.stringify({ scenarioKey, assumptions }),
    });
  },

  // GET /clients/{clientId}/plans
  async listClientPlans(clientId: string): Promise<FinancialPlanSummary[]> {
    return requestJson<FinancialPlanSummary[]>(`/clients/${clientId}/plans`, { method: 'GET' });
  },

  // GET /plans/{planVersionId}/recommendations
  async listPlanRecommendations(planVersionId: string): Promise<RecommendationSummary[]> {
    return requestJson<RecommendationSummary[]>(`/plans/${planVersionId}/recommendations`, {
      method: 'GET',
    });
  },

  // GET /clients/{clientId}/execution/instructions
  async listClientExecutionInstructions(clientId: string): Promise<ExecutionInstructionSummary[]> {
    return requestJson<ExecutionInstructionSummary[]>(
      `/clients/${clientId}/execution/instructions`,
      { method: 'GET' },
    );
  },

  // POST /plans/{planVersionId}/recommendations
  async createRecommendation(
    planVersionId: string,
    payload: RecommendationCreatePayload,
  ): Promise<{ id?: string; summary?: string; recType?: string; planVersionId?: string }> {
    return requestJson(`/plans/${planVersionId}/recommendations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listPlanningTemplates(): Promise<PlanningTemplateRecord[]> {
    const rows = await requestJson<PlanningTemplateRecord[]>('/api/admin/planning/templates', { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async uploadPlanningTemplate(payload: {
    code: string;
    name: string;
    versionNo?: number;
    locale?: string;
    productType?: string;
    docxFile: File;
    mappingFile?: File | null;
  }): Promise<PlanningTemplateRecord> {
    const token = getAccessToken();
    const fd = new FormData();
    fd.append('code', payload.code.trim());
    fd.append('name', payload.name.trim());
    if (payload.versionNo != null) fd.append('versionNo', String(payload.versionNo));
    if (payload.locale?.trim()) fd.append('locale', payload.locale.trim());
    if (payload.productType?.trim()) fd.append('productType', payload.productType.trim());
    fd.append('docxFile', payload.docxFile);
    if (payload.mappingFile) fd.append('mappingFile', payload.mappingFile);

    const response = await fetch(`${WEALTH_API_BASE_URL}/api/admin/planning/templates`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd,
    });
    const rawBody = await response.text();
    if (!response.ok) {
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
    if (!rawBody) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Empty response from upload.', undefined);
    }
    try {
      return JSON.parse(rawBody) as PlanningTemplateRecord;
    } catch {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Invalid JSON from upload.', rawBody);
    }
  },

  async publishPlanningTemplate(templateId: string): Promise<PlanningTemplateRecord> {
    return requestJson<PlanningTemplateRecord>(
      `/api/admin/planning/templates/${encodeURIComponent(templateId)}/publish`,
      { method: 'POST' },
    );
  },

  async deletePlanningTemplate(templateId: string): Promise<void> {
    await requestJson(`/api/admin/planning/templates/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
  },

  async listActivePlanningTemplates(): Promise<PlanningTemplateRecord[]> {
    const rows = await requestJson<PlanningTemplateRecord[]>('/planning/templates', { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async listCasePlanningDrafts(caseId: string): Promise<PlanningDraftSummary[]> {
    const rows = await requestJson<PlanningDraftSummary[]>(
      `/cases/${encodeURIComponent(caseId)}/planning/drafts`,
      { method: 'GET' },
    );
    return Array.isArray(rows) ? rows : [];
  },

  async createCasePlanningDraft(
    caseId: string,
    payload: { templateId: string; assumptions?: Record<string, unknown> },
  ): Promise<PlanningDraftDetail> {
    return requestJson<PlanningDraftDetail>(`/cases/${encodeURIComponent(caseId)}/planning/drafts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getPlanningDraft(planId: string): Promise<PlanningDraftDetail> {
    return requestJson<PlanningDraftDetail>(`/planning/drafts/${encodeURIComponent(planId)}`, { method: 'GET' });
  },

  async regeneratePlanningDraft(
    planId: string,
    payload?: { assumptions?: Record<string, unknown>; markReadyForReview?: boolean },
  ): Promise<PlanningDraftDetail> {
    return requestJson<PlanningDraftDetail>(`/planning/drafts/${encodeURIComponent(planId)}/regenerate`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  },

  async exportPlanningDraft(
    planId: string,
    payload?: {
      templateId?: string;
      refreshCompose?: boolean;
      /** auto | llm_only | merge_template — default llm_only when omitted */
      exportMode?: 'auto' | 'llm_only' | 'merge_template';
    },
  ): Promise<PlanningExportResult> {
    return requestJson<PlanningExportResult>(`/planning/drafts/${encodeURIComponent(planId)}/export`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  },

  async downloadPlanningArtifact(artifactId: string, filename: string): Promise<void> {
    const token = getAccessToken();
    const response = await fetch(
      `${WEALTH_API_BASE_URL}/planning/artifacts/${encodeURIComponent(artifactId)}/download`,
      {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (!response.ok) {
      const rawBody = await response.text();
      throw new ApiError(response.status, 'HTTP_ERROR', `Download failed: HTTP ${response.status}`, rawBody);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'plan-export.docx';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  // POST /execution/instructions
  async createExecutionInstruction(recommendationId: string, payload: Record<string, unknown>): Promise<string | undefined> {
    const response = await requestJson<{ id?: string }>('/execution/instructions', {
      method: 'POST',
      body: JSON.stringify({
        recommendationId,
        note: 'Created from Execution Console',
        payload,
      }),
    });
    return response.id;
  },

  // POST /execution/send
  async sendExecutionInstruction(instructionId: string): Promise<{
    id?: string;
    recommendationId?: string;
    status?: string;
    createdAt?: string;
  }> {
    return requestJson('/execution/send', {
      method: 'POST',
      body: JSON.stringify({ instructionId }),
    });
  },

  // POST /mobile/register
  async registerMobile(data: Record<string, unknown>): Promise<unknown> {
    return requestJson('/mobile/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // PUT /clients/{clientId}/profile
  async updateProfile(clientId: string, profile: Record<string, unknown>): Promise<unknown> {
    return requestJson(`/clients/${clientId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  },

  // POST /recommendations/{recommendationId}/decision
  async submitDecision(
    recommendationId: string,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<unknown> {
    return requestJson(`/recommendations/${recommendationId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decisionStatus: decision }),
    });
  },

  /* --- Admin AI Engine catalog (ADMIN, OpenAPI: /api/admin/ai-engine/*) --- */

  async listAdminCasePhases(): Promise<CasePhaseAdminRow[]> {
    const rows = await requestJson<CasePhaseAdminRow[]>('/api/admin/ai-engine/case-phases', { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async createAdminCasePhase(body: CasePhaseUpsertPayload): Promise<CasePhaseAdminRow> {
    return requestJson<CasePhaseAdminRow>('/api/admin/ai-engine/case-phases', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateAdminCasePhase(phaseCode: string, body: CasePhaseUpdatePayload): Promise<CasePhaseAdminRow> {
    return requestJson<CasePhaseAdminRow>(`/api/admin/ai-engine/case-phases/${encodeURIComponent(phaseCode)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async deleteAdminCasePhase(phaseCode: string): Promise<void> {
    await requestJson(`/api/admin/ai-engine/case-phases/${encodeURIComponent(phaseCode)}`, { method: 'DELETE' });
  },

  async listAdminAiInteractions(phaseCode?: string): Promise<AiInteractionAdminRow[]> {
    const qs = phaseCode ? `?phaseCode=${encodeURIComponent(phaseCode)}` : '';
    const rows = await requestJson<AiInteractionAdminRow[]>(`/api/admin/ai-engine/ai-interactions${qs}`, {
      method: 'GET',
    });
    return Array.isArray(rows) ? rows : [];
  },

  async createAdminAiInteraction(body: AiInteractionCreatePayload): Promise<AiInteractionAdminRow> {
    return requestJson<AiInteractionAdminRow>('/api/admin/ai-engine/ai-interactions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateAdminAiInteraction(
    interactionId: string,
    body: AiInteractionUpdatePayload,
  ): Promise<AiInteractionAdminRow> {
    return requestJson<AiInteractionAdminRow>(
      `/api/admin/ai-engine/ai-interactions/${encodeURIComponent(interactionId)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    );
  },

  async deleteAdminAiInteraction(interactionId: string): Promise<void> {
    await requestJson(`/api/admin/ai-engine/ai-interactions/${encodeURIComponent(interactionId)}`, {
      method: 'DELETE',
    });
  },

  async listAdminLlmProfiles(): Promise<AiLlmProfileAdminRow[]> {
    const rows = await requestJson<AiLlmProfileAdminRow[]>('/api/admin/ai-engine/llm-profiles', { method: 'GET' });
    return Array.isArray(rows) ? rows : [];
  },

  async getActiveAdminLlmProfile(): Promise<AiLlmProfileAdminRow | null> {
    try {
      return await requestJson<AiLlmProfileAdminRow>('/api/admin/ai-engine/llm-profiles/active', { method: 'GET' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  async createAdminLlmProfile(body: AiLlmProfileUpsertPayload): Promise<AiLlmProfileAdminRow> {
    return requestJson<AiLlmProfileAdminRow>('/api/admin/ai-engine/llm-profiles', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateAdminLlmProfile(id: string, body: AiLlmProfileUpsertPayload): Promise<AiLlmProfileAdminRow> {
    return requestJson<AiLlmProfileAdminRow>(`/api/admin/ai-engine/llm-profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async deleteAdminLlmProfile(id: string): Promise<void> {
    await requestJson(`/api/admin/ai-engine/llm-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export type CasePhaseAdminRow = {
  phaseCode: string;
  displayName: string;
  sortOrder: number;
  enabled: boolean;
  catalogVersion: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CasePhaseUpsertPayload = {
  phaseCode: string;
  displayName: string;
  sortOrder: number;
  enabled: boolean;
  catalogVersion: string;
};

export type CasePhaseUpdatePayload = {
  displayName: string;
  sortOrder: number;
  enabled: boolean;
  catalogVersion: string;
};

export type AiInteractionAdminRow = {
  interactionId: string;
  phaseCode: string;
  loopInput: Record<string, unknown>;
  systemPrompt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AiInteractionCreatePayload = {
  interactionId: string;
  phaseCode: string;
  loopInput: Record<string, unknown>;
  systemPrompt?: string | null;
};

export type AiInteractionUpdatePayload = {
  phaseCode: string;
  loopInput: Record<string, unknown>;
  systemPrompt?: string | null;
};

export type AiLlmProfileAdminRow = {
  id: string;
  code: string;
  displayName: string;
  llmProvider: string;
  deepseekBaseUrl?: string | null;
  deepseekModel?: string | null;
  azureOpenaiEndpoint?: string | null;
  azureOpenaiDeployment?: string | null;
  azureOpenaiApiVersion?: string | null;
  /** API returns flags only; secret values are never sent. */
  deepseekApiKeyConfigured?: boolean;
  azureOpenaiApiKeyConfigured?: boolean;
  assessmentLlmEnabled: boolean;
  completenessLoopGraphEnabled: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AiLlmProfileUpsertPayload = {
  code: string;
  displayName: string;
  llmProvider: string;
  deepseekBaseUrl?: string | null;
  deepseekModel?: string | null;
  azureOpenaiEndpoint?: string | null;
  azureOpenaiDeployment?: string | null;
  azureOpenaiApiVersion?: string | null;
  /** Omit when unchanged on edit; send empty string to clear stored key. */
  deepseekApiKey?: string | null;
  azureOpenaiApiKey?: string | null;
  assessmentLlmEnabled?: boolean;
  completenessLoopGraphEnabled?: boolean;
  active?: boolean;
};
