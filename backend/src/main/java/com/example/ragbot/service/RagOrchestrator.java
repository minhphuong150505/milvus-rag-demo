package com.example.ragbot.service;

import com.example.ragbot.config.RagProperties;
import com.example.ragbot.dto.*;
import com.example.ragbot.model.RetrievedChunk;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.BiConsumer;

@Service
public class RagOrchestrator {
    private final EmbeddingService embeddingService;
    private final RetrievalService retrievalService;
    private final PromptBuilder promptBuilder;
    private final LlmService llmService;
    private final RagProperties properties;
    private final CandidateReranker reranker;

    public RagOrchestrator(EmbeddingService embeddingService, RetrievalService retrievalService,
                           PromptBuilder promptBuilder, LlmService llmService, RagProperties properties, CandidateReranker reranker) {
        this.embeddingService = embeddingService;
        this.retrievalService = retrievalService;
        this.promptBuilder = promptBuilder;
        this.llmService = llmService;
        this.properties = properties;
        this.reranker = reranker;
    }

    public ChatResponse answer(ChatRequest request) {
        return answer(request, null);
    }

    public void stream(ChatRequest request, BiConsumer<String, Object> events) {
        ChatResponse response = answer(request, events);
        events.accept("done", response);
    }

    private ChatResponse answer(ChatRequest request, BiConsumer<String, Object> events) {
        long startedAt = System.nanoTime();
        int topK = request.topK() == null ? properties.topK() : request.topK();
        String query = retrievalQuestion(request);
        List<Float> vector = embeddingService.embed(query);
        List<RetrievedChunk> candidates = retrievalService.searchTopK(vector, 64).stream()
                .filter(chunk -> chunk.score() != null && chunk.score() >= properties.scoreThreshold()).toList();
        List<RetrievedChunk> evidence = reranker.rank(query, candidates, Math.max(1, Math.min(topK, 20)));
        List<SourceDto> sources = evidence.stream().map(this::toSourceDto).toList();
        if (events != null) events.accept("sources", Map.of("sources", sources));
        String answer;
        if (evidence.isEmpty()) {
            answer = properties.fallbackAnswer();
            if (events != null) events.accept("token", Map.of("token", answer));
        } else {
            String prompt = promptBuilder.build(request.question(), evidence, request.history());
            if (events == null) answer = llmService.chat(prompt).trim();
            else {
                StringBuilder text = new StringBuilder();
                llmService.stream(prompt, token -> {
                    if (text.length() + token.length() > 32000) throw new IllegalStateException("Answer exceeds limit");
                    text.append(token);
                    events.accept("token", Map.of("token", token));
                });
                answer = text.toString().trim();
            }
            if (answer.isBlank()) throw new IllegalStateException("Empty answer");
        }
        boolean grounded = !evidence.isEmpty() && !isRefusal(answer);
        return new ChatResponse(answer, grounded ? sources : List.of(), grounded, (System.nanoTime() - startedAt) / 1_000_000);
    }

    private boolean isRefusal(String answer) {
        String normalized = answer.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return normalized.contains(properties.fallbackAnswer().toLowerCase(Locale.ROOT))
                || normalized.contains("tôi không tìm thấy thông tin")
                || normalized.contains("không có thông tin trong tài liệu");
    }

    private String retrievalQuestion(ChatRequest request) {
        String question = request.question().trim();
        // Include the last user turn only for explicit follow-up references.
        if (question.toLowerCase(Locale.ROOT).matches("^(còn |vậy |thế |họ |công ty đó |điều đó |năm đó ).*")) {
            for (int i = request.history().size() - 1; i >= 0; i--) {
                HistoryMessage message = request.history().get(i);
                if (message.role().equals("user")) return message.content().substring(0, Math.min(1000, message.content().length())) + "\n" + question;
            }
        }
        return question;
    }

    private SourceDto toSourceDto(RetrievedChunk chunk) {
        String text = chunk.text() == null ? "" : chunk.text();
        String snippet = text.replaceAll("\\s+", " ").trim();
        if (snippet.length() > 200) snippet = snippet.substring(0, 200) + "...";
        return new SourceDto(chunk.docTitle(), chunk.sourceUrl(), chunk.page(), chunk.score(), snippet, chunk.sourceType(), text);
    }
}
