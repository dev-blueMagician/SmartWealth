package com.backend.wealth.discovery.dto;

import java.util.List;

public record DiscoveryMissingSummaryRequest(
        List<MissingQuestionItem> missing
) {
    public record MissingQuestionItem(String questionId, String questionText) {
    }
}
