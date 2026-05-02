package com.example.ragbot.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Configuration
public class OllamaConfig {

    @Bean
    RestClient ollamaRestClient(OllamaProperties properties) {
        return buildClient(properties.baseUrl(), properties.apiKey());
    }

    @Bean
    RestClient ollamaEmbeddingRestClient(OllamaProperties properties) {
        return buildClient(properties.embedBaseUrl(), properties.embedApiKey());
    }

    private RestClient buildClient(String baseUrl, String apiKey) {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(baseUrl);

        if (StringUtils.hasText(apiKey)) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);
        }

        return builder.build();
    }
}
