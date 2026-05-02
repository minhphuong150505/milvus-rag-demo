package com.example.ragbot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ollama")
public record OllamaProperties(
        String baseUrl,
        String apiKey,
        String embedBaseUrl,
        String embedApiKey,
        String chatModel,
        String embedModel,
        String chatPath,
        String embedPath,
        double temperature
) {
}
