package com.example.ragbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

@Component
public class OllamaStreamParser {
    private final ObjectMapper mapper;
    public OllamaStreamParser(ObjectMapper mapper) { this.mapper = mapper; }

    public void parse(InputStream stream, Consumer<String> tokens) throws IOException {
        try (Reader reader = new InputStreamReader(stream, StandardCharsets.UTF_8)) {
            StringBuilder line = new StringBuilder();
            int ch;
            while ((ch = reader.read()) != -1) {
                if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Stream cancelled");
                if (ch == '\n') {
                    if (process(line.toString(), tokens)) return;
                    line.setLength(0);
                } else {
                    if (line.length() >= 65536) throw new IOException("Ollama frame exceeds limit");
                    line.append((char) ch);
                }
            }
            if (!line.isEmpty() && process(line.toString(), tokens)) return;
            throw new EOFException("Ollama stream ended without done");
        }
    }
    private boolean process(String line, Consumer<String> tokens) throws IOException {
        if (line.isBlank()) return false;
        JsonNode node = mapper.readTree(line);
        if (node.has("error")) throw new IOException("Ollama stream returned an error");
        String content = node.path("message").path("content").asText(node.path("response").asText(""));
        if (!content.isEmpty()) tokens.accept(content);
        return node.path("done").asBoolean(false);
    }
}
