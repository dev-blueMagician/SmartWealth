package com.backend.wealth.planning.dto;

import java.util.Map;

public record RegeneratePlanningDraftRequest(
        Map<String, Object> assumptions,
        boolean markReadyForReview
) {
}
