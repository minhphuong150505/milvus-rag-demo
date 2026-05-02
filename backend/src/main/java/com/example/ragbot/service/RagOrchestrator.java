package com.example.ragbot.service;

import com.example.ragbot.config.RagProperties;
import com.example.ragbot.dto.ChatRequest;
import com.example.ragbot.dto.ChatResponse;
import com.example.ragbot.dto.SourceDto;
import com.example.ragbot.model.RetrievedChunk;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RagOrchestrator {

    private final EmbeddingService embeddingService;
    private final RetrievalService retrievalService;
    private final PromptBuilder promptBuilder;
    private final LlmService llmService;
    private final RagProperties properties;

    public RagOrchestrator(
            EmbeddingService embeddingService,
            RetrievalService retrievalService,
            PromptBuilder promptBuilder,
            LlmService llmService,
            RagProperties properties
    ) {
        this.embeddingService = embeddingService;
        this.retrievalService = retrievalService;
        this.promptBuilder = promptBuilder;
        this.llmService = llmService;
        this.properties = properties;
    }

    public ChatResponse answer(ChatRequest request) {
        long startedAt = System.currentTimeMillis();
        int topK = request.topK() == null ? properties.topK() : request.topK();
        topK = Math.max(1, Math.min(topK, 20));

        List<Float> queryVector = embeddingService.embed(request.question());
        List<RetrievedChunk> chunks = retrievalService.searchTopK(queryVector, topK);
        List<RetrievedChunk> evidence = chunks.stream()
                .filter(chunk -> chunk.score() != null && chunk.score() >= properties.scoreThreshold())
                .toList();

        if (evidence.isEmpty()) {
            return new ChatResponse(
                    properties.fallbackAnswer(),
                    List.of(),
                    false,
                    System.currentTimeMillis() - startedAt
            );
        }

        String prompt = promptBuilder.build(request.question(), evidence);
        String answer = llmService.chat(prompt).trim();
        List<SourceDto> sources = evidence.stream()
                .map(this::toSourceDto)
                .toList();

        return new ChatResponse(
                answer,
                sources,
                true,
                System.currentTimeMillis() - startedAt
        );
    }

    private SourceDto toSourceDto(RetrievedChunk chunk) {
        String snippet = normalizeWhitespace(chunk.text());
        if (snippet.length() > 200) {
            snippet = snippet.substring(0, 200) + "...";
        }
        return new SourceDto(
                chunk.docTitle(),
                chunk.sourceUrl(),
                chunk.page(),
                chunk.score(),
                snippet
        );
    }

    private String normalizeWhitespace(String text) {
        if (text == null) {
            return "";
        }
        return text.replaceAll("\\s+", " ").trim();
    }
}
