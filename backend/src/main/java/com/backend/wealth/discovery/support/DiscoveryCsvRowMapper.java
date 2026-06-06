package com.backend.wealth.discovery.support;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class DiscoveryCsvRowMapper {

    private DiscoveryCsvRowMapper() {
    }

    public record ParsedRow(
            String questionId,
            String module,
            String section,
            String questionText,
            String answerType,
            boolean repeatable,
            boolean requiredFlag,
            boolean conditionalFlag,
            List<String> optionLabels,
            String systemField
    ) {
    }

    public static ParsedRow parse(Map<String, String> row) {
        String qid = DiscoveryCsvParser.get(row, "question id", "question_id");
        String module = DiscoveryCsvParser.get(row, "module");
        String section = DiscoveryCsvParser.get(row, "section");
        String questionText = DiscoveryCsvParser.get(row, "question", "question_text");
        String rawAnswerType = DiscoveryCsvParser.get(row, "answer type", "answer_type");
        String proposed = DiscoveryCsvParser.get(
                row,
                "proposed answer / choice",
                "proposed answer",
                "choices"
        );
        String required = DiscoveryCsvParser.get(row, "required?", "required");
        String conditionalTrigger = DiscoveryCsvParser.get(row, "conditional trigger", "conditional_trigger");
        String mapsTo = DiscoveryCsvParser.get(
                row,
                "maps to data domain / data item",
                "maps to",
                "system_field"
        );

        String answerType = normalizeAnswerType(rawAnswerType);
        boolean repeatable = isRepeatable(rawAnswerType, questionText);
        boolean requiredFlag = isRequired(required);
        boolean conditionalFlag = isConditional(required, conditionalTrigger);
        List<String> options = splitOptions(proposed);

        return new ParsedRow(
                qid,
                emptyToNull(module),
                emptyToNull(section),
                emptyToNull(questionText),
                answerType,
                repeatable,
                requiredFlag,
                conditionalFlag,
                options,
                emptyToNull(mapsTo)
        );
    }

    private static String normalizeAnswerType(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "text";
        }
        String lower = raw.trim().toLowerCase(Locale.ROOT);
        if (lower.contains("multi-select") || lower.contains("multi select") || lower.contains("multi-country")) {
            return "multi-select";
        }
        if (lower.contains("single choice") || lower.equals("choice") || lower.contains("yes/no")) {
            return "choice";
        }
        if (lower.contains("repeatable") || lower.contains("repeatable block") || lower.contains("repeatable table")) {
            return "block";
        }
        if (lower.contains("currency") || lower.contains("amount")) {
            return "number";
        }
        if (lower.contains("number") || lower.contains("phone") && !lower.contains("text")) {
            return lower.contains("phone") ? "text" : "number";
        }
        if (lower.contains("date") || lower.contains("email") || lower.contains("text")
                || lower.contains("address") || lower.contains("structured")) {
            return "text";
        }
        if (lower.length() > 50) {
            return lower.substring(0, 50);
        }
        return lower;
    }

    private static boolean isRepeatable(String rawAnswerType, String questionText) {
        String combined = ((rawAnswerType == null ? "" : rawAnswerType) + " "
                + (questionText == null ? "" : questionText)).toLowerCase(Locale.ROOT);
        return combined.contains("repeatable");
    }

    private static boolean isRequired(String required) {
        if (!StringUtils.hasText(required)) {
            return false;
        }
        return required.trim().toLowerCase(Locale.ROOT).startsWith("mandatory");
    }

    private static boolean isConditional(String required, String trigger) {
        if (StringUtils.hasText(required)) {
            String r = required.trim().toLowerCase(Locale.ROOT);
            if (r.startsWith("conditional")) {
                return true;
            }
        }
        if (!StringUtils.hasText(trigger)) {
            return false;
        }
        String t = trigger.trim().toLowerCase(Locale.ROOT);
        return !t.equals("always") && !t.equals("n/a");
    }

    private static List<String> splitOptions(String proposed) {
        if (!StringUtils.hasText(proposed)) {
            return List.of();
        }
        String normalized = proposed.replace('\n', ';');
        String[] parts = normalized.split(";");
        List<String> out = new ArrayList<>();
        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.isEmpty() || isPlaceholderOption(trimmed)) {
                continue;
            }
            out.add(trimmed);
        }
        return out;
    }

    private static boolean isPlaceholderOption(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.contains("free text")
                || lower.contains("use controlled list")
                || lower.contains("dd/mm/yyyy")
                || lower.contains("add one row")
                || lower.equals("other");
    }

    private static String emptyToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
