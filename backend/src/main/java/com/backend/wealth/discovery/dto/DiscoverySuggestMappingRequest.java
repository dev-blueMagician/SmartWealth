package com.backend.wealth.discovery.dto;

import jakarta.validation.constraints.NotBlank;

public record DiscoverySuggestMappingRequest(
        @NotBlank String questionId,
        String questionText
) {
}
