package com.backend.wealth.cases.chat;

import com.backend.wealth.cases.chat.model.CaseChatMessage;
import com.backend.wealth.cases.chat.model.CaseChatThread;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CaseChatController {

    private final CaseChatService caseChatService;
    private final CaseChatAttachmentService caseChatAttachmentService;

    @GetMapping("/api/cases/{caseId}/chat/thread")
    public ChatThreadResponse getOrCreateThread(@PathVariable UUID caseId) {
        CaseChatThread t = caseChatService.ensureThreadPersisted(caseId);
        return new ChatThreadResponse(t.getId(), caseId, t.getChannel(), t.getCreatedAt(), t.getUpdatedAt());
    }

    @GetMapping("/api/cases/{caseId}/chat/messages")
    public List<ChatMessageResponse> listMessages(
            @PathVariable UUID caseId,
            @RequestParam UUID threadId,
            Authentication authentication
    ) {
        return caseChatService.listMessages(caseId, threadId, authentication).stream()
                .map(CaseChatController::toMessageDto)
                .toList();
    }

    @PostMapping("/api/cases/{caseId}/chat/detect-intent")
    public Map<String, Object> postDetectIntent(
            @PathVariable UUID caseId,
            @RequestBody ChatDetectIntentRequest body,
            Authentication authentication
    ) {
        CaseChatThread t = caseChatService.ensureThreadPersisted(caseId);
        UUID threadId = body.threadId() != null ? body.threadId() : t.getId();
        return caseChatService.detectIntent(caseId, threadId, body.message(), authentication);
    }

    @PostMapping(value = "/api/cases/{caseId}/chat/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CaseChatAttachmentService.ChatAttachmentUploadResponse postAttachment(
            @PathVariable UUID caseId,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "docKind", required = false) String docKind,
            Authentication authentication
    ) {
        return caseChatAttachmentService.upload(caseId, file, docKind, authentication);
    }

    @PatchMapping("/api/cases/{caseId}/chat/attachments/{caseDocumentId}/status")
    public CaseChatAttachmentService.DocumentReviewResponse patchAttachmentStatus(
            @PathVariable UUID caseId,
            @PathVariable UUID caseDocumentId,
            @RequestBody DocumentReviewRequest body,
            Authentication authentication
    ) {
        return caseChatAttachmentService.reviewDocument(caseId, caseDocumentId, body.status(), authentication);
    }

    @DeleteMapping("/api/cases/{caseId}/chat/messages")
    public Map<String, Object> deleteMessages(
            @PathVariable UUID caseId,
            @RequestParam UUID threadId,
            Authentication authentication
    ) {
        long deleted = caseChatService.clearChatHistory(caseId, threadId, authentication);
        return Map.of("threadId", threadId, "deletedCount", deleted);
    }

    @PostMapping("/api/cases/{caseId}/chat/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> postMessage(
            @PathVariable UUID caseId,
            @RequestBody ChatSendRequest body,
            Authentication authentication
    ) {
        CaseChatThread t = caseChatService.ensureThreadPersisted(caseId);
        UUID threadId = body.threadId() != null ? body.threadId() : t.getId();
        return caseChatService.sendUserMessageAndRunAi(
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
    }

    private static ChatMessageResponse toMessageDto(CaseChatMessage m) {
        return new ChatMessageResponse(
                m.getId(),
                m.getThread().getId(),
                m.getSenderKind(),
                m.getActorRole(),
                m.getVisibility(),
                m.getPhaseCode(),
                m.getAssessmentCode(),
                m.getIntentCode(),
                m.getBody(),
                m.getContextSnapshot(),
                m.getAiPayload(),
                m.getCreatedAt()
        );
    }

    public record ChatThreadResponse(UUID id, UUID caseId, String channel, java.time.OffsetDateTime createdAt,
                                     java.time.OffsetDateTime updatedAt) {
    }

    public record ChatMessageResponse(
            UUID id,
            UUID threadId,
            String senderKind,
            String actorRole,
            String visibility,
            String phaseCode,
            String assessmentCode,
            String intentCode,
            String body,
            Map<String, Object> contextSnapshot,
            Map<String, Object> aiPayload,
            java.time.OffsetDateTime createdAt
    ) {
    }

    public record ChatDetectIntentRequest(UUID threadId, String message) {
    }

    public record DocumentReviewRequest(String status) {
    }

    /**
     * @param phaseCode      optional override; defaults to {@code WealthCase.phase}
     * @param assessmentCode optional override; when null and autoDetectIntent, filled from detect-intent
     * @param autoDetectIntent when null or true, calls AI-engine detect-intent before turn
     * @param attachmentIds  optional {@code case_document.id} values from {@code POST .../chat/attachments}
     *                         <p>For token-by-token NDJSON, use {@code POST .../chat/messages/stream} instead.</p>
     */
    public record ChatSendRequest(
            UUID threadId,
            String phaseCode,
            String assessmentCode,
            String message,
            String visibility,
            Boolean autoDetectIntent,
            List<UUID> attachmentIds
    ) {
        public ChatSendRequest {
            attachmentIds = attachmentIds == null ? List.of() : List.copyOf(attachmentIds);
        }
    }
}
