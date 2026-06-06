package com.backend.wealth.discovery.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateMappingRequest(
        @NotBlank @Size(max = 32) String questionId,
        @NotBlank @Size(max = 200) String systemField,
        @Size(max = 50) String entityType,
        @Size(max = 50) String transformType
) {
}
