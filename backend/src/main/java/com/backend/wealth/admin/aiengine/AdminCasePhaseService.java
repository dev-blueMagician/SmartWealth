package com.backend.wealth.admin.aiengine;

import com.backend.wealth.admin.aiengine.dto.CasePhaseResponse;
import com.backend.wealth.admin.aiengine.dto.UpdateCasePhaseRequest;
import com.backend.wealth.admin.aiengine.dto.UpsertCasePhaseRequest;
import com.backend.wealth.cases.model.CasePhaseEntity;
import com.backend.wealth.cases.repository.CasePhaseRepository;
import com.backend.wealth.cases.service.CasePhaseService;
import com.backend.wealth.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminCasePhaseService {

    private final CasePhaseRepository casePhaseRepository;
    private final CasePhaseService casePhaseService;

    /** Admin list including disabled phases. */
    @Transactional(readOnly = true)
    public List<CasePhaseResponse> listAll() {
        return casePhaseRepository.findAll().stream()
                .sorted((a, b) -> {
                    int o = Integer.compare(a.getSortOrder(), b.getSortOrder());
                    return o != 0 ? o : a.getPhaseCode().compareTo(b.getPhaseCode());
                })
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CasePhaseResponse get(String phaseCode) {
        return casePhaseRepository.findById(phaseCode)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("case_phase not found: " + phaseCode));
    }

    @Transactional
    public CasePhaseResponse create(UpsertCasePhaseRequest req) {
        if (casePhaseRepository.existsById(req.phaseCode())) {
            throw new IllegalArgumentException("phase_code already exists: " + req.phaseCode());
        }
        LocalDateTime now = LocalDateTime.now();
        CasePhaseEntity e = CasePhaseEntity.builder()
                .phaseCode(req.phaseCode().trim())
                .displayName(req.displayName().trim())
                .sortOrder(req.sortOrder())
                .enabled(req.enabled())
                .catalogVersion(req.catalogVersion().trim())
                .createdAt(now)
                .updatedAt(now)
                .build();
        casePhaseRepository.save(e);
        casePhaseService.refreshCache();
        return toResponse(e);
    }

    @Transactional
    public CasePhaseResponse update(String phaseCode, UpdateCasePhaseRequest req) {
        CasePhaseEntity e = casePhaseRepository.findById(phaseCode)
                .orElseThrow(() -> new NotFoundException("case_phase not found: " + phaseCode));
        e.setDisplayName(req.displayName().trim());
        e.setSortOrder(req.sortOrder());
        e.setEnabled(req.enabled());
        e.setCatalogVersion(req.catalogVersion().trim());
        e.setUpdatedAt(LocalDateTime.now());
        casePhaseRepository.save(e);
        casePhaseService.refreshCache();
        return toResponse(e);
    }

    @Transactional
    public void delete(String phaseCode) {
        if (!casePhaseRepository.existsById(phaseCode)) {
            throw new NotFoundException("case_phase not found: " + phaseCode);
        }
        casePhaseRepository.deleteById(phaseCode);
        casePhaseService.refreshCache();
    }

    private CasePhaseResponse toResponse(CasePhaseEntity e) {
        return new CasePhaseResponse(
                e.getPhaseCode(),
                e.getDisplayName(),
                e.getSortOrder(),
                Boolean.TRUE.equals(e.getEnabled()),
                e.getCatalogVersion(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
