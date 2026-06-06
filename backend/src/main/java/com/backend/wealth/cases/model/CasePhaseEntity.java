package com.backend.wealth.cases.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "case_phase")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CasePhaseEntity {

    @Id
    @Column(name = "phase_code", length = 50, nullable = false)
    private String phaseCode;

    @Column(name = "display_name", length = 200, nullable = false)
    private String displayName;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "catalog_version", length = 16, nullable = false)
    private String catalogVersion;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
