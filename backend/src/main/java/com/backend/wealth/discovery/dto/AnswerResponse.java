package com.backend.wealth.discovery.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AnswerResponse(
        UUID id,
        UUID caseId,
        String questionId,
        int blockIndex,
        JsonNode answerValue,
        OffsetDateTime createdAt
) {
}
