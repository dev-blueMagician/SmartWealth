package com.backend.wealth.llm;

import com.backend.wealth.cases.model.AiLlmProfileEntity;
import com.backend.wealth.cases.repository.AiLlmProfileRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LlmChatService {

    private static final String DEFAULT_AZURE_API_VERSION = "2024-02-15-preview";
    private static final Duration TIMEOUT = Duration.ofSeconds(120);

    private final AiLlmProfileRepository aiLlmProfileRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .build();

    public String chat(String systemPrompt, String userPrompt) {
        AiLlmProfileEntity profile = aiLlmProfileRepository.findByIsActiveTrue()
                .orElseThrow(() -> new NotFoundException(
                        "No active ai_llm_profile. Configure one under Admin → AI Engine → AI settings."));
        return chatWithProfile(profile, systemPrompt, userPrompt);
    }

    String chatWithProfile(AiLlmProfileEntity profile, String systemPrompt, String userPrompt) {
        String provider = profile.getLlmProvider() == null
                ? ""
                : profile.getLlmProvider().trim().toLowerCase(Locale.ROOT);
        try {
            return switch (provider) {
                case "deepseek" -> chatDeepSeek(profile, systemPrompt, userPrompt);
                case "azure_openai" -> chatAzureOpenAi(profile, systemPrompt, userPrompt);
                default -> throw new BusinessException("Unsupported llm_provider: " + profile.getLlmProvider());
            };
        } catch (BusinessException | NotFoundException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("LLM request failed: " + ex.getMessage(), ex);
        }
    }

    private String chatDeepSeek(AiLlmProfileEntity profile, String systemPrompt, String userPrompt) throws Exception {
        String apiKey = profile.getDeepseekApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException("Active LLM profile has no DeepSeek API key configured.");
        }
        String baseUrl = StringUtils.hasText(profile.getDeepseekBaseUrl())
                ? profile.getDeepseekBaseUrl().trim()
                : "https://api.deepseek.com";
        String model = StringUtils.hasText(profile.getDeepseekModel())
                ? profile.getDeepseekModel().trim()
                : "deepseek-chat";
        String url = baseUrl.replaceAll("/+$", "") + "/v1/chat/completions";
        return postOpenAiCompatibleChat(url, apiKey.trim(), "Bearer", model, systemPrompt, userPrompt);
    }

    private String chatAzureOpenAi(AiLlmProfileEntity profile, String systemPrompt, String userPrompt) throws Exception {
        String apiKey = profile.getAzureOpenaiApiKey();
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException("Active LLM profile has no Azure OpenAI API key configured.");
        }
        if (!StringUtils.hasText(profile.getAzureOpenaiEndpoint())) {
            throw new BusinessException("Active LLM profile has no Azure OpenAI endpoint configured.");
        }
        if (!StringUtils.hasText(profile.getAzureOpenaiDeployment())) {
            throw new BusinessException("Active LLM profile has no Azure OpenAI deployment configured.");
        }
        String version = StringUtils.hasText(profile.getAzureOpenaiApiVersion())
                ? profile.getAzureOpenaiApiVersion().trim()
                : DEFAULT_AZURE_API_VERSION;
        String base = profile.getAzureOpenaiEndpoint().trim().replaceAll("/+$", "");
        String deployment = profile.getAzureOpenaiDeployment().trim();
        String url = base + "/openai/deployments/" + deployment + "/chat/completions?api-version=" + version;
        return postOpenAiCompatibleChat(url, apiKey.trim(), "api-key", null, systemPrompt, userPrompt);
    }

    private String postOpenAiCompatibleChat(
            String url,
            String apiKey,
            String authHeaderName,
            String model,
            String systemPrompt,
            String userPrompt
    ) throws Exception {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        if (StringUtils.hasText(model)) {
            payload.put("model", model);
        }
        payload.put("messages", java.util.List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
        ));

        String body = objectMapper.writeValueAsString(payload);
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if ("api-key".equalsIgnoreCase(authHeaderName)) {
            builder.header("api-key", apiKey);
        } else {
            builder.header("Authorization", "Bearer " + apiKey);
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new BusinessException(
                    "LLM HTTP " + response.statusCode() + ": " + truncate(response.body(), 500));
        }
        JsonNode root = objectMapper.readTree(response.body());
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        if (content.isMissingNode() || content.isNull()) {
            throw new BusinessException("LLM response missing message content.");
        }
        return content.asText("").trim();
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }
}
