package com.backend.wealth.discovery.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MappingResponse(
        UUID id,
        String questionId,
        String systemField,
        String entityType,
        String transformType,
        OffsetDateTime createdAt
) {
}
