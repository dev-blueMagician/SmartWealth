package com.backend.wealth.admin.aiengine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpsertAiInteractionRequest(
        @NotBlank @Size(max = 16) String interactionId,
        @NotBlank @Size(max = 50) String phaseCode,
        JsonNode loopInput,
        String systemPrompt
) {
}
