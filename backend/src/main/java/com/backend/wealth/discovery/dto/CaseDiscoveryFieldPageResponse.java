package com.backend.wealth.discovery.dto;

import java.util.List;

public record CaseDiscoveryFieldPageResponse(
        List<CaseDiscoveryFieldResponse> items,
        long total,
        int page,
        int size,
        long mandatoryFieldsTotal,
        long mandatoryFieldsFilled,
        long mandatoryFieldsMissing
) {
}
