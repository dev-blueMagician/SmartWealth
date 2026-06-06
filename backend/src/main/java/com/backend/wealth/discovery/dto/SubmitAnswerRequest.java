package com.backend.wealth.discovery.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SubmitAnswerRequest(
        @NotNull UUID caseId,
        @NotBlank @Size(max = 32) String questionId,
        Integer blockIndex,
        JsonNode answerValue
) {
}
