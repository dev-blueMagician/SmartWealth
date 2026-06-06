package com.backend.wealth.discovery.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record UnmappedDiscoveryAnswerResponse(
        String questionId,
        int blockIndex,
        JsonNode answerValue,
        String mappingSystemField
) {
}
