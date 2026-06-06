package com.backend.wealth.planning.model;

import com.backend.wealth.cases.documents.model.StoredDocument;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "plan_template")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "code", length = 100, nullable = false)
    private String code;

    @Column(name = "name", length = 255, nullable = false)
    private String name;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @Column(name = "locale", length = 16, nullable = false)
    private String locale;

    @Column(name = "product_type", length = 80)
    private String productType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private StoredDocument document;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "mapping_json", columnDefinition = "jsonb")
    private Map<String, Object> mappingJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "structure_json", columnDefinition = "jsonb")
    private Map<String, Object> structureJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "placeholders_detected", columnDefinition = "jsonb")
    private List<String> placeholdersDetected;

    @Column(name = "analyzed_at")
    private OffsetDateTime analyzedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (status == null || status.isBlank()) {
            status = "DRAFT";
        }
        if (locale == null || locale.isBlank()) {
            locale = "vi-VN";
        }
        if (versionNo == null || versionNo < 1) {
            versionNo = 1;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
