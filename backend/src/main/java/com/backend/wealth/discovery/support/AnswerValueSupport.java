package com.backend.wealth.discovery.support;

import com.fasterxml.jackson.databind.JsonNode;

public final class AnswerValueSupport {

    private AnswerValueSupport() {
    }

    public static boolean isEmpty(JsonNode value) {
        if (value == null || value.isNull()) {
            return true;
        }
        if (value.isTextual()) {
            return value.asText().trim().isEmpty();
        }
        if (value.isArray()) {
            return value.isEmpty();
        }
        if (value.isObject()) {
            return value.isEmpty();
        }
        return false;
    }

    public static String toDisplayText(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isTextual()) {
            return value.asText();
        }
        if (value.isNumber() || value.isBoolean()) {
            return value.asText();
        }
        return value.toString();
    }
}
