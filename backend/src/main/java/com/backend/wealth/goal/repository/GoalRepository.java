package com.backend.wealth.goal.repository;

import com.backend.wealth.goal.model.Goal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface GoalRepository extends JpaRepository<Goal, UUID> {

    List<Goal> findByClient_Id(UUID clientId);
}
