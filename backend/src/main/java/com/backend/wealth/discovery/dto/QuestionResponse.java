package com.backend.wealth.discovery.dto;

import java.time.OffsetDateTime;

public record QuestionResponse(
        String questionId,
        String module,
        String section,
        String questionText,
        String answerType,
        boolean repeatable,
        Boolean requiredFlag,
        Boolean conditionalFlag,
        OffsetDateTime createdAt
) {
}
