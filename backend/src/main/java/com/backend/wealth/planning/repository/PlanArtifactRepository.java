package com.backend.wealth.planning.repository;

import com.backend.wealth.planning.model.PlanArtifact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlanArtifactRepository extends JpaRepository<PlanArtifact, UUID> {

    List<PlanArtifact> findByPlan_IdOrderByCreatedAtDesc(UUID planId);
}
