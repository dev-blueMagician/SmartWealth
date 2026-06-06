package com.backend.wealth.integration;

import com.backend.wealth.exception.BusinessException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Calls AI-engine internal chat routes. Non-streaming: {@code POST /internal/chat/turn},
 * {@code POST /internal/chat/narrate}, {@code POST /internal/chat/detect-intent}.
 * Streaming: {@code POST /internal/chat/turn/stream} and {@code POST /internal/chat/narrate/stream}
 * (NDJSON) — use {@link com.backend.wealth.integration.AiEngineHttpStreamClient} from the service layer.
 */
@Slf4j
@Service
public class AiEngineChatClient {

    private final RestClient aiEngineRestClient;
    private final ObjectMapper objectMapper;
    private final String configuredBaseUrl;
    private final String internalToken;

    public AiEngineChatClient(
            @Qualifier("aiEngineRestClient") RestClient aiEngineRestClient,
            ObjectMapper objectMapper,
            @Value("${wealth.ai-engine.base-url:http://localhost:8010}") String configuredBaseUrl,
            @Value("${wealth.ai-engine.internal-token:}") String internalToken
    ) {
        this.aiEngineRestClient = aiEngineRestClient;
        this.objectMapper = objectMapper;
        this.configuredBaseUrl = configuredBaseUrl;
        this.internalToken = internalToken;
        if (internalToken == null || internalToken.isBlank()) {
            log.warn(
                    "wealth.ai-engine.internal-token is blank: AI-engine POST /internal/chat/* will return HTTP 401. "
                            + "Set WEALTH_AI_ENGINE_INTERNAL_TOKEN to the same value as AI-engine INTERNAL_WORKFLOW_EVENT_TOKEN."
            );
        }
    }

    public JsonNode postChatTurn(Map<String, Object> body) {
        return postInternalJson("/internal/chat/turn", body);
    }

    public JsonNode postNarrate(Map<String, Object> body) {
        return postInternalJson("/internal/chat/narrate", body);
    }

    /** Heuristic intent routing + suggested assessment for the current phase. */
    public JsonNode postDetectIntent(Map<String, Object> body) {
        return postInternalJson("/internal/chat/detect-intent", body);
    }

    private JsonNode postInternalJson(String path, Map<String, Object> body) {
        final String jsonBody;
        try {
            jsonBody = objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            throw new BusinessException("Could not serialize AI-engine payload", e);
        }

        try {
            return aiEngineRestClient.post()
                    .uri(path)
                    .headers(h -> {
                        if (internalToken != null && !internalToken.isBlank()) {
                            h.set("X-Internal-Token", internalToken);
                        }
                    })
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(jsonBody.getBytes(StandardCharsets.UTF_8))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            String snippet = e.getResponseBodyAsString();
            if (snippet != null && snippet.length() > 500) {
                snippet = snippet.substring(0, 500) + "…";
            }
            log.warn("AI-engine {} HTTP {}: {}", path, e.getStatusCode().value(), snippet);
            throw new BusinessException(
                    "AI-engine request failed (" + path + "): HTTP "
                            + e.getStatusCode().value()
                            + (snippet == null || snippet.isBlank() ? "" : (": " + snippet)),
                    e
            );
        } catch (RestClientException e) {
            log.warn("AI-engine {} transport error: {}", path, e.getMessage());
            throw new BusinessException(
                    "Could not reach AI-engine at "
                            + trimSlash(configuredBaseUrl)
                            + " for "
                            + path
                            + ". "
                            + e.getMessage(),
                    e
            );
        }
    }

    private static String trimSlash(String url) {
        if (url == null || url.isBlank()) {
            return "(not configured)";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
