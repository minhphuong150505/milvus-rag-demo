package com.example.ragbot.dto;

import java.util.List;

public record ChatResponse(
        String answer,
        List<SourceDto> sources,
        boolean grounded,
        Long latencyMs
) {
}
