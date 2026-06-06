package com.backend.wealth.planning.service;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.plan.constants.PlanStatuses;
import com.backend.wealth.plan.model.FinancialPlan;
import com.backend.wealth.plan.repository.FinancialPlanRepository;
import com.backend.wealth.planning.dto.CreatePlanningDraftRequest;
import com.backend.wealth.planning.dto.PlanningDraftResponse;
import com.backend.wealth.planning.dto.PlanningDraftSummaryResponse;
import com.backend.wealth.planning.dto.RegeneratePlanningDraftRequest;
import com.backend.wealth.planning.model.PlanTemplate;
import com.backend.wealth.planning.repository.PlanTemplateRepository;
import com.backend.wealth.support.TimeMappings;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlanningDraftService {

    private final WealthCaseRepository wealthCaseRepository;
    private final PlanTemplateRepository planTemplateRepository;
    private final FinancialPlanRepository financialPlanRepository;
    private final PlanningAgentComposeService planningAgentComposeService;

    @Transactional
    public PlanningDraftResponse createDraft(UUID caseId, CreatePlanningDraftRequest req) {
        WealthCase wealthCase = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        PlanTemplate template = planTemplateRepository.findById(req.templateId())
                .orElseThrow(() -> new NotFoundException("Plan template not found: " + req.templateId()));

        Map<String, Object> payload = planningAgentComposeService.buildComposedPayload(
                wealthCase.getId(),
                wealthCase.getClient().getId(),
                template,
                req.assumptions(),
                false
        );

        FinancialPlan plan = FinancialPlan.builder()
                .client(wealthCase.getClient())
                .template(template)
                .status(PlanStatuses.DRAFT)
                .versionNo(1)
                .approved(Boolean.FALSE)
                .content(payload)
                .build();
        financialPlanRepository.save(plan);
        return toResponse(plan, wealthCase.getId());
    }

    @Transactional(readOnly = true)
    public List<PlanningDraftSummaryResponse> listDraftsForCase(UUID caseId) {
        WealthCase wealthCase = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        String caseKey = caseId.toString();
        List<PlanningDraftSummaryResponse> rows = new ArrayList<>();
        for (FinancialPlan plan : financialPlanRepository.findByClient_IdOrderByCreatedAtDesc(
                wealthCase.getClient().getId())) {
            UUID planCaseId = extractCaseId(plan);
            if (planCaseId == null || !planCaseId.equals(caseId)) {
                continue;
            }
            String templateCode = plan.getTemplate() != null ? plan.getTemplate().getCode() : null;
            rows.add(new PlanningDraftSummaryResponse(
                    plan.getId(),
                    caseId,
                    plan.getClient().getId(),
                    plan.getTemplate() != null ? plan.getTemplate().getId() : null,
                    templateCode,
                    plan.getStatus(),
                    TimeMappings.toOffset(plan.getCreatedAt()),
                    TimeMappings.toOffset(plan.getFinalizedAt())
            ));
        }
        rows.sort(Comparator.comparing(PlanningDraftSummaryResponse::createdAt).reversed());
        return rows;
    }

    @Transactional(readOnly = true)
    public PlanningDraftResponse getDraft(UUID planId) {
        FinancialPlan plan = financialPlanRepository.findById(planId)
                .orElseThrow(() -> new NotFoundException("Plan draft not found: " + planId));
        UUID caseId = extractCaseId(plan);
        return toResponse(plan, caseId);
    }

    @Transactional
    public PlanningDraftResponse regenerate(UUID planId, RegeneratePlanningDraftRequest req) {
        FinancialPlan plan = financialPlanRepository.findById(planId)
                .orElseThrow(() -> new NotFoundException("Plan draft not found: " + planId));
        if (PlanStatuses.FINALIZED.equals(plan.getStatus()) || PlanStatuses.APPROVED.equals(plan.getStatus())) {
            throw new BusinessException("Cannot regenerate finalized/approved planning draft.");
        }
        UUID caseId = extractCaseId(plan);
        if (caseId == null) {
            throw new BusinessException("Plan payload missing caseId; cannot regenerate.");
        }
        PlanTemplate template = plan.getTemplate();
        if (template == null) {
            throw new BusinessException("Plan draft missing template_id.");
        }

        Map<String, Object> payload = planningAgentComposeService.buildComposedPayload(
                caseId,
                plan.getClient().getId(),
                template,
                req == null ? Map.of() : req.assumptions(),
                req != null && req.markReadyForReview()
        );
        plan.setContent(payload);
        plan.setStatus(req != null && req.markReadyForReview()
                ? PlanStatuses.READY_FOR_REVIEW
                : PlanStatuses.DRAFT_UPDATED);
        financialPlanRepository.save(plan);
        return toResponse(plan, caseId);
    }

    @Transactional
    public PlanningDraftResponse finalizeDraft(UUID planId) {
        FinancialPlan plan = financialPlanRepository.findById(planId)
                .orElseThrow(() -> new NotFoundException("Plan draft not found: " + planId));
        if (PlanStatuses.APPROVED.equals(plan.getStatus())) {
            throw new BusinessException("Plan is already approved.");
        }
        plan.setStatus(PlanStatuses.FINALIZED);
        plan.setFinalizedAt(LocalDateTime.now());
        financialPlanRepository.save(plan);
        return toResponse(plan, extractCaseId(plan));
    }

    private PlanningDraftResponse toResponse(FinancialPlan plan, UUID caseId) {
        return new PlanningDraftResponse(
                plan.getId(),
                caseId,
                plan.getClient().getId(),
                plan.getTemplate() != null ? plan.getTemplate().getId() : null,
                plan.getStatus(),
                Boolean.TRUE.equals(plan.getApproved()),
                TimeMappings.toOffset(plan.getCreatedAt()),
                TimeMappings.toOffset(plan.getFinalizedAt()),
                plan.getContent()
        );
    }

    private UUID extractCaseId(FinancialPlan plan) {
        if (plan.getContent() == null) {
            return null;
        }
        Object raw = plan.getContent().get("caseId");
        if (!(raw instanceof String text)) {
            return null;
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
