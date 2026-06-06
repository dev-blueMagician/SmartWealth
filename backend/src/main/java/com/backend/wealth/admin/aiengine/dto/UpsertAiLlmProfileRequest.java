package com.backend.wealth.admin.aiengine.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpsertAiLlmProfileRequest(
        @NotBlank @Size(max = 64) String code,
        @NotBlank @Size(max = 200) String displayName,
        @NotBlank
        @Pattern(regexp = "deepseek|azure_openai", message = "llmProvider must be deepseek or azure_openai")
        String llmProvider,
        @Size(max = 512) String deepseekBaseUrl,
        @Size(max = 128) String deepseekModel,
        @Size(max = 512) String azureOpenaiEndpoint,
        @Size(max = 128) String azureOpenaiDeployment,
        @Size(max = 64) String azureOpenaiApiVersion,
        /** Null on update = leave existing secret unchanged; empty string clears stored key. */
        @Size(max = 8192) String deepseekApiKey,
        @Size(max = 8192) String azureOpenaiApiKey,
        Boolean assessmentLlmEnabled,
        Boolean completenessLoopGraphEnabled,
        Boolean active
) {
}
