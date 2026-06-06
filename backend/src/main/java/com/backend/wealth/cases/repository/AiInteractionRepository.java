package com.backend.wealth.cases.repository;

import com.backend.wealth.cases.model.AiInteractionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiInteractionRepository extends JpaRepository<AiInteractionEntity, String> {

    List<AiInteractionEntity> findAllByPhasePhaseCodeOrderByInteractionIdAsc(String phaseCode);

    List<AiInteractionEntity> findAllByOrderByInteractionIdAsc();
}
