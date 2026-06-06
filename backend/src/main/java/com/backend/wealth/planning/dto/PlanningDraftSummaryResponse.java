package com.backend.wealth.planning.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PlanningDraftSummaryResponse(
        UUID planId,
        UUID caseId,
        UUID clientId,
        UUID templateId,
        String templateCode,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime finalizedAt
) {
}
