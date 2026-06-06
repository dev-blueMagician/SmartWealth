package com.backend.wealth.planning.dto;

import jakarta.validation.constraints.NotNull;

import java.util.Map;
import java.util.UUID;

public record CreatePlanningDraftRequest(
        @NotNull UUID templateId,
        Map<String, Object> assumptions
) {
}
