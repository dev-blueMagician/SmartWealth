package com.backend.wealth.client.controller;

import com.backend.wealth.api.clientdata.ClientsApi;
import com.backend.wealth.asset.service.AssetDiscoveryService;
import com.backend.wealth.client.service.ClientProfileService;
import com.backend.wealth.goal.service.GoalDiscoveryService;
import com.backend.wealth.openapi.model.ClientProfileResponse;
import com.backend.wealth.openapi.model.ClientProfileUpdateRequest;
import com.backend.wealth.openapi.model.DiscoveryAssetRequest;
import com.backend.wealth.openapi.model.DiscoveryAssetResponse;
import com.backend.wealth.openapi.model.DiscoveryGoalRequest;
import com.backend.wealth.openapi.model.DiscoveryGoalResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ClientProfileDiscoveryController implements ClientsApi {

    private final ClientProfileService clientProfileService;
    private final AssetDiscoveryService assetDiscoveryService;
    private final GoalDiscoveryService goalDiscoveryService;

    @Override
    public ResponseEntity<ClientProfileResponse> updateClientProfile(UUID clientId, ClientProfileUpdateRequest clientProfileUpdateRequest) {
        return ResponseEntity.ok(clientProfileService.updateProfile(clientId, clientProfileUpdateRequest));
    }

    @Override
    public ResponseEntity<List<DiscoveryAssetResponse>> listClientAssets(UUID clientId) {
        return ResponseEntity.ok(assetDiscoveryService.listAssets(clientId));
    }

    @Override
    public ResponseEntity<List<DiscoveryGoalResponse>> listClientGoals(UUID clientId) {
        return ResponseEntity.ok(goalDiscoveryService.listGoals(clientId));
    }

    @Override
    public ResponseEntity<DiscoveryAssetResponse> createClientAsset(UUID clientId, DiscoveryAssetRequest discoveryAssetRequest) {
        DiscoveryAssetResponse body = assetDiscoveryService.createAsset(clientId, discoveryAssetRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @Override
    public ResponseEntity<DiscoveryGoalResponse> createClientGoal(UUID clientId, DiscoveryGoalRequest discoveryGoalRequest) {
        DiscoveryGoalResponse body = goalDiscoveryService.createGoal(clientId, discoveryGoalRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
