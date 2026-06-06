package com.backend.wealth.admin.aiengine.dto;

import java.time.LocalDateTime;

public record CasePhaseResponse(
        String phaseCode,
        String displayName,
        int sortOrder,
        boolean enabled,
        String catalogVersion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
