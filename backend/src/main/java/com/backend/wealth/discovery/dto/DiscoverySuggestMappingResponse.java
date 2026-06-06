package com.backend.wealth.discovery.dto;

public record DiscoverySuggestMappingResponse(
        String systemField,
        String entityType,
        String transformType,
        String rationale
) {
}
