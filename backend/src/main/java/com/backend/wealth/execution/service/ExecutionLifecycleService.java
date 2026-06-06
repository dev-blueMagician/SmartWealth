package com.backend.wealth.execution.service;

import com.backend.wealth.audit.constants.AuditActions;
import com.backend.wealth.audit.constants.AuditEntities;
import com.backend.wealth.audit.model.AuditEvent;
import com.backend.wealth.audit.repository.AuditEventRepository;
import com.backend.wealth.cases.constants.CaseStatuses;
import com.backend.wealth.cases.service.CasePhaseService;
import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.execution.constants.ExecutionInstructionStatuses;
import com.backend.wealth.execution.model.ExecutionInstruction;
import com.backend.wealth.execution.repository.ExecutionInstructionRepository;
import com.backend.wealth.openapi.model.ExecutionInstructionCreateRequest;
import com.backend.wealth.openapi.model.ExecutionInstructionResponse;
import com.backend.wealth.openapi.model.ExecutionResultRequest;
import com.backend.wealth.openapi.model.ExecutionResultResponse;
import com.backend.wealth.openapi.model.ExecutionSendRequest;
import com.backend.wealth.openapi.model.ResultAllocationItem;
import com.backend.wealth.plan.constants.PlanStatuses;
import com.backend.wealth.portfolio.model.Portfolio;
import com.backend.wealth.portfolio.model.PortfolioAllocation;
import com.backend.wealth.portfolio.repository.PortfolioAllocationRepository;
import com.backend.wealth.portfolio.repository.PortfolioRepository;
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
public class ExecutionLifecycleService {

    private final RecommendationRepository recommendationRepository;
    private final ExecutionInstructionRepository executionInstructionRepository;
    private final PortfolioRepository portfolioRepository;
    private final PortfolioAllocationRepository portfolioAllocationRepository;
    private final AuditEventRepository auditEventRepository;
    private final WealthCaseRepository wealthCaseRepository;
    private final AiGateValidationService aiGateValidationService;
    private final CasePhaseService casePhaseService;

    @Transactional
    public ExecutionInstructionResponse createInstruction(ExecutionInstructionCreateRequest request) {
        Recommendation rec = recommendationRepository.findById(request.getRecommendationId())
                .orElseThrow(() -> new NotFoundException("Recommendation not found: " + request.getRecommendationId()));
        WealthCase wealthCase = wealthCaseRepository.findFirstByClient_IdOrderByCreatedAtDesc(rec.getPlan().getClient().getId())
                .orElseThrow(() -> new BusinessException("No case found for client when validating execution gate."));
        aiGateValidationService.assertReady(
                wealthCase.getId(),
                "EXECUTION",
                "execution instruction creation"
        );

        var plan = rec.getPlan();
        if (!PlanStatuses.APPROVED.equals(plan.getStatus()) || !Boolean.TRUE.equals(plan.getApproved())) {
            throw new BusinessException("Financial plan must be APPROVED before creating execution instructions.");
        }

        Map<String, Object> payload = new HashMap<>();
        if (request.getPayload() != null) {
            payload.putAll(request.getPayload());
        }
        if (request.getNote() != null) {
            payload.put("note", request.getNote());
        }

        ExecutionInstruction instruction = ExecutionInstruction.builder()
                .recommendation(rec)
                .status(ExecutionInstructionStatuses.DRAFT)
                .payload(payload.isEmpty() ? null : payload)
                .build();
        executionInstructionRepository.save(instruction);
        wealthCase.setPhase(casePhaseService.requireEnabledPhaseCode("EXECUTION"));
        wealthCase.setStatus(CaseStatuses.IN_PROGRESS);
        wealthCaseRepository.save(wealthCase);

        auditEventRepository.save(AuditEvent.builder()
                .entityName(AuditEntities.EXECUTION)
                .action(AuditActions.EXECUTION_TRIGGER)
                .build());

        return toInstructionResponse(instruction);
    }

    @Transactional
    public ExecutionInstructionResponse sendInstruction(ExecutionSendRequest request) {
        ExecutionInstruction instruction = executionInstructionRepository.findById(request.getInstructionId())
                .orElseThrow(() -> new NotFoundException("Instruction not found: " + request.getInstructionId()));

        if (!ExecutionInstructionStatuses.DRAFT.equals(instruction.getStatus())) {
            throw new BusinessException("Only DRAFT instructions can be sent.");
        }

        instruction.setStatus(ExecutionInstructionStatuses.SENT);
        executionInstructionRepository.save(instruction);
        return toInstructionResponse(instruction);
    }

    @Transactional
    public ExecutionResultResponse recordResults(ExecutionResultRequest request) {
        ExecutionInstruction instruction = executionInstructionRepository.findById(request.getInstructionId())
                .orElseThrow(() -> new NotFoundException("Instruction not found: " + request.getInstructionId()));

        if (!ExecutionInstructionStatuses.SENT.equals(instruction.getStatus())) {
            throw new BusinessException("Instruction must be SENT before recording results.");
        }

        Recommendation rec = instruction.getRecommendation();
        Client client = rec.getPlan().getClient();

        Portfolio portfolio = portfolioRepository.findByClient_Id(client.getId()).stream()
                .findFirst()
                .orElseGet(() -> portfolioRepository.save(Portfolio.builder().client(client).build()));

        portfolioAllocationRepository.deleteByPortfolio_Id(portfolio.getId());

        if (request.getAllocations() != null) {
            for (ResultAllocationItem item : request.getAllocations()) {
                PortfolioAllocation row = PortfolioAllocation.builder()
                        .portfolio(portfolio)
                        .assetClass(item.getAssetClass())
                        .percentage(item.getPercentage())
                        .build();
                portfolioAllocationRepository.save(row);
            }
        }

        instruction.setStatus(ExecutionInstructionStatuses.EXECUTED);
        executionInstructionRepository.save(instruction);
        wealthCaseRepository.findFirstByClient_IdOrderByCreatedAtDesc(client.getId()).ifPresent(wc -> {
            wc.setPhase(casePhaseService.requireEnabledPhaseCode("MONITORING"));
            wc.setStatus(CaseStatuses.IN_PROGRESS);
            wealthCaseRepository.save(wc);
        });

        ExecutionResultResponse response = new ExecutionResultResponse();
        response.setInstructionId(instruction.getId());
        response.setInstructionStatus(instruction.getStatus());
        response.setPortfolioId(portfolio.getId());
        response.setMessage("Portfolio updated; instruction EXECUTED.");
        return response;
    }

    @Transactional(readOnly = true)
    public List<ExecutionInstructionResponse> listInstructionsByClientId(UUID clientId) {
        return executionInstructionRepository.findByPlanClientId(clientId).stream()
                .map(this::toInstructionResponse)
                .collect(Collectors.toList());
    }

    private ExecutionInstructionResponse toInstructionResponse(ExecutionInstruction instruction) {
        ExecutionInstructionResponse response = new ExecutionInstructionResponse();
        response.setId(instruction.getId());
        response.setRecommendationId(instruction.getRecommendation().getId());
        response.setStatus(instruction.getStatus());
        response.setCreatedAt(TimeMappings.toOffset(instruction.getCreatedAt()));
        return response;
    }
}
