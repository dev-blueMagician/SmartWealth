package com.backend.wealth.plan.controller;

import com.backend.wealth.openapi.model.FinancialPlanVersionResponse;
import com.backend.wealth.openapi.model.WmRecommendationResponse;
import com.backend.wealth.plan.service.WmPlanningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Read-only WM endpoints for listing plans and recommendations (not generated from OpenAPI).
 */
@RestController
@RequiredArgsConstructor
public class WmPlanningQueryController {

    private final WmPlanningService wmPlanningService;

    @GetMapping("/clients/{clientId}/plans")
    public ResponseEntity<List<FinancialPlanVersionResponse>> listPlansForClient(@PathVariable UUID clientId) {
        return ResponseEntity.ok(wmPlanningService.listPlansForClient(clientId));
    }

    @GetMapping("/plans/{planVersionId}/recommendations")
    public ResponseEntity<List<WmRecommendationResponse>> listRecommendationsForPlan(
            @PathVariable UUID planVersionId
    ) {
        return ResponseEntity.ok(wmPlanningService.listRecommendationsForPlan(planVersionId));
    }
}
