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
import java.util.Base64;
import java.util.Map;

@Slf4j
@Service
public class AiEnginePlanningClient {

    private final RestClient aiEngineRestClient;
    private final ObjectMapper objectMapper;
    private final String configuredBaseUrl;
    private final String internalToken;

    public AiEnginePlanningClient(
            @Qualifier("aiEngineRestClient") RestClient aiEngineRestClient,
            ObjectMapper objectMapper,
            @Value("${wealth.ai-engine.base-url:http://localhost:8010}") String configuredBaseUrl,
            @Value("${wealth.ai-engine.internal-token:}") String internalToken
    ) {
        this.aiEngineRestClient = aiEngineRestClient;
        this.objectMapper = objectMapper;
        this.configuredBaseUrl = configuredBaseUrl;
        this.internalToken = internalToken;
    }

    public JsonNode analyzePlanningTemplate(Map<String, Object> body) {
        return postInternalJson("/internal/planning/analyze-template", body);
    }

    public JsonNode composePlanningPayload(Map<String, Object> body) {
        return postInternalJson("/internal/planning/compose", body);
    }

    public byte[] renderPlanningDocx(Map<String, Object> body) {
        JsonNode response = postInternalJson("/internal/planning/render-docx", body);
        if (response == null || !response.hasNonNull("docxBase64")) {
            throw new BusinessException("AI-engine render-docx returned no docxBase64.");
        }
        try {
            return Base64.getDecoder().decode(response.get("docxBase64").asText());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("AI-engine render-docx returned invalid base64.", ex);
        }
    }

    private JsonNode postInternalJson(String path, Map<String, Object> body) {
        final String jsonBody;
        try {
            jsonBody = objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            throw new BusinessException("Could not serialize AI-engine planning payload", e);
        }

        long startedAtNanos = System.nanoTime();
        log.info("AI-engine request path={} payloadBytes={}", path, jsonBody.length());
        try {
            JsonNode response = aiEngineRestClient.post()
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
            long elapsedMs = (System.nanoTime() - startedAtNanos) / 1_000_000;
            int keyCount = response != null && response.isObject() ? response.size() : 0;
            log.info("AI-engine response path={} elapsedMs={} responseKeys={}", path, elapsedMs, keyCount);
            return response;
        } catch (RestClientResponseException e) {
            String snippet = e.getResponseBodyAsString();
            if (snippet != null && snippet.length() > 500) {
                snippet = snippet.substring(0, 500) + "…";
            }
            long elapsedMs = (System.nanoTime() - startedAtNanos) / 1_000_000;
            log.warn("AI-engine {} HTTP {} elapsedMs={}: {}", path, e.getStatusCode().value(), elapsedMs, snippet);
            throw new BusinessException(
                    "AI-engine planning request failed (" + path + "): HTTP "
                            + e.getStatusCode().value()
                            + (snippet == null || snippet.isBlank() ? "" : (": " + snippet)),
                    e
            );
        } catch (RestClientException e) {
            long elapsedMs = (System.nanoTime() - startedAtNanos) / 1_000_000;
            log.warn("AI-engine {} transport error elapsedMs={}: {}", path, elapsedMs, e.getMessage());
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
