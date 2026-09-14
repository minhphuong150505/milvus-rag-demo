package com.example.ragbot.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record ChatRequest(
        @NotBlank @Size(max = 2000) String question,
        @Size(max = 100) String sessionId,
        @Min(1) @Max(20) Integer topK,
        @Size(max = 12) List<@NotNull @Valid HistoryMessage> history
) {
    public ChatRequest(String question, String sessionId, Integer topK) {
        this(question, sessionId, topK, List.of());
    }
    public ChatRequest {
        history = history == null ? List.of() : List.copyOf(history);
    }
}
