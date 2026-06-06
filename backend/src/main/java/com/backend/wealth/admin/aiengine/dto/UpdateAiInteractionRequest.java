package com.backend.wealth.admin.aiengine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateAiInteractionRequest(
        @NotBlank @Size(max = 50) String phaseCode,
        JsonNode loopInput,
        String systemPrompt
) {
}
