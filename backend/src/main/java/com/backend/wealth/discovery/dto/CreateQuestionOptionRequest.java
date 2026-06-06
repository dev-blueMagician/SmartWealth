package com.backend.wealth.discovery.dto;

import jakarta.validation.constraints.Size;

public record CreateQuestionOptionRequest(
        @Size(max = 100) String optionValue,
        @Size(max = 200) String optionLabel
) {
}
