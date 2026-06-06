package com.backend.wealth.cases.service;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.constants.ClientStatuses;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.execution.constants.ExecutionInstructionStatuses;
import com.backend.wealth.execution.repository.ExecutionInstructionRepository;
import com.backend.wealth.plan.constants.PlanStatuses;
import com.backend.wealth.plan.repository.FinancialPlanRepository;
import com.backend.wealth.task.constants.TaskStatuses;
import com.backend.wealth.task.constants.TaskTypes;
import com.backend.wealth.task.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Applies {@link WealthCase#setPhase(String)} when RM chat intent is {@code CHANGE_PHASE}.
 * Target is resolved from AI-engine {@code target_phase_code}, an explicit phase name in the message,
 * or "next" (next enabled phase in catalog order after the current phase).
 *
 * Enforces sequential-forward transitions and per-phase prerequisites so that
 * phases cannot be skipped or reverted via chat.
 */
@Service
@RequiredArgsConstructor
public class CaseChatPhaseTransitionService {

    private static final Pattern PHASE_TOKEN = Pattern.compile(
            "\\b(ONBOARDING|DISCOVERY|PLANNING|COLLABORATION|EXECUTION|MONITORING)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private final WealthCaseRepository wealthCaseRepository;
    private final CasePhaseService casePhaseService;
    private final TaskRepository taskRepository;
    private final FinancialPlanRepository financialPlanRepository;
    private final ExecutionInstructionRepository executionInstructionRepository;
    private final DiscoveryReadinessService discoveryReadinessService;

    public record TransitionResult(String fromPhase, String toPhase, String mode, String message) {
    }

    /**
     * @param llmTargetPhase optional canonical phase from detect-intent, or null
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TransitionResult transition(UUID caseId, String userMessage, String llmTargetPhase) {
        WealthCase wc = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        List<String> ordered = casePhaseService.listEnabledPhaseCodesOrdered();
        if (ordered.isEmpty()) {
            throw new BusinessException("No enabled case phases in catalog.");
        }

        String currentRaw = wc.getPhase();
        String current = resolveCanonicalCurrent(currentRaw, ordered);

        String target = resolveTargetPhase(ordered, current, userMessage, llmTargetPhase);
        String canonicalTarget = casePhaseService.requireEnabledPhaseCode(target);

        if (canonicalTarget.equalsIgnoreCase(current)) {
            return new TransitionResult(
                    current,
                    canonicalTarget,
                    "NOOP",
                    "Case is already in phase " + current + "."
            );
        }

        validateSequentialForward(ordered, current, canonicalTarget);
        validatePhasePrerequisites(wc, current);

        wc.setPhase(canonicalTarget);
        wealthCaseRepository.save(wc);

        return new TransitionResult(
                current,
                canonicalTarget,
                "APPLIED",
                "Case phase updated from " + current + " to " + canonicalTarget + "."
        );
    }

    // ------------------------------------------------------------------
    // Phase-transition guards
    // ------------------------------------------------------------------

    private static void validateSequentialForward(List<String> ordered, String current, String target) {
        int currentIdx = indexOfIgnoreCase(ordered, current);
        int targetIdx = indexOfIgnoreCase(ordered, target);

        if (targetIdx < currentIdx) {
            throw new BusinessException(
                    "Cannot move backward from " + current + " to " + target
                            + ". Phase transitions must move forward."
            );
        }
        if (targetIdx > currentIdx + 1) {
            throw new BusinessException(
                    "Cannot skip phases. Current phase: " + current
                            + ", next allowed: " + ordered.get(currentIdx + 1)
                            + ". Requested: " + target + "."
            );
        }
    }

    /**
     * Validates that the business prerequisites of {@code currentPhase} are satisfied
     * before allowing the case to leave that phase.
     */
    private void validatePhasePrerequisites(WealthCase wc, String currentPhase) {
        UUID caseId = wc.getId();
        Client client = wc.getClient();
        String upper = currentPhase.toUpperCase(Locale.ROOT);

        switch (upper) {
            case "ONBOARDING" -> {
                if (!ClientStatuses.ACTIVE.equals(client.getStatus())) {
                    throw new BusinessException(
                            "Cannot leave ONBOARDING: client must be registered (ACTIVE)."
                    );
                }
                taskRepository.findByWealthCase_IdAndTaskType(caseId, TaskTypes.PROFILE_COMPLETION)
                        .filter(t -> TaskStatuses.COMPLETED.equals(t.getStatus()))
                        .orElseThrow(() -> new BusinessException(
                                "Cannot leave ONBOARDING: PROFILE_COMPLETION task is not completed."
                        ));
            }
            case "PLANNING" -> {
                boolean hasPlans = !financialPlanRepository.findByClient_Id(client.getId()).isEmpty();
                if (!hasPlans) {
                    throw new BusinessException(
                            "Cannot leave PLANNING: at least one financial plan draft must exist."
                    );
                }
            }
            case "COLLABORATION" -> {
                boolean hasApprovedPlan = financialPlanRepository.findByClient_Id(client.getId()).stream()
                        .anyMatch(p -> PlanStatuses.APPROVED.equals(p.getStatus())
                                && Boolean.TRUE.equals(p.getApproved()));
                if (!hasApprovedPlan) {
                    throw new BusinessException(
                            "Cannot leave COLLABORATION: at least one financial plan must be APPROVED by the client."
                    );
                }
            }
            case "EXECUTION" -> {
                boolean hasExecuted = executionInstructionRepository.findByPlanClientId(client.getId()).stream()
                        .anyMatch(ei -> ExecutionInstructionStatuses.EXECUTED.equals(ei.getStatus()));
                if (!hasExecuted) {
                    throw new BusinessException(
                            "Cannot leave EXECUTION: at least one execution instruction must be EXECUTED."
                    );
                }
            }
            case "DISCOVERY" -> {
                discoveryReadinessService.assertDiscoveryDataPresent(client.getId());
            }
            default -> {
                // MONITORING or future phases — no exit prerequisites
            }
        }
    }

    private static int indexOfIgnoreCase(List<String> list, String value) {
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).equalsIgnoreCase(value)) {
                return i;
            }
        }
        return -1;
    }

    private static String resolveCanonicalCurrent(String stored, List<String> ordered) {
        if (stored == null || stored.isBlank()) {
            return ordered.get(0);
        }
        for (String p : ordered) {
            if (p.equalsIgnoreCase(stored.trim())) {
                return p;
            }
        }
        throw new BusinessException(
                "Case phase \"" + stored + "\" is not in the enabled phase catalog; fix the case or catalog first."
        );
    }

    private String resolveTargetPhase(
            List<String> ordered,
            String currentCanonical,
            String userMessage,
            String llmTargetPhase
    ) {
        if (llmTargetPhase != null && !llmTargetPhase.isBlank()) {
            return casePhaseService.requireEnabledPhaseCode(llmTargetPhase.trim());
        }
        String msg = userMessage != null ? userMessage : "";
        String explicit = firstExplicitPhaseInMessage(msg, ordered);
        if (explicit != null) {
            return explicit;
        }
        if (wantsNextPhaseOnly(msg) || looksLikeBarePhaseChange(msg)) {
            return nextPhase(ordered, currentCanonical);
        }
        throw new BusinessException(
                "Could not determine the target phase. Say \"next phase\" / \"phase tiếp theo\" "
                        + "or name an enabled phase (e.g. DISCOVERY)."
        );
    }

    private static boolean looksLikeBarePhaseChange(String msg) {
        String lower = msg.toLowerCase(Locale.ROOT);
        return lower.contains("chuyển phase")
                || lower.contains("chuyen phase")
                || lower.contains("next phase")
                || lower.contains("phase tiếp")
                || lower.contains("phase tiep");
    }

    private static boolean wantsNextPhaseOnly(String msg) {
        String lower = msg.toLowerCase(Locale.ROOT);
        boolean hasNextCue = lower.contains("tiếp theo")
                || lower.contains("tiep theo")
                || lower.contains("next phase")
                || lower.contains("phase tiếp theo")
                || lower.contains("phase tiep theo")
                || lower.contains("buoc tiep")
                || lower.contains("bước tiếp");
        if (!hasNextCue) {
            return false;
        }
        return PHASE_TOKEN.matcher(msg).find() == false;
    }

    private static String firstExplicitPhaseInMessage(String msg, List<String> ordered) {
        List<String> sorted = ordered.stream()
                .sorted((a, b) -> Integer.compare(b.length(), a.length()))
                .toList();
        String upper = msg.toUpperCase(Locale.ROOT);
        for (String p : sorted) {
            if (upper.contains(p.toUpperCase(Locale.ROOT))) {
                return p;
            }
        }
        return null;
    }

    private static String nextPhase(List<String> ordered, String currentCanonical) {
        int idx = -1;
        for (int i = 0; i < ordered.size(); i++) {
            if (ordered.get(i).equalsIgnoreCase(currentCanonical)) {
                idx = i;
                break;
            }
        }
        if (idx < 0) {
            idx = 0;
        }
        if (idx + 1 >= ordered.size()) {
            throw new BusinessException("Already at the last enabled phase; there is no next phase.");
        }
        return ordered.get(idx + 1);
    }
}
