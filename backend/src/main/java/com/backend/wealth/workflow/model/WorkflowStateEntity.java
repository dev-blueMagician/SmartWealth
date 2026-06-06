package com.backend.wealth.workflow.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workflow_state")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowStateEntity {

    @Id
    @Column(name = "workflow_id", nullable = false)
    private String workflowId;

    @Column(name = "status", length = 50, nullable = false)
    private String status;

    @Column(name = "case_id")
    private UUID caseId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_payload", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> inputPayload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_draft", columnDefinition = "jsonb")
    private Map<String, Object> aiDraft;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "human_decision", columnDefinition = "jsonb")
    private Map<String, Object> humanDecision;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (workflowId == null) {
            workflowId = java.util.UUID.randomUUID().toString();
        }
        if (version == null) {
            version = 1;
        }
        if (updatedAt == null) {
            updatedAt = OffsetDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
