package com.backend.wealth.cases.chat.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
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
@Table(name = "case_chat_message")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseChatMessage {

    public static final String SENDER_USER = "USER";
    public static final String SENDER_ASSISTANT = "ASSISTANT";
    public static final String SENDER_SYSTEM = "SYSTEM";

    public static final String VISIBILITY_ALL = "ALL";
    public static final String VISIBILITY_INTERNAL = "INTERNAL";

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "thread_id", nullable = false)
    private CaseChatThread thread;

    @Column(name = "sender_kind", length = 16, nullable = false)
    private String senderKind;

    @Column(name = "actor_role", length = 32, nullable = false)
    private String actorRole;

    @Column(name = "visibility", length = 16, nullable = false)
    private String visibility;

    @Column(name = "phase_code", length = 50)
    private String phaseCode;

    @Column(name = "assessment_code", length = 64)
    private String assessmentCode;

    @Column(name = "body", nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "intent_code", length = 32)
    private String intentCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_snapshot", columnDefinition = "jsonb")
    private Map<String, Object> contextSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_payload", columnDefinition = "jsonb")
    private Map<String, Object> aiPayload;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (visibility == null || visibility.isBlank()) {
            visibility = VISIBILITY_ALL;
        }
    }
}
