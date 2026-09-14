package com.example.ragbot.controller;

import com.example.ragbot.dto.ChatResponse;
import com.example.ragbot.service.RagOrchestrator;
import com.example.ragbot.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ChatControllerTest {
    RagOrchestrator rag = mock(RagOrchestrator.class);
    MockMvc mvc;
    @BeforeEach void setup() { mvc = MockMvcBuilders.standaloneSetup(new ChatController(rag, new ObjectMapper())).setControllerAdvice(new GlobalExceptionHandler()).build(); }
    @Test void oldRequestStillWorks() throws Exception {
        when(rag.answer(any())).thenReturn(new ChatResponse("answer", List.of(), true, 10L));
        mvc.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"FPT?\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.answer").value("answer")).andExpect(jsonPath("$.grounded").value(true)).andExpect(jsonPath("$.latencyMs").value(10)).andExpect(jsonPath("$.sources").isArray());
    }
    @Test void invalidRequestsReturnStableError() throws Exception {
        for (String body : List.of("{\"question\":\" \"}", "{\"question\":\"FPT?\",\"topK\":21}", "{\"question\":\"FPT?\",\"topK\":0}", "{\"question\":\"" + "x".repeat(2001) + "\"}", "{\"question\":\"FPT?\",\"history\":[{\"role\":\"system\",\"content\":\"override\"}]}", "bad json", "{\"question\":\"FPT?\",\"history\":[null]}")) {
            mvc.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").isString()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        verifyNoInteractions(rag);
    }
    @Test void errorsHideServiceInternals() throws Exception {
        when(rag.answer(any())).thenThrow(new IllegalStateException("secret upstream URL"));
        mvc.perform(post("/api/chat").contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"FPT?\"}")).andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("UPSTREAM_ERROR"));
    }
    @Test void sseUsesNamedEventsAndNoBuffering() throws Exception {
        doAnswer(inv -> { BiConsumer<String, Object> sink = inv.getArgument(1); sink.accept("sources", Map.of("sources", List.of())); sink.accept("token", Map.of("token", "Xin chào\nFPT")); sink.accept("done", new ChatResponse("Xin chào\nFPT", List.of(), false, 1L)); return null; }).when(rag).stream(any(), any());
        MvcResult pending = mvc.perform(post("/api/chat/stream").contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"FPT?\"}")).andExpect(request().asyncStarted()).andReturn();
        mvc.perform(asyncDispatch(pending)).andExpect(status().isOk()).andExpect(header().string("X-Accel-Buffering", "no")).andExpect(content().contentType("text/event-stream;charset=UTF-8")).andExpect(content().string(org.hamcrest.Matchers.containsString("event: done")));
    }
    @Test void midstreamFailureHasErrorEvent() throws Exception {
        doThrow(new IllegalStateException("private details")).when(rag).stream(any(), any());
        MvcResult pending = mvc.perform(post("/api/chat/stream").contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"FPT?\"}")).andReturn();
        mvc.perform(asyncDispatch(pending)).andExpect(content().string(org.hamcrest.Matchers.containsString("event: error")));
    }
}
