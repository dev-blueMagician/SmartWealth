package com.backend.wealth.cases.repository;

import com.backend.wealth.cases.model.WealthCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WealthCaseRepository extends JpaRepository<WealthCase, UUID> {

    Optional<WealthCase> findFirstByClient_IdOrderByCreatedAtAsc(UUID clientId);
    Optional<WealthCase> findFirstByClient_IdOrderByCreatedAtDesc(UUID clientId);

    List<WealthCase> findByClient_IdOrderByCreatedAtDesc(UUID clientId);
}
