package com.backend.wealth.cases.chat.stream;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * JSON line shapes for case-chat run progress. Serialize with Jackson
 * {@code objectMapper.writeValueAsString(...)} + newline for NDJSON.
 */
public final class CaseChatStreamEvents {

    private CaseChatStreamEvents() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Phase(
            String type,
            CaseChatRunPhase code,
            String detail,
            String labelVi,
            String httpMethod,
            String target
    ) {
        public Phase(CaseChatRunPhase code, String detail, String labelVi, String httpMethod, String target) {
            this("phase", code, detail, labelVi, httpMethod, target);
        }

        public static Phase of(CaseChatRunPhase code) {
            return new Phase(code, null, null, null, null);
        }

        public static Phase withDetail(CaseChatRunPhase code, String detail) {
            return new Phase(code, detail, null, null, null);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Done(
            String type,
            String userMessageId,
            String assistantMessageId
    ) {
        public Done(String userMessageId, String assistantMessageId) {
            this("done", userMessageId, assistantMessageId);
        }

        public static Done withoutIds() {
            return new Done(null, null);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Error(String type, String code, String message) {
        public Error(String message) {
            this("error", null, message);
        }

        public Error(String code, String message) {
            this("error", code, message);
        }
    }
}
