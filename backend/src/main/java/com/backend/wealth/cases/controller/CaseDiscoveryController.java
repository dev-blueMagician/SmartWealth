package com.backend.wealth.cases.controller;

import com.backend.wealth.api.clientdata.CasesApi;
import com.backend.wealth.cases.service.DiscoveryReadinessService;
import com.backend.wealth.openapi.model.DiscoveryCheckResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CaseDiscoveryController implements CasesApi {

    private final DiscoveryReadinessService discoveryReadinessService;

    @Override
    public ResponseEntity<DiscoveryCheckResponse> markDiscoveryReady(UUID caseId) {
        return ResponseEntity.ok(discoveryReadinessService.markDiscoveryReady(caseId));
    }
}
