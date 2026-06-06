package com.backend.wealth.asset.service;

import com.backend.wealth.asset.model.Asset;
import com.backend.wealth.asset.repository.AssetRepository;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.openapi.model.DiscoveryAssetRequest;
import com.backend.wealth.openapi.model.DiscoveryAssetResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssetDiscoveryService {

    private final AssetRepository assetRepository;
    private final ClientRepository clientRepository;

    @Transactional(readOnly = true)
    public List<DiscoveryAssetResponse> listAssets(UUID clientId) {
        if (!clientRepository.existsById(clientId)) {
            throw new NotFoundException("Client not found: " + clientId);
        }
        return assetRepository.findByClient_Id(clientId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DiscoveryAssetResponse createAsset(UUID clientId, DiscoveryAssetRequest request) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new NotFoundException("Client not found: " + clientId));
        Asset asset = Asset.builder()
                .client(client)
                .assetType(request.getAssetType())
                .value(request.getValue())
                .build();
        assetRepository.save(asset);

        DiscoveryAssetResponse response = new DiscoveryAssetResponse();
        response.setId(asset.getId());
        response.setClientId(client.getId());
        response.setAssetType(asset.getAssetType());
        response.setValue(asset.getValue());
        return response;
    }

    private DiscoveryAssetResponse toResponse(Asset asset) {
        DiscoveryAssetResponse response = new DiscoveryAssetResponse();
        response.setId(asset.getId());
        response.setClientId(asset.getClient().getId());
        response.setAssetType(asset.getAssetType());
        response.setValue(asset.getValue());
        return response;
    }
}
