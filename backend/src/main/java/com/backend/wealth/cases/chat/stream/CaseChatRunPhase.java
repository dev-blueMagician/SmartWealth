package com.backend.wealth.cases.chat.stream;

/**
 * Phase codes emitted on the case-chat progress stream (NDJSON / SSE lines).
 * Keep in sync with {@code frontend/src/domain/caseChatRunEvents.ts}.
 */
public enum CaseChatRunPhase {
    ROUTING,
    SEARCH,
    VERIFY,
    REASON,
    THINKING,
    DOCUMENT_PROCESS,
    DB_UPDATE
}
