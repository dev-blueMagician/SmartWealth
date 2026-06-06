package com.backend.wealth.discovery.dto;

import jakarta.validation.constraints.Size;

public record UpdateQuestionRequest(
        @Size(max = 100) String module,
        @Size(max = 100) String section,
        String questionText,
        @Size(max = 50) String answerType,
        Boolean repeatable,
        Boolean requiredFlag,
        Boolean conditionalFlag
) {
}
