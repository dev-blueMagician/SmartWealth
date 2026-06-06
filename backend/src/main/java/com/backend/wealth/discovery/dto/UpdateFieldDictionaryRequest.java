package com.backend.wealth.discovery.dto;

import jakarta.validation.constraints.Size;

public record UpdateFieldDictionaryRequest(
        Integer rowNo,
        @Size(max = 200) String dataDomain,
        @Size(max = 200) String dataItem,
        @Size(max = 200) String detailFieldGroup,
        Integer detailFieldNo,
        @Size(max = 200) String detailFieldName,
        String fieldDescription,
        @Size(max = 100) String dataType,
        @Size(max = 50) String mandatoryLevel,
        @Size(max = 100) String appliesTo,
        String suggestedSource,
        String validationRule,
        String usedFor,
        @Size(max = 100) String sensitivity,
        @Size(max = 100) String updateFrequency,
        String missingDataAction,
        String exampleValue,
        String notes
) {
}
