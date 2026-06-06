package com.backend.wealth.discovery.model;

import com.backend.wealth.cases.model.WealthCase;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
import java.util.UUID;

@Entity
@Table(name = "case_discovery_field")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseDiscoveryField {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id", nullable = false)
    private WealthCase wealthCase;

    @Column(name = "system_field", length = 200, nullable = false)
    private String systemField;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "value_jsonb", columnDefinition = "jsonb")
    private JsonNode valueJsonb;

    @Column(name = "value_text", columnDefinition = "text")
    private String valueText;

    @Column(name = "source", length = 50, nullable = false)
    private String source;

    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @Column(name = "question_id", length = 32)
    private String questionId;

    @Column(name = "block_index", nullable = false)
    private Integer blockIndex;

    @Column(name = "mapping_id")
    private UUID mappingId;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void touchTimestamps() {
        updatedAt = OffsetDateTime.now();
        if (blockIndex == null) {
            blockIndex = 0;
        }
        if (source == null) {
            source = "questionnaire";
        }
        if (status == null) {
            status = "missing";
        }
    }
}
