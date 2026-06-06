package com.backend.wealth.plan.repository;

import com.backend.wealth.plan.model.FinancialPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FinancialPlanRepository extends JpaRepository<FinancialPlan, UUID> {

    List<FinancialPlan> findByClient_Id(UUID clientId);

    List<FinancialPlan> findByClient_IdOrderByCreatedAtDesc(UUID clientId);

    boolean existsByTemplate_Id(UUID templateId);
}
