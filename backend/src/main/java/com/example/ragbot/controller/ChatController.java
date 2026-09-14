package com.example.ragbot.controller;

import com.example.ragbot.dto.ChatRequest;
import com.example.ragbot.dto.ChatResponse;
import com.example.ragbot.service.RagOrchestrator;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@Validated
@RestController
@RequestMapping("/api")
public class ChatController {

    private final RagOrchestrator ragOrchestrator;
    private final ObjectMapper mapper;

    public ChatController(RagOrchestrator ragOrchestrator, ObjectMapper mapper) {
        this.ragOrchestrator = ragOrchestrator;
        this.mapper = mapper;
    }

    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> stream(@Valid @RequestBody ChatRequest request) {
        StreamingResponseBody body = output -> {
            java.util.function.BiConsumer<String, Object> send = (event, data) -> {
                try {
                    output.write(("event: " + event + "\ndata: " + mapper.writeValueAsString(data) + "\n\n").getBytes(StandardCharsets.UTF_8));
                    output.flush();
                } catch (IOException exception) { throw new UncheckedIOException(exception); }
            };
            try { ragOrchestrator.stream(request, send); }
            catch (UncheckedIOException disconnected) { throw disconnected.getCause(); }
            catch (Exception exception) {
                send.accept("error", Map.of("error", "Dịch vụ trả lời tạm thời không khả dụng. Vui lòng thử lại.", "code", "UPSTREAM_ERROR"));
            }
        };
        return ResponseEntity.ok().contentType(new MediaType("text", "event-stream", StandardCharsets.UTF_8)).header("Cache-Control", "no-cache").header("X-Accel-Buffering", "no").body(body);
    }

    @PostMapping(value = "/chat", produces = MediaType.APPLICATION_JSON_VALUE)
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return ragOrchestrator.answer(request);
    }
}
