package com.example.ragbot.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.core.task.TaskRejectedException;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, Object>> handleValidation(Exception exception) {
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_JSON).body(Map.of("error", "Câu hỏi tối đa 2000 ký tự, Top K từ 1–20, lịch sử tối đa 12 tin nhắn (4000 ký tự mỗi tin).", "code", "INVALID_REQUEST"));
    }
    @ExceptionHandler({AsyncRequestTimeoutException.class, org.springframework.web.client.ResourceAccessException.class})
    public ResponseEntity<Map<String, Object>> handleTimeout(Exception exception) {
        return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).contentType(MediaType.APPLICATION_JSON).body(Map.of("error", "Dịch vụ phản hồi quá lâu. Vui lòng thử lại.", "code", "UPSTREAM_TIMEOUT"));
    }
    @ExceptionHandler(TaskRejectedException.class)
    public ResponseEntity<Map<String, Object>> handleBusy(Exception exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).contentType(MediaType.APPLICATION_JSON).body(Map.of("error", "Dịch vụ đang bận. Vui lòng thử lại sau.", "code", "SERVICE_BUSY"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).contentType(MediaType.APPLICATION_JSON).body(Map.of("error", "Dịch vụ trả lời tạm thời không khả dụng. Vui lòng thử lại.", "code", "UPSTREAM_ERROR"));
    }
}
