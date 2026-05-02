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

@Validated
@RestController
@RequestMapping("/api")
public class ChatController {

    private final RagOrchestrator ragOrchestrator;

    public ChatController(RagOrchestrator ragOrchestrator) {
        this.ragOrchestrator = ragOrchestrator;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return ragOrchestrator.answer(request);
    }
}
