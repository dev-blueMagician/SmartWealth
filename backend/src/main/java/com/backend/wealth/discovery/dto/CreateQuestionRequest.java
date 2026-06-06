package com.backend.wealth.discovery.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateQuestionRequest(
        @NotBlank @Size(max = 32) String questionId,
        @Size(max = 100) String module,
        @Size(max = 100) String section,
        String questionText,
        @Size(max = 50) String answerType,
        Boolean repeatable,
        Boolean requiredFlag,
        Boolean conditionalFlag
) {
}
