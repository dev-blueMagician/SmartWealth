package com.backend.wealth.discovery.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CaseDiscoveryFieldResponse(
        UUID id,
        UUID caseId,
        String systemField,
        JsonNode valueJsonb,
        String valueText,
        String source,
        String status,
        String questionId,
        Integer blockIndex,
        UUID mappingId,
        String dataDomain,
        String dataItem,
        String detailFieldName,
        String mandatoryLevel,
        String dataType,
        OffsetDateTime updatedAt
) {
}
