package com.backend.wealth.admin.aiengine.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;

public record AiInteractionResponse(
        String interactionId,
        String phaseCode,
        JsonNode loopInput,
        String systemPrompt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
