package com.backend.wealth.portfolio.repository;

import com.backend.wealth.portfolio.model.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {

    List<Portfolio> findByClient_Id(UUID clientId);
}
