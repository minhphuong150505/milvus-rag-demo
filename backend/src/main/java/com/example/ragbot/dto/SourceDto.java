package com.example.ragbot.dto;

public record SourceDto(
        String docTitle,
        String sourceUrl,
        Integer page,
        Double score,
        String snippet,
        String sourceType,
        String chunkText
) {}
