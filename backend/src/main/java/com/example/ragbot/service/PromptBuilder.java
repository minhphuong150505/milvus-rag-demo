package com.example.ragbot.service;

import com.example.ragbot.config.RagProperties;
import com.example.ragbot.model.RetrievedChunk;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PromptBuilder {

    private static final String SYSTEM_PROMPT = """
            Bạn là trợ lý AI của công ty %s. Nhiệm vụ của bạn là trả lời câu hỏi của khách hàng CHỈ DỰA VÀO phần CONTEXT được cung cấp bên dưới.

            QUY TẮC BẮT BUỘC:
            1. Nếu CONTEXT không chứa thông tin để trả lời câu hỏi, hãy nói chính xác: "Tôi không tìm thấy thông tin này trong tài liệu của công ty."
            2. KHÔNG được dùng kiến thức bên ngoài CONTEXT, kể cả khi bạn biết câu trả lời.
            3. KHÔNG được suy đoán, bịa đặt, hoặc bổ sung thông tin không có trong CONTEXT.
            4. Trả lời bằng tiếng Việt, ngắn gọn, đúng trọng tâm.
            5. Nếu CONTEXT có thông tin trái ngược nhau, hãy nêu cả hai và chỉ ra sự khác biệt.
            6. KHÔNG nhắc lại từ "CONTEXT" trong câu trả lời. Trả lời tự nhiên như nhân viên CSKH.
            """;

    private final RagProperties properties;

    public PromptBuilder(RagProperties properties) {
        this.properties = properties;
    }

    public String build(String question, List<RetrievedChunk> chunks) {
        String context = buildContext(chunks);
        return SYSTEM_PROMPT.formatted(properties.companyName())
                + "\nCONTEXT:\n---\n"
                + context
                + "---\n\nCÂU HỎI: "
                + question.trim()
                + "\n\nTRẢ LỜI:";
    }

    private String buildContext(List<RetrievedChunk> chunks) {
        StringBuilder context = new StringBuilder();
        int used = 0;
        int index = 1;

        for (RetrievedChunk chunk : chunks) {
            String page = chunk.page() != null && chunk.page() > 0 ? " - trang " + chunk.page() : "";
            String block = "[%d] (Nguồn: %s%s)%n%s%n%n".formatted(
                    index++,
                    safe(chunk.docTitle(), "Untitled"),
                    page,
                    safe(chunk.text(), "")
            );

            int remaining = properties.maxContextChars() - used;
            if (remaining <= 0) {
                break;
            }
            if (block.length() > remaining) {
                context.append(block, 0, Math.max(0, remaining));
                break;
            }
            context.append(block);
            used += block.length();
        }

        return context.toString();
    }

    private String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.strip();
    }
}
