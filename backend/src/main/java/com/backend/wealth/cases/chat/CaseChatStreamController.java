package com.backend.wealth.cases.chat;

import com.backend.wealth.cases.chat.model.CaseChatThread;
import com.backend.wealth.cases.chat.stream.CaseChatNdjsonWriter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.UUID;

/**
 * NDJSON streaming for case chat. Non-streaming turn remains
 * {@link CaseChatController#postMessage} ({@code POST .../chat/messages}).
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class CaseChatStreamController {

    private final CaseChatService caseChatService;
    private final ObjectMapper objectMapper;

    @PostMapping(
            value = "/api/cases/{caseId}/chat/messages/stream",
            produces = "application/x-ndjson"
    )
    public ResponseEntity<StreamingResponseBody> streamMessages(
            @PathVariable UUID caseId,
            @RequestBody CaseChatController.ChatSendRequest body,
            Authentication authentication
    ) {
        // Transactional prep must finish before async stream starts (avoids committed-response errors).
        CaseChatThread t = caseChatService.ensureThreadPersisted(caseId);
        UUID threadId = body.threadId() != null ? body.threadId() : t.getId();
        CaseChatService.CatalogStreamPrep prep = caseChatService.prepareCatalogStreamTurn(
                caseId,
                threadId,
                body.phaseCode(),
                body.assessmentCode(),
                body.message(),
                body.visibility(),
                body.autoDetectIntent(),
                body.attachmentIds(),
                authentication
        );
        log.info(
                "Case chat stream prep done caseId={} threadId={} userMessageId={} kind={} assessment={} intent={}",
                caseId,
                threadId,
                prep.userMessageId(),
                prep.streamKind(),
                prep.effectiveAssessment(),
                prep.intentCode()
        );

        StreamingResponseBody stream = outputStream -> {
            try {
                outputStream.flush();
                caseChatService.streamNdjsonToClient(prep, outputStream);
            } catch (Exception ex) {
                log.warn("Case chat stream failed caseId={}: {}", caseId, ex.getMessage());
                CaseChatNdjsonWriter.writeErrorAndDone(
                        outputStream,
                        objectMapper,
                        ex.getMessage() != null ? ex.getMessage() : "Stream failed."
                );
            }
        };

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/x-ndjson"))
                .header("Cache-Control", "no-cache, no-transform")
                .header("X-Accel-Buffering", "no")
                .body(stream);
    }
}
