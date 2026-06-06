package com.backend.wealth.plan.controller;

import com.backend.wealth.api.wm.ClientsApi;
import com.backend.wealth.openapi.model.FinancialPlanVersionResponse;
import com.backend.wealth.openapi.model.PlanDraftSeedRequest;
import com.backend.wealth.plan.service.WmPlanningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class WmClientPlansController implements ClientsApi {

    private final WmPlanningService wmPlanningService;

    @Override
    public ResponseEntity<FinancialPlanVersionResponse> createFinancialPlanDraft(UUID clientId, PlanDraftSeedRequest planDraftSeedRequest) {
        FinancialPlanVersionResponse body = wmPlanningService.createDraft(clientId, planDraftSeedRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
