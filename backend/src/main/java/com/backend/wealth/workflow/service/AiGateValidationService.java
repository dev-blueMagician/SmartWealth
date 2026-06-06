package com.backend.wealth.workflow.service;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.cases.service.CasePhaseService;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.workflow.repository.WorkflowStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiGateValidationService {

    private static final String DECISION_STOP = "STOP";

    private final WealthCaseRepository wealthCaseRepository;
    private final WorkflowStateRepository workflowStateRepository;
    private final JdbcTemplate jdbcTemplate;
    private final CasePhaseService casePhaseService;

    @Value("${wealth.ai-gate.enabled:true}")
    private boolean aiGateEnabled;

    /**
     * @param gatePhaseCode case phase whose catalogued assessments ({@code ai_interaction.phase_code}) must include a
     *                      recent {@code ai_result} with decision {@code STOP} for this workflow
     */
    @Transactional(readOnly = true)
    public void assertReady(UUID caseId, String gatePhaseCode, String actionName) {
        if (!aiGateEnabled) {
            return;
        }
        String canonicalPhase = casePhaseService.requireEnabledPhaseCode(gatePhaseCode);

        WealthCase wealthCase = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException("Case not found for AI gate validation: " + caseId));
        String workflowId = workflowStateRepository.findByCaseId(wealthCase.getId())
                .map(state -> state.getWorkflowId())
                .orElse(null);
        if (workflowId == null || workflowId.isBlank()) {
            throw blocked(canonicalPhase, actionName, "workflow mapping is missing.");
        }

        Optional<String> decisionOpt = loadLatestDecisionForPhase(workflowId, canonicalPhase);
        if (decisionOpt.isEmpty()) {
            throw blocked(
                    canonicalPhase,
                    actionName,
                    "No AI result found for this phase (assessment rows must exist in ai_interaction for phase_code)."
            );
        }

        String decision = decisionOpt.get();
        if (!DECISION_STOP.equalsIgnoreCase(decision)) {
            throw blocked(canonicalPhase, actionName, "Latest AI decision for this phase = " + decision + ".");
        }
    }

    /**
     * Latest {@code ai_result} for the workflow whose {@code orchestration_request.assessment_code} is catalogued
     * under {@code gatePhaseCode} in {@code ai_interaction} (per-phase STOP, independent of other phases).
     */
    private Optional<String> loadLatestDecisionForPhase(String workflowId, String gatePhaseCode) {
        final String sql = """
                SELECT ar.decision
                FROM ai_result ar
                JOIN orchestration_request req ON req.request_id = ar.request_id
                JOIN ai_interaction ai ON ai.interaction_id = req.assessment_code
                WHERE req.workflow_id::text = ?
                  AND ai.phase_code = ?
                ORDER BY ar.produced_at DESC, ar.created_at DESC
                LIMIT 1
                """;
        try {
            List<String> rows = jdbcTemplate.query(
                    sql,
                    (rs, idx) -> rs.getString("decision"),
                    workflowId,
                    gatePhaseCode
            );
            if (rows.isEmpty()) {
                return Optional.empty();
            }
            return Optional.ofNullable(rows.get(0));
        } catch (DataAccessException ex) {
            throw new BusinessException("AI support must be completed before proceeding. (detail=AI gate query failed)", ex);
        }
    }

    private BusinessException blocked(String canonicalPhaseCode, String actionName, String detail) {
        String action = actionName == null || actionName.isBlank() ? "current action" : actionName;
        return new BusinessException(
                "AI support must be completed before proceeding. (detail=AI gate query failed) " + action + ". "
                        + "(phase=" + canonicalPhaseCode + ", detail=" + detail + ")"
        );
    }
}
