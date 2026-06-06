package com.backend.wealth.discovery.dto;

import jakarta.validation.constraints.NotBlank;

public record DiscoveryExplainQuestionRequest(
        @NotBlank String questionId,
        String questionText,
        String answerType,
        Boolean requiredFlag
) {
}
