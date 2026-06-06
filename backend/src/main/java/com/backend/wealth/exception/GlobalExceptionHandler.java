package com.backend.wealth.exception;

import com.backend.wealth.openapi.model.CoreErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import jakarta.servlet.http.HttpServletResponse;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<CoreErrorResponse> handleBusiness(BusinessException ex) {
        if (isUpstreamUnreachable(ex)) {
            return build(HttpStatus.SERVICE_UNAVAILABLE, "UPSTREAM_UNAVAILABLE", ex.getMessage());
        }
        return build(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", ex.getMessage());
    }

    /**
     * AI-engine / other HTTP clients wrapped as {@link BusinessException#getCause()}.
     */
    private static boolean isUpstreamUnreachable(Throwable ex) {
        Throwable t = ex;
        while (t != null) {
            if (t instanceof ResourceAccessException) {
                return true;
            }
            if (t instanceof ConnectException || t instanceof UnknownHostException || t instanceof SocketTimeoutException) {
                return true;
            }
            Throwable cause = t.getCause();
            if (cause == t) {
                break;
            }
            t = cause;
        }
        String msg = ex.getMessage();
        if (msg != null) {
            String lower = msg.toLowerCase();
            if (lower.contains("connection refused") || lower.contains("failed to connect")) {
                return true;
            }
        }
        return false;
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<CoreErrorResponse> handleNotFound(NotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<CoreErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT, "CONFLICT",
                "Operation conflicts with existing data (e.g. foreign key). Remove dependent rows first.");
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<CoreErrorResponse> handleBadCredentials(BadCredentialsException ex) {
        return build(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid username or password.");
    }

    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            BindException.class,
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class
    })
    public ResponseEntity<CoreErrorResponse> handleValidation(Exception ex) {
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Invalid request data. Please verify input format and required fields.");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<CoreErrorResponse> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Uploaded file exceeds the maximum allowed size.");
    }

    @ExceptionHandler(AsyncRequestTimeoutException.class)
    public ResponseEntity<CoreErrorResponse> handleAsyncTimeout(
            AsyncRequestTimeoutException ex,
            HttpServletResponse response
    ) {
        if (response.isCommitted()) {
            log.warn(
                    "Async request timed out after response started (increase wealth.case-chat.stream-async-timeout-ms for long streams)"
            );
            return null;
        }
        log.warn("Async request timed out: {}", ex.getMessage());
        return build(HttpStatus.SERVICE_UNAVAILABLE, "STREAM_TIMEOUT",
                "The request took too long. Retry or increase server async timeout for chat streaming.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<CoreErrorResponse> handleSystem(Exception ex, HttpServletResponse response) {
        if (response.isCommitted()) {
            log.warn("Skipping error response; HTTP response already committed ({})", ex.getClass().getSimpleName());
            return null;
        }
        log.error("Unhandled system error", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR",
                "Unexpected system error occurred. Please retry or contact support.");
    }

    private ResponseEntity<CoreErrorResponse> build(HttpStatus status, String code, String message) {
        CoreErrorResponse body = new CoreErrorResponse();
        body.setCode(code);
        body.setMessage(message);
        return ResponseEntity.status(status).body(body);
    }
}
