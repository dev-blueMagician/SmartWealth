package com.backend.wealth.admin.aiengine.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateCasePhaseRequest(
        @NotBlank @Size(max = 200) String displayName,
        @NotNull Integer sortOrder,
        @NotNull Boolean enabled,
        @NotBlank @Size(max = 16) String catalogVersion
) {
}
