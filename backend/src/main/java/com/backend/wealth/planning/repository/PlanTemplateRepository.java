package com.backend.wealth.planning.repository;

import com.backend.wealth.planning.model.PlanTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanTemplateRepository extends JpaRepository<PlanTemplate, UUID> {

    List<PlanTemplate> findAllByOrderByUpdatedAtDesc();

    Optional<PlanTemplate> findFirstByCodeAndStatusOrderByVersionNoDesc(String code, String status);
}
