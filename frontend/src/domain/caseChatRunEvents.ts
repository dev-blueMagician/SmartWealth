/**
 * Contract for case-chat run progress (NDJSON / SSE lines or future stream).
 * Backend should emit the same `code` strings (see Java {@code CaseChatRunPhase}).
 */

export const CHAT_RUN_PHASE_CODES = [
  'ROUTING',
  'SEARCH',
  'VERIFY',
  'REASON',
  'THINKING',
  'DOCUMENT_PROCESS',
  'DB_UPDATE',
] as const;

export type ChatRunPhaseCode = (typeof CHAT_RUN_PHASE_CODES)[number];

export const HTTP_METHOD_HINTS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

export type HttpMethodHint = (typeof HTTP_METHOD_HINTS)[number];

const HTTP_METHOD_SET: ReadonlySet<string> = new Set(HTTP_METHOD_HINTS);

export function isHttpMethodHint(value: string): value is HttpMethodHint {
  return HTTP_METHOD_SET.has(value);
}

export type ChatRunPhaseDisplay = {
  /** Full line from server — wins over templates. */
  labelVi?: string;
  /** Hint for FE copy: read vs write style. */
  httpMethod?: HttpMethodHint;
  /** Short hint shown after middle dot, e.g. "hồ sơ khách". */
  target?: string;
  /** Extra clause (server or client). */
  detail?: string;
};

export type ChatRunStreamEvent =
  | ({ type: 'phase'; code: ChatRunPhaseCode } & ChatRunPhaseDisplay)
  | { type: 'assistant_delta'; text: string }
  | {
      type: 'catalog_turn_complete';
      assistant_text?: string;
      ai_payload?: Record<string, unknown>;
    }
  | {
      type: 'done';
      userMessageId?: string;
      assistantMessageId?: string;
    }
  | { type: 'error'; code?: string; message: string };

const PHASE_SET: ReadonlySet<string> = new Set(CHAT_RUN_PHASE_CODES);

export function isChatRunPhaseCode(value: string): value is ChatRunPhaseCode {
  return PHASE_SET.has(value);
}

/** Fallback when no `httpMethod` / `labelVi`. */
export const CHAT_RUN_PHASE_LABEL_VI: Record<ChatRunPhaseCode, string> = {
  ROUTING: 'Đang phân tích ý định…',
  SEARCH: 'Đang tìm và lọc thông tin…',
  VERIFY: 'Đang kiểm tra tính nhất quán…',
  REASON: 'Đang suy luận từ dữ liệu…',
  THINKING: 'Đang cân nhắc cách trả lời…',
  DOCUMENT_PROCESS: 'Đang xử lý nội dung tài liệu…',
  DB_UPDATE: 'Đang lưu trạng thái phiên…',
};

/** GET-style wording per phase (truy vấn / đọc). */
const PHASE_LABEL_READ_VI: Partial<Record<ChatRunPhaseCode, string>> = {
  ROUTING: 'Đang đọc ngữ cảnh tin nhắn…',
  SEARCH: 'Đang truy xuất thông tin liên quan…',
  VERIFY: 'Đang đọc lại và đối chiếu dữ liệu…',
  REASON: 'Đang truy vấn các ràng buộc và kết luận…',
  THINKING: 'Đang tổng hợp từ các nguồn đã đọc…',
  DOCUMENT_PROCESS: 'Đang đọc và trích nội dung tài liệu…',
  DB_UPDATE: 'Đang đọc trạng thái đã lưu…',
};

/** POST-style wording per phase (ghi / cập nhật). */
const PHASE_LABEL_WRITE_VI: Partial<Record<ChatRunPhaseCode, string>> = {
  ROUTING: 'Đang ghi nhận phân loại ý định…',
  SEARCH: 'Đang cập nhật chỉ mục tìm kiếm…',
  VERIFY: 'Đang ghi kết quả kiểm tra…',
  REASON: 'Đang lưu kết luận suy luận…',
  THINKING: 'Đang chuẩn bị bản thảo phản hồi…',
  DOCUMENT_PROCESS: 'Đang tải lên và cập nhật tài liệu…',
  DB_UPDATE: 'Đang ghi cập nhật vào cơ sở dữ liệu…',
};

function withTargetAndDetail(
  base: string,
  target?: string,
  detail?: string,
): string {
  let s = base;
  const t = target?.trim();
  const d = detail?.trim();
  if (t) s = `${s.replace(/…$/, '')} · ${t}…`;
  if (d) s = `${s.replace(/…$/, '')} (${d})…`;
  return s;
}

export function labelForRunPhase(
  code: ChatRunPhaseCode,
  detail?: string,
): string {
  const base = CHAT_RUN_PHASE_LABEL_VI[code];
  if (detail?.trim()) return `${base.replace(/…$/, '')} (${detail.trim()})…`;
  return base;
}

/** Resolved line for the typing indicator. */
export function resolveRunStatusLabel(row: ChatRunStepRow): string {
  if (row.labelVi?.trim()) return row.labelVi.trim();
  const method = row.httpMethod?.toUpperCase();
  let base: string;
  if (method === 'GET' || method === 'HEAD') {
    base = PHASE_LABEL_READ_VI[row.code] ?? CHAT_RUN_PHASE_LABEL_VI[row.code];
  } else if (
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE'
  ) {
    base = PHASE_LABEL_WRITE_VI[row.code] ?? CHAT_RUN_PHASE_LABEL_VI[row.code];
  } else {
    base = CHAT_RUN_PHASE_LABEL_VI[row.code];
  }
  return withTargetAndDetail(base, row.target, row.detail);
}

export function parseChatRunStreamLine(raw: string): ChatRunStreamEvent | null {
  const line = raw.trim();
  if (!line) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const t = o.type;
  if (t === 'phase') {
    const code = o.code;
    if (typeof code !== 'string' || !isChatRunPhaseCode(code)) return null;
    const detail = o.detail;
    const labelVi = o.labelVi;
    const target = o.target;
    const rawMethod = o.httpMethod;
    let httpMethod: HttpMethodHint | undefined;
    if (typeof rawMethod === 'string' && isHttpMethodHint(rawMethod.toUpperCase())) {
      httpMethod = rawMethod.toUpperCase() as HttpMethodHint;
    }
    return {
      type: 'phase',
      code,
      detail: typeof detail === 'string' ? detail : undefined,
      labelVi: typeof labelVi === 'string' ? labelVi : undefined,
      target: typeof target === 'string' ? target : undefined,
      httpMethod,
    };
  }
  if (t === 'assistant_delta') {
    const text = o.text;
    if (typeof text !== 'string') return null;
    return { type: 'assistant_delta', text };
  }
  if (t === 'catalog_turn_complete') {
    const assistant_text = o.assistant_text;
    const ai_payload = o.ai_payload;
    return {
      type: 'catalog_turn_complete',
      assistant_text: typeof assistant_text === 'string' ? assistant_text : undefined,
      ai_payload:
        ai_payload && typeof ai_payload === 'object' && !Array.isArray(ai_payload)
          ? (ai_payload as Record<string, unknown>)
          : undefined,
    };
  }
  if (t === 'done') {
    const userMessageId = o.userMessageId;
    const assistantMessageId = o.assistantMessageId;
    return {
      type: 'done',
      userMessageId: typeof userMessageId === 'string' ? userMessageId : undefined,
      assistantMessageId:
        typeof assistantMessageId === 'string' ? assistantMessageId : undefined,
    };
  }
  if (t === 'error') {
    const message = o.message;
    const code = o.code;
    if (typeof message !== 'string') return null;
    return {
      type: 'error',
      message,
      code: typeof code === 'string' ? code : undefined,
    };
  }
  return null;
}

/** One step row (stream or dev stub). */
export type ChatRunStepRow = {
  code: ChatRunPhaseCode;
  status: 'done' | 'active';
} & ChatRunPhaseDisplay;

export function applyPhaseEventToRows(
  prev: ChatRunStepRow[],
  code: ChatRunPhaseCode,
  display?: ChatRunPhaseDisplay,
): ChatRunStepRow[] {
  const withoutDupActive = prev.map((r) =>
    r.status === 'active' ? { ...r, status: 'done' as const } : r,
  );
  const last = withoutDupActive[withoutDupActive.length - 1];
  const hasDisplay =
    display &&
    Object.values(display).some((v) => v !== undefined && String(v).trim() !== '');
  if (last?.code === code && last.status === 'active') {
    if (!hasDisplay) return withoutDupActive;
    return [
      ...withoutDupActive.slice(0, -1),
      { ...last, ...display },
    ];
  }
  return [...withoutDupActive, { code, status: 'active', ...display }];
}

/** Use when handling a parsed {@code phase} line from NDJSON. */
export function applyPhaseStreamEvent(
  prev: ChatRunStepRow[],
  ev: Extract<ChatRunStreamEvent, { type: 'phase' }>,
): ChatRunStepRow[] {
  const { code, labelVi, httpMethod, target, detail } = ev;
  return applyPhaseEventToRows(prev, code, { labelVi, httpMethod, target, detail });
}

/** Active row for single-line UI. If nothing is {@code active}, returns null (use fallback). */
export function currentRunStepFromSteps(
  steps: ChatRunStepRow[],
): ChatRunStepRow | null {
  const active = [...steps].reverse().find((r) => r.status === 'active');
  if (active) return active;
  return null;
}

/** Dev-only sequence: illustrative phases only (no fake DB write while AI still runs). */
export const DEV_CHAT_PROGRESS_SCENARIO: Omit<ChatRunStepRow, 'status'>[] = [
  { code: 'ROUTING', httpMethod: 'GET', detail: 'luồng hội thoại' },
  { code: 'SEARCH', httpMethod: 'GET', target: 'case & catalog' },
  { code: 'VERIFY', httpMethod: 'GET', target: 'ràng buộc nghiệp vụ' },
  { code: 'REASON', detail: 'mục tiêu RM' },
  { code: 'THINKING' },
  {
    code: 'DOCUMENT_PROCESS',
    httpMethod: 'POST',
    target: 'đính kèm',
  },
  {
    code: 'THINKING',
    labelVi: 'Đang chờ phản hồi từ máy chủ…',
  },
];
