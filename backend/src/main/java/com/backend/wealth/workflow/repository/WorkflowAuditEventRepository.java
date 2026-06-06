package com.backend.wealth.workflow.repository;

import com.backend.wealth.workflow.model.WorkflowAuditEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkflowAuditEventRepository extends JpaRepository<WorkflowAuditEventEntity, String> {

    List<WorkflowAuditEventEntity> findByWorkflowIdOrderByCreatedAtAsc(String workflowId);
}
