package com.example.ragbot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class OllamaStreamParserTest {
    OllamaStreamParser parser = new OllamaStreamParser(new ObjectMapper());
    InputStream input(String text) { return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)); }
    @Test void parsesVietnameseAndFinalTokenAcrossByteBoundaries() throws Exception {
        String text = "\n{\"message\":{\"content\":\"Tiếng Việt \"},\"done\":false}\r\n{\"message\":{\"content\":\"[1]\"},\"done\":true}";
        InputStream split = new FilterInputStream(input(text)) { @Override public int read(byte[] b, int off, int len) throws IOException { return super.read(b, off, Math.min(len, 1)); } };
        List<String> tokens = new ArrayList<>();
        parser.parse(split, tokens::add);
        assertThat(tokens).containsExactly("Tiếng Việt ", "[1]");
    }
    @Test void supportsGenerateResponseAndIgnoresThinking() throws Exception {
        List<String> tokens = new ArrayList<>();
        parser.parse(input("{\"message\":{\"thinking\":\"private\"}}\n{\"response\":\"answer\",\"done\":true}\n"), tokens::add);
        assertThat(tokens).containsExactly("answer");
    }
    @Test void rejectsErrorFrameWithoutExposingUpstreamMessage() {
        assertThatThrownBy(() -> parser.parse(input("{\"error\":\"sensitive upstream body\"}\n"), t -> {})).isInstanceOf(IOException.class).hasMessageNotContaining("sensitive");
    }
    @Test void rejectsTruncatedStream() { assertThatThrownBy(() -> parser.parse(input("{\"message\":{\"content\":\"partial\"}}\n"), t -> {})).isInstanceOf(EOFException.class); }
    @Test void rejectsMalformedJson() { assertThatThrownBy(() -> parser.parse(input("bad json\n"), t -> {})).isInstanceOf(IOException.class); }
    @Test void boundsFrameSize() { assertThatThrownBy(() -> parser.parse(input("x".repeat(65537)), t -> {})).isInstanceOf(IOException.class).hasMessageContaining("limit"); }
    @Test void propagatesClientDisconnect() { assertThatThrownBy(() -> parser.parse(input("{\"response\":\"answer\",\"done\":true}\n"), t -> { throw new UncheckedIOException(new IOException("disconnected")); })).isInstanceOf(UncheckedIOException.class); }
}
