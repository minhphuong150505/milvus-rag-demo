package com.example.ragbot.service;

import com.example.ragbot.config.RagProperties;
import com.example.ragbot.model.RetrievedChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PromptBuilderTest {

    @Test
    void buildIncludesQuestionAndTruncatesContext() {
        RagProperties properties = new RagProperties(
                "ACME",
                5,
                0.55,
                80,
                "fallback"
        );
        PromptBuilder builder = new PromptBuilder(properties);
        RetrievedChunk chunk = new RetrievedChunk(
                1L,
                "Chính sách đổi trả trong vòng 30 ngày với sản phẩm còn nguyên tem mác.",
                "https://example.com",
                "web",
                0,
                0,
                "Chính sách đổi trả",
                0.82
        );

        String prompt = builder.build("Đổi trả bao lâu?", List.of(chunk));

        assertThat(prompt).contains("ACME");
        assertThat(prompt).contains("Đổi trả bao lâu?");
        assertThat(prompt).contains("Chính sách đổi trả");
        assertThat(prompt).contains("TRẢ LỜI:");
    }
}
