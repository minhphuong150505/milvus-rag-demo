package com.example.ragbot.service;

import com.example.ragbot.config.OllamaProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class LlmService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE =
            new ParameterizedTypeReference<>() {
            };

    private final RestClient ollamaRestClient;
    private final OllamaProperties properties;

    public LlmService(@Qualifier("ollamaRestClient") RestClient ollamaRestClient, OllamaProperties properties) {
        this.ollamaRestClient = ollamaRestClient;
        this.properties = properties;
    }

    public String chat(String prompt) {
        Map<String, Object> body = Map.of(
                "model", properties.chatModel(),
                "messages", List.of(Map.of("role", "user", "content", prompt)),
                "stream", false,
                "options", Map.of("temperature", properties.temperature())
        );

        Map<String, Object> response = ollamaRestClient.post()
                .uri(properties.chatPath())
                .body(body)
                .retrieve()
                .body(MAP_RESPONSE);

        if (response == null) {
            throw new IllegalStateException("Empty LLM response");
        }

        return extractContent(response);
    }

    private String extractContent(Map<String, Object> response) {
        Object message = response.get("message");
        if (message instanceof Map<?, ?> map && map.get("content") instanceof String content) {
            return content;
        }

        Object direct = response.get("response");
        if (direct instanceof String content) {
            return content;
        }

        Object choices = response.get("choices");
        if (choices instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object choiceMessage = first.get("message");
            if (choiceMessage instanceof Map<?, ?> map && map.get("content") instanceof String content) {
                return content;
            }
            if (first.get("text") instanceof String content) {
                return content;
            }
        }

        throw new IllegalStateException("LLM response did not include answer content");
    }
}
