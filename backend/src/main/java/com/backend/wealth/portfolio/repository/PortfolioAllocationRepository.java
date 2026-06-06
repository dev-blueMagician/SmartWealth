package com.backend.wealth.portfolio.repository;

import com.backend.wealth.portfolio.model.PortfolioAllocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PortfolioAllocationRepository extends JpaRepository<PortfolioAllocation, UUID> {

    List<PortfolioAllocation> findByPortfolio_Id(UUID portfolioId);

    void deleteByPortfolio_Id(UUID portfolioId);
}
