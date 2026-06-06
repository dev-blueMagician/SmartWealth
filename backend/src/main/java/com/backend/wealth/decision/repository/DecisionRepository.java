package com.backend.wealth.decision.repository;

import com.backend.wealth.decision.model.Decision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DecisionRepository extends JpaRepository<Decision, UUID> {
}
