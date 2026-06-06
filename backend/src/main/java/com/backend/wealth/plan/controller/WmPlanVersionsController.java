package com.backend.wealth.plan.controller;

import com.backend.wealth.api.wm.PlansApi;
import com.backend.wealth.openapi.model.FinancialPlanVersionResponse;
import com.backend.wealth.openapi.model.PlanCalculationStubRequest;
import com.backend.wealth.openapi.model.WmRecommendationCreateRequest;
import com.backend.wealth.openapi.model.WmRecommendationResponse;
import com.backend.wealth.plan.service.WmPlanningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class WmPlanVersionsController implements PlansApi {

    private final WmPlanningService wmPlanningService;

    @Override
    public ResponseEntity<WmRecommendationResponse> createPlanRecommendation(UUID planVersionId, WmRecommendationCreateRequest wmRecommendationCreateRequest) {
        WmRecommendationResponse body = wmPlanningService.createRecommendation(planVersionId, wmRecommendationCreateRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @Override
    public ResponseEntity<FinancialPlanVersionResponse> runPlanDraftCalculation(UUID planId, PlanCalculationStubRequest planCalculationStubRequest) {
        return ResponseEntity.ok(wmPlanningService.runDraftCalculation(planId, planCalculationStubRequest));
    }
}
