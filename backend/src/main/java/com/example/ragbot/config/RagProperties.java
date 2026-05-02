package com.example.ragbot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "rag")
public record RagProperties(
        String companyName,
        int topK,
        double scoreThreshold,
        int maxContextChars,
        String fallbackAnswer
) {
}
