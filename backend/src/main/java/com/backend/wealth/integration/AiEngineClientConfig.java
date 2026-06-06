package com.backend.wealth.integration;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class AiEngineClientConfig {

    @Bean
    @Qualifier("aiEngineRestClient")
    public RestClient aiEngineRestClient(@Value("${wealth.ai-engine.base-url:http://localhost:8010}") String baseUrl) {
        String normalized = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return RestClient.builder().baseUrl(normalized).build();
    }
}
