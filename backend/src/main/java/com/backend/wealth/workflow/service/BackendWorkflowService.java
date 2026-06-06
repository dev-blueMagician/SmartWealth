package com.backend.wealth.workflow.service;

import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.workflow.model.WorkflowAuditEventEntity;
import com.backend.wealth.workflow.model.WorkflowStateEntity;
import com.backend.wealth.workflow.repository.WorkflowAuditEventRepository;
import com.backend.wealth.workflow.repository.WorkflowStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BackendWorkflowService {

    private static final String STATUS_RECEIVED = "RECEIVED";
    private static final String STATUS_VALIDATED = "VALIDATED";
    private static final String STATUS_DRAFTED = "DRAFTED";
    private static final String STATUS_PENDING_HUMAN_APPROVAL = "PENDING_HUMAN_APPROVAL";
    private static final String STATUS_HUMAN_APPROVED = "HUMAN_APPROVED";
    private static final String STATUS_HUMAN_REJECTED = "HUMAN_REJECTED";

    private final WorkflowStateRepository workflowStateRepository;
    private final WorkflowAuditEventRepository workflowAuditEventRepository;

    @Transactional
    public Map<String, Object> createWorkflow(Map<String, Object> payload) {
        return createWorkflow(payload, null);
    }

    @Transactional
    public Map<String, Object> createWorkflow(Map<String, Object> payload, UUID caseId) {
        WorkflowStateEntity entity = WorkflowStateEntity.builder()
                .workflowId(java.util.UUID.randomUUID().toString())
                .status(STATUS_RECEIVED)
                .caseId(caseId)
                .inputPayload(payload != null ? payload : Map.of())
                .version(1)
                .updatedAt(OffsetDateTime.now())
                .build();
        workflowStateRepository.save(entity);

        appendAudit(
                entity.getWorkflowId(),
                "WORKFLOW_CREATED",
                "SYSTEM",
                "backend_workflow_service",
                Map.of("payload_keys", new ArrayList<>(entity.getInputPayload().keySet()))
        );
        return toWorkflowResponse(entity);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listWorkflows(int limit) {
        int boundedLimit = Math.min(Math.max(limit, 1), 1000);
        return workflowStateRepository.findAllByOrderByUpdatedAtDesc(PageRequest.of(0, boundedLimit))
                .stream()
                .map(this::toWorkflowResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getWorkflow(String workflowId) {
        WorkflowStateEntity entity = workflowStateRepository.findById(workflowId)
                .orElseThrow(() -> new NotFoundException("Workflow " + workflowId + " not found"));
        return toWorkflowResponse(entity);
    }

    @Transactional
    public Map<String, Object> runWorkflow(String workflowId) {
        WorkflowStateEntity state = workflowStateRepository.findById(workflowId)
                .orElseThrow(() -> new NotFoundException("Workflow " + workflowId + " not found"));

        while (!isTerminalForRun(state.getStatus())) {
            if (STATUS_RECEIVED.equals(state.getStatus())) {
                boolean valid = state.getInputPayload() != null && !state.getInputPayload().isEmpty();
                appendAudit(
                        state.getWorkflowId(),
                        "VALIDATION_EXECUTED",
                        "AGENT",
                        "data_validation_agent",
                        Map.of("is_valid", valid)
                );
                if (!valid) {
                    transitionTo(state, STATUS_PENDING_HUMAN_APPROVAL);
                    appendAudit(
                            state.getWorkflowId(),
                            "WORKFLOW_BLOCKED_BY_VALIDATION",
                            "ORCHESTRATOR",
                            "backend_workflow_orchestrator",
                            Map.of("reason", List.of("Payload must not be empty."))
                    );
                    break;
                }
                transitionTo(state, STATUS_VALIDATED);
                appendAudit(
                        state.getWorkflowId(),
                        "STATE_TRANSITION",
                        "ORCHESTRATOR",
                        "backend_workflow_orchestrator",
                        Map.of("to_state", STATUS_VALIDATED)
                );
                continue;
            }

            if (STATUS_VALIDATED.equals(state.getStatus())) {
                Map<String, Object> payload = state.getInputPayload() != null ? state.getInputPayload() : Map.of();
                List<String> segments = payload.entrySet().stream()
                        .map(entry -> entry.getKey() + "=" + String.valueOf(entry.getValue()))
                        .toList();
                Map<String, Object> draft = new LinkedHashMap<>();
                draft.put("content", "AI draft (SSOT grounded): " + String.join("; ", segments));
                draft.put("source_fields", new ArrayList<>(payload.keySet()));
                draft.put("generated_at", OffsetDateTime.now().toString());
                state.setAiDraft(draft);
                transitionTo(state, STATUS_DRAFTED);
                appendAudit(
                        state.getWorkflowId(),
                        "AI_DRAFT_CREATED",
                        "AGENT",
                        "drafting_agent",
                        Map.of("draft_preview", draft.get("content"))
                );
                continue;
            }

            if (STATUS_DRAFTED.equals(state.getStatus())) {
                transitionTo(state, STATUS_PENDING_HUMAN_APPROVAL);
                appendAudit(
                        state.getWorkflowId(),
                        "STATE_TRANSITION",
                        "ORCHESTRATOR",
                        "backend_workflow_orchestrator",
                        Map.of("to_state", STATUS_PENDING_HUMAN_APPROVAL)
                );
                continue;
            }

            throw new BusinessException("Unsupported workflow state: " + state.getStatus());
        }

        workflowStateRepository.save(state);
        return toWorkflowResponse(state);
    }

    @Transactional
    public Map<String, Object> applyHumanApproval(String workflowId, boolean approved, String reviewerId, String note) {
        WorkflowStateEntity state = workflowStateRepository.findById(workflowId)
                .orElseThrow(() -> new NotFoundException("Workflow " + workflowId + " not found"));
        if (!STATUS_PENDING_HUMAN_APPROVAL.equals(state.getStatus())) {
            throw new BusinessException("Human decision is allowed only at PENDING_HUMAN_APPROVAL state.");
        }

        Map<String, Object> decision = new LinkedHashMap<>();
        decision.put("approved", approved);
        decision.put("reviewer_id", reviewerId);
        decision.put("note", note);

        state.setHumanDecision(decision);
        transitionTo(state, approved ? STATUS_HUMAN_APPROVED : STATUS_HUMAN_REJECTED);
        workflowStateRepository.save(state);

        appendAudit(
                state.getWorkflowId(),
                "HUMAN_DECISION_RECORDED",
                "HUMAN",
                reviewerId,
                Map.of("approved", approved, "note", note)
        );
        return toWorkflowResponse(state);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listAuditEvents(String workflowId) {
        if (!workflowStateRepository.existsById(workflowId)) {
            throw new NotFoundException("Workflow " + workflowId + " not found");
        }
        return workflowAuditEventRepository.findByWorkflowIdOrderByCreatedAtAsc(workflowId)
                .stream()
                .map(this::toAuditResponse)
                .toList();
    }

    private void transitionTo(WorkflowStateEntity state, String status) {
        state.setStatus(status);
        state.setVersion(state.getVersion() + 1);
        state.setUpdatedAt(OffsetDateTime.now());
    }

    private boolean isTerminalForRun(String status) {
        return STATUS_PENDING_HUMAN_APPROVAL.equals(status)
                || STATUS_HUMAN_APPROVED.equals(status)
                || STATUS_HUMAN_REJECTED.equals(status);
    }

    private void appendAudit(
            String workflowId,
            String eventType,
            String actorType,
            String actorId,
            Map<String, Object> payload
    ) {
        WorkflowAuditEventEntity entity = WorkflowAuditEventEntity.builder()
                .eventId(java.util.UUID.randomUUID().toString())
                .workflowId(workflowId)
                .eventType(eventType)
                .actorType(actorType)
                .actorId(actorId)
                .payload(payload != null ? payload : Map.of())
                .createdAt(OffsetDateTime.now())
                .build();
        workflowAuditEventRepository.save(entity);
    }

    private Map<String, Object> toWorkflowResponse(WorkflowStateEntity state) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("workflow_id", state.getWorkflowId());
        response.put("case_id", state.getCaseId());
        response.put("status", state.getStatus());
        response.put("version", state.getVersion());
        response.put("ai_draft", state.getAiDraft());
        response.put("human_decision", state.getHumanDecision());
        response.put("updated_at", state.getUpdatedAt() != null ? state.getUpdatedAt().toString() : null);
        return response;
    }

    private Map<String, Object> toAuditResponse(WorkflowAuditEventEntity entity) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("event_id", entity.getEventId());
        response.put("event_type", entity.getEventType());
        response.put("actor_type", entity.getActorType());
        response.put("actor_id", entity.getActorId());
        response.put("payload", entity.getPayload());
        response.put("created_at", entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null);
        return response;
    }
}
