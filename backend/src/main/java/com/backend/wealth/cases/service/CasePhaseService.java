package com.backend.wealth.cases.service;

import com.backend.wealth.cases.model.CasePhaseEntity;
import com.backend.wealth.cases.repository.CasePhaseRepository;
import com.backend.wealth.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Resolves canonical {@code phase_code} values from the {@code case_phase} catalog (SSOT in PostgreSQL).
 * Lookup keys are matched case-insensitively against enabled rows.
 */
@Service
@RequiredArgsConstructor
public class CasePhaseService {

    private final CasePhaseRepository casePhaseRepository;

    private volatile Map<String, String> upperToCanonical;

    private Map<String, String> cache() {
        Map<String, String> c = upperToCanonical;
        if (c != null) {
            return c;
        }
        synchronized (this) {
            if (upperToCanonical == null) {
                upperToCanonical = loadCache();
            }
            return upperToCanonical;
        }
    }

    private Map<String, String> loadCache() {
        List<CasePhaseEntity> rows = casePhaseRepository.findAllByEnabledTrueOrderBySortOrderAsc();
        if (rows.isEmpty()) {
            throw new BusinessException(
                    "case_phase catalog is empty or all phases disabled. Seed with AI-engine/scripts/seed_ai_interaction_catalog.py."
            );
        }
        LinkedHashMap<String, String> m = new LinkedHashMap<>();
        for (CasePhaseEntity e : rows) {
            m.put(e.getPhaseCode().toUpperCase(Locale.ROOT), e.getPhaseCode());
        }
        return Collections.unmodifiableMap(m);
    }

    /** Reload from DB (e.g. after admin updates phases). */
    public void refreshCache() {
        synchronized (this) {
            upperToCanonical = loadCache();
        }
    }

    /**
     * Returns the canonical {@code phase_code} stored in DB for an enabled phase.
     *
     * @param requestedPhase typically matches PK {@code phase_code}, compared case-insensitively
     */
    public String requireEnabledPhaseCode(String requestedPhase) {
        if (requestedPhase == null || requestedPhase.isBlank()) {
            throw new BusinessException("Case phase code is required.");
        }
        String key = requestedPhase.trim().toUpperCase(Locale.ROOT);
        String canonical = cache().get(key);
        if (canonical == null) {
            throw new BusinessException("Unknown or disabled case phase: " + requestedPhase);
        }
        return canonical;
    }

    /** Whether {@code storedPhase} equals the canonical code for {@code requestedPhase}. */
    public boolean isPhase(String storedPhase, String requestedPhase) {
        return requireEnabledPhaseCode(requestedPhase).equals(storedPhase);
    }

    public List<String> listEnabledPhaseCodesOrdered() {
        return List.copyOf(cache().values());
    }
}
