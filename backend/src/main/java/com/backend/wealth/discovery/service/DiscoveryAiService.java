package com.backend.wealth.discovery.service;

import com.backend.wealth.discovery.dto.DiscoveryExplainQuestionRequest;
import com.backend.wealth.discovery.dto.DiscoveryMissingSummaryRequest;
import com.backend.wealth.discovery.dto.DiscoverySuggestAnswerRequest;
import com.backend.wealth.discovery.dto.DiscoverySuggestMappingRequest;
import com.backend.wealth.discovery.dto.DiscoverySuggestMappingResponse;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.llm.LlmChatService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiscoveryAiService {

    private static final String SYSTEM = "You are a professional wealth-management discovery assistant. "
            + "Reply concisely in plain text unless asked for JSON only.";

    private final LlmChatService llmChatService;
    private final ObjectMapper objectMapper;

    public String suggestAnswer(DiscoverySuggestAnswerRequest req) {
        String user = """
                Case: %s
                Question ID: %s
                Module: %s
                Section: %s
                Question: %s
                Answer type: %s

                Existing answers:
                %s

                Suggest a single concise answer value suitable for this field (plain text or number only, no markdown). If unsure, say what information is still needed.
                """.formatted(
                nullToDash(req.caseLabel()),
                req.questionId(),
                nullToDash(req.module()),
                nullToDash(req.section()),
                nullToDash(req.questionText()),
                nullToDash(req.answerType()),
                formatAnswers(req.existingAnswers())
        );
        return llmChatService.chat(SYSTEM, user);
    }

    public String explainQuestion(DiscoveryExplainQuestionRequest req) {
        String user = """
                Explain this wealth discovery question to a relationship manager in 2–3 short bullet points (plain text):
                ID: %s
                Text: %s
                Type: %s
                Required: %s
                """.formatted(
                req.questionId(),
                nullToDash(req.questionText()),
                nullToDash(req.answerType()),
                Boolean.TRUE.equals(req.requiredFlag()) ? "yes" : "no"
        );
        return llmChatService.chat(SYSTEM, user);
    }

    public String missingSummary(DiscoveryMissingSummaryRequest req) {
        List<DiscoveryMissingSummaryRequest.MissingQuestionItem> missing =
                req.missing() == null ? List.of() : req.missing();
        if (missing.isEmpty()) {
            return "All required questions are answered.";
        }
        String list = missing.stream()
                .map(q -> "- " + q.questionId() + ": " + nullToDash(q.questionText()))
                .collect(Collectors.joining("\n"));
        String user = """
                The user still needs to answer these required discovery questions:
                %s

                Write 2–3 friendly bullet points advising what to collect next (plain text, no markdown headers).
                """.formatted(list);
        return llmChatService.chat(SYSTEM, user);
    }

    public DiscoverySuggestMappingResponse suggestMapping(DiscoverySuggestMappingRequest req) {
        String user = """
                Suggest a domain field mapping for wealth discovery question %s: "%s".
                Reply as JSON only: {"systemField":"snake_case.path","entityType":"client|asset|goal|case","transformType":"none|currency|date","rationale":"one sentence"}
                """.formatted(req.questionId(), nullToDash(req.questionText()));
        String text = llmChatService.chat(SYSTEM, user);
        return parseMappingJson(text);
    }

    private DiscoverySuggestMappingResponse parseMappingJson(String text) {
        if (!StringUtils.hasText(text)) {
            throw new BusinessException("LLM returned empty mapping suggestion.");
        }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new BusinessException("LLM did not return valid JSON for mapping suggestion.");
        }
        try {
            JsonNode node = objectMapper.readTree(text.substring(start, end + 1));
            return new DiscoverySuggestMappingResponse(
                    node.path("systemField").asText(""),
                    node.path("entityType").asText("client"),
                    node.path("transformType").asText("none"),
                    node.path("rationale").asText("")
            );
        } catch (Exception ex) {
            throw new BusinessException("Failed to parse mapping JSON from LLM.", ex);
        }
    }

    private String formatAnswers(JsonNode answers) {
        if (answers == null || answers.isNull() || !answers.isObject()) {
            return "No answers yet.";
        }
        StringBuilder sb = new StringBuilder();
        answers.fields().forEachRemaining(entry -> {
            sb.append("- ").append(entry.getKey()).append(": ")
                    .append(entry.getValue().toString()).append('\n');
        });
        return sb.isEmpty() ? "No answers yet." : sb.toString().trim();
    }

    private static String nullToDash(String value) {
        return StringUtils.hasText(value) ? value.trim() : "—";
    }
}
