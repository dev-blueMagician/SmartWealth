package com.backend.wealth.planning.controller;

import com.backend.wealth.planning.dto.CreatePlanningDraftRequest;
import com.backend.wealth.planning.dto.ExportPlanningDraftRequest;
import com.backend.wealth.planning.dto.PlanningDraftResponse;
import com.backend.wealth.planning.dto.PlanningDraftSummaryResponse;
import com.backend.wealth.planning.dto.PlanningExportResponse;
import com.backend.wealth.planning.dto.RegeneratePlanningDraftRequest;
import com.backend.wealth.planning.service.PlanDocxExportService;
import com.backend.wealth.planning.service.PlanningDraftService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Planning — Draft lifecycle")
public class PlanningDraftController {

    private final PlanningDraftService planningDraftService;
    private final PlanDocxExportService planDocxExportService;

    @GetMapping("/cases/{caseId}/planning/drafts")
    public List<PlanningDraftSummaryResponse> listDrafts(@PathVariable UUID caseId) {
        return planningDraftService.listDraftsForCase(caseId);
    }

    @PostMapping("/cases/{caseId}/planning/drafts")
    public ResponseEntity<PlanningDraftResponse> createDraft(
            @PathVariable UUID caseId,
            @Valid @RequestBody CreatePlanningDraftRequest request
    ) {
        PlanningDraftResponse body = planningDraftService.createDraft(caseId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/planning/drafts/{planId}")
    public PlanningDraftResponse getDraft(@PathVariable UUID planId) {
        return planningDraftService.getDraft(planId);
    }

    @PostMapping("/planning/drafts/{planId}/regenerate")
    public PlanningDraftResponse regenerate(
            @PathVariable UUID planId,
            @RequestBody(required = false) RegeneratePlanningDraftRequest request
    ) {
        return planningDraftService.regenerate(planId, request);
    }

    @PostMapping("/planning/drafts/{planId}/finalize")
    public PlanningDraftResponse finalizeDraft(@PathVariable UUID planId) {
        return planningDraftService.finalizeDraft(planId);
    }

    @PostMapping("/planning/drafts/{planId}/export")
    public PlanningExportResponse exportDraft(
            @PathVariable UUID planId,
            @RequestBody(required = false) ExportPlanningDraftRequest request
    ) {
        return planDocxExportService.exportDocx(planId, request);
    }

    @GetMapping("/planning/artifacts/{artifactId}/download")
    public ResponseEntity<Resource> downloadArtifact(@PathVariable UUID artifactId) {
        var doc = planDocxExportService.resolveArtifactDocument(artifactId);
        Path file = planDocxExportService.resolveArtifactFilePath(artifactId);
        Resource resource = new FileSystemResource(file);
        String filename = doc.getOriginalFilename() == null ? "plan-export.docx" : doc.getOriginalFilename();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        doc.getContentType() != null
                                ? doc.getContentType()
                                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .body(resource);
    }
}
