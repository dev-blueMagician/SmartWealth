package com.backend.wealth.workflow.repository;

import com.backend.wealth.workflow.model.WorkflowStateEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowStateRepository extends JpaRepository<WorkflowStateEntity, String> {

    List<WorkflowStateEntity> findAllByOrderByUpdatedAtDesc(Pageable pageable);
    Optional<WorkflowStateEntity> findByCaseId(UUID caseId);
    List<WorkflowStateEntity> findByCaseIdIn(List<UUID> caseIds);
}
