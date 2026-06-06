package com.backend.wealth.cases.model;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_interaction")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiInteractionEntity {

    @Id
    @Column(name = "interaction_id", length = 16, nullable = false)
    private String interactionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "phase_code", referencedColumnName = "phase_code", nullable = false)
    private CasePhaseEntity phase;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "loop_input", columnDefinition = "jsonb", nullable = false)
    private JsonNode loopInput;

    @Column(name = "system_prompt", columnDefinition = "text")
    private String systemPrompt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
