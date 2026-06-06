package com.backend.wealth.planning.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PlanTemplateResponse(
        UUID id,
        String code,
        String name,
        Integer versionNo,
        String status,
        String locale,
        String productType,
        UUID documentId,
        String documentFilename,
        Map<String, Object> mappingJson,
        Map<String, Object> structureJson,
        List<String> placeholdersDetected,
        OffsetDateTime analyzedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
