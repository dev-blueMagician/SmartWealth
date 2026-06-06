package com.backend.wealth.discovery.dto;

import java.time.OffsetDateTime;

public record FieldDictionaryResponse(
        String systemFieldName,
        Integer rowNo,
        String dataDomain,
        String dataItem,
        String detailFieldGroup,
        Integer detailFieldNo,
        String detailFieldName,
        String fieldDescription,
        String dataType,
        String mandatoryLevel,
        String appliesTo,
        String suggestedSource,
        String validationRule,
        String usedFor,
        String sensitivity,
        String updateFrequency,
        String missingDataAction,
        String exampleValue,
        String notes,
        OffsetDateTime createdAt
) {
}
