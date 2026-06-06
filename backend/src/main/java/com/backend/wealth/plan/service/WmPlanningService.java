package com.backend.wealth.plan.service;

import com.backend.wealth.cases.constants.CaseStatuses;
import com.backend.wealth.cases.service.CasePhaseService;
import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.openapi.model.FinancialPlanVersionResponse;
import com.backend.wealth.openapi.model.PlanCalculationStubRequest;
import com.backend.wealth.openapi.model.PlanDraftSeedRequest;
import com.backend.wealth.openapi.model.WmRecommendationCreateRequest;
import com.backend.wealth.openapi.model.WmRecommendationResponse;
import com.backend.wealth.plan.constants.PlanStatuses;
import com.backend.wealth.plan.model.FinancialPlan;
import com.backend.wealth.plan.repository.FinancialPlanRepository;
import com.backend.wealth.recommendation.model.Recommendation;
import com.backend.wealth.recommendation.repository.RecommendationRepository;
import com.backend.wealth.support.TimeMappings;
import com.backend.wealth.workflow.service.AiGateValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WmPlanningService {

    private final FinancialPlanRepository financialPlanRepository;
    private final RecommendationRepository recommendationRepository;
    private final ClientRepository clientRepository;
    private final WealthCaseRepository wealthCaseRepository;
    private final AiGateValidationService aiGateValidationService;
    private final CasePhaseService casePhaseService;

    @Transactional
    public FinancialPlanVersionResponse createDraft(UUID clientId, PlanDraftSeedRequest seed) {
        WealthCase wealthCase = requireCaseReadyForPlanning(clientId);

        var client = clientRepository.findById(clientId)
                .orElseThrow(() -> new NotFoundException("Client not found: " + clientId));

        Map<String, Object> initial = new HashMap<>();
        initial.put("seedNote", seed != null ? seed.getNote() : null);

        FinancialPlan plan = FinancialPlan.builder()
                .client(client)
                .status(PlanStatuses.DRAFT)
                .versionNo(1)
                .approved(Boolean.FALSE)
                .content(initial)
                .build();
        financialPlanRepository.save(plan);

        wealthCase.setPhase(casePhaseService.requireEnabledPhaseCode("PLANNING"));
        wealthCase.setStatus(CaseStatuses.IN_PROGRESS);
        wealthCaseRepository.save(wealthCase);
        return toPlanResponse(plan);
    }

    @Transactional
    public FinancialPlanVersionResponse runDraftCalculation(UUID planId, PlanCalculationStubRequest stub) {
        FinancialPlan plan = financialPlanRepository.findById(planId)
                .orElseThrow(() -> new NotFoundException("Plan not found: " + planId));

        Map<String, Object> content = plan.getContent() != null
                ? new HashMap<>(plan.getContent())
                : new HashMap<>();
        content.put("calculationStub", Map.of(
                "scenarioKey", stub != null ? stub.getScenarioKey() : "DEFAULT",
                "assumptions", stub != null && stub.getAssumptions() != null ? stub.getAssumptions() : Map.of()
        ));
        content.put("computedAt", java.time.OffsetDateTime.now().toString());
        plan.setContent(content);
        financialPlanRepository.save(plan);
        return toPlanResponse(plan);
    }

    @Transactional(readOnly = true)
    public List<FinancialPlanVersionResponse> listPlansForClient(UUID clientId) {
        clientRepository.findById(clientId)
                .orElseThrow(() -> new NotFoundException("Client not found: " + clientId));
        return financialPlanRepository.findByClient_Id(clientId).stream()
                .map(this::toPlanResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WmRecommendationResponse> listRecommendationsForPlan(UUID planVersionId) {
        FinancialPlan plan = financialPlanRepository.findById(planVersionId)
                .orElseThrow(() -> new NotFoundException("Plan version not found: " + planVersionId));
        return recommendationRepository.findByPlan_Id(plan.getId()).stream()
                .map(this::toRecommendationResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public WmRecommendationResponse createRecommendation(UUID planVersionId, WmRecommendationCreateRequest request) {
        FinancialPlan plan = financialPlanRepository.findById(planVersionId)
                .orElseThrow(() -> new NotFoundException("Plan version not found: " + planVersionId));

        Recommendation rec = Recommendation.builder()
                .plan(plan)
                .recType(request.getRecType())
                .summary(request.getSummary())
                .build();
        recommendationRepository.save(rec);
        updateCaseForCollaboration(plan.getClient().getId());

        WmRecommendationResponse response = new WmRecommendationResponse();
        response.setId(rec.getId());
        response.setPlanVersionId(plan.getId());
        response.setRecType(rec.getRecType());
        response.setSummary(rec.getSummary());
        response.setCreatedAt(TimeMappings.toOffset(rec.getCreatedAt()));
        return response;
    }

    private WmRecommendationResponse toRecommendationResponse(Recommendation rec) {
        WmRecommendationResponse response = new WmRecommendationResponse();
        response.setId(rec.getId());
        response.setPlanVersionId(rec.getPlan().getId());
        response.setRecType(rec.getRecType());
        response.setSummary(rec.getSummary());
        response.setCreatedAt(TimeMappings.toOffset(rec.getCreatedAt()));
        return response;
    }

    private WealthCase requireCaseReadyForPlanning(UUID clientId) {
        WealthCase wc = wealthCaseRepository.findFirstByClient_IdOrderByCreatedAtDesc(clientId)
                .orElseThrow(() -> new BusinessException("No case for client."));
        aiGateValidationService.assertReady(
                wc.getId(),
                "PLANNING",
                "planning draft creation"
        );
        if (!casePhaseService.isPhase(wc.getPhase(), "PLANNING") || !CaseStatuses.READY.equals(wc.getStatus())) {
            throw new BusinessException("Case must be PLANNING and READY before WM planning.");
        }
        return wc;
    }

    private void updateCaseForCollaboration(UUID clientId) {
        wealthCaseRepository.findFirstByClient_IdOrderByCreatedAtDesc(clientId).ifPresent(wc -> {
            wc.setPhase(casePhaseService.requireEnabledPhaseCode("COLLABORATION"));
            wc.setStatus(CaseStatuses.READY);
            wealthCaseRepository.save(wc);
        });
    }

    private FinancialPlanVersionResponse toPlanResponse(FinancialPlan plan) {
        FinancialPlanVersionResponse response = new FinancialPlanVersionResponse();
        response.setId(plan.getId());
        response.setClientId(plan.getClient().getId());
        response.setStatus(plan.getStatus());
        response.setVersionNo(plan.getVersionNo());
        response.setApproved(plan.getApproved());
        response.setContent(plan.getContent());
        response.setCreatedAt(TimeMappings.toOffset(plan.getCreatedAt()));
        return response;
    }
}
