package com.backend.wealth.discovery.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CaseDiscoveryDatasetResponse(
        UUID caseId,
        Map<String, CaseDiscoveryFieldResponse> fields,
        List<UnmappedDiscoveryAnswerResponse> unmappedAnswers,
        long mandatoryFieldsTotal,
        long mandatoryFieldsFilled,
        long mandatoryFieldsMissing
) {
}
