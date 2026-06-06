package com.backend.wealth.discovery.dto;

import java.util.List;
import java.util.UUID;

public record DiscoveryRebuildResponse(
        UUID caseId,
        int fieldsWritten,
        int filledCount,
        int missingMaterializedCount,
        int unmappedAnswerCount,
        long mandatoryFieldsTotal,
        long mandatoryFieldsFilled,
        long mandatoryFieldsMissing,
        List<String> warnings
) {
}
