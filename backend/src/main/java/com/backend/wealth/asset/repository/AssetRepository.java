package com.backend.wealth.asset.repository;

import com.backend.wealth.asset.model.Asset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AssetRepository extends JpaRepository<Asset, UUID> {

    List<Asset> findByClient_Id(UUID clientId);
}
