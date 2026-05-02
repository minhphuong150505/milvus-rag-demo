package com.example.ragbot.model;

public record RetrievedChunk(
        Long id,
        String text,
        String sourceUrl,
        String sourceType,
        Integer page,
        Integer chunkIndex,
        String docTitle,
        Double score
) {
}
