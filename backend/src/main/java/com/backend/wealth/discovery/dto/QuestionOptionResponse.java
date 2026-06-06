package com.backend.wealth.discovery.dto;

import java.util.UUID;

public record QuestionOptionResponse(
        UUID id,
        String questionId,
        String optionValue,
        String optionLabel
) {
}
