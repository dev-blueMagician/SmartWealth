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

@Slf4j
@Service
public class AiEngineWorkflowClient {

    private final RestClient aiEngineRestClient;
    private final ObjectMapper objectMapper;

    @Value("${wealth.ai-engine.base-url:http://localhost:8010}")
    private String configuredBaseUrl;

    @Value("${wealth.ai-engine.workflow-create-max-attempts:4}")
    private int maxAttempts;

    @Value("${wealth.ai-engine.workflow-create-backoff-ms:400}")
    private long backoffMs;

    public AiEngineWorkflowClient(
            @Qualifier("aiEngineRestClient") RestClient aiEngineRestClient,
            ObjectMapper objectMapper
    ) {
        this.aiEngineRestClient = aiEngineRestClient;
        this.objectMapper = objectMapper;
    }

    /**
     * POST AI-engine /api/v1/workflows — retries on failure.
     */
    public String createWorkflowWithRetries(Map<String, Object> payload) {
        Map<String, Object> envelope = Map.of("payload", payload);
        final String jsonBody;
        try {
            jsonBody = objectMapper.writeValueAsString(envelope);
        } catch (JsonProcessingException e) {
            throw new BusinessException("Could not serialize workflow create payload", e);
        }

        Exception last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String raw = aiEngineRestClient.post()
                        .uri("/api/v1/workflows")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(jsonBody.getBytes(StandardCharsets.UTF_8))
                        .retrieve()
                        .body(String.class);
                JsonNode root = objectMapper.readTree(raw);
                String id = text(root, "workflow_id");
                if (id == null || id.isBlank()) {
                    id = text(root, "id");
                }
                if (id == null || id.isBlank()) {
                    throw new BusinessException("AI-engine response missing workflow_id");
                }
                return id;
            } catch (RestClientException | BusinessException e) {
                last = e;
                log.warn(
                        "AI-engine workflow create attempt {}/{} failed: {}",
                        attempt,
                        maxAttempts,
                        summarizeFailure(e)
                );
            } catch (Exception e) {
                last = e;
                log.warn(
                        "AI-engine workflow create attempt {}/{} failed: {}",
                        attempt,
                        maxAttempts,
                        e.getMessage(),
                        e
                );
            }
            if (attempt < maxAttempts) {
                sleepBackoff(attempt);
            }
        }
        String hint = " Start the AI-engine (e.g. uvicorn on port 8000) or set WEALTH_AI_ENGINE_BASE_URL.";
        throw new BusinessException(
                "Could not create workflow on AI-engine at "
                        + trimSlash(configuredBaseUrl)
                        + " after "
                        + maxAttempts
                        + " attempts. Last error: "
                        + summarizeFailure(last)
                        + hint,
                last
        );
    }

    private static String trimSlash(String url) {
        if (url == null || url.isBlank()) {
            return "(not configured)";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private static String summarizeFailure(Throwable e) {
        if (e == null) {
            return "unknown";
        }
        if (e instanceof RestClientResponseException r) {
            String body = r.getResponseBodyAsString();
            String snippet = body == null || body.isBlank() ? "" : (body.length() > 300 ? body.substring(0, 300) + "…" : body);
            return "HTTP " + r.getStatusCode().value() + " " + r.getStatusText() + (snippet.isEmpty() ? "" : ": " + snippet);
        }
        return e.getClass().getSimpleName() + ": " + (e.getMessage() != null ? e.getMessage() : "");
    }

    private static String text(JsonNode root, String field) {
        if (root == null || !root.has(field) || root.get(field).isNull()) {
            return null;
        }
        return root.get(field).asText();
    }

    private void sleepBackoff(int attempt) {
        try {
            Thread.sleep(backoffMs * attempt);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
