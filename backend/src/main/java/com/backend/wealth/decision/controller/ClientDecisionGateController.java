package com.backend.wealth.decision.controller;

import com.backend.wealth.api.decisiongate.RecommendationsApi;
import com.backend.wealth.decision.service.ClientDecisionGateService;
import com.backend.wealth.openapi.model.ClientDecisionRequest;
import com.backend.wealth.openapi.model.ClientDecisionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ClientDecisionGateController implements RecommendationsApi {

    private final ClientDecisionGateService clientDecisionGateService;

    @Override
    public ResponseEntity<ClientDecisionResponse> submitRecommendationDecision(UUID recommendationId, ClientDecisionRequest clientDecisionRequest) {
        ClientDecisionResponse body = clientDecisionGateService.submitDecision(recommendationId, clientDecisionRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
