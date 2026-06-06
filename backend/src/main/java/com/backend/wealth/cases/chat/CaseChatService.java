package com.backend.wealth.cases.chat;

import com.backend.wealth.cases.chat.model.CaseChatMessage;
import com.backend.wealth.cases.chat.model.CaseChatThread;
import com.backend.wealth.cases.chat.repository.CaseChatMessageRepository;
import com.backend.wealth.cases.chat.repository.CaseChatThreadRepository;
import com.backend.wealth.cases.documents.model.CaseDocument;
import com.backend.wealth.cases.documents.model.StoredDocument;
import com.backend.wealth.cases.documents.repository.CaseDocumentRepository;
import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.cases.service.CaseChatPhaseTransitionService;
import com.backend.wealth.cases.chat.stream.CaseChatNdjsonWriter;
import com.backend.wealth.cases.chat.stream.CaseChatRunPhase;
import com.backend.wealth.cases.chat.stream.CaseChatStreamEvents;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.integration.AiEngineChatClient;
import com.backend.wealth.integration.AiEngineHttpStreamClient;
import com.backend.wealth.plan.model.FinancialPlan;
import com.backend.wealth.plan.repository.FinancialPlanRepository;
import com.backend.wealth.planning.dto.CreatePlanningDraftRequest;
import com.backend.wealth.planning.dto.PlanningDraftResponse;
import com.backend.wealth.planning.dto.RegeneratePlanningDraftRequest;
import com.backend.wealth.planning.model.PlanTemplate;
import com.backend.wealth.planning.repository.PlanTemplateRepository;
import com.backend.wealth.planning.service.PlanningDraftService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Locale;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CaseChatService {

    private static final String STREAM_EMPTY_ASSISTANT_FALLBACK =
            "Không tạo được phản hồi AI cho lượt này. Vui lòng thử lại.";

    private static final Set<String> STAFF_ROLES = Set.of("RM", "WM", "IM", "ADMIN");
    private static final int HISTORY_WINDOW = 30;
    private static final int MAX_BODY_CHARS_FOR_CONTEXT = 4000;

    private final WealthCaseRepository wealthCaseRepository;
    private final CaseChatThreadRepository caseChatThreadRepository;
    private final CaseChatMessageRepository caseChatMessageRepository;
    private final AiEngineChatClient aiEngineChatClient;
    private final ObjectMapper objectMapper;
    private final CaseChatPhaseTransitionService caseChatPhaseTransitionService;
    private final CaseDocumentRepository caseDocumentRepository;
    private final CaseChatAttachmentService caseChatAttachmentService;
    private final AiEngineHttpStreamClient aiEngineHttpStreamClient;
    private final PlatformTransactionManager transactionManager;
    private final PlanningDraftService planningDraftService;
    private final PlanTemplateRepository planTemplateRepository;
    private final FinancialPlanRepository financialPlanRepository;

    @Transactional
    public CaseChatThread ensureThreadPersisted(UUID caseId) {
        WealthCase c = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        return caseChatThreadRepository.findByWealthCase_IdAndChannel(caseId, CaseChatThread.DEFAULT_CHANNEL)
                .orElseGet(() -> caseChatThreadRepository.save(CaseChatThread.builder()
                        .wealthCase(c)
                        .channel(CaseChatThread.DEFAULT_CHANNEL)
                        .build()));
    }

    @Transactional
    public long clearChatHistory(UUID caseId, UUID threadId, Authentication authentication) {
        String actor = primaryRole(authentication);
        if (!isStaff(actor)) {
            throw new BusinessException("Clearing chat history requires a staff role (RM, WM, IM, ADMIN).");
        }
        CaseChatThread thread = resolveThread(caseId, threadId);
        long deleted = caseChatMessageRepository.deleteByThread_Id(thread.getId());
        thread.setUpdatedAt(java.time.OffsetDateTime.now());
        caseChatThreadRepository.save(thread);
        log.info("Cleared {} chat messages for caseId={} threadId={} by actor={}", deleted, caseId, threadId, actor);
        return deleted;
    }

    @Transactional(readOnly = true)
    public List<CaseChatMessage> listMessages(UUID caseId, UUID threadId, Authentication authentication) {
        if (!wealthCaseRepository.existsById(caseId)) {
            throw new NotFoundException("Case not found: " + caseId);
        }
        CaseChatThread thread = caseChatThreadRepository.findById(threadId)
                .orElseThrow(() -> new NotFoundException("Chat thread not found: " + threadId));
        if (!thread.getWealthCase().getId().equals(caseId)) {
            throw new BusinessException("Thread does not belong to this case");
        }
        String actor = primaryRole(authentication);
        boolean staff = isStaff(actor);
        return caseChatMessageRepository.findByThread_IdOrderByCreatedAtAsc(threadId).stream()
                .filter(m -> staff || !CaseChatMessage.VISIBILITY_INTERNAL.equals(m.getVisibility()))
                .toList();
    }

    /**
     * Intent routing for the next turn (does not persist a message). Uses prior persisted history + case phase.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> detectIntent(
            UUID caseId,
            UUID threadId,
            String message,
            Authentication authentication
    ) {
        if (message == null || message.isBlank()) {
            throw new BusinessException("message is required");
        }
        WealthCase c = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        CaseChatThread thread = resolveThread(caseId, threadId);
        String phase = resolvePhaseCode(null, c);
        List<Map<String, Object>> history = buildConversationHistoryForAi(thread.getId(), authentication);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("case_id", caseId.toString());
        body.put("phase_code", phase);
        body.put("user_message", message.trim());
        body.put("conversation_history", history);

        JsonNode node = aiEngineChatClient.postDetectIntent(body);
        return objectMapper.convertValue(node, new TypeReference<>() {});
    }

    @Transactional
    public Map<String, Object> sendUserMessageAndRunAi(
            UUID caseId,
            UUID threadId,
            String phaseCode,
            String assessmentCode,
            String message,
            String visibility,
            Boolean autoDetectIntent,
            List<UUID> attachmentIds,
            Authentication authentication
    ) {
        List<UUID> attachmentIdList = attachmentIds == null
                ? List.of()
                : attachmentIds.stream().distinct().toList();
        List<Map<String, Object>> attachmentDetails = resolveAttachmentDetails(caseId, attachmentIdList);
        String userMsgTrim = message == null ? "" : message.trim();
        if (userMsgTrim.isEmpty() && attachmentDetails.isEmpty()) {
            throw new BusinessException("message or attachmentIds is required");
        }
        String persistedUserBody = persistedUserBody(userMsgTrim, attachmentDetails);
        String aiUserMessage = effectiveUserTextForAi(userMsgTrim, attachmentDetails);

        WealthCase c = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        CaseChatThread thread = resolveThread(caseId, threadId);

        String actor = primaryRole(authentication);
        String vis = (visibility == null || visibility.isBlank())
                ? CaseChatMessage.VISIBILITY_ALL
                : visibility.trim().toUpperCase();
        if (CaseChatMessage.VISIBILITY_INTERNAL.equals(vis) && !isStaff(actor)) {
            throw new BusinessException("INTERNAL messages require a staff role");
        }

        List<Map<String, Object>> history = buildConversationHistoryForAi(thread.getId(), authentication);

        String effectivePhase = resolvePhaseCode(phaseCode, c);
        JsonNode detectJson = null;
        String intentCode = null;
        if (autoDetectIntent == null || autoDetectIntent) {
            try {
                Map<String, Object> detectBody = new LinkedHashMap<>();
                detectBody.put("case_id", caseId.toString());
                detectBody.put("phase_code", effectivePhase);
                detectBody.put("user_message", aiUserMessage);
                detectBody.put("conversation_history", history);
                detectJson = aiEngineChatClient.postDetectIntent(detectBody);
                if (detectJson != null && detectJson.hasNonNull("intent")) {
                    intentCode = detectJson.get("intent").asText();
                }
            } catch (BusinessException ex) {
                log.warn("Chat intent detection skipped/failed: {}", ex.getMessage());
            }
        }

        if ("CHANGE_PHASE".equals(intentCode)) {
            if (!isStaff(actor)) {
                throw new BusinessException(
                        "Changing case phase via chat requires a staff role (RM, WM, IM, ADMIN)."
                );
            }
            String llmTarget = extractTargetPhaseFromDetect(detectJson);
            CaseChatPhaseTransitionService.TransitionResult tr;
            try {
                tr = caseChatPhaseTransitionService.transition(
                        caseId,
                        userMsgTrim,
                        llmTarget
                );
            } catch (BusinessException ex) {
                log.info("Phase transition blocked caseId={}: {}", caseId, ex.getMessage());
                tr = new CaseChatPhaseTransitionService.TransitionResult(
                        effectivePhase, effectivePhase, "BLOCKED", ex.getMessage()
                );
            }

            WealthCase after = wealthCaseRepository.findById(caseId)
                    .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
            String newPhase = after.getPhase() != null ? after.getPhase().trim() : effectivePhase;

            UUID orchestrationRequestId = UUID.randomUUID();
            Map<String, Object> contextSnapshot = new LinkedHashMap<>();
            contextSnapshot.put("resolvedPhaseCode", effectivePhase);
            contextSnapshot.put("resolvedAssessmentCode", null);
            contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
            contextSnapshot.put("conversationHistoryForAi", history);
            if (detectJson != null) {
                contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
            }
            if (!attachmentDetails.isEmpty()) {
                contextSnapshot.put("attachments", attachmentDetails);
            }
            Map<String, Object> transitionSnap = new LinkedHashMap<>();
            transitionSnap.put("fromPhase", tr.fromPhase());
            transitionSnap.put("toPhase", tr.toPhase());
            transitionSnap.put("mode", tr.mode());
            transitionSnap.put("message", tr.message());
            contextSnapshot.put("phaseTransition", transitionSnap);

            CaseChatMessage userRow = CaseChatMessage.builder()
                    .thread(thread)
                    .senderKind(CaseChatMessage.SENDER_USER)
                    .actorRole(actor)
                    .visibility(vis)
                    .phaseCode(effectivePhase)
                    .assessmentCode(null)
                    .body(persistedUserBody)
                    .intentCode(intentCode)
                    .contextSnapshot(contextSnapshot)
                    .build();
            caseChatMessageRepository.save(userRow);

            Map<String, Object> payloadMap = new LinkedHashMap<>();
            payloadMap.put("change_phase", Boolean.TRUE);
            payloadMap.put("phase_transition", transitionSnap);

            String assistantBody;
            if ("BLOCKED".equals(tr.mode())) {
                assistantBody = narrateBlockedPhaseTransition(
                        aiUserMessage, effectivePhase, history, tr, payloadMap
                );
            } else {
                assistantBody = narrateSuccessfulPhaseTransition(
                        aiUserMessage, newPhase, history, tr, payloadMap
                );
            }

            CaseChatMessage asst = CaseChatMessage.builder()
                    .thread(thread)
                    .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                    .actorRole("AI_ENGINE")
                    .visibility(CaseChatMessage.VISIBILITY_ALL)
                    .phaseCode(newPhase)
                    .assessmentCode(null)
                    .intentCode(intentCode)
                    .body(assistantBody)
                    .aiPayload(payloadMap)
                    .build();
            caseChatMessageRepository.save(asst);

            thread.setUpdatedAt(java.time.OffsetDateTime.now());
            caseChatThreadRepository.save(thread);

            Map<String, Object> out = new HashMap<>();
            out.put("threadId", thread.getId());
            out.put("userMessageId", userRow.getId());
            out.put("assistantMessageId", asst.getId());
            out.put("resolvedPhaseCode", newPhase);
            out.put("resolvedAssessmentCode", null);
            out.put("intent", intentCode);
            out.put("orchestrationRequestId", orchestrationRequestId);
            out.put("detectIntent", detectJson != null ? objectMapper.convertValue(detectJson, new TypeReference<>() {}) : null);
            out.put("phaseTransition", transitionSnap);
            out.put("aiTurn", payloadMap);
            out.put("chatNarrate", payloadMap.get("chat_narrate"));
            return out;
        }

        if ("VERIFY_DOCUMENT".equals(intentCode)) {
            if (!isStaff(actor)) {
                throw new BusinessException(
                        "Verifying documents via chat requires a staff role (RM, WM, IM, ADMIN)."
                );
            }
            String verifyAction = extractVerifyActionFromDetect(detectJson);
            if (verifyAction == null) {
                verifyAction = "VERIFIED";
            }
            List<UUID> targetIds = attachmentIdList;
            if (targetIds.isEmpty()) {
                targetIds = caseDocumentRepository
                        .findAllByWealthCase_IdAndStatus(caseId, CaseDocument.STATUS_PENDING)
                        .stream()
                        .map(CaseDocument::getId)
                        .toList();
            }
            if (targetIds.isEmpty()) {
                throw new BusinessException("No PENDING documents found for this case to verify.");
            }
            List<Map<String, Object>> reviewResults = new ArrayList<>();
            for (UUID cdId : targetIds) {
                try {
                    CaseChatAttachmentService.DocumentReviewResponse rr =
                            caseChatAttachmentService.reviewDocument(caseId, cdId, verifyAction, authentication);
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("caseDocumentId", rr.caseDocumentId().toString());
                    m.put("docKind", rr.docKind());
                    m.put("previousStatus", rr.previousStatus());
                    m.put("currentStatus", rr.currentStatus());
                    reviewResults.add(m);
                } catch (Exception ex) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("caseDocumentId", cdId.toString());
                    m.put("error", ex.getMessage());
                    reviewResults.add(m);
                }
            }

            UUID orchestrationRequestId = UUID.randomUUID();
            Map<String, Object> contextSnapshot = new LinkedHashMap<>();
            contextSnapshot.put("resolvedPhaseCode", effectivePhase);
            contextSnapshot.put("resolvedAssessmentCode", null);
            contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
            contextSnapshot.put("conversationHistoryForAi", history);
            if (detectJson != null) {
                contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
            }
            contextSnapshot.put("documentReview", reviewResults);

            CaseChatMessage userRow = CaseChatMessage.builder()
                    .thread(thread)
                    .senderKind(CaseChatMessage.SENDER_USER)
                    .actorRole(actor)
                    .visibility(vis)
                    .phaseCode(effectivePhase)
                    .assessmentCode(null)
                    .body(persistedUserBody)
                    .intentCode(intentCode)
                    .contextSnapshot(contextSnapshot)
                    .build();
            caseChatMessageRepository.save(userRow);

            Map<String, Object> payloadMap = new LinkedHashMap<>();
            payloadMap.put("verify_document", Boolean.TRUE);
            payloadMap.put("verify_action", verifyAction);
            payloadMap.put("review_results", reviewResults);

            String assistantBody = narrateDocumentReview(
                    aiUserMessage, effectivePhase, verifyAction, reviewResults, history, payloadMap
            );

            CaseChatMessage asst = CaseChatMessage.builder()
                    .thread(thread)
                    .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                    .actorRole("AI_ENGINE")
                    .visibility(CaseChatMessage.VISIBILITY_ALL)
                    .phaseCode(effectivePhase)
                    .assessmentCode(null)
                    .intentCode(intentCode)
                    .body(assistantBody)
                    .aiPayload(payloadMap)
                    .build();
            caseChatMessageRepository.save(asst);

            thread.setUpdatedAt(java.time.OffsetDateTime.now());
            caseChatThreadRepository.save(thread);

            Map<String, Object> out = new HashMap<>();
            out.put("threadId", thread.getId());
            out.put("userMessageId", userRow.getId());
            out.put("assistantMessageId", asst.getId());
            out.put("resolvedPhaseCode", effectivePhase);
            out.put("intent", intentCode);
            out.put("orchestrationRequestId", orchestrationRequestId);
            out.put("documentReview", reviewResults);
            out.put("aiTurn", payloadMap);
            out.put("chatNarrate", payloadMap.get("chat_narrate"));
            return out;
        }

        PlanningChatAction planningAction = resolvePlanningChatAction(aiUserMessage, effectivePhase, c);
        if (planningAction != null) {
            return completePlanningActionChatTurn(
                    caseId,
                    c,
                    thread,
                    actor,
                    vis,
                    effectivePhase,
                    persistedUserBody,
                    history,
                    detectJson,
                    attachmentDetails,
                    planningAction
            );
        }

        if (looksLikePlanningDraftUserRequest(aiUserMessage)) {
            return completePlanningDraftNotPersistedTurn(
                    caseId,
                    thread,
                    actor,
                    vis,
                    effectivePhase,
                    persistedUserBody,
                    history,
                    detectJson,
                    attachmentDetails,
                    c.getPhase()
            );
        }

        String effectiveAssessment = assessmentCode != null && !assessmentCode.isBlank()
                ? assessmentCode.trim()
                : null;
        if (effectiveAssessment == null && detectJson != null && detectJson.hasNonNull("suggested_assessment_code")) {
            effectiveAssessment = detectJson.get("suggested_assessment_code").asText();
        }
        if (effectiveAssessment == null || effectiveAssessment.isBlank()) {
            effectiveAssessment = "PLANNING".equalsIgnoreCase(effectivePhase)
                    ? "assessment_09"
                    : "onboarding_completeness";
        }

        // One fresh orchestration_request per chat turn (new intent + assessment for this send only).
        // Omitting orchestration_request_id on the engine would reuse a single deterministic row per case.
        UUID orchestrationRequestId = UUID.randomUUID();

        Map<String, Object> contextSnapshot = new LinkedHashMap<>();
        contextSnapshot.put("resolvedPhaseCode", effectivePhase);
        contextSnapshot.put("resolvedAssessmentCode", effectiveAssessment);
        contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
        contextSnapshot.put("conversationHistoryForAi", history);
        if (detectJson != null) {
            contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
        }
        if (!attachmentDetails.isEmpty()) {
            contextSnapshot.put("attachments", attachmentDetails);
        }

        CaseChatMessage userRow = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_USER)
                .actorRole(actor)
                .visibility(vis)
                .phaseCode(effectivePhase)
                .assessmentCode(effectiveAssessment)
                .body(persistedUserBody)
                .intentCode(intentCode)
                .contextSnapshot(contextSnapshot)
                .build();
        caseChatMessageRepository.save(userRow);

        Map<String, Object> aiBody = new LinkedHashMap<>();
        aiBody.put("case_id", caseId.toString());
        aiBody.put("phase_code", effectivePhase);
        aiBody.put("assessment_code", effectiveAssessment);
        aiBody.put("user_message", aiUserMessage);
        aiBody.put("sender_role", actor);
        aiBody.put("workflow_id", caseId.toString());
        aiBody.put("user_id", authentication != null ? authentication.getName() : "anonymous");
        aiBody.put("conversation_history", history);
        if (intentCode != null) {
            aiBody.put("chat_intent", intentCode);
        }
        aiBody.put("orchestration_request_id", orchestrationRequestId.toString());

        JsonNode aiResult = aiEngineChatClient.postChatTurn(aiBody);

        Map<String, Object> payloadMap = objectMapper.convertValue(aiResult, new TypeReference<>() {});
        String assistantText = maybeNarrateChatReply(
                aiUserMessage,
                effectivePhase,
                effectiveAssessment,
                history,
                aiResult,
                payloadMap
        );

        CaseChatMessage asst = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                .actorRole("AI_ENGINE")
                .visibility(CaseChatMessage.VISIBILITY_ALL)
                .phaseCode(effectivePhase)
                .assessmentCode(effectiveAssessment)
                .intentCode(intentCode)
                .body(assistantText)
                .aiPayload(payloadMap)
                .build();
        caseChatMessageRepository.save(asst);

        thread.setUpdatedAt(java.time.OffsetDateTime.now());
        caseChatThreadRepository.save(thread);

        Map<String, Object> out = new HashMap<>();
        out.put("threadId", thread.getId());
        out.put("userMessageId", userRow.getId());
        out.put("assistantMessageId", asst.getId());
        out.put("resolvedPhaseCode", effectivePhase);
        out.put("resolvedAssessmentCode", effectiveAssessment);
        out.put("intent", intentCode);
        out.put("orchestrationRequestId", orchestrationRequestId);
        out.put("detectIntent", detectJson != null ? objectMapper.convertValue(detectJson, new TypeReference<>() {}) : null);
        out.put("aiTurn", payloadMap);
        out.put("chatNarrate", payloadMap.get("chat_narrate"));
        return out;
    }

    public enum StreamTurnKind {
        CATALOG,
        CHANGE_PHASE,
        VERIFY_DOCUMENT,
        PLANNING_ACTION
    }

    private enum PlanningChatAction {
        CREATE_DRAFT,
        REGENERATE_DRAFT,
        FINALIZE_DRAFT,
        GET_DRAFT_STATUS
    }

    private record PlanningActionOutcome(
            String assistantText,
            Map<String, Object> payloadMap,
            String phaseCode
    ) {
    }

    public record CatalogStreamPrep(
            StreamTurnKind streamKind,
            UUID caseId,
            UUID threadId,
            UUID userMessageId,
            Map<String, Object> aiBody,
            Map<String, Object> narrateBody,
            Map<String, Object> assistantPayload,
            String narrateFallbackText,
            String assistantPhaseCode,
            String effectivePhase,
            String effectiveAssessment,
            String intentCode,
            String actor,
            String visibility,
            JsonNode detectJson
    ) {
    }

    /**
     * Persists the user message and prepares catalog, phase-change, or document-verify streaming.
     */
    @Transactional
    public CatalogStreamPrep prepareCatalogStreamTurn(
            UUID caseId,
            UUID threadId,
            String phaseCode,
            String assessmentCode,
            String message,
            String visibility,
            Boolean autoDetectIntent,
            List<UUID> attachmentIds,
            Authentication authentication
    ) {
        List<UUID> attachmentIdList = attachmentIds == null
                ? List.of()
                : attachmentIds.stream().distinct().toList();
        List<Map<String, Object>> attachmentDetails = resolveAttachmentDetails(caseId, attachmentIdList);
        String userMsgTrim = message == null ? "" : message.trim();
        if (userMsgTrim.isEmpty() && attachmentDetails.isEmpty()) {
            throw new BusinessException("message or attachmentIds is required");
        }
        String persistedUserBody = persistedUserBody(userMsgTrim, attachmentDetails);
        String aiUserMessage = effectiveUserTextForAi(userMsgTrim, attachmentDetails);

        WealthCase c = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        CaseChatThread thread = resolveThread(caseId, threadId);

        String actor = primaryRole(authentication);
        String vis = (visibility == null || visibility.isBlank())
                ? CaseChatMessage.VISIBILITY_ALL
                : visibility.trim().toUpperCase();
        if (CaseChatMessage.VISIBILITY_INTERNAL.equals(vis) && !isStaff(actor)) {
            throw new BusinessException("INTERNAL messages require a staff role");
        }

        List<Map<String, Object>> history = buildConversationHistoryForAi(thread.getId(), authentication);

        String effectivePhase = resolvePhaseCode(phaseCode, c);
        JsonNode detectJson = null;
        String intentCode = null;
        if (autoDetectIntent == null || autoDetectIntent) {
            try {
                Map<String, Object> detectBody = new LinkedHashMap<>();
                detectBody.put("case_id", caseId.toString());
                detectBody.put("phase_code", effectivePhase);
                detectBody.put("user_message", aiUserMessage);
                detectBody.put("conversation_history", history);
                detectJson = aiEngineChatClient.postDetectIntent(detectBody);
                if (detectJson != null && detectJson.hasNonNull("intent")) {
                    intentCode = detectJson.get("intent").asText();
                }
            } catch (BusinessException ex) {
                log.warn("Chat intent detection skipped/failed: {}", ex.getMessage());
            }
        }

        if ("CHANGE_PHASE".equals(intentCode)) {
            return prepareChangePhaseStreamTurn(
                    caseId,
                    thread,
                    actor,
                    vis,
                    effectivePhase,
                    aiUserMessage,
                    persistedUserBody,
                    history,
                    detectJson,
                    intentCode,
                    attachmentDetails
            );
        }
        if ("VERIFY_DOCUMENT".equals(intentCode)) {
            return prepareVerifyDocumentStreamTurn(
                    caseId,
                    thread,
                    actor,
                    vis,
                    effectivePhase,
                    aiUserMessage,
                    persistedUserBody,
                    history,
                    detectJson,
                    intentCode,
                    attachmentIdList,
                    authentication
            );
        }

        PlanningChatAction planningAction = resolvePlanningChatAction(aiUserMessage, effectivePhase, c);
        if (planningAction != null) {
            return preparePlanningActionStreamTurn(
                    caseId,
                    c,
                    thread,
                    actor,
                    vis,
                    effectivePhase,
                    persistedUserBody,
                    history,
                    detectJson,
                    planningAction,
                    attachmentDetails
            );
        }

        if (looksLikePlanningDraftUserRequest(aiUserMessage)) {
            return preparePlanningDraftNotPersistedStreamTurn(
                    caseId,
                    thread,
                    actor,
                    vis,
                    effectivePhase,
                    persistedUserBody,
                    history,
                    detectJson,
                    attachmentDetails,
                    c.getPhase()
            );
        }

        String effectiveAssessment = assessmentCode != null && !assessmentCode.isBlank()
                ? assessmentCode.trim()
                : null;
        if (effectiveAssessment == null && detectJson != null && detectJson.hasNonNull("suggested_assessment_code")) {
            effectiveAssessment = detectJson.get("suggested_assessment_code").asText();
        }
        if (effectiveAssessment == null || effectiveAssessment.isBlank()) {
            effectiveAssessment = "PLANNING".equalsIgnoreCase(effectivePhase)
                    ? "assessment_09"
                    : "onboarding_completeness";
        }

        UUID orchestrationRequestId = UUID.randomUUID();

        Map<String, Object> contextSnapshot = new LinkedHashMap<>();
        contextSnapshot.put("resolvedPhaseCode", effectivePhase);
        contextSnapshot.put("resolvedAssessmentCode", effectiveAssessment);
        contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
        contextSnapshot.put("conversationHistoryForAi", history);
        if (detectJson != null) {
            contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
        }
        if (!attachmentDetails.isEmpty()) {
            contextSnapshot.put("attachments", attachmentDetails);
        }

        CaseChatMessage userRow = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_USER)
                .actorRole(actor)
                .visibility(vis)
                .phaseCode(effectivePhase)
                .assessmentCode(effectiveAssessment)
                .body(persistedUserBody)
                .intentCode(intentCode)
                .contextSnapshot(contextSnapshot)
                .build();
        caseChatMessageRepository.save(userRow);

        Map<String, Object> aiBody = new LinkedHashMap<>();
        aiBody.put("case_id", caseId.toString());
        aiBody.put("phase_code", effectivePhase);
        aiBody.put("assessment_code", effectiveAssessment);
        aiBody.put("user_message", aiUserMessage);
        aiBody.put("sender_role", actor);
        aiBody.put("workflow_id", caseId.toString());
        aiBody.put("user_id", authentication != null ? authentication.getName() : "anonymous");
        aiBody.put("conversation_history", history);
        if (intentCode != null) {
            aiBody.put("chat_intent", intentCode);
        }
        aiBody.put("orchestration_request_id", orchestrationRequestId.toString());

        return new CatalogStreamPrep(
                StreamTurnKind.CATALOG,
                caseId,
                thread.getId(),
                userRow.getId(),
                aiBody,
                null,
                null,
                null,
                effectivePhase,
                effectivePhase,
                effectiveAssessment,
                intentCode,
                actor,
                vis,
                detectJson
        );
    }

    private CatalogStreamPrep prepareChangePhaseStreamTurn(
            UUID caseId,
            CaseChatThread thread,
            String actor,
            String vis,
            String effectivePhase,
            String aiUserMessage,
            String persistedUserBody,
            List<Map<String, Object>> history,
            JsonNode detectJson,
            String intentCode,
            List<Map<String, Object>> attachmentDetails
    ) {
        if (!isStaff(actor)) {
            throw new BusinessException(
                    "Changing case phase via chat requires a staff role (RM, WM, IM, ADMIN)."
            );
        }
        String llmTarget = extractTargetPhaseFromDetect(detectJson);
        CaseChatPhaseTransitionService.TransitionResult tr;
        try {
            tr = caseChatPhaseTransitionService.transition(caseId, aiUserMessage, llmTarget);
        } catch (BusinessException ex) {
            log.info("Phase transition blocked caseId={}: {}", caseId, ex.getMessage());
            tr = new CaseChatPhaseTransitionService.TransitionResult(
                    effectivePhase, effectivePhase, "BLOCKED", ex.getMessage()
            );
        }

        WealthCase after = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        String newPhase = after.getPhase() != null ? after.getPhase().trim() : effectivePhase;

        UUID orchestrationRequestId = UUID.randomUUID();
        Map<String, Object> contextSnapshot = new LinkedHashMap<>();
        contextSnapshot.put("resolvedPhaseCode", effectivePhase);
        contextSnapshot.put("resolvedAssessmentCode", null);
        contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
        contextSnapshot.put("conversationHistoryForAi", history);
        if (detectJson != null) {
            contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
        }
        if (!attachmentDetails.isEmpty()) {
            contextSnapshot.put("attachments", attachmentDetails);
        }
        Map<String, Object> transitionSnap = new LinkedHashMap<>();
        transitionSnap.put("fromPhase", tr.fromPhase());
        transitionSnap.put("toPhase", tr.toPhase());
        transitionSnap.put("mode", tr.mode());
        transitionSnap.put("message", tr.message());
        contextSnapshot.put("phaseTransition", transitionSnap);

        CaseChatMessage userRow = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_USER)
                .actorRole(actor)
                .visibility(vis)
                .phaseCode(effectivePhase)
                .assessmentCode(null)
                .body(persistedUserBody)
                .intentCode(intentCode)
                .contextSnapshot(contextSnapshot)
                .build();
        caseChatMessageRepository.save(userRow);

        Map<String, Object> payloadMap = new LinkedHashMap<>();
        payloadMap.put("change_phase", Boolean.TRUE);
        payloadMap.put("phase_transition", transitionSnap);

        Map<String, Object> narrateBody;
        String narrateFallback;
        if ("BLOCKED".equals(tr.mode())) {
            Map<String, Object> findings = new LinkedHashMap<>();
            findings.put("phase_transition_blocked", true);
            findings.put("current_phase", tr.fromPhase());
            findings.put("requested_phase", tr.toPhase());
            findings.put("blocked_reason", tr.message());
            narrateBody = buildPhaseNarrateBody(aiUserMessage, effectivePhase, "phase_transition", history, findings);
            narrateFallback = tr.message();
        } else {
            Map<String, Object> findings = new LinkedHashMap<>();
            findings.put("phase_transition_success", true);
            findings.put("from_phase", tr.fromPhase());
            findings.put("to_phase", tr.toPhase());
            findings.put("transition_mode", tr.mode());
            narrateBody = buildPhaseNarrateBody(aiUserMessage, newPhase, "phase_transition", history, findings);
            narrateFallback = tr.message();
        }

        return new CatalogStreamPrep(
                StreamTurnKind.CHANGE_PHASE,
                caseId,
                thread.getId(),
                userRow.getId(),
                null,
                narrateBody,
                payloadMap,
                narrateFallback,
                newPhase,
                effectivePhase,
                null,
                intentCode,
                actor,
                vis,
                detectJson
        );
    }

    private CatalogStreamPrep prepareVerifyDocumentStreamTurn(
            UUID caseId,
            CaseChatThread thread,
            String actor,
            String vis,
            String effectivePhase,
            String aiUserMessage,
            String persistedUserBody,
            List<Map<String, Object>> history,
            JsonNode detectJson,
            String intentCode,
            List<UUID> attachmentIdList,
            Authentication authentication
    ) {
        if (!isStaff(actor)) {
            throw new BusinessException(
                    "Verifying documents via chat requires a staff role (RM, WM, IM, ADMIN)."
            );
        }
        String verifyAction = extractVerifyActionFromDetect(detectJson);
        if (verifyAction == null) {
            verifyAction = "VERIFIED";
        }
        List<UUID> targetIds = attachmentIdList;
        if (targetIds.isEmpty()) {
            targetIds = caseDocumentRepository
                    .findAllByWealthCase_IdAndStatus(caseId, CaseDocument.STATUS_PENDING)
                    .stream()
                    .map(CaseDocument::getId)
                    .toList();
        }
        if (targetIds.isEmpty()) {
            throw new BusinessException("No PENDING documents found for this case to verify.");
        }
        List<Map<String, Object>> reviewResults = new ArrayList<>();
        for (UUID cdId : targetIds) {
            try {
                CaseChatAttachmentService.DocumentReviewResponse rr =
                        caseChatAttachmentService.reviewDocument(caseId, cdId, verifyAction, authentication);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("caseDocumentId", rr.caseDocumentId().toString());
                m.put("docKind", rr.docKind());
                m.put("previousStatus", rr.previousStatus());
                m.put("currentStatus", rr.currentStatus());
                reviewResults.add(m);
            } catch (Exception ex) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("caseDocumentId", cdId.toString());
                m.put("error", ex.getMessage());
                reviewResults.add(m);
            }
        }

        UUID orchestrationRequestId = UUID.randomUUID();
        Map<String, Object> contextSnapshot = new LinkedHashMap<>();
        contextSnapshot.put("resolvedPhaseCode", effectivePhase);
        contextSnapshot.put("resolvedAssessmentCode", null);
        contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
        contextSnapshot.put("conversationHistoryForAi", history);
        if (detectJson != null) {
            contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
        }
        contextSnapshot.put("documentReview", reviewResults);

        CaseChatMessage userRow = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_USER)
                .actorRole(actor)
                .visibility(vis)
                .phaseCode(effectivePhase)
                .assessmentCode(null)
                .body(persistedUserBody)
                .intentCode(intentCode)
                .contextSnapshot(contextSnapshot)
                .build();
        caseChatMessageRepository.save(userRow);

        Map<String, Object> payloadMap = new LinkedHashMap<>();
        payloadMap.put("verify_document", Boolean.TRUE);
        payloadMap.put("verify_action", verifyAction);
        payloadMap.put("review_results", reviewResults);

        Map<String, Object> narrateBody = buildDocumentReviewNarrateBody(
                aiUserMessage, effectivePhase, verifyAction, reviewResults, history
        );
        String narrateFallback = documentReviewFallbackText(reviewResults);

        return new CatalogStreamPrep(
                StreamTurnKind.VERIFY_DOCUMENT,
                caseId,
                thread.getId(),
                userRow.getId(),
                null,
                narrateBody,
                payloadMap,
                narrateFallback,
                effectivePhase,
                effectivePhase,
                null,
                intentCode,
                actor,
                vis,
                detectJson
        );
    }

    private CatalogStreamPrep preparePlanningActionStreamTurn(
            UUID caseId,
            WealthCase wealthCase,
            CaseChatThread thread,
            String actor,
            String vis,
            String effectivePhase,
            String persistedUserBody,
            List<Map<String, Object>> history,
            JsonNode detectJson,
            PlanningChatAction action,
            List<Map<String, Object>> attachmentDetails
    ) {
        PlanningActionOutcome outcome = executePlanningAction(caseId, wealthCase, action, actor);

        UUID orchestrationRequestId = UUID.randomUUID();
        Map<String, Object> contextSnapshot = new LinkedHashMap<>();
        contextSnapshot.put("resolvedPhaseCode", effectivePhase);
        contextSnapshot.put("resolvedAssessmentCode", null);
        contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
        contextSnapshot.put("conversationHistoryForAi", history);
        if (detectJson != null) {
            contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
        }
        if (!attachmentDetails.isEmpty()) {
            contextSnapshot.put("attachments", attachmentDetails);
        }
        contextSnapshot.put("planningAction", outcome.payloadMap());

        CaseChatMessage userRow = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_USER)
                .actorRole(actor)
                .visibility(vis)
                .phaseCode(effectivePhase)
                .assessmentCode(null)
                .body(persistedUserBody)
                .intentCode("PLANNING_ACTION")
                .contextSnapshot(contextSnapshot)
                .build();
        caseChatMessageRepository.save(userRow);

        return new CatalogStreamPrep(
                StreamTurnKind.PLANNING_ACTION,
                caseId,
                thread.getId(),
                userRow.getId(),
                null,
                null,
                outcome.payloadMap(),
                outcome.assistantText(),
                outcome.phaseCode(),
                effectivePhase,
                null,
                "PLANNING_ACTION",
                actor,
                vis,
                detectJson
        );
    }

    private PlanningActionOutcome executePlanningAction(
            UUID caseId,
            WealthCase wealthCase,
            PlanningChatAction action,
            String actorRole
    ) {
        if (!"PLANNING".equalsIgnoreCase(wealthCase.getPhase())) {
            throw new BusinessException("Planning actions via chat require case phase PLANNING.");
        }
        if (!isStaff(actorRole)) {
            throw new BusinessException("Planning actions via chat require a staff role (RM, WM, IM, ADMIN).");
        }

        FinancialPlan latest = findLatestPlanForCase(caseId, wealthCase.getClient().getId());
        PlanningDraftResponse draftResponse;
        boolean createdNewDraft = false;

        switch (action) {
            case CREATE_DRAFT -> {
                requirePlannerRole(actorRole);
                if (latest != null) {
                    draftResponse = planningDraftService.getDraft(latest.getId());
                } else {
                    PlanTemplate activeTemplate = resolveActivePlanningTemplate();
                    draftResponse = planningDraftService.createDraft(
                            caseId,
                            new CreatePlanningDraftRequest(activeTemplate.getId(), Map.of())
                    );
                    createdNewDraft = true;
                }
                if (!financialPlanRepository.existsById(draftResponse.planId())) {
                    throw new BusinessException(
                            "Planning draft was not persisted to financial_plan (planId="
                                    + draftResponse.planId()
                                    + ")."
                    );
                }
            }
            case REGENERATE_DRAFT -> {
                requirePlannerRole(actorRole);
                if (latest == null) {
                    throw new BusinessException("No planning draft found for this case. Create draft first.");
                }
                draftResponse = planningDraftService.regenerate(
                        latest.getId(),
                        new RegeneratePlanningDraftRequest(Map.of(), false)
                );
            }
            case FINALIZE_DRAFT -> {
                requirePlannerRole(actorRole);
                if (latest == null) {
                    throw new BusinessException("No planning draft found for this case. Create draft first.");
                }
                draftResponse = planningDraftService.finalizeDraft(latest.getId());
            }
            case GET_DRAFT_STATUS -> {
                if (latest == null) {
                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("planning_action", "GET_DRAFT_STATUS");
                    payload.put("planning_status", "NOT_FOUND");
                    payload.put("case_id", caseId.toString());
                    return new PlanningActionOutcome(
                            "Hiện chưa có planning draft cho case này. Bạn có thể yêu cầu: \"tạo planning draft\".",
                            payload,
                            wealthCase.getPhase()
                    );
                }
                draftResponse = planningDraftService.getDraft(latest.getId());
            }
            default -> throw new BusinessException("Unsupported planning chat action.");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("planning_action", action.name());
        payload.put("planning_draft", objectMapper.convertValue(draftResponse, new TypeReference<>() {}));
        payload.put("planning_draft_id", draftResponse.planId().toString());
        payload.put("planning_draft_persisted", true);
        payload.put("planning_draft_created_new", createdNewDraft);
        payload.put("case_id", caseId.toString());

        String assistantText = planningAssistantText(action, draftResponse, createdNewDraft);
        return new PlanningActionOutcome(assistantText, payload, wealthCase.getPhase());
    }

    private String planningAssistantText(
            PlanningChatAction action,
            PlanningDraftResponse draft,
            boolean createdNewDraft
    ) {
        long mandatoryMissing = readMandatoryMissing(draft.payload());
        return switch (action) {
            case CREATE_DRAFT -> createdNewDraft
                    ? "Đã tạo planning draft mới và lưu vào bảng financial_plan. "
                    + "planId=" + draft.planId()
                    + ", trạng thái: " + draft.status()
                    + ". Mandatory còn thiếu (theo field_dictionary): " + mandatoryMissing + "."
                    : "Planning draft đã tồn tại (không tạo bản mới). "
                    + "planId=" + draft.planId()
                    + ", trạng thái: " + draft.status()
                    + ". Mandatory còn thiếu (theo field_dictionary): " + mandatoryMissing
                    + ". Dùng \"regenerate draft\" để cập nhật nội dung.";
            case REGENERATE_DRAFT -> "Đã regenerate planning draft. "
                    + "Trạng thái hiện tại: " + draft.status()
                    + ". Mandatory còn thiếu: " + mandatoryMissing + ".";
            case FINALIZE_DRAFT -> "Đã finalize planning draft. "
                    + "Trạng thái hiện tại: " + draft.status()
                    + ".";
            case GET_DRAFT_STATUS -> "Planning draft hiện tại có trạng thái: " + draft.status()
                    + ". Mandatory còn thiếu: " + mandatoryMissing + ".";
        };
    }

    private static long readMandatoryMissing(Map<String, Object> payload) {
        if (payload == null) {
            return 0L;
        }
        Object discovery = payload.get("discovery");
        if (!(discovery instanceof Map<?, ?> map)) {
            return 0L;
        }
        Object value = map.get("mandatoryFieldsMissing");
        if (value instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof String text) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ex) {
                return 0L;
            }
        }
        return 0L;
    }

    private FinancialPlan findLatestPlanForCase(UUID caseId, UUID clientId) {
        return financialPlanRepository.findByClient_Id(clientId).stream()
                .filter(p -> caseId.equals(extractCaseIdFromPlan(p)))
                .sorted((a, b) -> {
                    if (a.getCreatedAt() == null && b.getCreatedAt() == null) {
                        return 0;
                    }
                    if (a.getCreatedAt() == null) {
                        return 1;
                    }
                    if (b.getCreatedAt() == null) {
                        return -1;
                    }
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .findFirst()
                .orElse(null);
    }

    private UUID extractCaseIdFromPlan(FinancialPlan plan) {
        if (plan.getContent() == null) {
            return null;
        }
        Object raw = plan.getContent().get("caseId");
        if (!(raw instanceof String text) || text.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private PlanTemplate resolveActivePlanningTemplate() {
        return planTemplateRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(t -> "ACTIVE".equalsIgnoreCase(t.getStatus()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        "No ACTIVE planning template found. Upload and publish a planning template first."
                ));
    }

    private static void requirePlannerRole(String role) {
        if (!"WM".equalsIgnoreCase(role) && !"ADMIN".equalsIgnoreCase(role)) {
            throw new BusinessException("Planning draft create/regenerate/finalize requires WM or ADMIN role.");
        }
    }

    private Map<String, Object> completePlanningActionChatTurn(
            UUID caseId,
            WealthCase wealthCase,
            CaseChatThread thread,
            String actor,
            String vis,
            String effectivePhase,
            String persistedUserBody,
            List<Map<String, Object>> history,
            JsonNode detectJson,
            List<Map<String, Object>> attachmentDetails,
            PlanningChatAction planningAction
    ) {
        PlanningActionOutcome planning = executePlanningAction(caseId, wealthCase, planningAction, actor);

        UUID orchestrationRequestId = UUID.randomUUID();
        Map<String, Object> contextSnapshot = new LinkedHashMap<>();
        contextSnapshot.put("resolvedPhaseCode", effectivePhase);
        contextSnapshot.put("resolvedAssessmentCode", null);
        contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
        contextSnapshot.put("conversationHistoryForAi", history);
        if (detectJson != null) {
            contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
        }
        if (!attachmentDetails.isEmpty()) {
            contextSnapshot.put("attachments", attachmentDetails);
        }
        contextSnapshot.put("planningAction", planning.payloadMap());

        CaseChatMessage userRow = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_USER)
                .actorRole(actor)
                .visibility(vis)
                .phaseCode(effectivePhase)
                .assessmentCode(null)
                .body(persistedUserBody)
                .intentCode("PLANNING_ACTION")
                .contextSnapshot(contextSnapshot)
                .build();
        caseChatMessageRepository.save(userRow);

        CaseChatMessage asst = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                .actorRole("AI_ENGINE")
                .visibility(CaseChatMessage.VISIBILITY_ALL)
                .phaseCode(planning.phaseCode())
                .assessmentCode(null)
                .intentCode("PLANNING_ACTION")
                .body(planning.assistantText())
                .aiPayload(planning.payloadMap())
                .build();
        caseChatMessageRepository.save(asst);

        thread.setUpdatedAt(java.time.OffsetDateTime.now());
        caseChatThreadRepository.save(thread);

        Map<String, Object> out = new HashMap<>();
        out.put("threadId", thread.getId());
        out.put("userMessageId", userRow.getId());
        out.put("assistantMessageId", asst.getId());
        out.put("resolvedPhaseCode", planning.phaseCode());
        out.put("resolvedAssessmentCode", null);
        out.put("intent", "PLANNING_ACTION");
        out.put("orchestrationRequestId", orchestrationRequestId);
        out.put("detectIntent", detectJson != null ? objectMapper.convertValue(detectJson, new TypeReference<>() {}) : null);
        out.put("aiTurn", planning.payloadMap());
        out.put("chatNarrate", null);
        return out;
    }

    private Map<String, Object> completePlanningDraftNotPersistedTurn(
            UUID caseId,
            CaseChatThread thread,
            String actor,
            String vis,
            String effectivePhase,
            String persistedUserBody,
            List<Map<String, Object>> history,
            JsonNode detectJson,
            List<Map<String, Object>> attachmentDetails,
            String casePhase
    ) {
        String phaseLabel = casePhase == null || casePhase.isBlank() ? "(unknown)" : casePhase.trim();
        String assistantBody =
                "Không ghi planning draft vào financial_plan vì case chưa ở phase PLANNING "
                + "(hiện tại: " + phaseLabel + "). "
                + "Chạy discovery check / chuyển phase PLANNING trước, hoặc gọi API "
                + "POST /cases/{caseId}/planning/drafts. "
                + "Tin nhắn trước đó từ assessment chat có thể mô tả \"đã tạo\" nhưng không lưu DB.";

        UUID orchestrationRequestId = UUID.randomUUID();
        Map<String, Object> contextSnapshot = new LinkedHashMap<>();
        contextSnapshot.put("resolvedPhaseCode", effectivePhase);
        contextSnapshot.put("orchestrationRequestId", orchestrationRequestId.toString());
        contextSnapshot.put("conversationHistoryForAi", history);
        contextSnapshot.put("planning_draft_persisted", false);
        contextSnapshot.put("planning_draft_blocked_reason", "CASE_NOT_IN_PLANNING_PHASE");
        contextSnapshot.put("case_phase", phaseLabel);
        if (detectJson != null) {
            contextSnapshot.put("detectIntent", objectMapper.convertValue(detectJson, new TypeReference<>() {}));
        }
        if (!attachmentDetails.isEmpty()) {
            contextSnapshot.put("attachments", attachmentDetails);
        }

        CaseChatMessage userRow = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_USER)
                .actorRole(actor)
                .visibility(vis)
                .phaseCode(effectivePhase)
                .assessmentCode(null)
                .body(persistedUserBody)
                .intentCode("PLANNING_DRAFT_NOT_PERSISTED")
                .contextSnapshot(contextSnapshot)
                .build();
        caseChatMessageRepository.save(userRow);

        Map<String, Object> payloadMap = new LinkedHashMap<>();
        payloadMap.put("planning_draft_persisted", false);
        payloadMap.put("case_phase", phaseLabel);

        CaseChatMessage asst = CaseChatMessage.builder()
                .thread(thread)
                .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                .actorRole("AI_ENGINE")
                .visibility(CaseChatMessage.VISIBILITY_ALL)
                .phaseCode(effectivePhase)
                .assessmentCode(null)
                .intentCode("PLANNING_DRAFT_NOT_PERSISTED")
                .body(assistantBody)
                .aiPayload(payloadMap)
                .build();
        caseChatMessageRepository.save(asst);

        thread.setUpdatedAt(java.time.OffsetDateTime.now());
        caseChatThreadRepository.save(thread);

        Map<String, Object> out = new HashMap<>();
        out.put("threadId", thread.getId());
        out.put("userMessageId", userRow.getId());
        out.put("assistantMessageId", asst.getId());
        out.put("resolvedPhaseCode", effectivePhase);
        out.put("intent", "PLANNING_DRAFT_NOT_PERSISTED");
        out.put("orchestrationRequestId", orchestrationRequestId);
        out.put("aiTurn", payloadMap);
        return out;
    }

    private CatalogStreamPrep preparePlanningDraftNotPersistedStreamTurn(
            UUID caseId,
            CaseChatThread thread,
            String actor,
            String vis,
            String effectivePhase,
            String persistedUserBody,
            List<Map<String, Object>> history,
            JsonNode detectJson,
            List<Map<String, Object>> attachmentDetails,
            String casePhase
    ) {
        Map<String, Object> sync = completePlanningDraftNotPersistedTurn(
                caseId,
                thread,
                actor,
                vis,
                effectivePhase,
                persistedUserBody,
                history,
                detectJson,
                attachmentDetails,
                casePhase
        );
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) sync.get("aiTurn");
        return new CatalogStreamPrep(
                StreamTurnKind.PLANNING_ACTION,
                caseId,
                thread.getId(),
                (UUID) sync.get("userMessageId"),
                null,
                null,
                payload,
                payload == null ? "" : "Không lưu planning draft — case chưa ở phase PLANNING.",
                effectivePhase,
                effectivePhase,
                null,
                "PLANNING_DRAFT_NOT_PERSISTED",
                actor,
                vis,
                detectJson
        );
    }

    private PlanningChatAction resolvePlanningChatAction(
            String message,
            String phaseCode,
            WealthCase wealthCase
    ) {
        PlanningChatAction action = detectPlanningChatAction(message, phaseCode);
        if (action != null) {
            return action;
        }
        if (wealthCase != null
                && "PLANNING".equalsIgnoreCase(wealthCase.getPhase())
                && looksLikePlanningDraftUserRequest(message)) {
            return PlanningChatAction.CREATE_DRAFT;
        }
        return null;
    }

    private static boolean looksLikePlanningDraftUserRequest(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        boolean planContext = containsAny(
                normalized,
                "plan",
                "draft",
                "planning",
                "kế hoạch",
                "ke hoach",
                "nháp",
                "nhap",
                "bản nháp",
                "ban nhap"
        );
        boolean createVerb = containsAny(
                normalized,
                "tạo",
                "tao",
                "create",
                "generate",
                "khởi tạo",
                "khoi tao",
                "lập",
                "lap"
        );
        return planContext && createVerb;
    }

    private PlanningChatAction detectPlanningChatAction(String message, String phaseCode) {
        if (message == null || message.isBlank()) {
            return null;
        }
        if (phaseCode == null || !"PLANNING".equalsIgnoreCase(phaseCode.trim())) {
            return null;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        if (!containsAny(
                normalized,
                "plan",
                "draft",
                "planning",
                "kế hoạch",
                "ke hoach",
                "nháp",
                "nhap",
                "bản nháp",
                "ban nhap"
        )) {
            return null;
        }
        if (containsAny(normalized, "finalize", "final", "chốt", "chot", "hoàn tất", "hoan tat")) {
            return PlanningChatAction.FINALIZE_DRAFT;
        }
        if (containsAny(normalized, "regenerate", "regen", "tạo lại", "tao lai", "cập nhật", "cap nhat")) {
            return PlanningChatAction.REGENERATE_DRAFT;
        }
        if (containsAny(normalized, "status", "trạng thái", "trang thai", "xem", "kiểm tra", "kiem tra")) {
            return PlanningChatAction.GET_DRAFT_STATUS;
        }
        if (containsAny(normalized, "tạo", "tao", "create", "generate", "khởi tạo", "khoi tao", "lập")) {
            return PlanningChatAction.CREATE_DRAFT;
        }
        return null;
    }

    private static boolean containsAny(String text, String... terms) {
        for (String term : terms) {
            if (text.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static Map<String, Object> buildPhaseNarrateBody(
            String userMessage,
            String phaseCode,
            String assessmentCode,
            List<Map<String, Object>> history,
            Map<String, Object> findings
    ) {
        Map<String, Object> narrateBody = new LinkedHashMap<>();
        narrateBody.put("user_message", userMessage != null ? userMessage.trim() : "");
        narrateBody.put(
                "input_language",
                ChatMessageLanguageDetector.detectForNarrate(userMessage, history));
        narrateBody.put("phase_code", phaseCode);
        narrateBody.put("assessment_code", assessmentCode);
        narrateBody.put("conversation_history", history);
        narrateBody.put("pass1_findings", findings);
        return narrateBody;
    }

    private Map<String, Object> buildDocumentReviewNarrateBody(
            String userMessage,
            String effectivePhase,
            String verifyAction,
            List<Map<String, Object>> reviewResults,
            List<Map<String, Object>> history
    ) {
        Map<String, Object> findings = new LinkedHashMap<>();
        findings.put("document_review_completed", true);
        findings.put("verify_action", verifyAction);
        findings.put("review_results", reviewResults);
        Map<String, Object> narrateBody = buildPhaseNarrateBody(
                userMessage, effectivePhase, "document_review", history, findings
        );
        return narrateBody;
    }

    private static String documentReviewFallbackText(List<Map<String, Object>> reviewResults) {
        StringBuilder sb = new StringBuilder();
        sb.append("Document review completed:\n");
        for (Map<String, Object> r : reviewResults) {
            if (r.containsKey("error")) {
                sb.append("- ").append(r.get("caseDocumentId")).append(": ERROR - ").append(r.get("error")).append("\n");
            } else {
                sb.append("- ").append(r.get("docKind")).append(": ").append(r.get("previousStatus")).append(" → ").append(r.get("currentStatus")).append("\n");
            }
        }
        return sb.toString().trim();
    }

    /**
     * Routes catalog turns to AI-engine {@code /turn/stream}; phase change and document verify to
     * {@code /narrate/stream}.
     */
    public void streamNdjsonToClient(CatalogStreamPrep prep, OutputStream clientSink) throws IOException {
        if (prep.streamKind() == StreamTurnKind.CATALOG) {
            streamCatalogNdjsonToClient(prep, clientSink);
            return;
        }
        if (prep.streamKind() == StreamTurnKind.PLANNING_ACTION) {
            streamPlanningActionNdjsonToClient(prep, clientSink);
            return;
        }
        streamNarrateNdjsonToClient(prep, clientSink);
    }

    public void streamPlanningActionNdjsonToClient(CatalogStreamPrep prep, OutputStream clientSink) throws IOException {
        try {
            writeStreamBootstrapPhases(clientSink);
            CaseChatNdjsonWriter.writeLine(
                    clientSink,
                    objectMapper,
                    CaseChatStreamEvents.Phase.of(CaseChatRunPhase.DB_UPDATE)
            );
            String assistantText = prep.narrateFallbackText() == null || prep.narrateFallbackText().isBlank()
                    ? STREAM_EMPTY_ASSISTANT_FALLBACK
                    : prep.narrateFallbackText();
            Map<String, Object> delta = new LinkedHashMap<>();
            delta.put("type", "assistant_delta");
            delta.put("text", assistantText);
            CaseChatNdjsonWriter.writeLine(clientSink, objectMapper, delta);

            TransactionTemplate tt = new TransactionTemplate(transactionManager);
            UUID assistantId = tt.execute(status -> {
                CaseChatThread thread = caseChatThreadRepository.findById(prep.threadId())
                        .orElseThrow(() -> new NotFoundException("Chat thread not found: " + prep.threadId()));
                CaseChatMessage asst = CaseChatMessage.builder()
                        .thread(thread)
                        .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                        .actorRole("AI_ENGINE")
                        .visibility(CaseChatMessage.VISIBILITY_ALL)
                        .phaseCode(prep.assistantPhaseCode())
                        .assessmentCode(null)
                        .intentCode(prep.intentCode())
                        .body(assistantText)
                        .aiPayload(prep.assistantPayload())
                        .build();
                caseChatMessageRepository.save(asst);
                thread.setUpdatedAt(java.time.OffsetDateTime.now());
                caseChatThreadRepository.save(thread);
                return asst.getId();
            });
            writeStreamDone(clientSink, prep, assistantId, 1, assistantText.length());
        } catch (BusinessException ex) {
            log.warn("Case chat planning stream business error: {}", ex.getMessage());
            safeStreamError(clientSink, ex.getMessage());
        } catch (IOException ex) {
            if (isClientDisconnect(ex)) {
                log.debug("Case chat planning stream client disconnected: {}", ex.getMessage());
            } else {
                log.warn("Case chat planning stream I/O error: {}", ex.getMessage());
                safeStreamError(clientSink, ex.getMessage());
            }
        } catch (Exception ex) {
            log.warn("Case chat planning stream error: {}", ex.getMessage());
            safeStreamError(clientSink, ex.getMessage() != null ? ex.getMessage() : "Stream failed.");
        }
    }

    /**
     * Proxies AI-engine NDJSON (including {@code assistant_delta} chunks) to the client, then persists
     * the assistant row from {@code catalog_turn_complete} and appends a {@code done} line with message ids.
     * Does not close {@code clientSink}; on failure writes {@code error} + {@code done} NDJSON lines.
     */
    public void streamCatalogNdjsonToClient(CatalogStreamPrep prep, OutputStream clientSink) throws IOException {
        String jsonBody = objectMapper.writeValueAsString(prep.aiBody());
        InputStream engineIn = null;
        int streamLineNo = 0;
        try {
            writeStreamBootstrapPhases(clientSink);
            log.info(
                    "Case chat stream opening AI-engine caseId={} threadId={} orchestrationRequestId={}",
                    prep.caseId(),
                    prep.threadId(),
                    prep.aiBody().get("orchestration_request_id")
            );
            engineIn = aiEngineHttpStreamClient.openPostStream("/internal/chat/turn/stream", jsonBody);
            BufferedReader br = new BufferedReader(new InputStreamReader(engineIn, StandardCharsets.UTF_8));
            JsonNode catalogComplete = null;
            String engineLine;
            while ((engineLine = br.readLine()) != null) {
                if (engineLine.isBlank()) {
                    continue;
                }
                streamLineNo++;
                clientSink.write(engineLine.getBytes(StandardCharsets.UTF_8));
                clientSink.write('\n');
                clientSink.flush();
                JsonNode lineNode = objectMapper.readTree(engineLine);
                String lineType = lineNode.path("type").asText("?");
                if ("assistant_delta".equals(lineType)) {
                    log.info(
                            "Case chat stream line {} type=assistant_delta chunkLen={} caseId={}",
                            streamLineNo,
                            lineNode.path("text").asText("").length(),
                            prep.caseId()
                    );
                } else if ("catalog_turn_complete".equals(lineType)) {
                    catalogComplete = lineNode;
                    log.info(
                            "Case chat stream line {} type=catalog_turn_complete assistantTextLen={} caseId={}",
                            streamLineNo,
                            catalogComplete.path("assistant_text").asText("").length(),
                            prep.caseId()
                    );
                } else if ("error".equals(lineType)) {
                    log.warn(
                            "Case chat stream line {} type=error message={} caseId={}",
                            streamLineNo,
                            lineNode.path("message").asText(""),
                            prep.caseId()
                    );
                } else {
                    log.info(
                            "Case chat stream line {} type={} caseId={}",
                            streamLineNo,
                            lineType,
                            prep.caseId()
                    );
                }
            }
            if (catalogComplete == null) {
                log.warn(
                        "Case chat stream no catalog_turn_complete from AI-engine caseId={} engineLines={}",
                        prep.caseId(),
                        streamLineNo
                );
                CaseChatNdjsonWriter.writeErrorAndDone(
                        clientSink,
                        objectMapper,
                        streamLineNo == 0
                                ? "AI-engine returned no stream data. Check AI-engine is running on WEALTH_AI_ENGINE_BASE_URL."
                                : "AI-engine stream ended without catalog_turn_complete line."
                );
                return;
            }
            String rawAssistantText = catalogComplete.path("assistant_text").asText("");
            final String assistantText;
            if (rawAssistantText == null || rawAssistantText.isBlank()) {
                log.warn(
                        "Case chat stream empty assistant_text from AI-engine, using fallback caseId={}",
                        prep.caseId()
                );
                assistantText = STREAM_EMPTY_ASSISTANT_FALLBACK;
            } else {
                assistantText = rawAssistantText;
            }
            JsonNode payloadNode = catalogComplete.get("ai_payload");
            Map<String, Object> aiPayload = objectMapper.convertValue(
                    payloadNode != null ? payloadNode : objectMapper.createObjectNode(),
                    new TypeReference<>() {}
            );
            TransactionTemplate tt = new TransactionTemplate(transactionManager);
            UUID assistantId = tt.execute(status -> {
                CaseChatThread thread = caseChatThreadRepository.findById(prep.threadId())
                        .orElseThrow(() -> new NotFoundException("Chat thread not found: " + prep.threadId()));
                CaseChatMessage asst = CaseChatMessage.builder()
                        .thread(thread)
                        .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                        .actorRole("AI_ENGINE")
                        .visibility(CaseChatMessage.VISIBILITY_ALL)
                        .phaseCode(prep.assistantPhaseCode())
                        .assessmentCode(prep.effectiveAssessment())
                        .intentCode(prep.intentCode())
                        .body(assistantText)
                        .aiPayload(aiPayload)
                        .build();
                caseChatMessageRepository.save(asst);
                thread.setUpdatedAt(java.time.OffsetDateTime.now());
                caseChatThreadRepository.save(thread);
                return asst.getId();
            });
            writeStreamDone(clientSink, prep, assistantId, streamLineNo, assistantText.length());
        } catch (BusinessException ex) {
            log.warn("Case chat catalog stream business error: {}", ex.getMessage());
            safeStreamError(clientSink, ex.getMessage());
        } catch (IOException ex) {
            if (isClientDisconnect(ex)) {
                log.debug("Case chat stream client disconnected: {}", ex.getMessage());
            } else {
                log.warn("Case chat catalog stream I/O error: {}", ex.getMessage());
                safeStreamError(clientSink, ex.getMessage());
            }
        } catch (Exception ex) {
            log.warn("Case chat catalog stream error: {}", ex.getMessage());
            safeStreamError(clientSink, ex.getMessage() != null ? ex.getMessage() : "Stream failed.");
        } finally {
            if (engineIn != null) {
                try {
                    engineIn.close();
                } catch (IOException ignored) {
                    // ignore
                }
            }
        }
    }

    /**
     * Streams narrate-only turns (phase change, document verify) via AI-engine {@code /narrate/stream}.
     */
    public void streamNarrateNdjsonToClient(CatalogStreamPrep prep, OutputStream clientSink) throws IOException {
        String jsonBody = objectMapper.writeValueAsString(prep.narrateBody());
        InputStream engineIn = null;
        int streamLineNo = 0;
        try {
            writeStreamBootstrapPhases(clientSink);
            if (prep.streamKind() == StreamTurnKind.VERIFY_DOCUMENT) {
                CaseChatNdjsonWriter.writeLine(
                        clientSink,
                        objectMapper,
                        CaseChatStreamEvents.Phase.of(CaseChatRunPhase.DOCUMENT_PROCESS)
                );
            } else if (prep.streamKind() == StreamTurnKind.CHANGE_PHASE) {
                CaseChatNdjsonWriter.writeLine(
                        clientSink,
                        objectMapper,
                        CaseChatStreamEvents.Phase.of(CaseChatRunPhase.DB_UPDATE)
                );
            }
            log.info(
                    "Case chat narrate stream opening AI-engine caseId={} threadId={} kind={}",
                    prep.caseId(),
                    prep.threadId(),
                    prep.streamKind()
            );
            engineIn = aiEngineHttpStreamClient.openPostStream("/internal/chat/narrate/stream", jsonBody);
            BufferedReader br = new BufferedReader(new InputStreamReader(engineIn, StandardCharsets.UTF_8));
            JsonNode narrateComplete = null;
            String engineLine;
            while ((engineLine = br.readLine()) != null) {
                if (engineLine.isBlank()) {
                    continue;
                }
                streamLineNo++;
                JsonNode lineNode = objectMapper.readTree(engineLine);
                String lineType = lineNode.path("type").asText("?");
                if ("narrate_complete".equals(lineType)) {
                    narrateComplete = lineNode;
                    log.info(
                            "Case chat narrate stream line {} type=narrate_complete assistantTextLen={} caseId={}",
                            streamLineNo,
                            narrateComplete.path("assistant_text").asText("").length(),
                            prep.caseId()
                    );
                    continue;
                }
                clientSink.write(engineLine.getBytes(StandardCharsets.UTF_8));
                clientSink.write('\n');
                clientSink.flush();
                if ("assistant_delta".equals(lineType)) {
                    log.debug(
                            "Case chat narrate stream line {} type=assistant_delta chunkLen={} caseId={}",
                            streamLineNo,
                            lineNode.path("text").asText("").length(),
                            prep.caseId()
                    );
                } else if ("error".equals(lineType)) {
                    log.warn(
                            "Case chat narrate stream line {} type=error message={} caseId={}",
                            streamLineNo,
                            lineNode.path("message").asText(""),
                            prep.caseId()
                    );
                }
            }
            if (narrateComplete == null) {
                log.warn(
                        "Case chat narrate stream no narrate_complete from AI-engine caseId={} engineLines={}",
                        prep.caseId(),
                        streamLineNo
                );
                CaseChatNdjsonWriter.writeErrorAndDone(
                        clientSink,
                        objectMapper,
                        streamLineNo == 0
                                ? "AI-engine returned no stream data. Check AI-engine is running on WEALTH_AI_ENGINE_BASE_URL."
                                : "AI-engine narrate stream ended without narrate_complete line."
                );
                return;
            }
            String rawAssistantText = narrateComplete.path("assistant_text").asText("");
            final String assistantText;
            if (rawAssistantText == null || rawAssistantText.isBlank()) {
                assistantText = prep.narrateFallbackText() != null && !prep.narrateFallbackText().isBlank()
                        ? prep.narrateFallbackText()
                        : STREAM_EMPTY_ASSISTANT_FALLBACK;
            } else {
                assistantText = rawAssistantText;
            }
            Map<String, Object> aiPayload = new LinkedHashMap<>(prep.assistantPayload());
            JsonNode narrNode = narrateComplete.get("chat_narrate");
            if (narrNode != null && !narrNode.isNull()) {
                aiPayload.put(
                        "chat_narrate",
                        objectMapper.convertValue(narrNode, new TypeReference<>() {})
                );
            }
            TransactionTemplate tt = new TransactionTemplate(transactionManager);
            UUID assistantId = tt.execute(status -> {
                CaseChatThread thread = caseChatThreadRepository.findById(prep.threadId())
                        .orElseThrow(() -> new NotFoundException("Chat thread not found: " + prep.threadId()));
                CaseChatMessage asst = CaseChatMessage.builder()
                        .thread(thread)
                        .senderKind(CaseChatMessage.SENDER_ASSISTANT)
                        .actorRole("AI_ENGINE")
                        .visibility(CaseChatMessage.VISIBILITY_ALL)
                        .phaseCode(prep.assistantPhaseCode())
                        .assessmentCode(null)
                        .intentCode(prep.intentCode())
                        .body(assistantText)
                        .aiPayload(aiPayload)
                        .build();
                caseChatMessageRepository.save(asst);
                thread.setUpdatedAt(java.time.OffsetDateTime.now());
                caseChatThreadRepository.save(thread);
                return asst.getId();
            });
            writeStreamDone(clientSink, prep, assistantId, streamLineNo, assistantText.length());
        } catch (BusinessException ex) {
            log.warn("Case chat narrate stream business error: {}", ex.getMessage());
            safeStreamError(clientSink, ex.getMessage());
        } catch (IOException ex) {
            if (isClientDisconnect(ex)) {
                log.debug("Case chat narrate stream client disconnected: {}", ex.getMessage());
            } else {
                log.warn("Case chat narrate stream I/O error: {}", ex.getMessage());
                safeStreamError(clientSink, ex.getMessage());
            }
        } catch (Exception ex) {
            log.warn("Case chat narrate stream error: {}", ex.getMessage());
            safeStreamError(clientSink, ex.getMessage() != null ? ex.getMessage() : "Stream failed.");
        } finally {
            if (engineIn != null) {
                try {
                    engineIn.close();
                } catch (IOException ignored) {
                    // ignore
                }
            }
        }
    }

    private void writeStreamDone(
            OutputStream clientSink,
            CatalogStreamPrep prep,
            UUID assistantId,
            int streamLineNo,
            int assistantTextLen
    ) throws IOException {
        CaseChatStreamEvents.Done done = new CaseChatStreamEvents.Done(
                prep.userMessageId().toString(),
                assistantId != null ? assistantId.toString() : null
        );
        CaseChatNdjsonWriter.writeLine(clientSink, objectMapper, done);
        log.info(
                "Case chat stream finished caseId={} kind={} lines={} assistantMessageId={} assistantTextLen={}",
                prep.caseId(),
                prep.streamKind(),
                streamLineNo,
                assistantId,
                assistantTextLen
        );
    }

    private void writeStreamBootstrapPhases(OutputStream clientSink) throws IOException {
        CaseChatNdjsonWriter.writeLine(clientSink, objectMapper, CaseChatStreamEvents.Phase.of(CaseChatRunPhase.ROUTING));
        CaseChatNdjsonWriter.writeLine(clientSink, objectMapper, CaseChatStreamEvents.Phase.of(CaseChatRunPhase.SEARCH));
    }

    private void safeStreamError(OutputStream clientSink, String message) {
        CaseChatNdjsonWriter.writeErrorAndDone(clientSink, objectMapper, message);
    }

    private static boolean isClientDisconnect(IOException ex) {
        String m = ex.getMessage();
        if (m == null) {
            return false;
        }
        String lower = m.toLowerCase();
        return lower.contains("closed")
                || lower.contains("broken pipe")
                || lower.contains("connection reset")
                || lower.contains("abort");
    }

    private List<Map<String, Object>> resolveAttachmentDetails(UUID caseId, List<UUID> attachmentIds) {
        if (attachmentIds.isEmpty()) {
            return List.of();
        }
        List<CaseDocument> rows = caseDocumentRepository.findAllByWealthCase_IdAndIdIn(caseId, attachmentIds);
        if (rows.size() != attachmentIds.size()) {
            throw new BusinessException("One or more attachment ids were not found for this case.");
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (CaseDocument cd : rows) {
            StoredDocument d = cd.getDocument();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("caseDocumentId", cd.getId().toString());
            m.put("documentId", d.getId().toString());
            m.put("docKind", cd.getDocKind());
            m.put("originalFilename", d.getOriginalFilename());
            m.put("contentType", d.getContentType());
            m.put("byteSize", d.getByteSize());
            m.put("storageKey", d.getStorageKey());
            list.add(m);
        }
        return list;
    }

    private static String persistedUserBody(String trimmedMessage, List<Map<String, Object>> attachmentDetails) {
        if (trimmedMessage != null && !trimmedMessage.isEmpty()) {
            return trimmedMessage;
        }
        if (attachmentDetails.isEmpty()) {
            return "";
        }
        return "📎 "
                + attachmentDetails.stream()
                .map(a -> String.valueOf(a.getOrDefault("originalFilename", "file")))
                .collect(Collectors.joining(", "));
    }

    private static String effectiveUserTextForAi(String trimmedMessage, List<Map<String, Object>> attachmentDetails) {
        if (trimmedMessage != null && !trimmedMessage.isEmpty()) {
            return trimmedMessage;
        }
        if (attachmentDetails.isEmpty()) {
            return "";
        }
        return "User uploaded file(s): "
                + attachmentDetails.stream()
                .map(a -> String.valueOf(a.getOrDefault("originalFilename", "file")))
                .collect(Collectors.joining(", "));
    }

    private static String extractTargetPhaseFromDetect(JsonNode detectJson) {
        if (detectJson == null || !detectJson.hasNonNull("target_phase_code")) {
            return null;
        }
        return detectJson.get("target_phase_code").asText().trim();
    }

    private static String extractVerifyActionFromDetect(JsonNode detectJson) {
        if (detectJson == null || !detectJson.hasNonNull("verify_action")) {
            return null;
        }
        String v = detectJson.get("verify_action").asText().trim().toUpperCase();
        if ("VERIFIED".equals(v) || "REJECTED".equals(v)) {
            return v;
        }
        return null;
    }

    /**
     * Pass-2 natural reply via AI-engine {@code /internal/chat/narrate}. On failure, falls back to raw findings JSON.
     */
    private String maybeNarrateChatReply(
            String userMessage,
            String effectivePhase,
            String effectiveAssessment,
            List<Map<String, Object>> history,
            JsonNode aiResult,
            Map<String, Object> payloadMap
    ) {
        Map<String, Object> narrateBody = new LinkedHashMap<>();
        narrateBody.put("user_message", userMessage != null ? userMessage.trim() : "");
        narrateBody.put(
                "input_language",
                ChatMessageLanguageDetector.detectForNarrate(userMessage, history));
        narrateBody.put("phase_code", effectivePhase);
        narrateBody.put("assessment_code", effectiveAssessment);
        narrateBody.put("conversation_history", history);
        Object findings = payloadMap.get("findings");
        if (findings != null) {
            narrateBody.put("pass1_findings", findings);
        }
        if (aiResult != null && aiResult.hasNonNull("output_text")) {
            narrateBody.put("pass1_output_text", aiResult.get("output_text").asText());
        }
        try {
            JsonNode narr = aiEngineChatClient.postNarrate(narrateBody);
            if (narr != null && narr.hasNonNull("chat_reply")) {
                String reply = narr.get("chat_reply").asText().trim();
                if (!reply.isEmpty()) {
                    Map<String, Object> narrMap = objectMapper.convertValue(narr, new TypeReference<>() {});
                    payloadMap.put("chat_narrate", narrMap);
                    return reply;
                }
            }
        } catch (BusinessException ex) {
            log.debug("Chat narrate skipped: {}", ex.getMessage());
        }
        return extractAssistantBodyPlainText(aiResult);
    }

    /**
     * When a phase transition is BLOCKED by prerequisite validation, ask the narrate LLM
     * to produce a friendly explanation instead of showing a raw error to the RM.
     * Falls back to the raw blocked reason if narrate is unavailable.
     */
    private String narrateBlockedPhaseTransition(
            String userMessage,
            String effectivePhase,
            List<Map<String, Object>> history,
            CaseChatPhaseTransitionService.TransitionResult tr,
            Map<String, Object> payloadMap
    ) {
        Map<String, Object> findings = new LinkedHashMap<>();
        findings.put("phase_transition_blocked", true);
        findings.put("current_phase", tr.fromPhase());
        findings.put("requested_phase", tr.toPhase());
        findings.put("blocked_reason", tr.message());

        Map<String, Object> narrateBody = new LinkedHashMap<>();
        narrateBody.put("user_message", userMessage != null ? userMessage.trim() : "");
        narrateBody.put(
                "input_language",
                ChatMessageLanguageDetector.detectForNarrate(userMessage, history));
        narrateBody.put("phase_code", effectivePhase);
        narrateBody.put("assessment_code", "phase_transition");
        narrateBody.put("conversation_history", history);
        narrateBody.put("pass1_findings", findings);

        try {
            JsonNode narr = aiEngineChatClient.postNarrate(narrateBody);
            if (narr != null && narr.hasNonNull("chat_reply")) {
                String reply = narr.get("chat_reply").asText().trim();
                if (!reply.isEmpty()) {
                    Map<String, Object> narrMap = objectMapper.convertValue(narr, new TypeReference<>() {});
                    payloadMap.put("chat_narrate", narrMap);
                    return reply;
                }
            }
        } catch (Exception ex) {
            log.debug("Blocked phase narrate fallback: {}", ex.getMessage());
        }
        return tr.message();
    }

    private String narrateSuccessfulPhaseTransition(
            String userMessage,
            String newPhase,
            List<Map<String, Object>> history,
            CaseChatPhaseTransitionService.TransitionResult tr,
            Map<String, Object> payloadMap
    ) {
        Map<String, Object> findings = new LinkedHashMap<>();
        findings.put("phase_transition_success", true);
        findings.put("from_phase", tr.fromPhase());
        findings.put("to_phase", tr.toPhase());
        findings.put("transition_mode", tr.mode());

        Map<String, Object> narrateBody = new LinkedHashMap<>();
        narrateBody.put("user_message", userMessage != null ? userMessage.trim() : "");
        narrateBody.put(
                "input_language",
                ChatMessageLanguageDetector.detectForNarrate(userMessage, history));
        narrateBody.put("phase_code", newPhase);
        narrateBody.put("assessment_code", "phase_transition");
        narrateBody.put("conversation_history", history);
        narrateBody.put("pass1_findings", findings);

        try {
            JsonNode narr = aiEngineChatClient.postNarrate(narrateBody);
            if (narr != null && narr.hasNonNull("chat_reply")) {
                String reply = narr.get("chat_reply").asText().trim();
                if (!reply.isEmpty()) {
                    Map<String, Object> narrMap = objectMapper.convertValue(narr, new TypeReference<>() {});
                    payloadMap.put("chat_narrate", narrMap);
                    return reply;
                }
            }
        } catch (Exception ex) {
            log.debug("Successful phase narrate fallback: {}", ex.getMessage());
        }
        return tr.message();
    }

    private String narrateDocumentReview(
            String userMessage,
            String effectivePhase,
            String verifyAction,
            List<Map<String, Object>> reviewResults,
            List<Map<String, Object>> history,
            Map<String, Object> payloadMap
    ) {
        Map<String, Object> findings = new LinkedHashMap<>();
        findings.put("document_review_completed", true);
        findings.put("verify_action", verifyAction);
        findings.put("review_results", reviewResults);

        Map<String, Object> narrateBody = new LinkedHashMap<>();
        narrateBody.put("user_message", userMessage != null ? userMessage.trim() : "");
        narrateBody.put(
                "input_language",
                ChatMessageLanguageDetector.detectForNarrate(userMessage, history));
        narrateBody.put("phase_code", effectivePhase);
        narrateBody.put("assessment_code", "document_review");
        narrateBody.put("conversation_history", history);
        narrateBody.put("pass1_findings", findings);

        try {
            JsonNode narr = aiEngineChatClient.postNarrate(narrateBody);
            if (narr != null && narr.hasNonNull("chat_reply")) {
                String reply = narr.get("chat_reply").asText().trim();
                if (!reply.isEmpty()) {
                    Map<String, Object> narrMap = objectMapper.convertValue(narr, new TypeReference<>() {});
                    payloadMap.put("chat_narrate", narrMap);
                    return reply;
                }
            }
        } catch (Exception ex) {
            log.debug("Document review narrate fallback: {}", ex.getMessage());
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Document review completed:\n");
        for (Map<String, Object> r : reviewResults) {
            if (r.containsKey("error")) {
                sb.append("- ").append(r.get("caseDocumentId")).append(": ERROR - ").append(r.get("error")).append("\n");
            } else {
                sb.append("- ").append(r.get("docKind")).append(": ").append(r.get("previousStatus")).append(" → ").append(r.get("currentStatus")).append("\n");
            }
        }
        return sb.toString().trim();
    }

    private CaseChatThread resolveThread(UUID caseId, UUID threadId) {
        CaseChatThread thread = caseChatThreadRepository.findById(threadId)
                .orElseThrow(() -> new NotFoundException("Chat thread not found: " + threadId));
        if (!thread.getWealthCase().getId().equals(caseId)) {
            throw new BusinessException("Thread does not belong to this case");
        }
        return thread;
    }

    private static String resolvePhaseCode(String overridePhase, WealthCase c) {
        if (overridePhase != null && !overridePhase.isBlank()) {
            return overridePhase.trim();
        }
        if (c.getPhase() != null && !c.getPhase().isBlank()) {
            return c.getPhase().trim();
        }
        return "ONBOARDING";
    }

    private List<Map<String, Object>> buildConversationHistoryForAi(UUID threadId, Authentication authentication) {
        boolean staff = isStaff(primaryRole(authentication));
        List<CaseChatMessage> chunk = caseChatMessageRepository.findByThread_IdOrderByCreatedAtDesc(
                threadId,
                PageRequest.of(0, HISTORY_WINDOW)
        );
        Collections.reverse(chunk);
        List<Map<String, Object>> out = new ArrayList<>();
        for (CaseChatMessage m : chunk) {
            if (!staff && CaseChatMessage.VISIBILITY_INTERNAL.equals(m.getVisibility())) {
                continue;
            }
            String role = CaseChatMessage.SENDER_ASSISTANT.equals(m.getSenderKind()) ? "assistant" : "user";
            String body = m.getBody() != null ? m.getBody() : "";
            if (body.length() > MAX_BODY_CHARS_FOR_CONTEXT) {
                body = body.substring(0, MAX_BODY_CHARS_FOR_CONTEXT - 1) + "…";
            }
            Map<String, Object> turn = new LinkedHashMap<>();
            turn.put("role", role);
            turn.put("content", body);
            out.add(turn);
        }
        return out;
    }

    /**
     * Persist human-readable chat text in {@code case_chat_message.body}, not raw JSON blobs.
     * Narrate path already returns plain text; this handles narrate-off / failure fallbacks.
     */
    private String extractAssistantBodyPlainText(JsonNode aiResult) {
        if (aiResult == null || aiResult.isNull()) {
            return "";
        }
        JsonNode outputText = aiResult.get("output_text");
        if (outputText != null && outputText.isTextual()) {
            String ot = outputText.asText().trim();
            if (!ot.isEmpty()) {
                String fromEmbedded = tryExtractAssistantLineFromJsonText(ot);
                if (fromEmbedded != null && !fromEmbedded.isBlank()) {
                    return fromEmbedded;
                }
                if (!looksLikeJsonObjectOrArray(ot)) {
                    return ot;
                }
            }
        }
        JsonNode findings = aiResult.get("findings");
        if (findings != null && findings.isObject()) {
            String line = tryExtractAssistantLineFromFindingsObject(findings);
            if (line != null && !line.isBlank()) {
                return line;
            }
            return summarizeFindingsAsPlainText(findings);
        }
        if (findings != null && findings.isTextual()) {
            return findings.asText();
        }
        if (outputText != null && outputText.isTextual()) {
            return outputText.asText();
        }
        return "Assessment completed. See message metadata for technical details.";
    }

    /** If {@code jsonText} is a JSON object, pull common narrative fields. */
    private String tryExtractAssistantLineFromJsonText(String jsonText) {
        if (jsonText == null || jsonText.isBlank() || !looksLikeJsonObjectOrArray(jsonText)) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(jsonText);
            if (!root.isObject()) {
                return null;
            }
            return tryExtractAssistantLineFromFindingsObject(root);
        } catch (Exception ex) {
            return null;
        }
    }

    private static boolean looksLikeJsonObjectOrArray(String s) {
        char c = s.charAt(0);
        return c == '{' || c == '[';
    }

    private static String tryExtractAssistantLineFromFindingsObject(JsonNode obj) {
        if (obj == null || !obj.isObject()) {
            return null;
        }
        for (String key : new String[] {"llm_assistant", "chat_reply", "message", "summary"}) {
            JsonNode n = obj.get(key);
            if (n != null && n.isTextual()) {
                String t = n.asText().trim();
                if (!t.isEmpty()) {
                    return t;
                }
            }
        }
        return null;
    }

    private static String summarizeFindingsAsPlainText(JsonNode findings) {
        if (findings.has("is_complete")) {
            boolean complete = findings.get("is_complete").asBoolean(false);
            if (complete) {
                return "Context completeness checks passed.";
            }
        }
        if (findings.has("missing_items") && findings.get("missing_items").isArray()) {
            var arr = findings.get("missing_items");
            if (arr.size() > 0) {
                List<String> parts = new ArrayList<>();
                arr.forEach(n -> {
                    if (n.isTextual()) {
                        parts.add(n.asText());
                    }
                });
                if (!parts.isEmpty()) {
                    return "Missing required context: " + String.join(", ", parts) + ".";
                }
            }
        }
        if (findings.has("profile_snapshot_error") && findings.get("profile_snapshot_error").isTextual()) {
            String err = findings.get("profile_snapshot_error").asText().trim();
            if (!err.isEmpty()) {
                return "Profile lookup: " + err;
            }
        }
        return "Assessment completed.";
    }

    private static String primaryRole(Authentication authentication) {
        if (authentication == null) {
            return "UNKNOWN";
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .findFirst()
                .orElse("USER");
    }

    private static boolean isStaff(String roleCode) {
        return roleCode != null && STAFF_ROLES.contains(roleCode);
    }
}
