package com.backend.wealth.workflow.controller;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.workflow.model.WorkflowStateEntity;
import com.backend.wealth.workflow.repository.WorkflowStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/workflows")
@RequiredArgsConstructor
public class WorkflowLinkQueryController {

    private final WealthCaseRepository wealthCaseRepository;
    private final WorkflowStateRepository workflowStateRepository;

    @GetMapping("/by-client/{clientId}")
    public List<WorkflowLinkItem> listByClient(@PathVariable UUID clientId) {
        List<WealthCase> wealthCases = wealthCaseRepository.findByClient_IdOrderByCreatedAtDesc(clientId);
        if (wealthCases.isEmpty()) {
            return List.of();
        }
        Map<UUID, WorkflowStateEntity> workflowByCaseId = workflowStateRepository.findByCaseIdIn(
                        wealthCases.stream().map(WealthCase::getId).toList()
                ).stream()
                .filter(state -> state.getCaseId() != null)
                .collect(Collectors.toMap(WorkflowStateEntity::getCaseId, Function.identity(), (left, right) -> left));

        return wealthCases.stream()
                .filter(wc -> workflowByCaseId.containsKey(wc.getId()))
                .map(wc -> new WorkflowLinkItem(
                        workflowByCaseId.get(wc.getId()).getWorkflowId(),
                        wc.getId(),
                        clientId,
                        wc.getType(),
                        wc.getStatus()
                ))
                .toList();
    }

    public record WorkflowLinkItem(
            String workflowId,
            UUID caseId,
            UUID clientId,
            String caseType,
            String caseStatus
    ) {
    }
}
