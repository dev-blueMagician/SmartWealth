package com.backend.wealth.integration;

import com.backend.wealth.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Long-lived HTTP streaming calls to AI-engine (NDJSON). Uses {@link HttpClient} so response bytes
 * are forwarded as they arrive (RestClient exchange can buffer or delay stream bodies).
 */
@Slf4j
@Service
public class AiEngineHttpStreamClient {

    private final HttpClient httpClient;
    private final String configuredBaseUrl;
    private final String internalToken;

    public AiEngineHttpStreamClient(
            @Value("${wealth.ai-engine.base-url:http://localhost:8010}") String configuredBaseUrl,
            @Value("${wealth.ai-engine.internal-token:}") String internalToken
    ) {
        this.configuredBaseUrl = trimSlash(configuredBaseUrl);
        this.internalToken = internalToken;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        log.info("AI-engine HTTP stream client configured for base URL {}", this.configuredBaseUrl);
    }

    /**
     * POST JSON to AI-engine and return the raw response body stream (caller must close).
     */
    public InputStream openPostStream(String path, String jsonBody) {
        String uriPath = path.startsWith("/") ? path : "/" + path;
        URI uri = URI.create(configuredBaseUrl + uriPath);
        try {
            HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMinutes(15))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/x-ndjson")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8));
            if (internalToken != null && !internalToken.isBlank()) {
                req.header("X-Internal-Token", internalToken);
            }
            HttpResponse<InputStream> response = httpClient.send(req.build(), HttpResponse.BodyHandlers.ofInputStream());
            int status = response.statusCode();
            if (status >= 200 && status < 300) {
                InputStream body = response.body();
                if (body == null) {
                    throw new BusinessException(
                            "AI-engine stream returned empty body (" + uriPath + ")."
                    );
                }
                log.info("AI-engine stream connected {} HTTP {}", uriPath, status);
                return body;
            }
            String snippet = "";
            try (InputStream err = response.body()) {
                if (err != null) {
                    snippet = new String(err.readAllBytes(), StandardCharsets.UTF_8);
                    if (snippet.length() > 800) {
                        snippet = snippet.substring(0, 800) + "…";
                    }
                }
            } catch (Exception ignored) {
                // ignore
            }
            log.warn("AI-engine stream {} HTTP {}: {}", uriPath, status, snippet);
            throw new BusinessException(
                    "AI-engine stream failed (" + uriPath + "): HTTP " + status
                            + (snippet.isBlank() ? "" : (": " + snippet))
            );
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            String detail = describeError(e);
            log.warn("AI-engine stream {} transport error [{}]: {}", uriPath, detail, e.toString());
            throw new BusinessException(
                    "Could not reach AI-engine at " + configuredBaseUrl + uriPath
                            + ". " + detail
                            + " — ensure AI-engine is running and WEALTH_AI_ENGINE_BASE_URL matches.",
                    e
            );
        }
    }

    private static String describeError(Throwable e) {
        if (e == null) {
            return "unknown error";
        }
        String msg = e.getMessage();
        if (msg != null && !msg.isBlank()) {
            return msg;
        }
        Throwable cause = e.getCause();
        if (cause != null && cause != e) {
            return cause.getClass().getSimpleName() + ": " + describeError(cause);
        }
        return e.getClass().getSimpleName();
    }

    private static String trimSlash(String url) {
        if (url == null || url.isBlank()) {
            return "http://localhost:8010";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
