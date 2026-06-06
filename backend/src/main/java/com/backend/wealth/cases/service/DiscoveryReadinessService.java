package com.backend.wealth.cases.service;

import com.backend.wealth.asset.repository.AssetRepository;
import com.backend.wealth.cases.constants.CaseStatuses;
import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.constants.ClientStatuses;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.goal.repository.GoalRepository;
import com.backend.wealth.openapi.model.DiscoveryCheckResponse;
import com.backend.wealth.task.constants.TaskStatuses;
import com.backend.wealth.task.constants.TaskTypes;
import com.backend.wealth.task.repository.TaskRepository;
import com.backend.wealth.workflow.service.AiGateValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DiscoveryReadinessService {

    private final WealthCaseRepository wealthCaseRepository;
    private final TaskRepository taskRepository;
    private final AiGateValidationService aiGateValidationService;
    private final CasePhaseService casePhaseService;
    private final AssetRepository assetRepository;
    private final GoalRepository goalRepository;

    @Transactional
    public DiscoveryCheckResponse markDiscoveryReady(UUID caseId) {
        aiGateValidationService.assertReady(
                caseId,
                "ONBOARDING",
                "discovery check"
        );

        WealthCase wc = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        Client client = wc.getClient();

        if (!ClientStatuses.ACTIVE.equals(client.getStatus())) {
            throw new BusinessException("Client must be registered (ACTIVE) before discovery check.");
        }

        taskRepository.findByWealthCase_IdAndTaskType(caseId, TaskTypes.PROFILE_COMPLETION)
                .filter(t -> TaskStatuses.COMPLETED.equals(t.getStatus()))
                .orElseThrow(() -> new BusinessException("PROFILE_COMPLETION task is not completed."));

        assertDiscoveryDataPresent(client.getId());

        wc.setPhase(casePhaseService.requireEnabledPhaseCode("PLANNING"));
        wc.setStatus(CaseStatuses.READY);
        wealthCaseRepository.save(wc);

        DiscoveryCheckResponse response = new DiscoveryCheckResponse();
        response.setCaseId(wc.getId());
        response.setCaseStatus(wc.getStatus());
        response.setMessage("Case moved to PLANNING and marked READY.");
        return response;
    }

    /**
     * Verify that at least one asset and one goal exist for the client.
     * Discovery phase requires capturing financial data before moving to planning.
     */
    public void assertDiscoveryDataPresent(UUID clientId) {
        if (assetRepository.findByClient_Id(clientId).isEmpty()) {
            throw new BusinessException(
                    "Cannot proceed to PLANNING: at least one asset record is required. "
                            + "Please add the client's assets during the Discovery phase."
            );
        }
        if (goalRepository.findByClient_Id(clientId).isEmpty()) {
            throw new BusinessException(
                    "Cannot proceed to PLANNING: at least one goal record is required. "
                            + "Please add the client's financial goals during the Discovery phase."
            );
        }
    }
}
