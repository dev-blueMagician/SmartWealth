package com.backend.wealth.cases.controller;

import com.backend.wealth.cases.documents.model.CaseDocument;
import com.backend.wealth.cases.documents.repository.CaseDocumentRepository;
import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.task.model.Task;
import com.backend.wealth.task.repository.TaskRepository;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
public class CaseQueryController {

    private final WealthCaseRepository wealthCaseRepository;
    private final TaskRepository taskRepository;
    private final CaseDocumentRepository caseDocumentRepository;

    public CaseQueryController(
            WealthCaseRepository wealthCaseRepository,
            TaskRepository taskRepository,
            CaseDocumentRepository caseDocumentRepository
    ) {
        this.wealthCaseRepository = wealthCaseRepository;
        this.taskRepository = taskRepository;
        this.caseDocumentRepository = caseDocumentRepository;
    }

    @GetMapping("/api/cases")
    @Transactional(readOnly = true)
    public List<CaseSummaryResponse> listCases() {
        return wealthCaseRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(this::toCaseSummary)
                .toList();
    }

    @GetMapping("/api/cases/{caseId}")
    @Transactional(readOnly = true)
    public CaseSummaryResponse getCase(@PathVariable UUID caseId) {
        WealthCase wealthCase = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        return toCaseSummary(wealthCase);
    }

    @GetMapping("/api/cases/{caseId}/tasks")
    @Transactional(readOnly = true)
    public List<CaseTaskResponse> listCaseTasks(@PathVariable UUID caseId) {
        if (!wealthCaseRepository.existsById(caseId)) {
            throw new NotFoundException("Case not found: " + caseId);
        }
        return taskRepository.findByWealthCase_IdOrderByUpdatedAtDesc(caseId)
                .stream()
                .map(this::toTaskResponse)
                .toList();
    }

    @GetMapping("/api/cases/{caseId}/client-profile")
    @Transactional(readOnly = true)
    public ClientProfileInfoResponse getCaseClientProfile(@PathVariable UUID caseId) {
        WealthCase wealthCase = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        Client c = wealthCase.getClient();
        return new ClientProfileInfoResponse(
                c.getId(),
                c.getName(),
                c.getStatus(),
                c.getRiskProfile(),
                c.getResidency(),
                c.getDateOfBirth(),
                c.getMaritalStatus(),
                c.getNationality(),
                c.getPrimaryPhone(),
                c.getPrimaryEmail(),
                c.getContactAddress(),
                c.getCreatedAt()
        );
    }

    @GetMapping("/api/cases/{caseId}/documents")
    @Transactional(readOnly = true)
    public List<CaseDocumentResponse> listCaseDocuments(@PathVariable UUID caseId) {
        if (!wealthCaseRepository.existsById(caseId)) {
            throw new NotFoundException("Case not found: " + caseId);
        }
        return caseDocumentRepository.findAllByWealthCase_IdOrderByCreatedAtDesc(caseId)
                .stream()
                .map(this::toDocumentResponse)
                .toList();
    }

    private CaseDocumentResponse toDocumentResponse(CaseDocument cd) {
        var doc = cd.getDocument();
        return new CaseDocumentResponse(
                cd.getId(),
                doc.getId(),
                doc.getOriginalFilename(),
                doc.getContentType(),
                doc.getByteSize(),
                cd.getDocKind(),
                cd.getPhaseCode(),
                cd.getStatus(),
                cd.getNotes(),
                cd.getCreatedAt()
        );
    }

    private CaseSummaryResponse toCaseSummary(WealthCase wealthCase) {
        return new CaseSummaryResponse(
                wealthCase.getId(),
                wealthCase.getClient().getId(),
                wealthCase.getClient().getName(),
                wealthCase.getType(),
                wealthCase.getPhase(),
                wealthCase.getStatus(),
                wealthCase.getCreatedAt()
        );
    }

    private CaseTaskResponse toTaskResponse(Task task) {
        return new CaseTaskResponse(
                task.getId(),
                task.getTaskType(),
                task.getStatus(),
                task.getUpdatedAt()
        );
    }

    public record CaseSummaryResponse(
            UUID id,
            UUID clientId,
            String clientName,
            String type,
            String phase,
            String status,
            LocalDateTime createdAt
    ) {
    }

    public record CaseTaskResponse(
            UUID id,
            String taskType,
            String status,
            LocalDateTime updatedAt
    ) {
    }

    public record ClientProfileInfoResponse(
            UUID clientId,
            String name,
            String status,
            String riskProfile,
            String residency,
            LocalDate dateOfBirth,
            String maritalStatus,
            String nationality,
            String primaryPhone,
            String primaryEmail,
            String contactAddress,
            LocalDateTime createdAt
    ) {
    }

    public record CaseDocumentResponse(
            UUID id,
            UUID documentId,
            String originalFilename,
            String contentType,
            Long byteSize,
            String docKind,
            String phaseCode,
            String status,
            String notes,
            OffsetDateTime createdAt
    ) {
    }
}
