package com.backend.wealth.cases.repository;

import com.backend.wealth.cases.model.AiLlmProfileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiLlmProfileRepository extends JpaRepository<AiLlmProfileEntity, UUID> {

    Optional<AiLlmProfileEntity> findByCode(String code);

    List<AiLlmProfileEntity> findAllByOrderByDisplayNameAsc();

    Optional<AiLlmProfileEntity> findByIsActiveTrue();
}
