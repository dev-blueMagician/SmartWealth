package com.backend.wealth.discovery.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "field_dictionary")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldDictionary {

    @Id
    @Column(name = "system_field_name", length = 200, nullable = false)
    private String systemFieldName;

    @Column(name = "row_no")
    private Integer rowNo;

    @Column(name = "data_domain", length = 200)
    private String dataDomain;

    @Column(name = "data_item", length = 200)
    private String dataItem;

    @Column(name = "detail_field_group", length = 200)
    private String detailFieldGroup;

    @Column(name = "detail_field_no")
    private Integer detailFieldNo;

    @Column(name = "detail_field_name", length = 200)
    private String detailFieldName;

    @Column(name = "field_description", columnDefinition = "text")
    private String fieldDescription;

    @Column(name = "data_type", length = 100)
    private String dataType;

    @Column(name = "mandatory_level", length = 50)
    private String mandatoryLevel;

    @Column(name = "applies_to", length = 100)
    private String appliesTo;

    @Column(name = "suggested_source", columnDefinition = "text")
    private String suggestedSource;

    @Column(name = "validation_rule", columnDefinition = "text")
    private String validationRule;

    @Column(name = "used_for", columnDefinition = "text")
    private String usedFor;

    @Column(name = "sensitivity", length = 100)
    private String sensitivity;

    @Column(name = "update_frequency", length = 100)
    private String updateFrequency;

    @Column(name = "missing_data_action", columnDefinition = "text")
    private String missingDataAction;

    @Column(name = "example_value", columnDefinition = "text")
    private String exampleValue;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}
