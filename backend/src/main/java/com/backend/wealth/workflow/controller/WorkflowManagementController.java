package com.backend.wealth.workflow.controller;

import com.backend.wealth.workflow.service.BackendWorkflowService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Validated
@RequiredArgsConstructor
@RequestMapping("/api/v1/workflows")
public class WorkflowManagementController {

    private final BackendWorkflowService backendWorkflowService;

    @PostMapping("")
    public Map<String, Object> createWorkflow(@RequestBody CreateWorkflowRequest request) {
        Map<String, Object> payload = request != null && request.payload() != null ? request.payload() : Map.of();
        UUID caseId = request != null ? request.caseId() : null;
        return backendWorkflowService.createWorkflow(payload, caseId);
    }

    @GetMapping("")
    public List<Map<String, Object>> listWorkflows(
            @RequestParam(defaultValue = "100")
            @Min(1)
            @Max(1000)
            int limit
    ) {
        return backendWorkflowService.listWorkflows(limit);
    }

    @PostMapping("/{workflowId}/run")
    public Map<String, Object> runWorkflow(@PathVariable String workflowId) {
        return backendWorkflowService.runWorkflow(workflowId);
    }

    @GetMapping("/{workflowId}")
    public Map<String, Object> getWorkflow(@PathVariable String workflowId) {
        return backendWorkflowService.getWorkflow(workflowId);
    }

    @GetMapping("/{workflowId}/audit-events")
    public List<Map<String, Object>> listAuditEvents(@PathVariable String workflowId) {
        return backendWorkflowService.listAuditEvents(workflowId);
    }

    @PostMapping("/{workflowId}/human-approval")
    public Map<String, Object> applyHumanApproval(
            @PathVariable String workflowId,
            @RequestBody HumanApprovalRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required.");
        }
        return backendWorkflowService.applyHumanApproval(
                workflowId,
                request.approved(),
                request.reviewer_id(),
                request.note()
        );
    }

    public record CreateWorkflowRequest(Map<String, Object> payload, UUID caseId) {
    }

    public record HumanApprovalRequest(boolean approved, String reviewer_id, String note) {
    }
}
