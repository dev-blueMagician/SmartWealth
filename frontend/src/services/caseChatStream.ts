import { ApiError } from './apiError';
import {
  applyPhaseStreamEvent,
  parseChatRunStreamLine,
  type ChatRunStepRow,
  type ChatRunStreamEvent,
} from '../domain/caseChatRunEvents';

export type CaseChatStreamHandlers = {
  onPhase?: (steps: ChatRunStepRow[]) => void;
  onAssistantDelta?: (fullText: string, delta: string) => void;
  onDone?: (event: Extract<ChatRunStreamEvent, { type: 'done' }>) => void;
  onError?: (message: string) => void;
};

/**
 * Coalesce many per-character stream updates into at most one React commit per animation frame.
 */
export function createRafBatchedTextSink(apply: (fullText: string) => void): {
  push: (fullText: string) => void;
  flush: () => void;
  cancel: () => void;
} {
  let pending = '';
  let rafId: number | null = null;

  const commit = () => {
    rafId = null;
    apply(pending);
  };

  return {
    push(fullText: string) {
      pending = fullText;
      if (rafId == null) {
        rafId = requestAnimationFrame(commit);
      }
    },
    flush() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      apply(pending);
    },
    cancel() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pending = '';
    },
  };
}

const STREAM_TRACE =
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

function traceStream(message: string, detail?: unknown): void {
  if (!STREAM_TRACE) return;
  if (detail !== undefined) {
    console.info(`[case-chat-stream] ${message}`, detail);
  } else {
    console.info(`[case-chat-stream] ${message}`);
  }
}

function traceStreamEvent(ev: ChatRunStreamEvent, lineNo: number): void {
  if (!STREAM_TRACE) return;
  switch (ev.type) {
    case 'phase':
      console.info(`[case-chat-stream] #${lineNo} phase`, ev.code);
      break;
    case 'assistant_delta':
      console.info(`[case-chat-stream] #${lineNo} assistant_delta`, {
        deltaLen: ev.text.length,
        char: ev.text.length === 1 ? ev.text : undefined,
      });
      break;
    case 'catalog_turn_complete':
      console.info(`[case-chat-stream] #${lineNo} catalog_turn_complete`, {
        assistantTextLen: (ev.assistant_text ?? '').length,
        preview: (ev.assistant_text ?? '').slice(0, 120),
      });
      break;
    case 'done':
      console.info(`[case-chat-stream] #${lineNo} done`, {
        userMessageId: ev.userMessageId,
        assistantMessageId: ev.assistantMessageId,
      });
      break;
    case 'error':
      console.warn(`[case-chat-stream] #${lineNo} error`, ev.message);
      break;
    default:
      break;
  }
}

/**
 * Read NDJSON body from {@link Response} (case chat stream endpoint).
 */
export async function consumeCaseChatNdjsonStream(
  response: Response,
  handlers: CaseChatStreamHandlers,
): Promise<void> {
  traceStream('response', {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type'),
  });

  if (!response.ok) {
    const raw = await response.text();
    traceStream('http error body', raw.slice(0, 500));
    let message = `HTTP ${response.status} ${response.statusText}`;
    try {
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      if (typeof parsed?.message === 'string') message = parsed.message;
    } catch {
      if (raw) message = raw.slice(0, 500);
    }
    throw new ApiError(response.status, 'HTTP_ERROR', message, raw || undefined);
  }

  const body = response.body;
  if (!body) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Empty stream body.', undefined);
  }

  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let steps: ChatRunStepRow[] = [];
  let assistantText = '';
  let lineNo = 0;
  let deltaCount = 0;

  const dispatch = (ev: ChatRunStreamEvent) => {
    traceStreamEvent(ev, lineNo);
    if (ev.type === 'phase') {
      steps = applyPhaseStreamEvent(steps, ev);
      handlers.onPhase?.(steps);
    } else if (ev.type === 'assistant_delta') {
      deltaCount += 1;
      assistantText += ev.text;
      handlers.onAssistantDelta?.(assistantText, ev.text);
    } else if (ev.type === 'catalog_turn_complete') {
      const full = ev.assistant_text ?? '';
      assistantText = full;
      handlers.onAssistantDelta?.(assistantText, full);
    } else if (ev.type === 'done') {
      handlers.onDone?.(ev);
    } else if (ev.type === 'error') {
      handlers.onError?.(ev.message);
    }
  };

  const consumeLine = (line: string) => {
    if (!line) return;
    lineNo += 1;
    const ev = parseChatRunStreamLine(line);
    if (ev) {
      dispatch(ev);
    } else {
      traceStream(`#${lineNo} unparseable line`, line.slice(0, 200));
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      consumeLine(line);
    }
  }

  const tail = buf.trim();
  if (tail) {
    consumeLine(tail);
  }

  traceStream('finished', {
    lineNo,
    deltaCount,
    assistantTextLen: assistantText.length,
  });

  if (lineNo === 0) {
    throw new ApiError(
      response.status,
      'EMPTY_STREAM',
      'Server returned an empty NDJSON stream (0 lines). Check backend logs and AI-engine connectivity.',
      undefined,
    );
  }
}
