package com.backend.wealth.discovery.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record DiscoverySummaryResponse(
        UUID caseId,
        DiscoverySummaryStats stats,
        List<DiscoverySummaryFieldItem> filledFields,
        List<DiscoverySummaryMissingItem> missingMandatory,
        List<UnmappedDiscoveryAnswerResponse> unmappedAnswers,
        Map<String, Long> filledCountByDomain
) {
    public record DiscoverySummaryStats(
            int materializedFields,
            int filledCount,
            int missingMaterializedCount,
            long mandatoryFieldsTotal,
            long mandatoryFieldsFilled,
            long mandatoryFieldsMissing,
            int unmappedAnswerCount
    ) {
    }

    public record DiscoverySummaryFieldItem(
            String systemField,
            String valueText,
            String dataDomain,
            String dataItem,
            String detailFieldName,
            String questionId,
            Integer blockIndex
    ) {
    }

    public record DiscoverySummaryMissingItem(
            String systemField,
            String dataDomain,
            String dataItem,
            String detailFieldName,
            String mandatoryLevel
    ) {
    }
}
