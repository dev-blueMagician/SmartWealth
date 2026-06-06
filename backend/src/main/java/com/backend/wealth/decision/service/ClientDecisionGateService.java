package com.backend.wealth.decision.service;

import com.backend.wealth.cases.constants.CaseStatuses;
import com.backend.wealth.cases.service.CasePhaseService;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.decision.constants.DecisionStatuses;
import com.backend.wealth.decision.model.Decision;
import com.backend.wealth.decision.repository.DecisionRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.openapi.model.ClientDecisionRequest;
import com.backend.wealth.openapi.model.ClientDecisionResponse;
import com.backend.wealth.plan.constants.PlanStatuses;
import com.backend.wealth.plan.model.FinancialPlan;
import com.backend.wealth.plan.repository.FinancialPlanRepository;
import com.backend.wealth.recommendation.model.Recommendation;
import com.backend.wealth.recommendation.repository.RecommendationRepository;
import com.backend.wealth.support.TimeMappings;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ClientDecisionGateService {

    private final RecommendationRepository recommendationRepository;
    private final DecisionRepository decisionRepository;
    private final FinancialPlanRepository financialPlanRepository;
    private final WealthCaseRepository wealthCaseRepository;
    private final CasePhaseService casePhaseService;

    @Transactional
    public ClientDecisionResponse submitDecision(UUID recommendationId, ClientDecisionRequest request) {
        Recommendation rec = recommendationRepository.findById(recommendationId)
                .orElseThrow(() -> new NotFoundException("Recommendation not found: " + recommendationId));

        if (request.getDecisionStatus() == null) {
            throw new BusinessException("decisionStatus is required.");
        }
        String rawStatus = request.getDecisionStatus().getValue();

        Decision decision = Decision.builder()
                .recommendation(rec)
                .decisionStatus(rawStatus)
                .build();
        decisionRepository.save(decision);

        FinancialPlan plan = rec.getPlan();
        if (DecisionStatuses.APPROVED.equals(rawStatus)) {
            plan.setApproved(Boolean.TRUE);
            plan.setStatus(PlanStatuses.APPROVED);
            financialPlanRepository.save(plan);
            updateCasePhaseForDecision(plan.getClient().getId(), true);
        } else if (DecisionStatuses.REJECTED.equals(rawStatus)) {
            plan.setStatus(PlanStatuses.REJECTED);
            financialPlanRepository.save(plan);
            updateCasePhaseForDecision(plan.getClient().getId(), false);
        }

        ClientDecisionResponse response = new ClientDecisionResponse();
        response.setDecisionId(decision.getId());
        response.setRecommendationId(rec.getId());
        response.setDecisionStatus(decision.getDecisionStatus());
        response.setDecidedAt(TimeMappings.toOffset(decision.getDecidedAt()));
        response.setFinancialPlanId(plan.getId());
        response.setFinancialPlanStatus(plan.getStatus());
        response.setPlanApproved(plan.getApproved());
        return response;
    }

    private void updateCasePhaseForDecision(UUID clientId, boolean approved) {
        wealthCaseRepository.findFirstByClient_IdOrderByCreatedAtDesc(clientId).ifPresent(wc -> {
            if (approved) {
                wc.setPhase(casePhaseService.requireEnabledPhaseCode("EXECUTION"));
                wc.setStatus(CaseStatuses.READY);
            } else {
                wc.setPhase(casePhaseService.requireEnabledPhaseCode("COLLABORATION"));
                wc.setStatus(CaseStatuses.BLOCKED);
            }
            wealthCaseRepository.save(wc);
        });
    }
}
