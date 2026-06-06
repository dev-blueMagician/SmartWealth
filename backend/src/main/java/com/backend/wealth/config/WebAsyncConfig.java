package com.backend.wealth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Streaming chat (LLM + catalog assessment) can exceed the servlet default async timeout (~30s).
 */
@Configuration
public class WebAsyncConfig implements WebMvcConfigurer {

    @Value("${wealth.case-chat.stream-async-timeout-ms:900000}")
    private long streamAsyncTimeoutMs;

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setDefaultTimeout(streamAsyncTimeoutMs);
    }
}
