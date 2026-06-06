package com.backend.wealth.discovery.controller;

import com.backend.wealth.discovery.dto.CaseDiscoveryDatasetResponse;
import com.backend.wealth.discovery.dto.CaseDiscoveryFieldPageResponse;
import com.backend.wealth.discovery.dto.DiscoveryRebuildResponse;
import com.backend.wealth.discovery.dto.DiscoverySummaryResponse;
import com.backend.wealth.discovery.service.DiscoveryProjectionService;
import com.backend.wealth.discovery.service.DiscoverySummaryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/cases/{caseId}/discovery")
@RequiredArgsConstructor
@Tag(name = "Discovery — Case dataset")
public class CaseDiscoveryDatasetController {

    private final DiscoveryProjectionService discoveryProjectionService;
    private final DiscoverySummaryService discoverySummaryService;

    @PostMapping("/rebuild")
    public ResponseEntity<DiscoveryRebuildResponse> rebuild(@PathVariable UUID caseId) {
        return ResponseEntity.ok(discoveryProjectionService.rebuild(caseId));
    }

    @GetMapping("/fields")
    public CaseDiscoveryFieldPageResponse listFields(
            @PathVariable UUID caseId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return discoveryProjectionService.listFields(caseId, status, page, size);
    }

    @GetMapping("/dataset")
    public CaseDiscoveryDatasetResponse getDataset(@PathVariable UUID caseId) {
        return discoveryProjectionService.getDataset(caseId);
    }

    /**
     * Compact discovery payload for UI/LLM (token-bounded). Full dataset remains on {@code /dataset}.
     */
    @GetMapping("/summary")
    public DiscoverySummaryResponse getSummary(
            @PathVariable UUID caseId,
            @RequestParam(required = false) String dataDomain,
            @RequestParam(defaultValue = "40") int filledLimit,
            @RequestParam(defaultValue = "30") int missingLimit,
            @RequestParam(defaultValue = "15") int unmappedLimit
    ) {
        return discoverySummaryService.buildSummary(
                caseId,
                dataDomain,
                filledLimit,
                missingLimit,
                unmappedLimit
        );
    }
}
