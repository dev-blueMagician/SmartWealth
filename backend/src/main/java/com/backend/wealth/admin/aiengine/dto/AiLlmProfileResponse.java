package com.backend.wealth.admin.aiengine.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AiLlmProfileResponse(
        UUID id,
        String code,
        String displayName,
        String llmProvider,
        String deepseekBaseUrl,
        String deepseekModel,
        String azureOpenaiEndpoint,
        String azureOpenaiDeployment,
        String azureOpenaiApiVersion,
        boolean deepseekApiKeyConfigured,
        boolean azureOpenaiApiKeyConfigured,
        boolean assessmentLlmEnabled,
        boolean completenessLoopGraphEnabled,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
