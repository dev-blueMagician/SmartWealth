package com.backend.wealth.planning.dto;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record PlanningDraftResponse(
        UUID planId,
        UUID caseId,
        UUID clientId,
        UUID templateId,
        String status,
        boolean approved,
        OffsetDateTime createdAt,
        OffsetDateTime finalizedAt,
        Map<String, Object> payload
) {
}
