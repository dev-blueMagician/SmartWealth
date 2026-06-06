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
@Table(name = "question_definition")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionDefinition {

    @Id
    @Column(name = "question_id", length = 32, nullable = false)
    private String questionId;

    @Column(name = "module", length = 100)
    private String module;

    @Column(name = "section", length = 100)
    private String section;

    @Column(name = "question_text", columnDefinition = "text")
    private String questionText;

    @Column(name = "answer_type", length = 50)
    private String answerType;

    @Column(name = "is_repeatable")
    private Boolean repeatable;

    @Column(name = "required_flag")
    private Boolean requiredFlag;

    @Column(name = "conditional_flag")
    private Boolean conditionalFlag;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (repeatable == null) {
            repeatable = false;
        }
    }
}
