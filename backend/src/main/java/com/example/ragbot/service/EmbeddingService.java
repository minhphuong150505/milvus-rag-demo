package com.example.ragbot.service;

import com.example.ragbot.config.OllamaProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class EmbeddingService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE =
            new ParameterizedTypeReference<>() {
            };

    private final RestClient ollamaRestClient;
    private final OllamaProperties properties;

    public EmbeddingService(
            @Qualifier("ollamaEmbeddingRestClient") RestClient ollamaEmbeddingRestClient,
            OllamaProperties properties
    ) {
        this.ollamaRestClient = ollamaEmbeddingRestClient;
        this.properties = properties;
    }

    public List<Float> embed(String text) {
        String normalized = text == null ? "" : text.trim();
        Map<String, Object> response = null;
        HttpClientErrorException lastException = null;

        List<EmbeddingRequest> requests = List.of(
                new EmbeddingRequest(properties.embedPath(), "input"),
                new EmbeddingRequest("/api/embed", "input"),
                new EmbeddingRequest("/api/embeddings", "prompt")
        );

        List<String> attempted = new ArrayList<>();
        for (EmbeddingRequest request : requests) {
            String attemptKey = normalizePath(request.path()) + ":" + request.textField();
            if (attempted.contains(attemptKey)) {
                continue;
            }
            attempted.add(attemptKey);

            try {
                response = requestEmbedding(request.path(), request.textField(), normalized);
                break;
            } catch (HttpClientErrorException exception) {
                if (!isFallbackCandidate(exception.getStatusCode())) {
                    throw exception;
                }
                lastException = exception;
            }
        }

        if (response == null) {
            if (lastException != null) {
                throw lastException;
            }
            throw new IllegalStateException("No embedding request was attempted");
        }
        return extractEmbedding(response);
    }

    private Map<String, Object> requestEmbedding(String path, String textField, String text) {
        Map<String, Object> body = Map.of(
                "model", properties.embedModel(),
                textField, text
        );

        Map<String, Object> response = ollamaRestClient.post()
                .uri(path)
                .body(body)
                .retrieve()
                .body(MAP_RESPONSE);

        if (response == null) {
            throw new IllegalStateException("Empty embedding response");
        }
        return response;
    }

    private boolean isFallbackCandidate(HttpStatusCode statusCode) {
        return statusCode.value() == 400 || statusCode.value() == 404 || statusCode.value() == 422;
    }

    private String normalizePath(String path) {
        return "/" + path.replaceAll("^/+|/+$", "");
    }

    private List<Float> extractEmbedding(Map<String, Object> response) {
        Object embedding = response.get("embedding");
        if (embedding instanceof List<?> values) {
            return toFloatList(values);
        }

        Object embeddings = response.get("embeddings");
        if (embeddings instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof List<?> values) {
            return toFloatList(values);
        }

        Object data = response.get("data");
        if (data instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object nested = first.get("embedding");
            if (nested instanceof List<?> values) {
                return toFloatList(values);
            }
        }

        throw new IllegalStateException("Embedding response did not include a vector");
    }

    private List<Float> toFloatList(List<?> values) {
        List<Float> floats = new ArrayList<>(values.size());
        for (Object value : values) {
            if (!(value instanceof Number number)) {
                throw new IllegalStateException("Embedding contains a non-numeric value");
            }
            floats.add(number.floatValue());
        }
        return floats;
    }

    private record EmbeddingRequest(String path, String textField) {
    }
}
