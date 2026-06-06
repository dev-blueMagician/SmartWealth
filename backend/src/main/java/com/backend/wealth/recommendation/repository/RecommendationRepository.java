package com.backend.wealth.recommendation.repository;

import com.backend.wealth.recommendation.model.Recommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {

    List<Recommendation> findByPlan_Id(UUID planId);
}
