package com.backend.wealth.discovery.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;

public record DiscoverySuggestAnswerRequest(
        @NotBlank String questionId,
        String module,
        String section,
        String questionText,
        String answerType,
        JsonNode existingAnswers,
        String caseLabel
) {
}
