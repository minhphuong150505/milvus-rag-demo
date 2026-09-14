package com.example.ragbot.service;

import com.example.ragbot.config.RagProperties;
import com.example.ragbot.dto.*;
import com.example.ragbot.model.RetrievedChunk;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.function.Consumer;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RagOrchestratorTest {
    EmbeddingService embed = mock(EmbeddingService.class);
    RetrievalService retrieval = mock(RetrievalService.class);
    LlmService llm = mock(LlmService.class);
    RagProperties properties = new RagProperties("FPT", 5, .5, 6000, "Tôi không tìm thấy thông tin này trong tài liệu của doanh nghiệp.");
    RagOrchestrator rag = new RagOrchestrator(embed, retrieval, new PromptBuilder(properties), llm, properties, new CandidateReranker());
    RetrievedChunk chunk = new RetrievedChunk(1L, "FPT hoạt động trong lĩnh vực công nghệ. ".repeat(10), "https://fpt.com", "web", 2, 0, "Giới thiệu FPT", .9);
    @BeforeEach void setup() { when(embed.embed(anyString())).thenReturn(List.of(.1f)); when(retrieval.searchTopK(anyList(), anyInt())).thenReturn(List.of(chunk)); }
    @Test void oldContractAndFullSource() {
        when(llm.chat(anyString())).thenReturn("Công nghệ [1]");
        ChatResponse response = rag.answer(new ChatRequest("FPT làm gì?", null, null));
        assertThat(response.grounded()).isTrue();
        assertThat(response.sources().get(0).chunkText()).isEqualTo(chunk.text());
        assertThat(response.sources().get(0).snippet()).hasSize(203);
        assertThat(response.sources().get(0).sourceType()).isEqualTo("web");
        verify(retrieval).searchTopK(List.of(.1f), 64);
    }
    @Test void noEvidenceDoesNotCallLlm() {
        when(retrieval.searchTopK(anyList(), anyInt())).thenReturn(List.of());
        ChatResponse response = rag.answer(new ChatRequest("Thời tiết Hà Nội hôm nay?", null, 3));
        assertThat(response.grounded()).isFalse();
        assertThat(response.sources()).isEmpty();
        verifyNoInteractions(llm);
    }
    @Test void lowScoresAreExcluded() {
        when(retrieval.searchTopK(anyList(), anyInt())).thenReturn(List.of(new RetrievedChunk(2L, "Weather", "", "text", 0, 0, "Other", .2)));
        assertThat(rag.answer(new ChatRequest("Thời tiết?", null, 1)).grounded()).isFalse();
        verifyNoInteractions(llm);
    }
    @Test void llmRefusalIsNotGrounded() {
        when(llm.chat(anyString())).thenReturn("Tôi không tìm thấy thông tin này trong tài liệu của công ty.");
        ChatResponse response = rag.answer(new ChatRequest("Thời tiết Hà Nội hôm nay?", null, 5));
        assertThat(response.grounded()).isFalse();
        assertThat(response.sources()).isEmpty();
    }
    @Test void historyHelpsFollowupAndIsIncludedInPrompt() {
        when(llm.chat(anyString())).thenReturn("Câu trả lời");
        rag.answer(new ChatRequest("Còn năm 2024?", null, 4, List.of(new HistoryMessage("user", "Doanh thu FPT năm 2023?"))));
        verify(embed).embed("Doanh thu FPT năm 2023?\nCòn năm 2024?");
        verify(llm).chat(contains("user: Doanh thu FPT năm 2023?"));
    }
    @Test void streamOrdersSourcesTokensDone() {
        doAnswer(invocation -> { Consumer<String> sink = invocation.getArgument(1); sink.accept("Xin "); sink.accept("chào [1]"); return null; }).when(llm).stream(anyString(), any());
        List<String> events = new ArrayList<>();
        List<Object> data = new ArrayList<>();
        rag.stream(new ChatRequest("FPT?", null, 5), (name, value) -> { events.add(name); data.add(value); });
        assertThat(events).containsExactly("sources", "token", "token", "done");
        assertThat(((ChatResponse)data.get(3)).answer()).isEqualTo("Xin chào [1]");
        assertThat(((ChatResponse)data.get(3)).grounded()).isTrue();
    }
    @Test void fallbackStreamsAndFinishesUngrounded() {
        when(retrieval.searchTopK(anyList(), anyInt())).thenReturn(List.of());
        List<String> events = new ArrayList<>();
        rag.stream(new ChatRequest("Thời tiết?", null, 5), (name, value) -> { events.add(name); if (name.equals("done")) assertThat(((ChatResponse)value).grounded()).isFalse(); });
        assertThat(events).containsExactly("sources", "token", "done");
    }
    @Test void streamFailureNeverSendsDone() {
        doThrow(new IllegalStateException("failure")).when(llm).stream(anyString(), any());
        List<String> events = new ArrayList<>();
        assertThatThrownBy(() -> rag.stream(new ChatRequest("FPT?", null, 5), (name, value) -> events.add(name))).isInstanceOf(IllegalStateException.class);
        assertThat(events).containsExactly("sources");
    }
}
